/**
 * Antigravity Calculation Engine
 * Computes surplus/deficit position for each inventory item.
 */

export type RecommendedAction = 'keep' | 'sell-back' | 'cancel-po' | 'write-off' | 'monitor' | 'investigate'
export type Urgency = 'high' | 'medium' | 'low'

export interface CalcInput {
  item_id: string
  item_description: string
  category: string
  line_status: string
  unit_price: number
  currency: string
  decision: string | null
  retention_pct: number
  // stock
  available: number
  blocked: number
  on_po: number
  // open POs from purchase_orders table
  open_po_qty: number
  open_po_count: number
  cancellable_po_qty: number
  // forecast
  forecast_total: number
  forecast_count: number
  forecast_avg: number
}

export interface CalcResult extends CalcInput {
  total_supply: number
  gross_surplus_qty: number
  retention_qty: number
  net_surplus_qty: number
  surplus_value: number
  coverage_months: number | null
  recommended_action: RecommendedAction
  urgency: Urgency
}

const CURRENT_MONTH = (() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})()

export function runCalculation(inputs: CalcInput[]): CalcResult[] {
  return inputs.map(item => {
    const total_supply = item.available + item.on_po

    const gross_surplus_qty = Math.max(0, total_supply - item.forecast_total)
    const retention_qty = Math.round(item.available * (item.retention_pct / 100))
    const net_surplus_qty = Math.max(0, gross_surplus_qty - retention_qty)
    const surplus_value = net_surplus_qty * item.unit_price

    const coverage_months =
      item.forecast_avg > 0 ? parseFloat((total_supply / item.forecast_avg).toFixed(1)) : null

    const recommended_action = deriveAction(item, net_surplus_qty, coverage_months)
    const urgency = deriveUrgency(surplus_value, recommended_action)

    return {
      ...item,
      total_supply,
      gross_surplus_qty,
      retention_qty,
      net_surplus_qty,
      surplus_value,
      coverage_months,
      recommended_action,
      urgency,
    }
  })
}

function deriveAction(
  item: CalcInput,
  net_surplus_qty: number,
  coverage_months: number | null
): RecommendedAction {
  if (item.line_status === 'phase_out') {
    if (item.cancellable_po_qty > 0) return 'cancel-po'
    if (item.available > 0) return 'sell-back'
    return 'keep'
  }

  if (item.line_status === 'needs_resolution') return 'investigate'

  if (net_surplus_qty > 0) {
    if (coverage_months !== null && coverage_months > 24) return 'sell-back'
    if (coverage_months !== null && coverage_months > 12) return 'monitor'
  }

  return 'keep'
}

function deriveUrgency(surplus_value: number, action: RecommendedAction): Urgency {
  if (action === 'keep' || action === 'investigate') return 'low'
  if (surplus_value >= 50000) return 'high'
  if (surplus_value >= 10000) return 'medium'
  return 'low'
}

export { CURRENT_MONTH }
