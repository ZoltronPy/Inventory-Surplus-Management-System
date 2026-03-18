# 🚀 Antigravity — Inventory Surplus Management System

> Smart inventory surplus tracking, material movement analysis, order cancellation management, and sell-back optimization.

---

## 🎯 What is Antigravity?

**Antigravity** is a web-based application designed for managing inventory surplus during product phase-outs, line restructuring, or demand shifts. It connects stock data, purchase orders, forecasts, and supplier information to answer critical questions:

- **What stock is surplus** and can be sold back to customers?
- **Which open orders should be cancelled** — and at which suppliers?
- **How much stock do we retain** as a safety buffer?
- **How does actual consumption compare** to forecasted demand?
- **What actions need to be taken** and what's their current status?

**Item** is the central entity linking everything together — stock positions, open orders, demand forecasts, phase & action decisions, and planning tasks.

---

## 📊 Core Features

### Data Management
- **P&A Master Data** — Item classification (applicator, continue supply, phase out, needs resolution), pricing, MOQ, lead times
- **Stock Tracking** — Available, blocked, allocated, on PO, economic stock calculation
- **Purchase Orders** — Full PO lifecycle tracking with cancellation management
- **Forecast Management** — 10-12 month rolling demand forecast per item
- **Supplier Database** — Contact info, order aggregation, cancellation packages

### Analytical Engine ("The Brain")
- **Surplus Calculation** — `Economic Stock + On PO - (Forecast × Horizon + Retention Buffer)`
- **Stock Coverage** — Months of supply at current forecast rate (RED / ORANGE / YELLOW / GREEN)
- **Cancellation Recommendations** — Auto-suggests which POs to cancel, starting from furthest delivery dates
- **Sell-Back Identification** — Physically available surplus stock valued for customer sell-back
- **Configurable Retention %** — Per-item or bulk safety buffer (e.g., keep 10% above forecast)
- **Forecast vs Actuals Variance** — Consumption tracking and deviation analysis

### Views & Dashboards
| View | Description |
|------|-------------|
| **Dashboard** | KPI cards, charts, alerts, activity feed |
| **Item List** | Filterable/sortable master table with bulk actions |
| **Item Detail** | 360° view — stock, orders, forecast, coverage timeline, linked cards |
| **Supplier List** | Aggregated supplier overview with open PO values |
| **Supplier Detail** | Orders, items supplied, cancellation summary, export |
| **Stock Tab** | Stock analysis, surplus ranking, value treemap |
| **Forecast Tab** | Pivot table, variance analysis, coverage heatmap |
| **Calculation Tab** | Central engine — configure, calculate, generate action lists |
| **Planning (Kanban)** | Drag & drop execution tracking |
| **Reports** | Export packages for suppliers and customers |

### Planning & Kanban Board
Visual Kanban with **typed cards** and **status columns**:

**Card Types (Tabs):**
`Items` · `Sell Back` · `Cancel Orders` · `Escatec Support` · `Issues` · `Ask` · `Done`

**Status Columns:**
`Backlog` → `In Progress` → `Waiting` → `Done`

- Drag & drop between columns AND between tabs
- Master overview matrix (tab × status) for instant visibility
- Auto-generate cards from calculation results
- Full activity log for traceability

---

## 🧮 Key Calculation

```
total_forecast    = SUM(forecast for next N months)
retain_qty        = total_forecast × (retention_pct / 100)
net_required      = total_forecast + retain_qty
surplus           = economic_stock + on_po - net_required

IF surplus > 0 → Sell back / Cancel POs
IF surplus < 0 → Keep all stock & orders
```

**Coverage:**
```
coverage_months = economic_stock / avg_monthly_forecast

🔴 > 12 months    (heavy surplus)
🟠 > 6 months     (moderate surplus)
🟡 3-6 months     (monitor)
🟢 < 3 months     (healthy)
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| State | Zustand |
| Tables | TanStack Table (React Table v8) |
| Charts | Recharts |
| Kanban | @hello-pangea/dnd |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| Import | Papaparse (CSV) + SheetJS (Excel) |
| Export | SheetJS (xlsx) + jsPDF |

---

## 📁 Project Structure

```
├── docs/
│   └── SPEC.md                 # Full technical specification
├── src/                        # Application source (Phase 1+)
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🗺️ Roadmap

### Phase 1 — Foundation
- [ ] Database schema & Supabase setup
- [ ] CSV/Excel import pipeline
- [ ] Item List + Item Detail views
- [ ] Basic Stock view

### Phase 2 — Core Logic
- [ ] Calculation engine (surplus, coverage, cancel logic)
- [ ] Calculation / "Brain" tab
- [ ] Supplier List + Detail views
- [ ] Forecast tab

### Phase 3 — Planning & Actions
- [ ] Kanban board with typed cards
- [ ] Card auto-generation from calculations
- [ ] Drag & drop (columns + tabs)
- [ ] Activity log

### Phase 4 — Polish & Export
- [ ] Dashboard with all widgets
- [ ] Report generation & export
- [ ] Alerts & notifications
- [ ] Bulk actions
- [ ] Dark mode

---

## 📄 Documentation

- **[Full Specification (SPEC.md)](docs/SPEC.md)** — Complete data model, business logic, UI specs, and implementation details

---

## 🤝 Contributing

This project is currently in the specification and early development phase. Contributions, ideas, and feedback are welcome.

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

> **Antigravity** — Because surplus inventory shouldn't weigh you down. 🎈
