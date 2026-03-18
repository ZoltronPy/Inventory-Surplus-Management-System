# ANTIGRAVITY — Inventory Surplus Management System

## System Prompt / Project Brief

You are building **Antigravity**, a web-based inventory surplus management application. The system tracks material movement, identifies surplus stock for sell-back to customers, manages order cancellations with suppliers, and monitors consumption against forecasts.

---

## 1. CORE CONCEPT

**Item** is the central entity that links everything together — stock, orders, forecasts, P&A decisions, and planning actions. Every view in the application revolves around items and their relationships.

The primary business goal: A product line (or set of items) is being phased out or restructured. We need to determine:
- What stock is surplus and can be sold back
- What open orders should be cancelled (and at which suppliers)
- What items/stock we need to retain (with configurable retention %)
- What the consumption vs forecast variance looks like
- What actions need to be taken and track their progress

---

## 2. DATA MODEL

### 2.1 P&A (Phase & Action) Master Data
The P&A dataset is the master reference for which items are in scope and what decisions apply to them.

| Field | Description |
|-------|-------------|
| `item_id` | Unique item identifier (primary key across all datasets) |
| `item_description` | Human-readable item name/description |
| `category` | Item category/group |
| `line_status` | Enum: `applicator` / `continue_supply` / `needs_resolution` / `phase_out` / `tbd` |
| `note_lines` | Array of free-text notes (multiple note lines per item) |
| `unit_price` | Standard unit price |
| `currency` | Price currency (CZK, EUR, USD) |
| `moq` | Minimum Order Quantity |
| `lead_time_days` | Lead time in days |
| `supplier_id` | Primary supplier reference |
| `decision` | Current decision/action assigned to this item |
| `retention_pct` | % of stock to retain (default 0%, configurable per item or bulk) |

### 2.2 Stock
Current inventory position per item.

| Field | Description |
|-------|-------------|
| `item_id` | FK to P&A |
| `available` | Available stock quantity |
| `blocked` | Blocked stock quantity |
| `allocated` | Allocated stock quantity |
| `on_po` | Quantity on open Purchase Orders |
| `economic_stock` | **Calculated**: `available - blocked` |
| `warehouse_location` | Optional: warehouse/bin location |
| `last_updated` | Timestamp of last stock update |

### 2.3 Orders (Purchase Orders)
Open and historical purchase orders.

| Field | Description |
|-------|-------------|
| `po_number` | Purchase Order number |
| `po_line` | PO line number |
| `item_id` | FK to P&A |
| `quantity` | Ordered quantity |
| `delivery_date` | Expected delivery date |
| `supplier_id` | Supplier identifier |
| `supplier_name` | Supplier name |
| `unit_price` | Price per unit on this PO |
| `currency` | Order currency |
| `po_status` | Enum: `open` / `confirmed` / `in_transit` / `delivered` / `to_cancel` / `cancelled` |
| `cancel_flag` | Boolean: marked for cancellation |
| `cancel_reason` | Free text reason if flagged |

### 2.4 Forecast
Monthly demand forecast per item, typically 10-12 months forward.

| Field | Description |
|-------|-------------|
| `item_id` | FK to P&A |
| `month` | Month (YYYY-MM format) |
| `forecast_qty` | Forecasted quantity for that month |

### 2.5 Suppliers

| Field | Description |
|-------|-------------|
| `supplier_id` | Unique supplier identifier |
| `supplier_name` | Supplier name |
| `contact_person` | Primary contact |
| `email` | Contact email |
| `phone` | Contact phone |
| `country` | Supplier country |
| `payment_terms` | Payment terms |
| `notes` | Free text notes |

### 2.6 Planning Cards (Kanban)

| Field | Description |
|-------|-------------|
| `card_id` | Unique card identifier |
| `item_id` | FK to P&A (nullable — card can be general) |
| `card_type` | Enum: `item` / `sell_back` / `cancel_order` / `escatec_support` / `issue` / `ask` / `general` |
| `status` | Enum (Kanban column): `backlog` / `in_progress` / `waiting` / `done` |
| `title` | Card title |
| `description` | Card description / notes |
| `assignee` | Who is responsible |
| `priority` | Enum: `low` / `medium` / `high` / `critical` |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |
| `due_date` | Optional deadline |
| `linked_po` | Optional: linked PO number |
| `linked_supplier_id` | Optional: linked supplier |
| `value_impact` | Optional: monetary impact of this action |

### 2.7 Activity Log

| Field | Description |
|-------|-------------|
| `log_id` | Unique log entry ID |
| `timestamp` | When the action occurred |
| `user` | Who performed the action |
| `entity_type` | What was affected (item, card, order, etc.) |
| `entity_id` | ID of affected entity |
| `action` | What happened (moved, updated, created, etc.) |
| `from_value` | Previous value/state |
| `to_value` | New value/state |
| `notes` | Optional context |

---

## 3. CALCULATED FIELDS & BUSINESS LOGIC

### 3.1 Surplus Calculation (per item)
```
total_forecast = SUM(forecast_qty for next N months)
retain_qty = total_forecast * (retention_pct / 100)
net_required = total_forecast + retain_qty
surplus_qty = economic_stock + on_po - net_required
surplus_value = surplus_qty * unit_price

IF surplus_qty > 0 → item has surplus → candidate for sell-back
IF surplus_qty < 0 → item has deficit → may need to keep all POs
```

### 3.2 Stock Coverage
```
avg_monthly_consumption = AVG(forecast_qty for next 12 months)
coverage_months = economic_stock / avg_monthly_consumption
```

**Flags:**
- `coverage_months > 12` → RED flag (heavy surplus)
- `coverage_months > 6` → ORANGE flag (moderate surplus)  
- `coverage_months 3-6` → YELLOW (monitor)
- `coverage_months < 3` → GREEN (healthy)

### 3.3 Order Cancellation Logic
```
FOR each item WHERE surplus_qty > 0:
    Sort open POs by delivery_date DESC (cancel furthest-out first)
    Cancel POs until cancelled_qty >= surplus_qty
    Generate cancellation list grouped by supplier
```

### 3.4 Sell-Back Calculation
```
sellable_qty = MIN(surplus_qty, economic_stock)  // can only sell what's physically in stock
sellable_value = sellable_qty * unit_price
```

### 3.5 Consumption Tracking
```
actual_consumption = stock_change over period (calculated from stock snapshots)
forecast_variance = (actual_consumption - forecast_qty) / forecast_qty * 100
```

---

## 4. APPLICATION VIEWS

### 4.1 Dashboard (Home)
**Purpose:** High-level overview of the entire situation at a glance.

**Widgets/Cards:**
- **Total Items in Scope** — count + breakdown by `line_status`
- **Total Stock Value** — economic stock × unit price, summed
- **Total Surplus Value** — sum of all positive surplus values
- **Total Open PO Value** — sum of all open PO values
- **Cancellation Value** — total value of POs recommended for cancellation
- **Sell-Back Value** — total value of stock identified for sell-back
- **Coverage Distribution** — chart showing items by coverage bucket (RED/ORANGE/YELLOW/GREEN)
- **Top 10 Surplus Items** — by value
- **Top Suppliers by Open PO Value** — bar chart
- **Kanban Summary** — card counts per column/type
- **Forecast vs Consumption Trend** — line chart, last 6 months
- **Recent Activity** — last 10 actions from activity log
- **Alerts Panel:**
  - Items with coverage > 12 months
  - POs arriving within 14 days that should be cancelled
  - Items with no forecast but stock on hand
  - Items with forecast but zero stock and no POs

### 4.2 Item List
**Purpose:** Filterable, sortable master list of all items.

**Columns:**
- Item ID, Description, Category
- Line Status (color-coded badge)
- Unit Price, MOQ, Lead Time
- Economic Stock, On PO
- Total Forecast (next 12m)
- Surplus Qty, Surplus Value
- Coverage (months) with color indicator
- Retention %
- Supplier
- Kanban Status (current planning stage)

**Features:**
- Search/filter by any column
- Multi-select for bulk actions:
  - Set retention % in bulk
  - Create kanban cards in bulk
  - Export selection
- Sort by any column
- Toggle column visibility
- Quick filters: "Surplus only", "Deficit only", "Needs resolution", "Phase out"
- Export to CSV/Excel

### 4.3 Item Detail
**Purpose:** Complete 360° view of a single item.

**Sections:**
- **Header:** Item ID, Description, Status badge, Retention % (editable), Supplier link
- **Key Metrics Bar:** Economic Stock | On PO | Total Forecast | Surplus/Deficit | Coverage | Unit Price
- **P&A Info:** Line status, all note lines, MOQ, Lead Time, Decision
- **Stock Breakdown:** Available / Blocked / Allocated / On PO / Economic — visual bar
- **Open Orders Table:** All POs for this item with status, delivery date, supplier, qty, price. Cancel toggle per PO.
- **Forecast Table/Chart:** Monthly forecast with bar chart overlay. Show consumption actuals if available.
- **Coverage Timeline:** Visual timeline showing when stock runs out at current forecast rate
- **Surplus Calculation Panel:** Step-by-step calculation showing how surplus was derived
- **Linked Kanban Cards:** All planning cards related to this item
- **Activity History:** All changes/actions on this item
- **Notes/Comments:** Free text area for adding notes
- **Actions:**
  - Mark for sell-back
  - Flag POs for cancellation
  - Create planning card
  - Adjust retention %
  - Export item report

### 4.4 Supplier List
**Purpose:** Overview of all suppliers with aggregated data.

**Columns:**
- Supplier ID, Name, Country, Contact
- Total Items Supplied (count)
- Total Open PO Value
- Total POs to Cancel (value)
- PO Count (open / to cancel / cancelled)
- Average Lead Time

**Features:**
- Search/filter
- Sort by any column
- Click through to Supplier Detail

### 4.5 Supplier Detail
**Purpose:** All information about a specific supplier.

**Sections:**
- **Header:** Supplier name, contact info, country, payment terms
- **Summary Cards:** Total items | Open PO value | Cancel value | Avg lead time
- **Orders Table:** All POs for this supplier, filterable by status
- **Items Supplied:** List of all items from this supplier with stock/surplus info
- **Cancellation Summary:** Grouped list of what to cancel, ready for export/communication
- **Notes:** Free text
- **Export:** Generate cancellation letter/list for this supplier

### 4.6 Forecast Tab
**Purpose:** Forecast management and analysis across all items.

**Views:**
- **Table View:** Pivot table — items as rows, months as columns, qty in cells. Editable.
- **Chart View:** Stacked bar chart of total forecast by month, with category/supplier breakdown
- **Variance View:** Forecast vs Actual consumption comparison (if actuals available)
- **Coverage Heatmap:** Items × Months grid, color-coded by coverage status

**Features:**
- Filter by item, category, supplier, line status
- Edit forecast values inline
- Import forecast from CSV/Excel
- Export forecast

### 4.7 Stock Tab
**Purpose:** Stock position analysis.

**Views:**
- **Stock Table:** All items with full stock breakdown (available, blocked, allocated, on PO, economic)
- **Surplus Analysis:** Items ranked by surplus value, with breakdown
- **Aging View:** If aging data available, show stock age distribution
- **Stock Value Treemap:** Visual representation of where stock value sits

**Features:**
- Filter by status, category, supplier, coverage range
- Highlight surplus items
- Export

### 4.8 Calculation / Analysis Tab — "The Brain"
**Purpose:** Central calculation engine where everything comes together.

This is the core analytical view where surplus is calculated and decisions are made.

**Layout:**

**Step 1 — Configuration Panel (top):**
- Global retention % (applies to all items without individual override)
- Forecast horizon selector (3 / 6 / 9 / 12 months)
- Include/exclude items by line_status
- Recalculate button

**Step 2 — Results Table:**
| Item | Eco Stock | On PO | Total Supply | Forecast (horizon) | Retention % | Retain Qty | Net Required | Surplus/Deficit | Surplus Value | Action |
|------|-----------|-------|-------------|--------------------:|-------------|-----------|-------------|----------------|--------------|--------|
| (per item row with all calculated fields) |

- Color coding: surplus = green, deficit = red, borderline = yellow
- Editable: retention % per row (overrides global)
- Action column: dropdown — "Sell Back" / "Cancel POs" / "Keep" / "Review"

**Step 3 — Summary Panel:**
- Total surplus value across all items
- Total sell-back value (what's physically in stock)
- Total PO cancellation value
- Breakdown by supplier (cancellation value per supplier)
- Breakdown by category

**Step 4 — Action Generation:**
- "Generate Sell-Back List" → creates list of items + qty + value to sell
- "Generate Cancellation List" → creates list of POs to cancel, grouped by supplier
- "Create Kanban Cards" → auto-generates planning cards for all flagged items
- "Export Full Report" → Excel/PDF with everything

### 4.9 Planning / Kanban Tab
**Purpose:** Track execution of all actions in a visual Kanban board.

**Board Structure:**

**Tabs (card types / swimlanes):**
Each tab filters the Kanban to show only cards of that type. An "All" tab shows everything.

| Tab | Description |
|-----|-------------|
| **All** | All cards across all types, full Kanban view |
| **Items** | General item-level planning cards |
| **Sell Back** | Cards tracking sell-back activities |
| **Cancel Orders** | Cards tracking order cancellation activities |
| **Escatec Support** | Cards requiring Escatec team support/action |
| **Issues** | Problems, blockers, escalations |
| **Ask** | Questions pending answers from someone |
| **Done** | Completed cards (archive view) |

**Kanban Columns (status):**
Each tab has these columns:
| Backlog | In Progress | Waiting / On Hold | Done |

**Card Display:**
Each card shows:
- Title (item ID + short description)
- Card type badge (color-coded)
- Priority indicator
- Assignee avatar/name
- Item key metrics (if linked to item): stock, surplus, value
- Linked PO info (if applicable)
- Due date (if set)
- Value impact (if set)
- Quick actions: move to next column, edit, link item

**Features:**
- **Drag & Drop:** Move cards between columns AND between tabs (change type)
- **Quick Add:** Create card from any view (item detail, calculation tab, etc.)
- **Filters:** By assignee, priority, item, supplier, date range
- **Master Overview Panel** (collapsible sidebar): 
  Shows count of cards per tab × column as a matrix/heatmap:
  ```
              Backlog | In Progress | Waiting | Done
  Items:        12   |     5       |    3    |  20
  Sell Back:     8   |     3       |    2    |  15
  Cancel:        5   |     4       |    1    |  10
  Escatec:       2   |     1       |    0    |   3
  Issues:        3   |     2       |    1    |   5
  Ask:           4   |     0       |    2    |   8
  ```
  Clicking any cell filters the board to those cards.
- **Bulk Move:** Select multiple cards and move them together
- **Auto-generate:** From Calculation tab, auto-create cards for all surplus items
- **Timeline View** (alternative to Kanban): Gantt-like view of cards by due date
- **Export:** Export board state, filtered view, or full history

### 4.10 Reports / Export Tab
**Purpose:** Generate reports and export data for external communication.

**Available Reports:**
- **Surplus Summary Report** — Executive summary of all surplus items, values, recommended actions
- **Supplier Cancellation Package** — Per-supplier: list of POs to cancel with item details, values
- **Sell-Back Proposal** — Items available for sell-back with pricing
- **Stock Position Report** — Current stock across all items
- **Forecast vs Actuals Report** — Variance analysis
- **Planning Status Report** — Kanban board status summary
- **Full Data Export** — Everything in one Excel workbook (multiple sheets)

**Format Options:** Excel (.xlsx), PDF, CSV

---

## 5. UI/UX REQUIREMENTS

### Navigation
- **Left Sidebar:** Fixed navigation with icons + labels
  - Dashboard
  - Items (list)
  - Suppliers (list)
  - Stock
  - Forecast
  - Calculation ("The Brain")
  - Planning (Kanban)
  - Reports
  - Settings
- **Top Bar:** Search (global item search), Notifications/Alerts bell, User menu

### Design Principles
- Clean, professional, data-dense but not cluttered
- Color system: Use RED/ORANGE/YELLOW/GREEN consistently for coverage/status
- Dark mode support
- Responsive (desktop-first, but tablet-friendly)
- Fast: Tables should be virtualized for 1000+ items
- All tables: sortable, filterable, column-reorderable, exportable

### Data Import
- CSV/Excel upload for each data source (P&A, Stock, Orders, Forecast)
- Column mapping UI (in case column names don't match exactly)
- Validation & error reporting on import
- Incremental update support (add/update, not just replace)

### Interactivity
- All calculated fields update in real-time when inputs change (retention %, forecast horizon)
- Cross-linking: Click any item ID anywhere → opens Item Detail
- Cross-linking: Click any supplier name → opens Supplier Detail
- Cross-linking: Click any PO number → highlights in Orders view
- Breadcrumbs for navigation context

---

## 6. TECHNICAL STACK SUGGESTION

- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **State Management:** Zustand or Redux Toolkit
- **Tables:** TanStack Table (React Table v8) for all data grids
- **Charts:** Recharts or Chart.js
- **Kanban:** @hello-pangea/dnd (drag and drop)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **Export:** SheetJS (xlsx), jsPDF
- **Import:** Papaparse (CSV), SheetJS (Excel)

---

## 7. DATA FLOW

```
[CSV/Excel Upload] → [Import & Validation] → [Database (Supabase)]
                                                      ↓
                              ┌──────────────────────────────────────┐
                              │         CALCULATION ENGINE           │
                              │                                      │
                              │  Stock + Orders + Forecast + P&A     │
                              │         + Retention %                │
                              │              ↓                       │
                              │  Surplus/Deficit per Item            │
                              │  Cancel Recommendations              │
                              │  Sell-Back Candidates                │
                              │  Coverage Analysis                   │
                              └──────────────────────────────────────┘
                                              ↓
                    ┌─────────────┬──────────────┬──────────────┐
                    │  Dashboard  │  Analysis    │  Planning    │
                    │  (overview) │  (decisions) │  (execution) │
                    └─────────────┴──────────────┴──────────────┘
                                              ↓
                              [Reports & Exports → Suppliers/Customers]
```

---

## 8. IMPLEMENTATION PHASES

### Phase 1 — Foundation
- Data model & database setup (Supabase)
- CSV/Excel import for all 4 data sources
- Item List + Item Detail views
- Basic Stock view

### Phase 2 — Core Logic
- Calculation engine (surplus, coverage, cancel logic)
- Calculation / "Brain" tab
- Supplier List + Detail views
- Forecast tab

### Phase 3 — Planning & Actions
- Kanban board with all tabs
- Card creation from Calculation tab
- Drag & drop between columns and tabs
- Master overview panel
- Activity log

### Phase 4 — Polish & Export
- Dashboard with all widgets
- Report generation
- Export functionality
- Alerts & notifications
- Bulk actions
- Dark mode

---

## 9. SAMPLE INTERACTIONS

**User uploads P&A Excel** → System parses, validates, shows preview → User confirms → Items created in database

**User opens Calculation tab** → Sets 10% global retention, 12-month horizon → System calculates surplus for all items → User sees ranked list → Adjusts retention to 15% for specific high-value items → Clicks "Generate Cancellation List" → System creates list grouped by supplier → User exports for each supplier

**User opens Kanban** → Sees auto-generated cards from calculation → Drags "Cancel PO for Item X at Supplier Y" from Backlog to In Progress → Adds note "Email sent to supplier 2024-03-15" → Later moves to Done

**User opens Item Detail for Item 12345** → Sees stock is 5000, forecast is 200/month, coverage = 25 months (RED) → 3 open POs totaling 2000 units → Surplus = 2200 units → Flags 2 POs for cancellation → Marks 1200 units for sell-back → Creates kanban card for follow-up

---

## 10. NAMING & TERMINOLOGY

| Internal Term | Display Label | Description |
|---------------|--------------|-------------|
| `economic_stock` | Economic Stock | Available minus Blocked |
| `surplus_qty` | Surplus | Stock + On PO - (Forecast × horizon + Retention) |
| `coverage_months` | Coverage | Months of stock at current forecast rate |
| `retention_pct` | Retention % | % of forecast to keep as safety buffer |
| `sell_back` | Sell Back | Stock identified for selling to customer/market |
| `cancel_flag` | Cancel | PO flagged for cancellation |
| `line_status` | Line Status | P&A classification of the item's future |

---

*This is the complete specification for Antigravity. Build it modularly, starting with data import and the calculation engine, then layering views on top.*
