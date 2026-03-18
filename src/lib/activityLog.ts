import { supabase } from './supabase'

interface LogParams {
  entity_type: string   // 'item' | 'kanban_card' | 'purchase_order' | ...
  entity_id: string
  action: string        // 'decision_saved' | 'card_created' | 'card_moved' | ...
  from_value?: string
  to_value?: string
  notes?: string
}

export async function logActivity(params: LogParams): Promise<void> {
  try {
    await supabase.from('activity_log').insert({
      entity_type: params.entity_type,
      entity_id:   params.entity_id,
      action:      params.action,
      from_value:  params.from_value ?? null,
      to_value:    params.to_value   ?? null,
      notes:       params.notes      ?? null,
    })
  } catch {
    // Non-critical — silently ignore log failures
  }
}
