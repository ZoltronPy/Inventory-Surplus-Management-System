import { useState } from 'react'
import FileUpload from '../components/FileUpload'
import { Database, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'

export default function Settings() {
  const [data, setData] = useState<{ [key: string]: any[] }>({
    items: [],
    stock: [],
    orders: [],
    forecast: []
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [logs, setLogs] = useState<string[]>([])

  const handleDataLoaded = (loadedData: any[], type: string) => {
    setData(prev => ({ ...prev, [type]: loadedData }))
    addLog(`Loaded ${loadedData.length} rows for ${type}`)
  }

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
  }

  const syncToDatabase = async () => {
    setIsSyncing(true)
    setSyncStatus('syncing')
    addLog('Starting database synchronization...')

    try {
      // 1. Sync Suppliers first (deduplicated from items and orders)
      const suppliersMap = new Map()
      data.items.forEach(item => {
        if (item.supplier_id) suppliersMap.set(item.supplier_id, { supplier_id: item.supplier_id, supplier_name: item.supplier_name || item.supplier_id })
      })
      data.orders.forEach(order => {
        if (order.supplier_id) suppliersMap.set(order.supplier_id, { supplier_id: order.supplier_id, supplier_name: order.supplier_name || order.supplier_id })
      })
      
      if (suppliersMap.size > 0) {
        addLog(`Upserting ${suppliersMap.size} suppliers...`)
        const { error: sError } = await supabase.from('suppliers').upsert(Array.from(suppliersMap.values()))
        if (sError) throw sError
      }

      // 2. Sync Items
      if (data.items.length > 0) {
        addLog(`Upserting ${data.items.length} items...`)
        const itemsToUpsert = data.items.map(i => ({
          item_id: String(i.item_id),
          item_description: i.item_description || '',
          category: i.category,
          line_status: i.line_status || 'tbd',
          unit_price: i.unit_price,
          currency: i.currency || 'CZK',
          moq: i.moq,
          lead_time_days: i.lead_time_days,
          supplier_id: i.supplier_id,
          decision: i.decision,
          retention_pct: i.retention_pct || 0
        }))
        const { error: iError } = await supabase.from('items').upsert(itemsToUpsert)
        if (iError) throw iError
      }

      // 3. Sync Stock
      if (data.stock.length > 0) {
        addLog(`Upserting ${data.stock.length} stock records...`)
        const stockToUpsert = data.stock.map(s => ({
          item_id: String(s.item_id),
          available: s.available || 0,
          blocked: s.blocked || 0,
          allocated: s.allocated || 0,
          on_po: s.on_po || 0,
          warehouse_location: s.warehouse_location
        }))
        const { error: stError } = await supabase.from('stock').upsert(stockToUpsert)
        if (stError) throw stError
      }

      // 4. Sync Orders
      if (data.orders.length > 0) {
        addLog(`Syncing ${data.orders.length} purchase orders...`)
        const ordersToUpsert = data.orders.map(o => ({
          po_number: String(o.po_number),
          po_line: o.po_line || 1,
          item_id: String(o.item_id),
          quantity: o.quantity || 0,
          delivery_date: o.delivery_date,
          supplier_id: o.supplier_id,
          unit_price: o.unit_price,
          currency: o.currency,
          po_status: o.po_status || 'open',
          cancel_flag: o.cancel_flag === 'true' || o.cancel_flag === true
        }))
        const { error: poError } = await supabase.from('purchase_orders').upsert(ordersToUpsert)
        if (poError) throw poError
      }

      // 5. Sync Forecast
      if (data.forecast.length > 0) {
        addLog(`Syncing forecast data...`)
        const forecastsToUpsert: any[] = []
        data.forecast.forEach(row => {
          const itemId = String(row.item_id)
          Object.keys(row).forEach(key => {
            if (key.match(/^\d{4}-\d{2}$/)) { // YYYY-MM format
              forecastsToUpsert.push({
                item_id: itemId,
                month: key,
                forecast_qty: row[key] || 0
              })
            }
          })
          if (row.month && row.forecast_qty !== undefined) {
             forecastsToUpsert.push({
                item_id: itemId,
                month: String(row.month),
                forecast_qty: row.forecast_qty
              })
          }
        })
        
        if (forecastsToUpsert.length > 0) {
           const { error: fError } = await supabase.from('forecasts').upsert(forecastsToUpsert, { onConflict: 'item_id, month' })
           if (fError) throw fError
        }
      }

      setSyncStatus('success')
      addLog('Synchronization completed successfully!')
    } catch (err: any) {
      console.error(err)
      setSyncStatus('error')
      addLog(`ERROR: ${err.message || 'Unknown error during sync'}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const hasData = Object.values(data).some(arr => arr.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Data Management</h2>
          <p className="text-muted-foreground">Import and synchronize your master data files.</p>
        </div>
        <button 
          disabled={!hasData || isSyncing}
          onClick={syncToDatabase}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg",
            !hasData || isSyncing 
              ? "bg-muted text-muted-foreground cursor-not-allowed" 
              : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
          )}
        >
          {isSyncing ? (
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Database className="w-4 h-4" />
          )}
          Sync to Database
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FileUpload 
          title="P&A Master Data" 
          description="Items, descriptions, categories"
          type="items"
          onDataLoaded={handleDataLoaded}
        />
        <FileUpload 
          title="Stock Position" 
          description="Available, blocked, on PO"
          type="stock"
          onDataLoaded={handleDataLoaded}
        />
        <FileUpload 
          title="Purchase Orders" 
          description="Open orders and schedules"
          type="orders"
          onDataLoaded={handleDataLoaded}
        />
        <FileUpload 
          title="Demand Forecast" 
          description="Monthly requirements"
          type="forecast"
          onDataLoaded={handleDataLoaded}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border rounded-xl overflow-hidden shadow-sm flex flex-col h-[400px]">
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Synchronization Logs</h3>
            {syncStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            {syncStatus === 'error' && <AlertTriangle className="w-4 h-4 text-destructive" />}
          </div>
          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 bg-black/5">
            {logs.length === 0 ? (
              <p className="text-muted-foreground italic">No logs yet. Upload files and click Sync to begin.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={cn(
                  "py-0.5",
                  log.includes('ERROR') ? "text-destructive font-bold" : 
                  log.includes('successfully') ? "text-green-600 font-bold" : "text-muted-foreground"
                )}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-sm">Data Summary</h3>
          <div className="space-y-3">
            {[
              { label: 'Items', count: data.items.length, color: 'bg-blue-500' },
              { label: 'Stock records', count: data.stock.length, color: 'bg-green-500' },
              { label: 'Orders', count: data.orders.length, color: 'bg-orange-500' },
              { label: 'Forecast rows', count: data.forecast.length, color: 'bg-purple-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", item.color)}></div>
                  <span className="text-xs font-medium">{item.label}</span>
                </div>
                <span className="text-xs font-bold leading-none">{item.count}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed mt-4">
            * Ensure your files have the correct column headers as specified in the technical guide. 
            The system will attempt to deduplicate based on Primary Keys (item_id, po_number+po_line).
          </p>
        </div>
      </div>
    </div>
  )
}
