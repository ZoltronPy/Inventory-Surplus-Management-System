import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Package, TrendingUp, ShoppingCart, Layers } from 'lucide-react'
import { cn } from '../lib/utils'
import { CURRENT_MONTH } from '../lib/calculationEngine'

// ─── types ───────────────────────────────────────────────────────────────────

interface KpiData {
  totalItems:   number
  stockValue:   number
  openPoValue:  number
  openPoCount:  number
  activeCards:  number
}

interface ForecastBar {
  month: string
  qty:   number
}

interface DecisionSlice {
  name:  string
  value: number
  color: string
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtValue(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}K`
  return `€${v.toFixed(0)}`
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })
}

const DECISION_COLORS: Record<string, string> = {
  keep:        '#22c55e',
  'sell-back': '#f97316',
  'cancel-po': '#ef4444',
  'write-off': '#8b5cf6',
  monitor:     '#3b82f6',
  investigate: '#eab308',
  pending:     '#94a3b8',
}

const DECISION_LABELS: Record<string, string> = {
  keep:        'Keep',
  'sell-back': 'Sell Back',
  'cancel-po': 'Cancel PO',
  'write-off': 'Write Off',
  monitor:     'Monitor',
  investigate: 'Investigate',
  pending:     'Pending',
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [kpi, setKpi]                     = useState<KpiData | null>(null)
  const [forecastBars, setForecastBars]   = useState<ForecastBar[]>([])
  const [decisionSlices, setDecisionSlices] = useState<DecisionSlice[]>([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [
        { data: stockRows },
        { data: poRows },
        { count: activeCards },
        { count: totalItems },
        { data: forecasts },
        { data: items },
      ] = await Promise.all([
        supabase
          .from('stock')
          .select('available, items!inner(unit_price)'),
        supabase
          .from('purchase_orders')
          .select('order_qty, unit_price')
          .eq('status', 'open'),
        supabase
          .from('kanban_cards')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'done'),
        supabase
          .from('items')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('forecasts')
          .select('month, forecast_qty')
          .gte('month', CURRENT_MONTH)
          .order('month', { ascending: true }),
        supabase
          .from('items')
          .select('decision'),
      ])

      // Stock value: available * unit_price (joined)
      const stockValue = (stockRows ?? []).reduce((sum: number, row: any) => {
        return sum + (row.available ?? 0) * (row.items?.unit_price ?? 0)
      }, 0)

      // Open PO value & count
      const openPoValue = (poRows ?? []).reduce((sum: number, row: any) => {
        return sum + (row.order_qty ?? 0) * (row.unit_price ?? 0)
      }, 0)
      const openPoCount = (poRows ?? []).length

      setKpi({
        totalItems:  totalItems  ?? 0,
        stockValue,
        openPoValue,
        openPoCount,
        activeCards: activeCards ?? 0,
      })

      // Forecast bars — aggregate by month, max 12
      const monthMap: Record<string, number> = {}
      ;(forecasts ?? []).forEach((f: any) => {
        monthMap[f.month] = (monthMap[f.month] ?? 0) + f.forecast_qty
      })
      const bars: ForecastBar[] = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 12)
        .map(([month, qty]) => ({ month: fmtMonth(month), qty }))
      setForecastBars(bars)

      // Decision pie
      const decMap: Record<string, number> = {}
      ;(items ?? []).forEach((i: any) => {
        const key = i.decision ?? 'pending'
        decMap[key] = (decMap[key] ?? 0) + 1
      })
      const slices: DecisionSlice[] = Object.entries(decMap)
        .sort(([a], [b]) => (decMap[b] ?? 0) - (decMap[a] ?? 0))
        .map(([name, value]) => ({
          name:  DECISION_LABELS[name] ?? name,
          value,
          color: DECISION_COLORS[name] ?? '#94a3b8',
        }))
      setDecisionSlices(slices)

    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // KPI card definitions
  const kpiCards = kpi
    ? [
        {
          label: 'Total SKUs',
          value: kpi.totalItems.toLocaleString(),
          sub:   'Items in system',
          icon:  <Package className="w-4 h-4" />,
          color: 'text-primary',
        },
        {
          label: 'Stock Value',
          value: fmtValue(kpi.stockValue),
          sub:   'Available × unit price',
          icon:  <TrendingUp className="w-4 h-4" />,
          color: 'text-green-600',
        },
        {
          label: 'Open PO Value',
          value: fmtValue(kpi.openPoValue),
          sub:   `${kpi.openPoCount} open lines`,
          icon:  <ShoppingCart className="w-4 h-4" />,
          color: 'text-orange-500',
        },
        {
          label: 'Active Cards',
          value: kpi.activeCards.toLocaleString(),
          sub:   'Kanban in progress',
          icon:  <Layers className="w-4 h-4" />,
          color: 'text-blue-500',
        },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Inventory overview at a glance.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border px-3 py-1.5 rounded-md">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          System Stable
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-5 bg-card border rounded-xl shadow-sm h-[104px] animate-pulse bg-muted/40"
              />
            ))
          : kpiCards.map(card => (
              <div key={card.label} className="p-5 bg-card border rounded-xl shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <p className="text-xs font-medium uppercase tracking-wider">{card.label}</p>
                  <span className={card.color}>{card.icon}</span>
                </div>
                <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-tight">{card.sub}</p>
              </div>
            ))
        }
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

        {/* Bar chart — Monthly Forecast */}
        <div className="col-span-4 p-6 bg-card border rounded-xl shadow-sm">
          <h4 className="font-semibold">Monthly Demand Forecast</h4>
          <p className="text-xs text-muted-foreground mb-4">
            Upcoming {forecastBars.length} months — total units across all SKUs
          </p>
          {loading ? (
            <div className="h-64 animate-pulse bg-muted/30 rounded-lg" />
          ) : forecastBars.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground italic text-sm">
              No forecast data — import Demand Forecast in Settings.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={forecastBars} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                  cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                  formatter={(v: number) => [v.toLocaleString(), 'Forecast Qty']}
                />
                <Bar dataKey="qty" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart — Decision Distribution */}
        <div className="col-span-3 p-6 bg-card border rounded-xl shadow-sm">
          <h4 className="font-semibold">Decision Distribution</h4>
          <p className="text-xs text-muted-foreground mb-4">Items by saved decision status</p>
          {loading ? (
            <div className="h-64 animate-pulse bg-muted/30 rounded-lg" />
          ) : decisionSlices.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground italic text-sm">
              No items found.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={decisionSlices}
                  cx="50%"
                  cy="42%"
                  innerRadius={58}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {decisionSlices.map((slice, i) => (
                    <Cell key={i} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                  formatter={(v: number, name: string) => [v.toLocaleString(), name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  )
}
