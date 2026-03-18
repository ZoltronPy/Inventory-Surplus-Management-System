import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { Badge } from '../components/ui/Badge'
import { Link } from 'react-router-dom'
import {
  Plus,
  X,
  GripVertical,
  ExternalLink,
  AlertCircle,
  Clock,
  CheckCircle2,
  PauseCircle,
  Activity,
  ChevronDown,
} from 'lucide-react'
import { cn } from '../lib/utils'

type CardType = 'item' | 'sell_back' | 'cancel_order' | 'escatec_support' | 'issue' | 'ask'
type Status = 'backlog' | 'in_progress' | 'waiting' | 'done'
type Priority = 'low' | 'medium' | 'high' | 'critical'

interface KanbanCard {
  card_id: string
  card_type: CardType
  status: Status
  title: string
  item_id: string | null
  description: string | null
  priority: Priority
  assignee: string | null
  due_date: string | null
  linked_po_number: string | null
  linked_supplier_id: string | null
  value_impact: number | null
  created_at: string
}

interface ActivityEntry {
  log_id: number
  timestamp: string
  entity_type: string
  entity_id: string
  action: string
  from_value: string | null
  to_value: string | null
  notes: string | null
}

const TABS: { key: CardType; label: string }[] = [
  { key: 'item',             label: 'Items'     },
  { key: 'sell_back',        label: 'Sell Back' },
  { key: 'cancel_order',     label: 'Cancel PO' },
  { key: 'escatec_support',  label: 'Escatec'   },
  { key: 'issue',            label: 'Issues'    },
  { key: 'ask',              label: 'Ask'       },
]

const COLUMNS: { key: Status; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'backlog',     label: 'Backlog',     icon: <Clock className="w-3.5 h-3.5" />,        color: 'border-t-muted-foreground/40' },
  { key: 'in_progress', label: 'In Progress', icon: <AlertCircle className="w-3.5 h-3.5" />,  color: 'border-t-orange-400'          },
  { key: 'waiting',     label: 'Waiting',     icon: <PauseCircle className="w-3.5 h-3.5" />,  color: 'border-t-yellow-400'          },
  { key: 'done',        label: 'Done',        icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'border-t-green-500'           },
]

const PRIORITY_META: Record<Priority, { label: string; variant: any }> = {
  low:      { label: 'Low',      variant: 'secondary'   },
  medium:   { label: 'Medium',   variant: 'warning'     },
  high:     { label: 'High',     variant: 'destructive' },
  critical: { label: 'Critical', variant: 'destructive' },
}

// ─── New Card Form ─────────────────────────────────────────────────────────────
function NewCardForm({
  cardType,
  onSave,
  onCancel,
}: {
  cardType: CardType
  onSave: (card: Omit<KanbanCard, 'card_id' | 'created_at'>) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle]           = useState('')
  const [itemId, setItemId]         = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority]     = useState<Priority>('medium')
  const [assignee, setAssignee]     = useState('')
  const [dueDate, setDueDate]       = useState('')
  const [valueImpact, setValueImpact] = useState('')
  const [saving, setSaving]         = useState(false)

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      card_type: cardType,
      status: 'backlog',
      title: title.trim(),
      item_id: itemId.trim() || null,
      description: description.trim() || null,
      priority,
      assignee: assignee.trim() || null,
      due_date: dueDate || null,
      linked_po_number: null,
      linked_supplier_id: null,
      value_impact: valueImpact ? parseFloat(valueImpact) : null,
    })
    setSaving(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border rounded-xl p-4 shadow-md space-y-3 mb-4"
    >
      <input
        autoFocus
        placeholder="Card title *"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Item ID"
          value={itemId}
          onChange={e => setItemId(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
        />
        <input
          placeholder="Assignee"
          value={assignee}
          onChange={e => setAssignee(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          type="number"
          placeholder="Value impact (€)"
          value={valueImpact}
          onChange={e => setValueImpact(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
      />
      <div className="flex items-center gap-2">
        <select
          value={priority}
          onChange={e => setPriority(e.target.value as Priority)}
          className="flex-1 px-2 py-1.5 border rounded-lg text-xs bg-background"
        >
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="flex-1 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : 'Add Card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}

// ─── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCardItem({
  card,
  index,
  onDelete,
}: {
  card: KanbanCard
  index: number
  onDelete: (id: string) => void
}) {
  const pm = PRIORITY_META[card.priority]

  return (
    <Draggable draggableId={card.card_id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            'bg-card border rounded-xl p-3.5 shadow-sm space-y-2 group transition-shadow',
            snapshot.isDragging && 'shadow-lg rotate-1 ring-2 ring-primary/30'
          )}
        >
          <div className="flex items-start gap-2">
            <span
              {...provided.dragHandleProps}
              className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </span>
            <p className="flex-1 text-sm font-medium leading-snug">{card.title}</p>
            <button
              onClick={() => onDelete(card.card_id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {card.description && (
            <p className="text-xs text-muted-foreground pl-5 leading-relaxed line-clamp-2">
              {card.description}
            </p>
          )}

          <div className="flex items-center gap-2 pl-5 flex-wrap">
            <Badge variant={pm.variant} className="text-[10px]">{pm.label}</Badge>

            {card.item_id && (
              <Link
                to={`/items/${card.item_id}`}
                className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline"
                onClick={e => e.stopPropagation()}
              >
                {card.item_id}
                <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            )}

            {card.value_impact != null && card.value_impact > 0 && (
              <span className="text-[10px] text-green-700 font-semibold">
                €{card.value_impact.toLocaleString()}
              </span>
            )}
          </div>

          {(card.assignee || card.due_date) && (
            <div className="flex items-center justify-between pl-5 text-[10px] text-muted-foreground">
              {card.assignee && <span>{card.assignee}</span>}
              {card.due_date && (
                <span className={cn(
                  card.due_date < new Date().toISOString().slice(0, 10) && card.status !== 'done'
                    ? 'text-destructive font-semibold'
                    : ''
                )}>
                  {card.due_date}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Planning() {
  const [activeTab, setActiveTab] = useState<CardType>('item')
  const [cards, setCards] = useState<KanbanCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [showActivity, setShowActivity] = useState(false)

  useEffect(() => {
    fetchCards()
    fetchActivity()
  }, [])

  async function fetchCards() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('kanban_cards')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      setCards((data ?? []) as KanbanCard[])
    } catch (err) {
      console.error('Error fetching kanban cards:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchActivity() {
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(40)
    setActivityLog((data ?? []) as ActivityEntry[])
  }

  async function handleAddCard(card: Omit<KanbanCard, 'card_id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('kanban_cards')
      .insert(card)
      .select()
      .single()
    if (error) { console.error(error); return }
    const newCard = data as KanbanCard
    setCards(prev => [...prev, newCard])
    setShowNewForm(false)
    logActivity({
      entity_type: 'kanban_card',
      entity_id: newCard.card_id,
      action: 'card_created',
      to_value: newCard.status,
      notes: newCard.title,
    }).then(fetchActivity)
  }

  async function handleDelete(id: string) {
    const card = cards.find(c => c.card_id === id)
    setCards(prev => prev.filter(c => c.card_id !== id))
    await supabase.from('kanban_cards').delete().eq('card_id', id)
    if (card) {
      logActivity({
        entity_type: 'kanban_card',
        entity_id: id,
        action: 'card_deleted',
        notes: card.title,
      }).then(fetchActivity)
    }
  }

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStatus = destination.droppableId as Status
    const oldStatus = source.droppableId as Status
    const card = cards.find(c => c.card_id === draggableId)

    setCards(prev =>
      prev.map(c => (c.card_id === draggableId ? { ...c, status: newStatus } : c))
    )
    await supabase
      .from('kanban_cards')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('card_id', draggableId)

    logActivity({
      entity_type: 'kanban_card',
      entity_id: draggableId,
      action: 'card_moved',
      from_value: oldStatus,
      to_value: newStatus,
      notes: card?.title,
    }).then(fetchActivity)
  }

  const tabCards = cards.filter(c => c.card_type === activeTab)
  const colCards = (col: Status) => tabCards.filter(c => c.status === col)
  const tabCount = (tab: CardType) =>
    cards.filter(c => c.card_type === tab && c.status !== 'done').length

  return (
    <div className="space-y-5 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Planning Board</h2>
          <p className="text-muted-foreground">Track execution of surplus resolution actions.</p>
        </div>
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium shadow hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Card
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b shrink-0 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setShowNewForm(false) }}
            className={cn(
              'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tabCount(tab.key) > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {tabCount(tab.key)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* New Card Form */}
      {showNewForm && (
        <div className="max-w-md shrink-0">
          <NewCardForm
            cardType={activeTab}
            onSave={handleAddCard}
            onCancel={() => setShowNewForm(false)}
          />
        </div>
      )}

      {/* Kanban Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 flex-1 min-h-0 overflow-x-auto pb-2">
            {COLUMNS.map(col => (
              <div key={col.key} className="flex flex-col w-72 shrink-0">
                <div
                  className={cn(
                    'bg-muted/50 border border-b-0 rounded-t-xl px-4 py-3 flex items-center justify-between border-t-2',
                    col.color
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="text-muted-foreground">{col.icon}</span>
                    {col.label}
                  </div>
                  <span className="text-xs font-bold bg-background border rounded-full px-2 py-0.5">
                    {colCards(col.key).length}
                  </span>
                </div>

                <Droppable droppableId={col.key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'flex-1 border border-t-0 rounded-b-xl p-2.5 space-y-2.5 overflow-y-auto min-h-[200px] transition-colors',
                        snapshot.isDraggingOver
                          ? 'bg-primary/5 border-primary/30'
                          : 'bg-muted/20'
                      )}
                    >
                      {colCards(col.key).length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-xs text-muted-foreground/50 italic text-center pt-8">
                          Drop cards here
                        </p>
                      )}
                      {colCards(col.key).map((card, index) => (
                        <KanbanCardItem
                          key={card.card_id}
                          card={card}
                          index={index}
                          onDelete={handleDelete}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* Activity Log Panel */}
      <div className="shrink-0 border rounded-xl overflow-hidden bg-card shadow-sm">
        <button
          onClick={() => setShowActivity(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="w-4 h-4" />
            Activity Log
            <span className="text-xs font-normal">({activityLog.length} entries)</span>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showActivity && 'rotate-180')} />
        </button>

        {showActivity && (
          <div className="border-t divide-y divide-border max-h-56 overflow-y-auto">
            {activityLog.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground italic text-center">No activity yet.</p>
            ) : (
              activityLog.map(entry => (
                <div key={entry.log_id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-muted/20">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5 font-mono">
                    {new Date(entry.timestamp).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold capitalize">{entry.action.replace(/_/g, ' ')}</span>
                    {entry.entity_id && (
                      <span className="text-xs text-muted-foreground font-mono ml-1.5">{entry.entity_id.slice(0, 8)}</span>
                    )}
                    {entry.from_value && entry.to_value && (
                      <span className="text-xs text-muted-foreground ml-1.5">
                        {entry.from_value} → {entry.to_value}
                      </span>
                    )}
                    {entry.notes && (
                      <p className="text-[10px] text-muted-foreground truncate">{entry.notes}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap capitalize">
                    {entry.entity_type}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
