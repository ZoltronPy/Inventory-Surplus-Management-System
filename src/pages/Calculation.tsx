import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { runCalculation, CURRENT_MONTH } from '../lib/calculationEngine'
import type { CalcResult, CalcInput } from '../lib/calculationEngine'
import { Badge } from '../components/ui/Badge'
import {
  Brain,
  AlertTriangle,
  TrendingDown,
  ShoppingCart,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Save,
  KanbanSquare,
} from 'lucide-react'
import { cn } from '../lib/utils'

type SortingState = Array<{ id: string; desc: boolean }>
type FilterTab = 'all' | 'sell-back' | 'cancel-po' | 'monitor' | 'investigate' | 'keep'

const columnHelper = createColumnHelper<CalcResult>()

const ACTION_META: Record<string, { label: string; variant: any }> = {
  'keep':        { label: 'Keep',       variant: 'success' },
  'sell-back':   { label: 'Sell Back',  variant: 'warning' },
  'cancel-po':   { label: 'Cancel PO',  variant: 'destructive' },
  'write-off':   { label: 'Write-off',  variant: 'destructive' },
  'monitor':     { label: 'Monitor',    variant: 'secondary' },
  'investigate': { label: 'Investigate',variant: 'outline' },
}

export default function Calculation() {
  const [results, setResults] = useState<CalcResult[]>([])
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'surplus_value', desc: true }])
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [sentToBoard, setSentToBoard] = useState<Set<string>>(new Set())

  const filteredResults = useMemo(
    () =>
      activeTab === 'all'
        ? results
        : results.filter(r => r.recommended_action === activeTab),
    [results, activeTab]
  )

  const summary = useMemo(() => {
    const surplusItems = results.filter(r => r.net_surplus_qty > 0)
    const totalSurplusValue = surplusItems.reduce((s, r) => s + r.surplus_value, 0)
    const sellBack = results.filter(r => r.recommended_action === 'sell-back').length
    const cancelPo = results.filter(r => r.recommended_action === 'cancel-po').length
    const monitor = results.filter(r => r.recommended_action === 'monitor').length
    return { totalSurplusValue, sellBack, cancelPo, monitor, total: results.length }
  }, [results])

  async function handleRecalculate() {
    setLoading(true)
    try {
      // 1. Fetch all items with stock
      const { data: items, error: iErr } = await supabase
        .from('items')
        .select('*, stock(available, blocked, on_po)')
      if (iErr) throw iErr

      // 2. Fetch forecasts >= current month
      const { data: forecasts, error: fErr } = await supabase
        .from('forecasts')
        .select('item_id, month, forecast_qty')
        .gte('month', CURRENT_MONTH)
      if (fErr) throw fErr

      // 3. Fetch open POs (not cancelled)
      const { data: orders, error: oErr } = await supabase
        .from('purchase_orders')
        .select('item_id, quantity, po_status, cancel_flag')
        .eq('po_status', 'open')
      if (oErr) throw oErr

      // Index forecasts by item
      const forecastByItem: Record<string, number[]> = {}
      ;(forecasts ?? []).forEach(f => {
        if (!forecastByItem[f.item_id]) forecastByItem[f.item_id] = []
        forecastByItem[f.item_id].push(f.forecast_qty)
      })

      // Index open POs by item
      const openPOByItem: Record<string, { total: number; count: number; cancellable: number }> = {}
      ;(orders ?? []).forEach(o => {
        if (!openPOByItem[o.item_id]) openPOByItem[o.item_id] = { total: 0, count: 0, cancellable: 0 }
        const qty = o.quantity ?? 0
        openPOByItem[o.item_id].total += qty
        openPOByItem[o.item_id].count += 1
        if (!o.cancel_flag) openPOByItem[o.item_id].cancellable += qty
      })

      // Build inputs
      const inputs: CalcInput[] = (items ?? []).map((item: any) => {
        const stock = Array.isArray(item.stock) ? item.stock[0] : item.stock
        const fMonths = forecastByItem[item.item_id] ?? []
        const fTotal = fMonths.reduce((s: number, v: number) => s + v, 0)
        const fAvg = fMonths.length > 0 ? fTotal / fMonths.length : 0
        const po = openPOByItem[item.item_id] ?? { total: 0, count: 0, cancellable: 0 }

        return {
          item_id: item.item_id,
          item_description: item.item_description,
          category: item.category,
          line_status: item.line_status ?? 'tbd',
          unit_price: item.unit_price ?? 0,
          currency: item.currency ?? 'CZK',
          decision: item.decision,
          retention_pct: item.retention_pct ?? 0,
          available: stock?.available ?? 0,
          blocked: stock?.blocked ?? 0,
          on_po: stock?.on_po ?? 0,
          open_po_qty: po.total,
          open_po_count: po.count,
          cancellable_po_qty: po.cancellable,
          forecast_total: fTotal,
          forecast_count: fMonths.length,
          forecast_avg: parseFloat(fAvg.toFixed(2)),
        }
      })

      const calcResults = runCalculation(inputs)
      setResults(calcResults)

      // Seed overrides from existing decisions
      const ov: Record<string, string> = {}
      calcResults.forEach(r => {
        if (r.decision) ov[r.item_id] = r.decision
      })
      setOverrides(ov)
      setLastRun(new Date())
    } catch (err) {
      console.error('Calculation error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function saveDecision(item_id: string) {
    const action = overrides[item_id]
    const prev_decision = results.find(r => r.item_id === item_id)?.decision ?? null
    setSaving(prev => new Set(prev).add(item_id))
    try {
      const { error } = await supabase
        .from('items')
        .update({ decision: action })
        .eq('item_id', item_id)
      if (error) throw error
      setResults(prev =>
        prev.map(r => (r.item_id === item_id ? { ...r, decision: action } : r))
      )
      logActivity({
        entity_type: 'item',
        entity_id: item_id,
        action: 'decision_saved',
        from_value: prev_decision ?? undefined,
        to_value: action,
      })
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(prev => {
        const next = new Set(prev)
        next.delete(item_id)
        return next
      })
    }
  }

  // Map engine action → kanban card_type
  const ACTION_TO_CARD_TYPE: Record<string, string> = {
    'sell-back':   'sell_back',
    'cancel-po':   'cancel_order',
    'investigate': 'issue',
    'monitor':     'item',
    'keep':        'item',
    'write-off':   'item',
  }

  async function sendToBoard(item: CalcResult) {
    const card_type = ACTION_TO_CARD_TYPE[item.recommended_action] ?? 'item'
    const priority  = item.urgency === 'high' ? 'high' : item.urgency === 'medium' ? 'medium' : 'low'

    const { error } = await supabase.from('kanban_cards').insert({
      card_type,
      status:       'backlog',
      title:        `${ACTION_META[item.recommended_action]?.label ?? 'Action'}: ${item.item_id}`,
      item_id:      item.item_id,
      description:  item.item_description,
      priority,
      value_impact: item.surplus_value > 0 ? item.surplus_value : null,
    })
    if (error) { console.error(error); return }

    setSentToBoard(prev => new Set(prev).add(item.item_id))
    logActivity({
      entity_type: 'item',
      entity_id:   item.item_id,
      action:      'sent_to_board',
      to_value:    card_type,
      notes:       `Surplus value: ${item.surplus_value}`,
    })
  }

  const fmt = (val: number, currency = 'CZK') =>
    new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(val)

  const columns = useMemo(
    () => [
      columnHelper.accessor('item_id', {
        header: 'Item ID',
        cell: info => <span className="font-mono font-medium text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('item_description', {
        header: 'Description',
        cell: info => <div className="max-w-[220px] truncate text-sm">{info.getValue()}</div>,
      }),
      columnHelper.accessor('available', {
        header: 'Avail',
        cell: info => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor('on_po', {
        header: 'On PO',
        cell: info => <span className="text-blue-600 font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor('forecast_total', {
        header: 'Forecast',
        cell: info => (
          <span className="text-muted-foreground">{info.getValue() || '—'}</span>
        ),
      }),
      columnHelper.accessor('coverage_months', {
        header: 'Coverage',
        cell: info => {
          const v = info.getValue()
          if (v === null) return <span className="text-muted-foreground italic text-xs">∞</span>
          return (
            <span
              className={cn(
                'font-medium',
                v > 24 ? 'text-destructive' : v > 12 ? 'text-orange-500' : 'text-green-600'
              )}
            >
              {v} mo
            </span>
          )
        },
      }),
      columnHelper.accessor('net_surplus_qty', {
        header: 'Surplus Qty',
        cell: info => (
          <span className={cn('font-bold', info.getValue() > 0 && 'text-destructive')}>
            {info.getValue() > 0 ? info.getValue() : '—'}
          </span>
        ),
      }),
      columnHelper.accessor('surplus_value', {
        id: 'surplus_value',
        header: 'Surplus €',
        cell: info => (
          <span className={cn('font-medium text-xs', info.getValue() > 0 && 'text-destructive font-bold')}>
            {info.getValue() > 0 ? fmt(info.getValue(), info.row.original.currency) : '—'}
          </span>
        ),
      }),
      columnHelper.accessor('recommended_action', {
        header: 'Recommended',
        cell: info => {
          const m = ACTION_META[info.getValue()] ?? ACTION_META['keep']
          return (
            <Badge variant={m.variant} className="text-[10px] whitespace-nowrap">
              {m.label}
            </Badge>
          )
        },
      }),
      columnHelper.accessor('urgency', {
        header: 'Urgency',
        cell: info => {
          const v = info.getValue()
          return (
            <span
              className={cn(
                'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                v === 'high' ? 'bg-red-100 text-red-700' :
                v === 'medium' ? 'bg-orange-100 text-orange-700' :
                'bg-muted text-muted-foreground'
              )}
            >
              {v}
            </span>
          )
        },
      }),
      columnHelper.display({
        id: 'board',
        header: 'Board',
        cell: ({ row }) => {
          const item = row.original
          const sent = sentToBoard.has(item.item_id)
          return (
            <button
              disabled={sent}
              onClick={() => sendToBoard(item)}
              title={sent ? 'Already sent to board' : 'Send to Planning Board'}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                sent
                  ? 'text-green-600 cursor-default'
                  : 'hover:bg-primary/10 text-muted-foreground hover:text-primary'
              )}
            >
              <KanbanSquare className="w-4 h-4" />
            </button>
          )
        },
      }),
      columnHelper.display({
        id: 'action',
        header: 'Decision',
        cell: ({ row }) => {
          const item = row.original
          const current = overrides[item.item_id] ?? item.recommended_action
          const isDirty = current !== item.decision
          return (
            <div className="flex items-center gap-2">
              <select
                value={current}
                onChange={e =>
                  setOverrides(prev => ({ ...prev, [item.item_id]: e.target.value }))
                }
                className="text-xs border rounded px-2 py-1 bg-background"
              >
                {Object.entries(ACTION_META).map(([val, m]) => (
                  <option key={val} value={val}>{m.label}</option>
                ))}
              </select>
              <button
                disabled={!isDirty || saving.has(item.item_id)}
                onClick={() => saveDecision(item.item_id)}
                className={cn(
                  'p-1.5 rounded transition-all',
                  isDirty
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                )}
              >
                {saving.has(item.item_id) ? (
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
              </button>
            </div>
          )
        },
      }),
    ],
    [overrides, saving, sentToBoard]
  )

  const table = useReactTable({
    data: filteredResults,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: results.length },
    { key: 'sell-back', label: 'Sell Back', count: summary.sellBack },
    { key: 'cancel-po', label: 'Cancel PO', count: summary.cancelPo },
    { key: 'monitor', label: 'Monitor', count: summary.monitor },
    {
      key: 'investigate',
      label: 'Investigate',
      count: results.filter(r => r.recommended_action === 'investigate').length,
    },
    { key: 'keep', label: 'Keep', count: results.filter(r => r.recommended_action === 'keep').length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" />
            The Brain
          </h2>
          <p className="text-muted-foreground">
            Surplus analysis engine.{' '}
            {lastRun && (
              <span className="text-xs">
                Last run: {lastRun.toLocaleTimeString('cs-CZ')}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setResults([]); setOverrides({}); setLastRun(null) }}
            disabled={loading || results.length === 0}
            className="border px-4 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40"
          >
            Reset
          </button>
          <button
            onClick={handleRecalculate}
            disabled={loading}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-semibold shadow hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            {loading ? 'Calculating…' : 'Recalculate'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Total Surplus Value',
              value: fmt(summary.totalSurplusValue),
              icon: <TrendingDown className="w-4 h-4" />,
              sub: 'net of retention',
              color: 'text-destructive',
            },
            {
              label: 'Sell Back',
              value: summary.sellBack,
              icon: <ShoppingCart className="w-4 h-4" />,
              sub: 'items to return',
              color: 'text-orange-500',
            },
            {
              label: 'Cancel PO',
              value: summary.cancelPo,
              icon: <AlertTriangle className="w-4 h-4" />,
              sub: 'open orders to cancel',
              color: 'text-red-600',
            },
            {
              label: 'Items OK',
              value: summary.total - summary.sellBack - summary.cancelPo - summary.monitor,
              icon: <CheckCircle2 className="w-4 h-4" />,
              sub: 'no action needed',
              color: 'text-green-600',
            },
          ].map(card => (
            <div key={card.label} className="p-5 bg-card border rounded-xl shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <p className="text-xs font-medium uppercase tracking-wider">{card.label}</p>
                <span className={card.color}>{card.icon}</span>
              </div>
              <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tight">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !loading && (
        <div className="bg-accent/50 border border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Brain className="w-8 h-8 text-primary/40" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Ready to Analyse</h3>
            <p className="text-muted-foreground max-w-sm mt-1 text-sm">
              Click <strong>Recalculate</strong> to run the surplus engine across all items, stock, and forecasts.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {results.length > 0 && (
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-4 pt-4 border-b pb-0 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-3 py-2 text-xs font-semibold rounded-t-md border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab.key
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                <span className="ml-1.5 bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full text-[10px]">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted/50 border-b">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-6 py-10 text-center text-muted-foreground italic"
                    >
                      No items in this category.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr
                      key={row.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        row.original.urgency === 'high' && 'bg-red-50/30'
                      )}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          className="px-4 py-3 text-sm align-middle whitespace-nowrap"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3.5 border-t flex items-center justify-between bg-muted/20 text-sm">
            <div className="text-muted-foreground text-xs">
              Showing {table.getRowModel().rows.length} of {filteredResults.length} items
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 border rounded-lg bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium text-xs">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 border rounded-lg bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
