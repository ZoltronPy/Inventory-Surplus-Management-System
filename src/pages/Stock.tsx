import { useState, useEffect, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table'
import { supabase } from '../lib/supabase'
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Warehouse, TrendingDown, AlertTriangle, Package } from 'lucide-react'
import { cn } from '../lib/utils'

type SortingState = Array<{ id: string; desc: boolean }>

interface StockRow {
  item_id: string
  available: number
  blocked: number
  allocated: number
  on_po: number
  warehouse_location: string | null
  items: {
    item_description: string
    category: string
    unit_price: number
    currency: string
  } | null
}

const columnHelper = createColumnHelper<StockRow>()

export default function Stock() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  useEffect(() => {
    fetchStock()
  }, [])

  async function fetchStock() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('stock')
        .select(`
          *,
          items(item_description, category, unit_price, currency)
        `)
      if (error) throw error
      setRows((data as StockRow[]) ?? [])
    } catch (err) {
      console.error('Error fetching stock:', err)
    } finally {
      setLoading(false)
    }
  }

  const summary = useMemo(() => {
    const totalAvailableValue = rows.reduce(
      (sum, r) => sum + r.available * (r.items?.unit_price ?? 0),
      0
    )
    const totalBlockedValue = rows.reduce(
      (sum, r) => sum + r.blocked * (r.items?.unit_price ?? 0),
      0
    )
    const totalOnPo = rows.reduce((sum, r) => sum + r.on_po, 0)
    const zeroStock = rows.filter(r => r.available === 0).length
    return { totalAvailableValue, totalBlockedValue, totalOnPo, zeroStock, total: rows.length }
  }, [rows])

  const fmt = (val: number, currency = 'CZK') =>
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val)

  const columns = useMemo(() => [
    columnHelper.accessor('item_id', {
      header: ({ column }) => (
        <button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>
          Item ID <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => <span className="font-mono font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor(row => row.items?.item_description ?? '—', {
      id: 'description',
      header: 'Description',
      cell: info => <div className="max-w-[260px] truncate">{info.getValue()}</div>,
    }),
    columnHelper.accessor(row => row.items?.category ?? '—', {
      id: 'category',
      header: 'Category',
      cell: info => <span className="text-muted-foreground text-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor('available', {
      header: ({ column }) => (
        <button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>
          Available <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => (
        <span className={cn('font-bold', info.getValue() === 0 && 'text-destructive')}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('blocked', {
      header: 'Blocked',
      cell: info => (
        <span className={cn('font-medium', info.getValue() > 0 && 'text-orange-500')}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('allocated', {
      header: 'Allocated',
      cell: info => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('on_po', {
      header: 'On PO',
      cell: info => (
        <span className={cn('font-medium', info.getValue() > 0 && 'text-blue-600')}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor(row => row.available * (row.items?.unit_price ?? 0), {
      id: 'stock_value',
      header: ({ column }) => (
        <button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>
          Stock Value <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => (
        <span className="font-medium text-xs">
          {fmt(info.getValue(), info.row.original.items?.currency ?? 'CZK')}
        </span>
      ),
    }),
    columnHelper.accessor('warehouse_location', {
      header: 'Location',
      cell: info => (
        <span className="text-muted-foreground text-xs font-mono">{info.getValue() ?? '—'}</span>
      ),
    }),
  ], [])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Stock Position</h2>
          <p className="text-muted-foreground">Current warehouse inventory overview.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search items..."
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-[280px]"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Total SKUs',
            value: summary.total,
            icon: <Package className="w-4 h-4" />,
            sub: 'in warehouse',
            color: 'text-primary',
          },
          {
            label: 'Available Value',
            value: fmt(summary.totalAvailableValue),
            icon: <Warehouse className="w-4 h-4" />,
            sub: 'at unit price',
            color: 'text-green-600',
          },
          {
            label: 'Blocked Value',
            value: fmt(summary.totalBlockedValue),
            icon: <AlertTriangle className="w-4 h-4" />,
            sub: 'requires resolution',
            color: 'text-orange-500',
          },
          {
            label: 'Zero Stock Items',
            value: summary.zeroStock,
            icon: <TrendingDown className="w-4 h-4" />,
            sub: 'available = 0',
            color: 'text-destructive',
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

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/50 border-b">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-muted-foreground italic">
                    No stock records found. Import Stock Position data in Settings.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-5 py-3.5 text-sm align-middle whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3.5 border-t flex items-center justify-between bg-muted/20 text-sm">
          <div className="text-muted-foreground">
            Showing {table.getRowModel().rows.length} of {rows.length} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 border rounded-lg bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 border rounded-lg bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
