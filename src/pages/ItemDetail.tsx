import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Badge } from '../components/ui/Badge'
import {
  ArrowLeft,
  ChevronRight,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Save,
} from 'lucide-react'
import { cn } from '../lib/utils'

interface ItemDetailData {
  item_id: string
  item_description: string
  category: string
  line_status: string
  unit_price: number
  currency: string
  decision: string
  retention_pct: number
  moq: number
  lead_time_days: number
  stock: {
    available: number
    blocked: number
    allocated: number
    on_po: number
    warehouse_location: string
  } | null
  purchase_orders: Array<{
    po_number: string
    quantity: number
    delivery_date: string
    po_status: string
  }>
  forecasts: Array<{
    month: string
    forecast_qty: number
  }>
}

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ItemDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editedDecision, setEditedDecision] = useState('')
  const [editedRetention, setEditedRetention] = useState(0)

  useEffect(() => {
    if (id) fetchItemDetails(id)
  }, [id])

  async function fetchItemDetails(itemId: string) {
    try {
      setLoading(true)
      const { data: item, error: iError } = await supabase
        .from('items')
        .select(`
          *,
          stock(*),
          purchase_orders(*),
          forecasts(*)
        `)
        .eq('item_id', itemId)
        .single()

      if (iError) throw iError
      
      setData(item as any)
      setEditedDecision(item.decision || '')
      setEditedRetention(item.retention_pct || 0)
    } catch (err) {
      console.error('Error fetching item details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!id || !data) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('items')
        .update({
          decision: editedDecision,
          retention_pct: editedRetention
        })
        .eq('item_id', id)

      if (error) throw error
      setData({ ...data, decision: editedDecision, retention_pct: editedRetention })
    } catch (err) {
      console.error('Error saving decision:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[400px]">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  if (!data) return (
    <div className="p-12 text-center">
      <h2 className="text-xl font-semibold">Item not found</h2>
      <Link to="/items" className="text-primary hover:underline mt-4 inline-block">Back to Items</Link>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/items" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="w-3 h-3" /> Items
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium">{data.item_id}</span>
        </nav>
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight">{data.item_id}</h2>
          <Badge variant={data.line_status === 'phase_out' ? 'warning' : 'success'}>
            {data.line_status.replace('_', ' ')}
          </Badge>
        </div>
        <p className="text-muted-foreground">{data.item_description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Stock Position
              </h3>
              <span className="text-xs text-muted-foreground">Location: {data.stock?.warehouse_location || 'N/A'}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Available</p>
                <p className="text-2xl font-bold">{data.stock?.available || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Blocked</p>
                <p className="text-2xl font-bold text-destructive">{data.stock?.blocked || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Allocated</p>
                <p className="text-2xl font-bold text-orange-600">{data.stock?.allocated || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">On PO</p>
                <p className="text-2xl font-bold text-blue-600">{data.stock?.on_po || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4 border-l-4 border-l-primary">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Strategic Decision
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Resolution Action</label>
                <select 
                  value={editedDecision}
                  onChange={e => setEditedDecision(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-background text-sm"
                >
                  <option value="">Pending Selection</option>
                  <option value="keep">Keep (Maintain Supply)</option>
                  <option value="sell-back">Sell Back to Customer</option>
                  <option value="cancel-po">Cancel Open Orders</option>
                  <option value="write-off">Write-off / Scrap</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Retention Target (%)</label>
                  <span className="text-xs font-bold">{editedRetention}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={editedRetention}
                  onChange={e => setEditedRetention(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <button 
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col min-h-[400px]">
            <h3 className="font-semibold flex items-center gap-2 mb-6">
              <TrendingUp className="w-4 h-4 text-primary" />
              Demand Forecast (Monthly)
            </h3>
            <div className="flex-1 w-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-muted/5">
              <TrendingUp className="w-12 h-12 text-muted-foreground opacity-20 mb-4" />
              <p className="text-muted-foreground text-sm">Forecast Chart Temporarily Disabled</p>
              <p className="text-xs text-muted-foreground italic">(Resolving chart library compatibility)</p>
            </div>
          </div>

          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                Active Purchase Orders
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/10 text-muted-foreground border-b">
                    <th className="px-6 py-3 font-semibold uppercase text-[10px]">PO Number</th>
                    <th className="px-6 py-3 font-semibold uppercase text-[10px]">Qty</th>
                    <th className="px-6 py-3 font-semibold uppercase text-[10px]">Delivery</th>
                    <th className="px-6 py-3 font-semibold uppercase text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.purchase_orders.length > 0 ? (
                    data.purchase_orders.map(po => (
                      <tr key={po.po_number} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium">{po.po_number}</td>
                        <td className="px-6 py-4 font-bold">{po.quantity}</td>
                        <td className="px-6 py-4">{po.delivery_date}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="text-[10px]">
                            {po.po_status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground italic">
                        No active purchase orders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
