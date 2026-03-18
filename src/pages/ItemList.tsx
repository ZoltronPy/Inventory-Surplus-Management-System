import { useState, useEffect, useMemo } from 'react'
import { 
  useReactTable, 
  getCoreRowModel, 
  flexRender, 
  createColumnHelper,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel
} from '@tanstack/react-table'
import { supabase } from '../lib/supabase'
import { Badge } from '../components/ui/Badge'
import { Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown, Package, Info } from 'lucide-react'
import { cn } from '../lib/utils'
import { Link } from 'react-router-dom'

// Local type definition to avoid Vite runtime error with external type imports
type SortingState = Array<{ id: string; desc: boolean }>

interface ItemData {
  item_id: string
  item_description: string
  category: string
  line_status: string
  unit_price: number
  currency: string
  decision: string
  stock: {
    available: number
  } | null
}

const columnHelper = createColumnHelper<ItemData>()

export default function ItemList() {
  const [items, setItems] = useState<ItemData[]>([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          stock(available)
        `)
      
      if (error) throw error
      setItems(data as any[])
    } catch (err) {
      console.error('Error fetching items:', err)
    } finally {
      setLoading(false)
    }
  }

  const columns = useMemo(() => [
    columnHelper.accessor('item_id', {
      header: ({ column }) => (
        <button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>
          ID <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: info => <span className="font-mono font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('item_description', {
      header: 'Description',
      cell: info => <div className="max-w-[300px] truncate">{info.getValue()}</div>,
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: info => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    columnHelper.accessor('line_status', {
      header: 'Status',
      cell: info => {
        const val = info.getValue()?.toLowerCase() || 'tbd'
        let variant: any = 'outline'
        if (val === 'continue_supply') variant = 'success'
        if (val === 'phase_out') variant = 'warning'
        if (val === 'needs_resolution') variant = 'destructive'
        return <Badge variant={variant} className="capitalize">{val.replace('_', ' ')}</Badge>
      },
    }),
    columnHelper.accessor(row => row.stock?.available ?? 0, {
      id: 'available',
      header: 'Stock',
      cell: info => (
        <div className="flex items-center gap-2">
          <Package className="w-3 h-3 text-muted-foreground" />
          <span className={cn("font-medium", Number(info.getValue()) === 0 && "text-destructive")}>
            {info.getValue()}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor('unit_price', {
      header: 'Price',
      cell: info => (
        <span className="font-medium">
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: info.row.original.currency || 'CZK' }).format(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('decision', {
      header: 'Decision',
      cell: info => {
        const val = info.getValue()?.toLowerCase()
        return val ? (
          <Badge variant="secondary" className="capitalize">{val}</Badge>
        ) : (
          <span className="text-muted-foreground italic text-xs">Pending</span>
        )
      },
    }),
    columnHelper.display({
      id: 'actions',
      cell: info => (
        <Link 
          to={`/items/${info.row.original.item_id}`}
          className="p-2 hover:bg-muted rounded-lg transition-colors inline-block"
        >
          <Info className="w-4 h-4 text-primary" />
        </Link>
      )
    })
  ], [])

  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      globalFilter,
    },
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
          <h2 className="text-3xl font-bold tracking-tight">Items Master</h2>
          <p className="text-muted-foreground">Manage and track your inventory portfolio.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search items..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-[300px]"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-background text-sm font-medium hover:bg-muted transition-colors">
            <Filter className="w-4 h-4" />
            Category
          </button>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/50 border-b">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                      <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded w-3/4"></div></td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-muted-foreground italic">
                    No items found. Import some data in Settings.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4 text-sm align-middle whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/20 text-sm">
          <div className="text-muted-foreground">
            Showing {table.getRowModel().rows.length} of {items.length} items
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 border rounded-lg bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 font-medium">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
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
