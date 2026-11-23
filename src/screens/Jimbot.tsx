import { ArrowUp, ChevronLeft, ChevronRight, Clock3, MapPin, MessageSquareText, PiggyBank, Plus, ThumbsDown, ThumbsUp } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLang, useT } from '@/app/i18n'
import { BudgetSheet } from '@/components/BudgetSheet'
import { Jimbot } from '@/components/mascot/Jimbot'
import { OfflineState } from '@/components/states/States'
import { Button } from '@/components/ui/Button'
import { PhaseTag } from '@/components/ui/PhaseTag'
import { Skeleton } from '@/components/ui/Skeleton'
import type { ChatResult, Msg } from '@/data/chat'
import { cn } from '@/lib/cn'
import { BudgetSummary, JimbotActions, JimbotMapPreview, PlaceStopCard } from '@/components/jimbot'
import { TripItineraryCard } from '@/components/jimbot/trip/TripItineraryCard'
import { ShareSheet, shareOrFallback } from '@/components/ShareSheet'
import type { JimbotAction } from '@/data/chat'
import { askJimbot } from '@/lib/jimbotClient'
import { supabase } from '@/lib/supabase'
import { useOnline } from '@/lib/useOnline'

/* ============================ CHAT UI ============================== */
type BotMsg = Extract<Msg, { role: 'bot' }>
type Conversation = { id: string; updated_at: string; title: string }

const MAX_INPUT = 300

type LangT = (tl: string, en: string) => string

const offlineText = (t: LangT) => t('Hindi ako makasagot ngayon. Subukan ulit mamaya.', "I can't answer right now. Try again later.")
const saveFailText = (t: LangT) => t('Hindi ko ma-save ang itinerary ngayon. Subukan ulit mamaya.', "I couldn't save the itinerary. Try again later.")

const welcomeMessage = (t: LangT): Msg => ({
  id: 'welcome',
  role: 'bot',
  expression: 'waving',
  text: t('Kumusta! Ako si Jimbot. Tutulungan kitang gumawa ng itinerary at mag-budget ng biyahe mo.', "Hi! I'm Jimbot. I'll help you make an itinerary and budget for your trip."),
  quickReplies: [t('Gumawa ng itinerary', 'Make an itinerary'), t('Mag-budget', 'Set a budget'), 'Quezon City'],
})

const STRUCTURED_KEYS = ['places', 'itineraryDraft', 'budget', 'map', 'actions', 'warnings', 'refusal', 'quickReplies'] as const

export function JimbotScreen() {
  return <JimbotChat />
}

export function JimbotChat({ embedded }: { embedded?: boolean }) {
  const { t } = useLang()
  const [messages, setMessages] = useState<Msg[]>(() => [welcomeMessage(t)])
  const [thinking, setThinking] = useState(false)
  const [input, setInput] = useState('')
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<Conversation[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState(false)
  const [conversationError, setConversationError] = useState(false)
  const [switchingConversation, setSwitchingConversation] = useState(false)
  const conversationId = useRef<string | undefined>(undefined)
  const listRef = useRef<HTMLDivElement>(null)
  const online = useOnline()
  const navigate = useNavigate()

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const scroller = embedded ? el.closest('.overflow-y-auto') : document.scrollingElement
    requestAnimationFrame(() => scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' }))
  }, [messages, thinking, embedded])

  useEffect(() => {
    let active = true
    void (async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user || !active) {
        if (active) setHistoryLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('jimbot_conversations')
        .select('id, updated_at')
        .eq('user_id', auth.user.id)
        .order('updated_at', { ascending: false })
        .limit(30)
      if (error) {
        console.error('Jimbot conversation lookup failed', error)
        if (active) {
          setHistoryError(true)
          setHistoryLoading(false)
        }
        return
      }
      if (!active) return
      const conversations = data ?? []
      const ids = conversations.map((conversation) => conversation.id)
      const { data: userMessages, error: messagesError } = ids.length
        ? await supabase
            .from('jimbot_messages')
            .select('conversation_id, content')
            .eq('role', 'user')
            .in('conversation_id', ids)
            .order('created_at', { ascending: true })
        : { data: [], error: null }
      if (messagesError) {
        console.error('Jimbot history lookup failed', messagesError)
        if (active) {
          setHistoryError(true)
          setHistoryLoading(false)
        }
        return
      }
      if (!active) return
      const firstMessage = new Map<string, string>()
      for (const message of userMessages ?? []) {
        if (!firstMessage.has(message.conversation_id)) firstMessage.set(message.conversation_id, message.content)
      }
      const conversationList = conversations.map((conversation) => ({
        ...conversation,
        title: firstMessage.get(conversation.id)?.slice(0, 52) || t('Bagong usapan', 'New chat'),
      }))
      setHistory(conversationList)
      setHistoryLoading(false)
      if (conversationList[0]) await openConversation(conversationList[0].id, activeCheck)
    })()

    function activeCheck() {
      return active
    }

    return () => {
      active = false
    }
  }, [])

  const openConversation = async (id: string, isActive: () => boolean = () => true) => {
    setSwitchingConversation(true)
    const { data, error } = await supabase
      .from('jimbot_messages')
      .select('id, role, content, intent, payload')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Jimbot conversation load failed', error)
      if (isActive()) setConversationError(true)
      setSwitchingConversation(false)
      return
    }
    if (!isActive()) return
    const restored: Msg[] = [welcomeMessage(t)]
    for (const message of data ?? []) {
      if (message.intent?.startsWith('feedback_')) continue
      if (message.role === 'user') {
        restored.push({ id: message.id, role: 'user', text: message.content })
      } else {
        const bot: Record<string, unknown> = { id: message.id, role: 'bot', expression: 'idea', text: message.content }
        const payload = (message as { payload?: unknown }).payload
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const p = payload as Record<string, unknown>
          for (const key of STRUCTURED_KEYS) if (p[key] != null) bot[key] = p[key]
          if (bot.refusal) bot.expression = 'unsure'
        }
        restored.push(bot as BotMsg)
      }
    }
    conversationId.current = id
    planningRef.current = null
    setMessages(restored)
    setConversationError(false)
    setSwitchingConversation(false)
    setHistoryOpen(false)
  }

  const saveMessage = async (role: 'user' | 'bot', content: string, intent: string, payload?: Record<string, unknown> | null) => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return false
    let createdConversation = false
    if (!conversationId.current) {
      const { data, error } = await supabase.from('jimbot_conversations').insert({ user_id: auth.user.id }).select('id').single()
      if (error) throw error
      conversationId.current = data.id
      createdConversation = true
    }
    const id = conversationId.current
    if (!id) throw new Error(t('Hindi nagawa ang pag-uusap ni Jimbot.', "Couldn't create the Jimbot conversation."))
    const row = { conversation_id: id, user_id: auth.user.id, role, intent, content }
    let { error } = await supabase.from('jimbot_messages').insert((payload ? { ...row, payload } : row) as typeof row)
    // Best-effort: payload column may not exist yet; retry without it.
    if (error && payload) ({ error } = await supabase.from('jimbot_messages').insert(row))
    if (error) throw error
    const updatedAt = new Date().toISOString()
    const { error: updateError } = await supabase.from('jimbot_conversations').update({ updated_at: updatedAt }).eq('id', id)
    if (updateError) throw updateError
    setHistory((current) => {
      const existing = current.find((conversation) => conversation.id === id)
      const next = {
        id,
        updated_at: updatedAt,
        title: createdConversation && role === 'user' ? content.slice(0, 52) : existing?.title ?? t('Bagong usapan', 'New chat'),
      }
      return [next, ...current.filter((conversation) => conversation.id !== id)].slice(0, 30)
    })
    return true
  }

  // Last AI plan payload so confirm-save can re-verify business IDs server-side.
  const planningRef = useRef<Record<string, unknown> | null>(null)
  const pendingShare = useRef(false)
  const [share, setShare] = useState<{ title: string } | null>(null)
  const [savedIds, setSavedIds] = useState<Record<string, string>>({})

  const send = async (text: string, opts: { explicitConfirmed?: boolean } = {}) => {
    const clean = text.trim().slice(0, MAX_INPUT)
    if (!clean || thinking) return

    const userMsg: Msg = { id: `u${Date.now()}`, role: 'user', text: clean }
    // History includes the current user turn.
    const recent = [...messages.filter((m) => m.id !== 'welcome'), userMsg].slice(-8)

    setMessages((m) => [...m, userMsg])
    setInput('')
    setThinking(true)

    const pushOffline = (replyText: string) =>
      setMessages((m) => [...m, { id: `b${Date.now()}`, role: 'bot', expression: 'unsure', text: replyText }])

    try {
      await saveMessage('user', clean, 'user')

      if (!online) {
        pushOffline(offlineText(t))
        return
      }

      const ai = await askJimbot({
        message: clean,
        conversationId: conversationId.current ?? null,
        planningContext: planningRef.current,
        explicitConfirmed: opts.explicitConfirmed,
        history: recent.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
      })

      if (ai.ok) {
        planningRef.current = {
          itineraryDraft: ai.bot.itineraryDraft ?? null,
          places: ai.bot.places ?? [],
          map: ai.bot.map ?? null,
          budget: ai.bot.budget ?? null,
        }
        const botId = `b${Date.now()}`
        const intent = ai.bot.refusal
          ? 'refuse'
          : opts.explicitConfirmed
            ? 'save'
            : ai.bot.itineraryDraft
              ? 'plan'
              : 'clarify'
        const outcome = ai.bot.refusal ? 'refusal' : ai.bot.itineraryDraft ? 'cards' : 'clarify'
        setMessages((m) => [...m, { id: botId, role: 'bot', expression: ai.bot.refusal ? 'unsure' : 'idea', ...ai.bot }])
        await saveMessage('bot', ai.bot.text, intent, { ...(ai.payload ?? {}), outcome })
        if (ai.savedItineraryId) {
          setSavedIds((cur) => ({ ...cur, [botId]: ai.savedItineraryId! }))
          if (pendingShare.current) {
            pendingShare.current = false
            setShare({ title: ai.bot.itineraryDraft?.title ?? 'Itinerary' })
          } else {
            navigate(`/itinerary/${ai.savedItineraryId}`)
          }
        } else if (opts.explicitConfirmed) {
          // Server returned a chat reply without an id (auth/draft error). Keep user on chat.
          pendingShare.current = false
        }
        return
      }

      const failText = opts.explicitConfirmed ? saveFailText(t) : offlineText(t)
      pushOffline(failText)
      pendingShare.current = false
      await saveMessage('bot', failText, 'offline')
    } catch (error) {
      console.error('Jimbot request failed', error)
      pushOffline(offlineText(t))
    } finally {
      setThinking(false)
    }
  }

  const sendFeedback = async (messageId: string, value: 'up' | 'down') => {
    try {
      const saved = await saveMessage('user', `Jimbot response ${messageId}: ${value === 'up' ? 'helpful' : 'not helpful'}`, `feedback_${value}`)
      if (!saved) throw new Error(t('Mag-sign in para maitala ang feedback.', 'Sign in to save feedback.'))
      setMessages((current) => current.map((message) => (message.id === messageId && message.role === 'bot' ? { ...message, feedback: value, feedbackError: undefined } : message)))
    } catch (error) {
      console.error('Jimbot feedback save failed', error)
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.role === 'bot'
            ? { ...message, feedbackError: error instanceof Error ? error.message : t('Hindi na-save ang feedback. Subukan ulit.', "Feedback wasn't saved. Try again.") }
            : message,
        ),
      )
    }
  }

  const startNewConversation = () => {
    if (thinking || switchingConversation) return
    conversationId.current = undefined
    planningRef.current = null
    setMessages([welcomeMessage(t)])
    setInput('')
    setConversationError(false)
    setHistoryOpen(false)
  }

  const lastBotId = [...messages].reverse().find((m) => m.role === 'bot')?.id

  return (
    <main className={cn('flex min-h-dvh flex-col', embedded ? 'min-h-full' : 'pb-[88px] md:pb-0')}>
      <header className={cn('sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-xl', embedded && 'pr-14')}>
        <div className={cn('mx-auto flex items-center gap-2 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]', !embedded && 'max-w-[760px] md:px-6 md:pt-6')}>
          <button
            type="button"
            aria-label={historyOpen ? t('Isara ang mga usapan', 'Close conversations') : t('Buksan ang mga usapan', 'Open conversations')}
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-2 transition-colors hover:bg-sunken"
          >
            {historyOpen ? <ChevronLeft size={20} /> : <MessageSquareText size={19} />}
          </button>
          <Jimbot crop="head" size={48} expression={thinking ? 'thinking' : 'waving'} animate={false} />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-h2">
              Jimbot <PhaseTag phase="MVP" />
            </h1>
            <p className="text-caption text-fg-2">{online ? t('AI travel buddy mo · itinerary at budget', 'Your AI travel buddy · itinerary and budget') : t('Offline', 'Offline')}</p>
          </div>
          <Button size="sm" variant="secondary" icon={<Plus size={16} />} onClick={startNewConversation} disabled={thinking || switchingConversation || historyLoading} aria-label={t('Bago', 'New')}>
            <span className="hidden sm:inline">{t('Bago', 'New')}</span>
          </Button>
          <Button size="sm" variant="secondary" icon={<PiggyBank size={16} />} onClick={() => setBudgetOpen(true)} aria-label="Budget">
            <span className="hidden sm:inline">Budget</span>
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {historyOpen && (
          <aside className={cn('absolute inset-y-0 left-0 z-30 flex w-[min(280px,85vw)] flex-col border-r border-line bg-bg shadow-float md:w-[260px]', !embedded && 'md:static md:shadow-none')}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold">
                <Clock3 size={17} className="text-link" /> {t('Mga usapan', 'Conversations')}
              </h2>
              <button type="button" aria-label={t('Isara ang mga usapan', 'Close conversations')} onClick={() => setHistoryOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-fg-2 hover:bg-sunken">
                <ChevronLeft size={19} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {historyLoading ? (
                <div className="space-y-2 px-2 py-3" aria-busy="true" aria-label={t('Kinukuha ang mga usapan', 'Loading conversations')}>
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="space-y-2 rounded-xl px-3 py-2.5">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  ))}
                </div>
              ) : historyError ? (
                <p role="alert" className="px-3 py-4 text-sm text-danger">{t('Hindi ma-load ang kasaysayan ng usapan.', "Couldn't load the conversation history.")}</p>
              ) : history.length ? (
                <ul className="space-y-1">
                  {history.map((conversation) => (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => void openConversation(conversation.id)}
                        disabled={switchingConversation || thinking}
                        aria-current={conversationId.current === conversation.id ? 'page' : undefined}
                        className={cn(
                          'w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-sunken disabled:opacity-50',
                          conversationId.current === conversation.id && 'bg-primary/10 text-primary',
                        )}
                      >
                        <span className="block truncate text-sm font-medium">{conversation.title}</span>
                        <span className="mt-1 block text-xs text-fg-2">{new Date(conversation.updated_at).toLocaleDateString('fil-PH', { month: 'short', day: 'numeric' })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-4 text-sm text-fg-2">{t('Wala pang naka-save na usapan.', 'No saved conversations yet.')}</p>
              )}
            </div>
          </aside>
        )}
        <section className="flex min-w-0 flex-1 flex-col">
          {!online ? (
            <OfflineState body={t('Kailangan ni Jimbot ng internet para gumawa ng bagong plano. Bukas pa rin ang mga naka-save mong itinerary.', 'Jimbot needs internet to make a new plan. Your saved itineraries are still available.')} />
          ) : (
            <div ref={listRef} className={cn('mx-auto w-full flex-1 space-y-4 px-4 pb-4 pt-4', !embedded && 'max-w-[760px] md:px-6')} aria-live="polite">
              {switchingConversation ? (
                <p className="text-center text-caption text-fg-2">{t('Binubuksan ang usapan…', 'Opening conversation…')}</p>
              ) : (
                <>
                  {conversationError && <p role="alert" className="text-center text-sm text-danger">{t('Hindi ma-load ang usapan. Subukan itong buksan ulit.', "Couldn't load the conversation. Try opening it again.")}</p>}
                  <p className="text-center text-caption text-fg-2">{t('Ngayon', 'Today')}</p>
                  {messages.map((m) =>
                    m.role === 'user' ? (
                      <UserBubble key={m.id} text={m.text} />
                    ) : (
                      <BotReply
                        key={m.id}
                        msg={m}
                        showQuickReplies={m.id === lastBotId && !thinking}
                        showFeedback={m.id === lastBotId && !thinking}
                        onPick={send}
                        onFeedback={(value) => sendFeedback(m.id, value)}
                        onOpenBusiness={(id) => navigate(`/shop/${id}`)}
                        onRefine={(text) => void send(text)}
                        onShare={(m) => {
                          if (m.role !== 'bot') return
                          const id = savedIds[m.id]
                          if (id) {
                            shareOrFallback({ title: m.itineraryDraft?.title ?? 'Itinerary', text: m.text, url: `${location.origin}/itinerary/${id}` }, () =>
                              setShare({ title: m.itineraryDraft?.title ?? 'Itinerary' }),
                            )
                            return
                          }
                          pendingShare.current = true
                          void send(t('Sige, i-save mo na ang itinerary.', 'Yes, save the itinerary.'), { explicitConfirmed: true })
                        }}
                        savedId={savedIds[m.id]}
                        onAction={(a) => {
                          if (a.type === 'confirm_save') void send(t('Sige, i-save mo na ang itinerary.', 'Yes, save the itinerary.'), { explicitConfirmed: true })
                          else if (a.type === 'revise_cheaper') void send(t('Pwede bang mas mura ang version nito?', 'Can you make a cheaper version?'))
                          else if (a.type === 'open_business' && a.businessId) navigate(`/shop/${a.businessId}`)
                          else if (a.type === 'open_help') navigate('/account/help')
                          else if (a.type === 'open_map') {
                            // Handled inside BotReply (scroll + highlight map preview).
                          }
                        }}
                        onOpenResult={(result) => navigate(result.kind === 'business' ? `/shop/${result.id}` : `/itinerary/${result.id}`)}
                      />
                    )
                  )}
                  <AnimatePresence>{thinking && <Thinking />}</AnimatePresence>
                </>
              )}
            </div>
          )}

          <div className={cn('sticky z-20', embedded ? 'bottom-0' : 'bottom-[88px] md:bottom-0')}>
            <div className={cn('mx-auto w-full', !embedded && 'max-w-[760px] md:px-2')}>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send(input)
                }}
                className="flex items-center gap-2 px-4 pb-3"
              >
                <label className="glass flex h-12 flex-1 items-center rounded-full pl-4 pr-1.5 shadow-float">
                  <span className="sr-only">{t('Mensahe kay Jimbot', 'Message Jimbot')}</span>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={MAX_INPUT}
                    placeholder={t('Itanong kay Jimbot…', 'Ask Jimbot…')}
                    disabled={!online || switchingConversation}
                    className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-fg placeholder:text-fg-2"
                  />
                  <button
                    type="submit"
                    aria-label={t('Ipadala', 'Send')}
                    disabled={!input.trim() || thinking || switchingConversation}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-deep text-white transition-opacity disabled:opacity-40"
                  >
                    <ArrowUp size={20} strokeWidth={2.4} />
                  </button>
                </label>
              </form>
            </div>
          </div>
        </section>
      </div>
      <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} />
      <ShareSheet open={!!share} onClose={() => setShare(null)} title={share?.title ?? 'Itinerary'} />
    </main>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="flex justify-end">
      <p className="max-w-[80%] rounded-[22px] rounded-br-md bg-deep px-4 py-2.5 text-[16px] leading-6 text-white">{text}</p>
    </motion.div>
  )
}

function Thinking() {
  const t = useT()
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-end gap-2">
      <Jimbot expression="thinking" variant="standalone" size={84} />
      <div className="card mb-3 flex items-center gap-1.5 rounded-[22px] rounded-bl-md px-4 py-3">
        <span className="text-[15px] text-fg-2">{t('Gumagawa ng plano', 'Making a plan')}</span>
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-primary" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
        ))}
      </div>
    </motion.div>
  )
}

function BotReply({
  msg,
  showQuickReplies,
  showFeedback,
  onPick,
  onFeedback,
  onOpenResult,
  onOpenBusiness,
  onAction,
  onRefine,
  onShare,
  savedId,
}: {
  onOpenBusiness: (id: string) => void
  onAction: (a: JimbotAction) => void
  onRefine: (text: string) => void
  onShare: (msg: BotMsg) => void
  savedId?: string
  msg: BotMsg
  showQuickReplies: boolean
  showFeedback: boolean
  onPick: (text: string) => void
  onFeedback: (value: 'up' | 'down') => void
  onOpenResult: (result: ChatResult) => void
}) {
  const navigate = useNavigate()
  const t = useT()
  const big = msg.expression === 'unsure'
  const resultsTrackRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [mapHighlight, setMapHighlight] = useState(false)
  const [focusMapToken, setFocusMapToken] = useState(0)
  const hasCarousel = (msg.results?.length ?? 0) > 3
  const scrollResults = (direction: -1 | 1) => {
    const track = resultsTrackRef.current
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' })
  }
  const focusMap = () => {
    if (msg.itineraryDraft?.days?.length) {
      setFocusMapToken((n) => n + 1)
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setMapHighlight(true)
    window.setTimeout(() => setMapHighlight(false), 1400)
  }
  const handleAction = (a: JimbotAction) => {
    if (a.type === 'open_map') {
      focusMap()
      return
    }
    onAction(a)
  }
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2">
      {big ? (
        <Jimbot expression="unsure" variant="standalone" size={64} className="-ml-1 shrink-0" />
      ) : (
        <Jimbot crop="head" expression={msg.expression} size={36} animate={false} className="mt-1" />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className={cn('card rounded-[22px] rounded-tl-md px-4 py-3', big && 'border-2 border-dashed border-caution/50')}>
          {big && <p className="mb-1 font-display text-[15px] font-semibold text-caution">{t('Hindi ako sigurado', "I'm not sure")}</p>}
          <p className="text-[16px] leading-6">{msg.text}</p>
        </div>
        {msg.itineraryDraft?.days?.length ? (
          <div ref={cardRef}>
            <TripItineraryCard
              draft={msg.itineraryDraft}
              budget={msg.budget}
              places={msg.places}
              warnings={msg.warnings}
              saved={Boolean(savedId)}
              focusMapToken={focusMapToken || undefined}
              onOpenBusiness={onOpenBusiness}
              onSave={() => onAction({ type: 'confirm_save', label: t('I-save', 'Save'), businessId: null })}
              onShare={() => onShare(msg)}
              onRefine={(text) => onRefine(text)}
            />
          </div>
        ) : (
          <>
            {msg.places?.map((p) => <PlaceStopCard key={p.businessId} {...p} note={p.reason} onOpen={onOpenBusiness} />)}
            {msg.budget && <BudgetSummary budget={msg.budget} />}
            {msg.map?.businessIds?.length ? (
              <JimbotMapPreview ref={mapRef} map={msg.map} highlight={mapHighlight} onOpenBusiness={onOpenBusiness} />
            ) : null}
          </>
        )}
        {msg.refusal && (
          <button type="button" onClick={() => navigate('/account/help')} className="text-sm font-medium text-link">
            {t('Kailangan ng tao?', 'Need a human?')}
          </button>
        )}
        {msg.warnings?.map((w, i) => (
          <p key={i} className="rounded-xl bg-caution/10 px-3 py-2 text-xs text-fg-2">{w}</p>
        ))}
        {msg.actions && showQuickReplies && <JimbotActions actions={msg.actions} onAction={handleAction} />}
        {msg.results && msg.results.length > 0 && (
          <div className="space-y-2">
            {hasCarousel && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold text-fg-2">
                  {msg.results.length} {t('resulta · swipe para makita lahat', 'results · swipe to see all')}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={t('Mga naunang resulta', 'Previous results')}
                    onClick={() => scrollResults(-1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-fg-2 transition hover:bg-surface"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label={t('Mga susunod na resulta', 'Next results')}
                    onClick={() => scrollResults(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-fg-2 transition hover:bg-surface"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            )}
            <div
              ref={hasCarousel ? resultsTrackRef : undefined}
              role={hasCarousel ? 'region' : undefined}
              aria-label={hasCarousel ? t('Mga resulta sa carousel', 'Results carousel') : undefined}
              tabIndex={hasCarousel ? 0 : undefined}
              className={hasCarousel ? 'no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2' : 'space-y-2'}
            >
              {msg.results.map((result) => (
                <ResultCard
                  key={`${result.kind}-${result.id}`}
                  result={result}
                  onOpen={() => onOpenResult(result)}
                  layout={hasCarousel ? 'carousel' : 'list'}
                />
              ))}
            </div>
          </div>
        )}
        {showQuickReplies && msg.quickReplies && msg.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {msg.quickReplies.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onPick(label)}
                className="rounded-full border border-line bg-bg/60 px-3.5 py-1.5 text-[14px] text-fg transition-colors hover:bg-bg"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {showFeedback && msg.id !== 'welcome' && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[12px] text-fg-2">{t('Nakatulong ba ito?', 'Did this help?')}</span>
            <button type="button" aria-label={t('Nakatulong', 'Helpful')} aria-pressed={msg.feedback === 'up'} onClick={() => onFeedback('up')} className={cn('rounded-full p-1.5 text-fg-2 hover:bg-surface', msg.feedback === 'up' && 'bg-primary/15 text-primary')}>
              <ThumbsUp size={15} />
            </button>
            <button type="button" aria-label={t('Hindi nakatulong', 'Not helpful')} aria-pressed={msg.feedback === 'down'} onClick={() => onFeedback('down')} className={cn('rounded-full p-1.5 text-fg-2 hover:bg-surface', msg.feedback === 'down' && 'bg-primary/15 text-primary')}>
              <ThumbsDown size={15} />
            </button>
            {msg.feedbackError && <span role="alert" className="text-xs text-danger">{msg.feedbackError}</span>}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ResultCard({
  result,
  onOpen,
  layout = 'list',
}: {
  result: ChatResult
  onOpen: () => void
  layout?: 'list' | 'carousel'
}) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const t = useT()
  const carousel = layout === 'carousel'

  if (result.kind === 'itinerary') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'card text-left transition-colors hover:bg-surface',
          carousel
            ? 'w-[min(82vw,300px)] shrink-0 snap-start overflow-hidden rounded-[22px]'
            : 'flex w-full items-center gap-3 rounded-[22px] p-3',
        )}
      >
        <div className={cn(
          'flex shrink-0 items-center justify-center bg-primary/15 text-primary',
          carousel ? 'h-32 w-full' : 'h-12 w-12 rounded-xl',
        )}>
          <MapPin size={20} />
        </div>
        <span className={cn('min-w-0 flex-1', carousel && 'block p-3')}>
          <span className="block truncate font-semibold">{result.title}</span>
          <span className="block truncate text-sm text-fg-2">{[result.area, result.subtitle, `₱${result.budget.toLocaleString()}`].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'card text-left transition-all hover:bg-surface',
        carousel
          ? 'w-[min(82vw,300px)] shrink-0 snap-start overflow-hidden rounded-[22px] hover:-translate-y-0.5'
          : 'flex w-full items-center gap-3 rounded-[22px] p-3',
      )}
    >
      {carousel ? (
        <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-primary/20 to-sunken">
          {result.photo && !photoFailed ? (
            <img
              src={result.photo}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <div className="grid h-full place-items-center text-primary" aria-hidden="true">
              <MapPin size={28} />
            </div>
          )}
          {result.verified && (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
              Verified
            </span>
          )}
        </div>
      ) : result.photo && !photoFailed ? (
        <img
          src={result.photo}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
          loading="lazy"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
          <MapPin size={20} />
        </div>
      )}
      <span className={cn('min-w-0 flex-1', carousel && 'block p-3')}>
        <span className="block truncate font-semibold">{result.name}</span>
        <span className="block truncate text-sm text-fg-2">{[result.type, result.city, result.priceRange].filter(Boolean).join(' · ')}</span>
        {result.address && <span className="block truncate text-xs text-fg-2">{result.address}</span>}
        {carousel && <span className="mt-2 block text-xs font-semibold text-link">{t('Tingnan ang profile →', 'View profile →')}</span>}
      </span>
      {!carousel && result.verified && (
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-1 text-[11px] font-semibold text-primary">Verified</span>
      )}
    </button>
  )
}
