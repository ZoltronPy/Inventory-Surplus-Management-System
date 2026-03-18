import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Download, RefreshCw, FileText, ShoppingCart, Activity } from 'lucide-react'
import { cn } from '../lib/utils'

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csv, ''], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── types ────────────────────────────────────────────────────────────────────

type Tab = 'actions' | 'openpo' | 'activity'

interface ActionRow {
  'Item ID':       string
  Description:     string
  Category:        string
  'Line Status':   string
  Decision:        string
  Available:       number
  'Unit Price':    number
  'Est. Value':    string
}

interface PoRow {
  'PO Number':      string
  'Item ID':        string
  Description:      string
  'Order Qty':      number
  'Delivered Qty':  number
  'Open Qty':       number
  'Unit Price':     number
  'Open Value':     string
  'Delivery Date':  string
  Status:           string
}

interface ActivityRow {
  Timestamp:      string
  'Entity Type':  string
  'Entity ID':    string
  Action:         string
  'From':         string
  'To':           string
  Notes:          string
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const DECISION_COLOR: Record<string, string> = {
  'sell-back':  'bg-orange-100 text-orange-700',
  'cancel-po':  'bg-red-100 text-red-700',
  'write-off':  'bg-purple-100 text-purple-700',
  'monitor':    'bg-blue-100 text-blue-700',
  'investigate':'bg-yellow-100 text-yellow-700',
  'keep':       'bg-green-100 text-green-700',
}

function fmtValue(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(1)}K`
  return `€${n.toFixed(2)}`
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>('actions')
  const [loading,   setLoading]   = useState(true)

  const [actionRows,   setActionRows]   = useState<ActionRow[]>([])
  const [poRows,       setPoRows]       = useState<PoRow[]>([])
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [
        { data: items },
        { data: stockData },
        { data: pos },
        { data: activity },
      ] = await Promise.all([
        supabase
          .from('items')
          .select('item_id, item_description, category, unit_price, line_status, decision')
          .not('decision', 'is', null)
          .order('item_id'),
        supabase
          .from('stock')
          .select('item_id, available'),
        supabase
          .from('purchase_orders')
          .select('item_id, po_number, order_qty, delivered_qty, unit_price, delivery_date, status, items(item_description)')
          .eq('status', 'open')
          .order('delivery_date', { ascending: true }),
        supabase
          .from('activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
      ])

      // Build stock index
      const stockIdx: Record<string, number> = {}
      ;(stockData ?? []).forEach((s: any) => { stockIdx[s.item_id] = s.available ?? 0 })

      // Action rows
      const aRows: ActionRow[] = (items ?? []).map((i: any) => {
        const avail = stockIdx[i.item_id] ?? 0
        const estVal = avail * (i.unit_price ?? 0)
        return {
          'Item ID':      i.item_id,
          Description:    i.item_description ?? '',
          Category:       i.category ?? '—',
          'Line Status':  i.line_status ?? '—',
          Decision:       i.decision ?? '—',
          Available:      avail,
          'Unit Price':   i.unit_price ?? 0,
          'Est. Value':   fmtValue(estVal),
        }
      })
      setActionRows(aRows)

      // PO rows
      const pRows: PoRow[] = (pos ?? []).map((p: any) => {
        const openQty  = (p.order_qty ?? 0) - (p.delivered_qty ?? 0)
        const openVal  = openQty * (p.unit_price ?? 0)
        const desc     = (p.items as any)?.item_description ?? p.item_id
        return {
          'PO Number':      p.po_number ?? '—',
          'Item ID':        p.item_id,
          Description:      desc,
          'Order Qty':      p.order_qty ?? 0,
          'Delivered Qty':  p.delivered_qty ?? 0,
          'Open Qty':       openQty,
          'Unit Price':     p.unit_price ?? 0,
          'Open Value':     fmtValue(openVal),
          'Delivery Date':  fmtDate(p.delivery_date),
          Status:           p.status ?? '—',
        }
      })
      setPoRows(pRows)

      // Activity rows
      const actRows: ActivityRow[] = (activity ?? []).map((a: any) => ({
        Timestamp:      fmtDate(a.created_at ?? a.timestamp),
        'Entity Type':  a.entity_type ?? '—',
        'Entity ID':    a.entity_id   ?? '—',
        Action:         a.action      ?? '—',
        'From':         a.from_value  ?? '',
        'To':           a.to_value    ?? '',
        Notes:          a.notes       ?? '',
      }))
      setActivityRows(actRows)

    } catch (err) {
      console.error('Reports fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'actions',  label: 'Action Report',  icon: <FileText   className="w-4 h-4" />, count: actionRows.length   },
    { id: 'openpo',   label: 'Open POs',        icon: <ShoppingCart className="w-4 h-4" />, count: poRows.length       },
    { id: 'activity', label: 'Activity Log',    icon: <Activity   className="w-4 h-4" />, count: activityRows.length },
  ]

  const exportMap: Record<Tab, { filename: string; rows: Record<string, unknown>[] }> = {
    actions:  { filename: 'action-report.csv',  rows: actionRows   as unknown as Record<string, unknown>[] },
    openpo:   { filename: 'open-po-report.csv', rows: poRows       as unknown as Record<string, unknown>[] },
    activity: { filename: 'activity-log.csv',   rows: activityRows as unknown as Record<string, unknown>[] },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reports & Exports</h2>
          <p className="text-muted-foreground">Preview and download data as CSV.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm bg-card hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={() => {
              const { filename, rows } = exportMap[activeTab]
              exportCsv(filename, rows)
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
            {!loading && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'actions'  && <ActionTable  rows={actionRows}   />}
            {activeTab === 'openpo'   && <PoTable       rows={poRows}       />}
            {activeTab === 'activity' && <ActivityTable rows={activityRows} />}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Action Report table ──────────────────────────────────────────────────────

function ActionTable({ rows }: { rows: ActionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2">
        <FileText className="w-10 h-10 opacity-20" />
        <p className="italic text-sm">No items with a saved decision yet.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            {['Item ID','Description','Category','Line Status','Decision','Available','Unit Price','Est. Value'].map(h => (
              <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2.5 font-mono text-xs font-medium text-primary">{r['Item ID']}</td>
              <td className="px-4 py-2.5 text-xs max-w-[200px] truncate">{r.Description}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.Category}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{r['Line Status']}</td>
              <td className="px-4 py-2.5">
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  DECISION_COLOR[r.Decision] ?? 'bg-muted text-muted-foreground'
                )}>
                  {r.Decision}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-right">{r.Available.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-xs text-right">€{r['Unit Price'].toFixed(2)}</td>
              <td className="px-4 py-2.5 text-xs text-right font-medium">{r['Est. Value']}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
        {rows.length} items with saved decisions
      </div>
    </div>
  )
}

// ─── Open PO table ────────────────────────────────────────────────────────────

function PoTable({ rows }: { rows: PoRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2">
        <ShoppingCart className="w-10 h-10 opacity-20" />
        <p className="italic text-sm">No open purchase orders.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            {['PO Number','Item ID','Description','Order Qty','Delivered','Open Qty','Unit Price','Open Value','Delivery Date'].map(h => (
              <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2.5 font-mono text-xs font-medium">{r['PO Number']}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-primary">{r['Item ID']}</td>
              <td className="px-4 py-2.5 text-xs max-w-[180px] truncate text-muted-foreground">{r.Description}</td>
              <td className="px-4 py-2.5 text-xs text-right">{r['Order Qty'].toLocaleString()}</td>
              <td className="px-4 py-2.5 text-xs text-right text-muted-foreground">{r['Delivered Qty'].toLocaleString()}</td>
              <td className="px-4 py-2.5 text-xs text-right font-medium">{r['Open Qty'].toLocaleString()}</td>
              <td className="px-4 py-2.5 text-xs text-right">€{r['Unit Price'].toFixed(2)}</td>
              <td className="px-4 py-2.5 text-xs text-right font-medium text-orange-600">{r['Open Value']}</td>
              <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground">{r['Delivery Date']}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
        {rows.length} open PO lines
      </div>
    </div>
  )
}

// ─── Activity Log table ───────────────────────────────────────────────────────

function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2">
        <Activity className="w-10 h-10 opacity-20" />
        <p className="italic text-sm">No activity recorded yet.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            {['Timestamp','Entity Type','Entity ID','Action','From','To','Notes'].map(h => (
              <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.Timestamp}</td>
              <td className="px-4 py-2.5 text-xs">{r['Entity Type']}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-primary">{r['Entity ID']?.slice(0, 8)}</td>
              <td className="px-4 py-2.5">
                <span className="text-xs bg-muted px-2 py-0.5 rounded">{r.Action}</span>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{r['From'] || '—'}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{r['To'] || '—'}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">{r.Notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
        {rows.length} log entries (last 200)
      </div>
    </div>
  )
}
