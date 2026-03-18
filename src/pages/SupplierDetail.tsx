import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Badge } from '../components/ui/Badge'
import {
  ArrowLeft,
  ChevronRight,
  Package,
  ShoppingCart,
  Truck,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '../lib/utils'

interface SupplierData {
  supplier_id: string
  supplier_name: string
}

interface ItemRow {
  item_id: string
  item_description: string
  category: string
  line_status: string
  unit_price: number
  currency: string
  decision: string | null
  stock: { available: number; on_po: number }[] | null
}

interface PORow {
  po_number: string
  po_line: number
  item_id: string
  quantity: number
  delivery_date: string
  unit_price: number
  currency: string
  po_status: string
  cancel_flag: boolean
}

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>()
  const [supplier, setSupplier] = useState<SupplierData | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [orders, setOrders] = useState<PORow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchSupplier(id)
  }, [id])

  async function fetchSupplier(supplierId: string) {
    try {
      setLoading(true)
      const [{ data: sup }, { data: itemData }, { data: poData }] = await Promise.all([
        supabase
          .from('suppliers')
          .select('supplier_id, supplier_name')
          .eq('supplier_id', supplierId)
          .single(),
        supabase
          .from('items')
          .select('item_id, item_description, category, line_status, unit_price, currency, decision, stock(available, on_po)')
          .eq('supplier_id', supplierId),
        supabase
          .from('purchase_orders')
          .select('po_number, po_line, item_id, quantity, delivery_date, unit_price, currency, po_status, cancel_flag')
          .eq('supplier_id', supplierId)
          .order('delivery_date', { ascending: true }),
      ])

      setSupplier(sup as SupplierData)
      setItems((itemData ?? []) as ItemRow[])
      setOrders((poData ?? []) as PORow[])
    } catch (err) {
      console.error('Error fetching supplier:', err)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (val: number, currency = 'CZK') =>
    new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(val)

  const openOrders = orders.filter(o => o.po_status === 'open' && !o.cancel_flag)
  const totalStockValue = items.reduce((sum, i) => {
    const stock = Array.isArray(i.stock) ? i.stock[0] : i.stock
    return sum + (stock?.available ?? 0) * i.unit_price
  }, 0)
  const totalOpenPOValue = openOrders.reduce(
    (sum, o) => sum + o.quantity * o.unit_price,
    0
  )
  const currency = items[0]?.currency ?? 'CZK'

  if (loading)
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )

  if (!supplier)
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-semibold">Supplier not found</h2>
        <Link to="/suppliers" className="text-primary hover:underline mt-4 inline-block">
          Back to Suppliers
        </Link>
      </div>
    )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/suppliers" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="w-3 h-3" /> Suppliers
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium">{supplier.supplier_name}</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{supplier.supplier_name}</h2>
            <p className="text-muted-foreground font-mono text-sm">{supplier.supplier_id}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'SKUs', value: items.length, color: 'text-primary' },
          { label: 'Stock Value', value: fmt(totalStockValue, currency), color: 'text-green-600' },
          { label: 'Open PO Lines', value: openOrders.length, color: 'text-blue-600' },
          { label: 'Open PO Value', value: fmt(totalOpenPOValue, currency), color: 'text-blue-600' },
        ].map(c => (
          <div key={c.label} className="p-4 bg-card border rounded-xl shadow-sm space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.label}</p>
            <p className={cn('text-xl font-bold', c.color)}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Items */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Items ({items.length})</h3>
          </div>
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-muted/50 border-b">
                <tr>
                  {['Item ID', 'Description', 'Avail', 'Status', 'Decision'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                      No items found.
                    </td>
                  </tr>
                ) : (
                  items.map(item => {
                    const stock = Array.isArray(item.stock) ? item.stock[0] : item.stock
                    const ls = item.line_status?.toLowerCase() ?? 'tbd'
                    let lsVariant: any = 'outline'
                    if (ls === 'continue_supply') lsVariant = 'success'
                    if (ls === 'phase_out') lsVariant = 'warning'
                    if (ls === 'needs_resolution') lsVariant = 'destructive'
                    return (
                      <tr key={item.item_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            to={`/items/${item.item_id}`}
                            className="font-mono font-medium text-primary hover:underline text-xs"
                          >
                            {item.item_id}
                          </Link>
                        </td>
                        <td className="px-4 py-3 max-w-[180px] truncate">{item.item_description}</td>
                        <td className="px-4 py-3 font-bold">
                          <span className={cn(stock?.available === 0 && 'text-destructive')}>
                            {stock?.available ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={lsVariant} className="text-[10px] capitalize">
                            {ls.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {item.decision ? (
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {item.decision}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Pending</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Purchase Orders */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Purchase Orders ({orders.length})</h3>
            </div>
            {openOrders.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-orange-600 font-semibold">
                <AlertTriangle className="w-3 h-3" />
                {openOrders.length} open
              </span>
            )}
          </div>
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-muted/50 border-b">
                <tr>
                  {['PO Number', 'Item', 'Qty', 'Delivery', 'Value', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">
                      No purchase orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map(po => (
                    <tr
                      key={`${po.po_number}-${po.po_line}`}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        po.cancel_flag && 'opacity-50'
                      )}
                    >
                      <td className="px-4 py-3 font-mono font-medium text-xs">{po.po_number}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{po.item_id}</td>
                      <td className="px-4 py-3 font-bold">{po.quantity}</td>
                      <td className="px-4 py-3 text-xs">{po.delivery_date ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">{fmt(po.quantity * po.unit_price, po.currency)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            po.cancel_flag ? 'destructive' :
                            po.po_status === 'open' ? 'outline' :
                            'secondary'
                          }
                          className="text-[10px]"
                        >
                          {po.cancel_flag ? 'cancelled' : po.po_status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
