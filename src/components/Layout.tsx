import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Truck,
  TrendingUp,
  Boxes,
  Brain,
  Kanban,
  FileText,
  Search,
  Settings,
  Sun,
  Moon,
} from 'lucide-react'
import { cn } from '../lib/utils'

// ─── navigation structure ─────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'Data',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Items',     href: '/items',     icon: Package          },
      { name: 'Suppliers', href: '/suppliers', icon: Truck            },
      { name: 'Stock',     href: '/stock',     icon: Boxes            },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { name: 'Forecast',  href: '/forecast',     icon: TrendingUp },
      { name: 'The Brain', href: '/calculation',  icon: Brain      },
    ],
  },
  {
    label: 'Actions',
    items: [
      { name: 'Planning', href: '/planning', icon: Kanban   },
      { name: 'Reports',  href: '/reports',  icon: FileText },
    ],
  },
]

const ALL_NAV = NAV_GROUPS.flatMap(g => g.items).concat([
  { name: 'Settings', href: '/settings', icon: Settings },
])

// ─── dark mode hook ───────────────────────────────────────────────────────────

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, setDark] as const
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Layout() {
  const location = useLocation()
  const [dark, setDark] = useDarkMode()

  // Current page label for header
  const currentPage =
    ALL_NAV.find(item => location.pathname.startsWith(item.href))?.name ?? 'Antigravity'

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 border-r bg-card flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b">
          <h1 className="text-xl font-bold tracking-tight text-primary">Antigravity</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest font-semibold">
            Surplus Management
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-4 px-3">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Settings at bottom */}
        <div className="px-3 pb-4 border-t pt-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0">
          {/* Page title */}
          <p className="text-sm font-semibold text-foreground">{currentPage}</p>

          <div className="flex items-center gap-3">
            {/* Global search */}
            <div className="flex items-center bg-muted/50 rounded-lg px-3 py-1.5 w-72 border transition-all focus-within:ring-2 focus-within:ring-ring focus-within:bg-card">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search items, suppliers..."
                className="bg-transparent border-none text-sm w-full ml-2 outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(d => !d)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="h-6 w-px bg-border" />

            {/* User */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                AD
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium leading-none">Admin</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Global Planner</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
