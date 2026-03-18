import { useState, useEffect, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Search, ArrowUpDown, Info, Truck, Package, ShoppingCart, TrendingDown } from 'lucide-react'
import { cn } from '../lib/utils'

type SortingState = Array<{ id: string; desc: boolean }>

interface SupplierRow {
  supplier_id: string
  supplier_name: string
  item_count: number
  stock_value: number
  open_po_count: number
  open_po_value: number
  currency: string
}

const columnHelper = createColumnHelper<SupplierRow>()

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'stock_value', desc: true }])
  const [globalFilter, setGlobalFilter] = useState('')

  useEffect(() => {
    fetchSuppliers()
  }, [])

  async function fetchSuppliers() {
    try {
      setLoading(true)

      const [{ data: rawSuppliers }, { data: items }, { data: orders }] = await Promise.all([
        supabase.from('suppliers').select('supplier_id, supplier_name'),
        supabase.from('items').select('item_id, supplier_id, unit_price, currency, stock(available)'),
        supabase
          .from('purchase_orders')
          .select('supplier_id, quantity, unit_price, currency, po_status')
          .eq('po_status', 'open'),
      ])

      const itemsBySup: Record<string, any[]> = {}
      ;(items ?? []).forEach((i: any) => {
        if (!itemsBySup[i.supplier_id]) itemsBySup[i.supplier_id] = []
        itemsBySup[i.supplier_id].push(i)
      })

      const ordersBySup: Record<string, any[]> = {}
      ;(orders ?? []).forEach((o: any) => {
        if (!ordersBySup[o.supplier_id]) ordersBySup[o.supplier_id] = []
        ordersBySup[o.supplier_id].push(o)
      })

      const rows: SupplierRow[] = (rawSuppliers ?? []).map((s: any) => {
        const supItems = itemsBySup[s.supplier_id] ?? []
        const supOrders = ordersBySup[s.supplier_id] ?? []

        const stock_value = supItems.reduce((sum: number, i: any) => {
          const avail = Array.isArray(i.stock)
            ? (i.stock[0]?.available ?? 0)
            : (i.stock?.available ?? 0)
          return sum + avail * (i.unit_price ?? 0)
        }, 0)

        const open_po_value = supOrders.reduce(
          (sum: number, o: any) => sum + (o.quantity ?? 0) * (o.unit_price ?? 0),
          0
        )

        const currency = supItems[0]?.currency ?? supOrders[0]?.currency ?? 'CZK'

        return {
          supplier_id: s.supplier_id,
          supplier_name: s.supplier_name ?? s.supplier_id,
          item_count: supItems.length,
          stock_value,
          open_po_count: supOrders.length,
          open_po_value,
          currency,
        }
      })

      setSuppliers(rows)
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    } finally {
      setLoading(false)
    }
  }

  const summary = useMemo(
    () => ({
      total: suppliers.length,
      totalItems: suppliers.reduce((s, r) => s + r.item_count, 0),
      totalStockValue: suppliers.reduce((s, r) => s + r.stock_value, 0),
      totalOpenPOs: suppliers.reduce((s, r) => s + r.open_po_count, 0),
    }),
    [suppliers]
  )

  const fmt = (val: number, currency = 'CZK') =>
    new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(val)

  const columns = useMemo(
    () => [
      columnHelper.accessor('supplier_id', {
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>
            Supplier ID <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: info => <span className="font-mono font-medium text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('supplier_name', {
        header: 'Name',
        cell: info => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor('item_count', {
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>
            Items <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: info => (
          <div className="flex items-center gap-1.5">
            <Package className="w-3 h-3 text-muted-foreground" />
            <span className="font-medium">{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('stock_value', {
        id: 'stock_value',
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>
            Stock Value <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: info => (
          <span className="font-medium text-xs">
            {fmt(info.getValue(), info.row.original.currency)}
          </span>
        ),
      }),
      columnHelper.accessor('open_po_count', {
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>
            Open POs <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: info => (
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="w-3 h-3 text-muted-foreground" />
            <span className={cn('font-medium', info.getValue() > 0 && 'text-blue-600')}>
              {info.getValue()}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor('open_po_value', {
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>
            PO Value <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: info => (
          <span className={cn('text-xs font-medium', info.getValue() > 0 && 'text-blue-600')}>
            {info.getValue() > 0
              ? fmt(info.getValue(), info.row.original.currency)
              : '—'}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        cell: ({ row }) => (
          <Link
            to={`/suppliers/${row.original.supplier_id}`}
            className="p-2 hover:bg-muted rounded-lg transition-colors inline-block"
          >
            <Info className="w-4 h-4 text-primary" />
          </Link>
        ),
      }),
    ],
    []
  )

  const table = useReactTable({
    data: suppliers,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Suppliers</h2>
          <p className="text-muted-foreground">Overview of all supply partners.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-[260px]"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Total Suppliers',
            value: summary.total,
            icon: <Truck className="w-4 h-4" />,
            color: 'text-primary',
          },
          {
            label: 'Total SKUs',
            value: summary.totalItems,
            icon: <Package className="w-4 h-4" />,
            color: 'text-muted-foreground',
          },
          {
            label: 'Total Stock Value',
            value: fmt(summary.totalStockValue),
            icon: <TrendingDown className="w-4 h-4" />,
            color: 'text-green-600',
          },
          {
            label: 'Open PO Lines',
            value: summary.totalOpenPOs,
            icon: <ShoppingCart className="w-4 h-4" />,
            color: 'text-blue-600',
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
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
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
                  <td
                    colSpan={columns.length}
                    className="px-5 py-12 text-center text-muted-foreground italic"
                  >
                    No suppliers found. Import data in Settings.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className="px-5 py-3.5 text-sm align-middle whitespace-nowrap"
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
        <div className="px-5 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
          {table.getRowModel().rows.length} of {suppliers.length} suppliers
        </div>
      </div>
    </div>
  )
}
