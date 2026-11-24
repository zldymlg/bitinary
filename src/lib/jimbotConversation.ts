import type { Msg } from '../data/chat.ts'

type StoredMessage = {
  id: string
  role: string
  content: string
  intent: string | null
  payload: unknown
}

export function restoreJimbotConversation(rows: StoredMessage[], welcome: Msg, retryNotice: string) {
  const messages: Msg[] = [welcome]
  let latestUserMessage = ''
  let lastRole: 'user' | 'bot' | null = null
  let planningContext: Record<string, unknown> | null = null

  for (const row of rows) {
    if (row.intent?.startsWith('feedback_')) continue

    if (row.role === 'user') {
      latestUserMessage = row.content
      messages.push({ id: row.id, role: 'user', text: row.content })
      lastRole = 'user'
      continue
    }

    if (row.role !== 'bot') continue

    const payload = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? row.payload as Record<string, unknown>
      : {}
    const bot: Record<string, unknown> = {
      id: row.id,
      role: 'bot',
      expression: payload.refusal ? 'unsure' : 'idea',
      text: row.content,
    }
    for (const key of ['places', 'itineraryDraft', 'budget', 'map', 'actions', 'warnings', 'refusal', 'quickReplies']) {
      if (payload[key] != null) bot[key] = payload[key]
    }
    if (row.intent === 'offline' && latestUserMessage) bot.retryText = latestUserMessage

    if (payload.itineraryDraft || (!planningContext?.itineraryDraft &&
      ((Array.isArray(payload.places) && payload.places.length) || payload.budget || payload.map))) {
      planningContext = {
        itineraryDraft: payload.itineraryDraft ?? null,
        places: payload.places ?? [],
        map: payload.map ?? null,
        budget: payload.budget ?? null,
      }
    }
    messages.push(bot as Msg)
    lastRole = 'bot'
  }

  if (lastRole === 'user') {
    messages.push({
      id: `retry-${messages[messages.length - 1].id}`,
      role: 'bot',
      expression: 'unsure',
      text: retryNotice,
      retryText: latestUserMessage,
    })
  }

  return { messages, planningContext }
}
