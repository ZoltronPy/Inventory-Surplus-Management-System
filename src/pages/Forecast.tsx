import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Search, Calendar, BarChart2, TrendingUp, Package } from 'lucide-react'
import { cn } from '../lib/utils'
import { CURRENT_MONTH } from '../lib/calculationEngine'

interface ForecastItem {
  item_id: string
  item_description: string
  category: string
  monthly: Record<string, number>   // month -> qty
  total: number
  avg: number
  peak: number
}

export default function Forecast() {
  const [items, setItems] = useState<ForecastItem[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    fetchForecast()
  }, [])

  async function fetchForecast() {
    try {
      setLoading(true)
      const [{ data: forecasts }, { data: itemMeta }] = await Promise.all([
        supabase
          .from('forecasts')
          .select('item_id, month, forecast_qty')
          .gte('month', CURRENT_MONTH)
          .order('month', { ascending: true }),
        supabase.from('items').select('item_id, item_description, category'),
      ])

      if (!forecasts || forecasts.length === 0) {
        setItems([])
        setMonths([])
        return
      }

      // Collect unique months (sorted)
      const monthSet = new Set<string>()
      forecasts.forEach(f => monthSet.add(f.month))
      const sortedMonths = Array.from(monthSet).sort()
      setMonths(sortedMonths)

      // Meta index
      const metaById: Record<string, { item_description: string; category: string }> = {}
      ;(itemMeta ?? []).forEach((i: any) => { metaById[i.item_id] = i })

      // Pivot: item_id -> month -> qty
      const pivot: Record<string, Record<string, number>> = {}
      forecasts.forEach(f => {
        if (!pivot[f.item_id]) pivot[f.item_id] = {}
        pivot[f.item_id][f.month] = (pivot[f.item_id][f.month] ?? 0) + f.forecast_qty
      })

      const rows: ForecastItem[] = Object.entries(pivot).map(([item_id, monthly]) => {
        const vals = Object.values(monthly)
        const total = vals.reduce((s, v) => s + v, 0)
        const avg = vals.length > 0 ? total / vals.length : 0
        const peak = Math.max(...vals, 0)
        const meta = metaById[item_id]
        return {
          item_id,
          item_description: meta?.item_description ?? item_id,
          category: meta?.category ?? '—',
          monthly,
          total,
          avg: parseFloat(avg.toFixed(1)),
          peak,
        }
      })

      // Sort by total desc
      rows.sort((a, b) => b.total - a.total)
      setItems(rows)
    } catch (err) {
      console.error('Error fetching forecast:', err)
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(items.map(i => i.category))).sort()],
    [items]
  )

  const filtered = useMemo(() => {
    return items.filter(i => {
      const matchSearch =
        !search ||
        i.item_id.toLowerCase().includes(search.toLowerCase()) ||
        i.item_description.toLowerCase().includes(search.toLowerCase())
      const matchCat = categoryFilter === 'all' || i.category === categoryFilter
      return matchSearch && matchCat
    })
  }, [items, search, categoryFilter])

  // Column totals per month
  const monthTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    months.forEach(m => {
      totals[m] = filtered.reduce((s, i) => s + (i.monthly[m] ?? 0), 0)
    })
    return totals
  }, [filtered, months])

  const maxMonthTotal = useMemo(
    () => Math.max(...Object.values(monthTotals), 1),
    [monthTotals]
  )

  // Per-item max for heatmap intensity
  const globalMax = useMemo(
    () => Math.max(...items.flatMap(i => Object.values(i.monthly)), 1),
    [items]
  )

  const summary = useMemo(() => {
    const totalDemand = items.reduce((s, i) => s + i.total, 0)
    const skusWithForecast = items.length
    const next3Total = items.reduce((s, i) => {
      const next3 = months.slice(0, 3)
      return s + next3.reduce((ms, m) => ms + (i.monthly[m] ?? 0), 0)
    }, 0)
    const peakMonth = months.reduce(
      (best, m) => (monthTotals[m] > (monthTotals[best] ?? 0) ? m : best),
      months[0] ?? ''
    )
    return { totalDemand, skusWithForecast, next3Total, peakMonth }
  }, [items, months, monthTotals])

  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-')
    return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Demand Forecast</h2>
          <p className="text-muted-foreground">Monthly demand outlook per item.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-[220px]"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Months of Forecast',
            value: months.length,
            icon: <Calendar className="w-4 h-4" />,
            color: 'text-primary',
          },
          {
            label: 'SKUs with Forecast',
            value: summary.skusWithForecast,
            icon: <Package className="w-4 h-4" />,
            color: 'text-muted-foreground',
          },
          {
            label: 'Next 3 Months',
            value: summary.next3Total.toLocaleString(),
            icon: <TrendingUp className="w-4 h-4" />,
            color: 'text-green-600',
          },
          {
            label: 'Peak Month',
            value: summary.peakMonth ? fmtMonth(summary.peakMonth) : '—',
            icon: <BarChart2 className="w-4 h-4" />,
            color: 'text-orange-500',
          },
        ].map(card => (
          <div key={card.label} className="p-5 bg-card border rounded-xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <p className="text-xs font-medium uppercase tracking-wider">{card.label}</p>
              <span className={card.color}>{card.icon}</span>
            </div>
            <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Pivot Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2">
            <BarChart2 className="w-10 h-10 opacity-20" />
            <p className="italic text-sm">No forecast data. Import Demand Forecast in Settings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-muted/50 border-b sticky top-0">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[120px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    Item ID
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[180px]">
                    Description
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    Category
                  </th>
                  {months.map(m => (
                    <th
                      key={m}
                      className="px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap min-w-[70px]"
                    >
                      {fmtMonth(m)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap">
                    Total
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap">
                    Avg/mo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(item => (
                  <tr key={item.item_id} className="hover:bg-muted/30 transition-colors">
                    <td className="sticky left-0 z-10 bg-card px-4 py-2.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                      <Link
                        to={`/items/${item.item_id}`}
                        className="font-mono font-medium text-primary hover:underline text-xs"
                      >
                        {item.item_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate text-xs text-muted-foreground">
                      {item.item_description}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {item.category}
                    </td>
                    {months.map(m => {
                      const qty = item.monthly[m] ?? 0
                      const intensity = qty > 0 ? Math.min(qty / globalMax, 1) : 0
                      return (
                        <td key={m} className="px-3 py-2.5 text-right">
                          {qty > 0 ? (
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: `rgba(59, 130, 246, ${0.08 + intensity * 0.55})`,
                                color: intensity > 0.5 ? 'rgb(29, 78, 216)' : 'inherit',
                              }}
                            >
                              {qty}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-2.5 text-right font-bold text-xs">{item.total}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{item.avg}</td>
                  </tr>
                ))}
              </tbody>

              {/* Totals footer */}
              <tfoot className="border-t-2 bg-muted/40">
                <tr>
                  <td colSpan={3} className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    Column Total
                  </td>
                  {months.map(m => {
                    const total = monthTotals[m] ?? 0
                    const intensity = total > 0 ? total / maxMonthTotal : 0
                    return (
                      <td key={m} className="px-3 py-3 text-right">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${0.08 + intensity * 0.5})`,
                            color: 'rgb(21, 128, 61)',
                          }}
                        >
                          {total}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right font-bold text-xs">
                    {Object.values(monthTotals).reduce((s, v) => s + v, 0)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
            {filtered.length} of {items.length} items
          </div>
        )}
      </div>
    </div>
  )
}
