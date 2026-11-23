import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { emptyBusiness, type BusinessProfile } from "@/app/account"

import { deviceLang, LangOverride, type Lang } from "@/app/i18n"

import type { Expression } from "@/components/mascot/Jimbot"

import { getForcedState, isBizPreview } from "@/lib/forced"

import { AUTH_INTENT_KEY, AUTH_ROLE_KEY } from "@/lib/authFlow"

import { supabase } from "@/lib/supabase"

import { usePersistentState } from "@/lib/usePersistentState"

import { clearBitinaryBrowserCache } from "@/lib/clearBitinaryBrowserCache"

import { loadOwnedWorkspace } from "./db/loadWorkspace"

import {
  demoBusiness,
  seedBoosts,
  seedBranches,
  seedCases,
  seedComments,
  seedDeals,
  seedNotifs,
  seedPosts,
  seedRequests,
  seedReviews,
  seedStaff,
  ago,
  type Boost,
  type Branch,
  type Case,
  type Comment,
  type Deal,
  type Notif,
  type Post,
  type ResRequest,
  type Review,
  type Staff,
} from "./seed"

export type LangPref = "en" | "tl" | "device"

export type Channel = "notif" | "messenger" | "sms"

export type BizData = {
  langPref: LangPref | null

  session: WorkspaceSession | null

  resume: string | null

  profile: {
    name: string
    nickname: string
    email: string
    mobile: string
    google?: string
  }

  business: BusinessProfile

  updated: Record<string, string>

  quick: {
    state: "open" | "closed"
    soldOut: boolean
    longQueue: boolean
    special: string
    at?: string
  }

  branches: Branch[]

  activeBranch: string

  staff: Staff[]

  posts: Post[]

  comments: Comment[]

  reviews: Review[]

  cases: Case[]

  deals: Deal[]

  boosts: Boost[]

  requests: ResRequest[]

  reservations: {
    enabled: boolean
    tables: number
    maxParty: number
    slot: number
  }

  queue: QueueState

  notifs: Notif[]

  prefs: {
    jimbotMatch: boolean
    channel: Channel
    notif: {
      reviews: boolean
      comments: boolean
      reports: boolean
      weekly: boolean
      deals: boolean
    }
  }

  qrToken: string

  blocked: string[]

  reportsUsed: number
}

type WorkspaceSession = {
  method: "google" | "mobile" | "email"
  contact: string
}

type QueueState = {
  open: boolean
  waiting: number
}

function persistedWorkspace(data: BizData) {
  const {
    langPref: _langPref,
    session: _session,
    resume: _resume,
    profile: _profile,
    ...workspace
  } = data

  return workspace
}

const WORKSPACE_CACHE_PREFIX = "bitinary-business-workspace:"

type CachedWorkspace = {
  workspace: BizData
  savedAt: number
}

function readWorkspaceCache(userId: string): CachedWorkspace | null {
  const key = `${WORKSPACE_CACHE_PREFIX}${userId}`

  try {
    const raw = sessionStorage.getItem(key)

    if (!raw) return null

    const cached = JSON.parse(raw) as Partial<CachedWorkspace>
    const workspace = cached.workspace

    if (
      !workspace?.business ||
      !workspace.profile ||
      !Array.isArray(workspace.posts) ||
      typeof cached.savedAt !== "number"
    ) {
      sessionStorage.removeItem(key)

      return null
    }

    return {
      savedAt: cached.savedAt,
      workspace: {
        ...initialData,
        ...workspace,
        profile: { ...initialData.profile, ...workspace.profile },
        business: { ...emptyBusiness, ...workspace.business },
        session: null,
      },
    }
  } catch (error) {
    console.warn("Could not read the cached business workspace.", error)

    clearWorkspaceCache(userId)

    return null
  }
}

function writeWorkspaceCache(userId: string | null, data: BizData) {
  if (!userId) return

  try {
    sessionStorage.setItem(
      `${WORKSPACE_CACHE_PREFIX}${userId}`,

      JSON.stringify({ workspace: data, savedAt: Date.now() }),
    )
  } catch (error) {
    console.warn("Could not cache the business workspace.", error)
  }
}

function clearWorkspaceCache(userId: string | null) {
  if (!userId) return

  try {
    sessionStorage.removeItem(`${WORKSPACE_CACHE_PREFIX}${userId}`)
  } catch (error) {
    console.warn("Could not clear the cached business workspace.", error)
  }
}

const updatedSeed = {
  basics: ago(40 * 864e5),
  location: ago(40 * 864e5),
  hours: ago(9 * 864e5),
  contact: ago(40 * 864e5),
  menu: ago(3 * 864e5),
  photos: ago(12 * 864e5),
  about: ago(30 * 864e5),
  online: ago(30 * 864e5),
  verify: ago(2 * 864e5),
}

/** Activity (posts, reviews, stats) is seeded so the prototype always has something to manage. */

export const initialData: BizData = {
  langPref: null,

  session: null,

  resume: null,

  profile: { name: "", nickname: "", email: "", mobile: "" },

  business: emptyBusiness,

  updated: {},

  quick: { state: "open", soldOut: false, longQueue: false, special: "" },

  branches: [],

  activeBranch: "",

  staff: [],

  posts: [],

  comments: [],

  reviews: [],

  cases: [],

  deals: [],

  boosts: [],

  requests: [],

  reservations: { enabled: false, tables: 0, maxParty: 0, slot: 0 },

  queue: { open: false, waiting: 0 },

  notifs: [],

  prefs: {
    jimbotMatch: false,
    channel: "notif",
    notif: {
      reviews: true,
      comments: true,
      reports: true,
      weekly: true,
      deals: true,
    },
  },

  qrToken: "",

  blocked: [],

  reportsUsed: 0,
}

export const demoData: BizData = {
  ...initialData,

  langPref: "en",

  session: { method: "email", contact: "business@example.com" },

  profile: {
    name: "Business",
    nickname: "Business",
    email: "business@example.com",
    mobile: "9171234500",
    google: "business@example.com",
  },

  business: demoBusiness,

  updated: updatedSeed,

  branches: seedBranches,

  activeBranch: "br1",

  staff: seedStaff,

  posts: seedPosts,

  comments: seedComments,

  reviews: seedReviews,

  cases: seedCases,

  deals: seedDeals,

  boosts: seedBoosts,

  requests: seedRequests,

  reservations: { enabled: true, tables: 12, maxParty: 12, slot: 90 },

  queue: { open: true, waiting: 4 },

  notifs: seedNotifs,

  qrToken: "KMB-7F3A",

  reportsUsed: 2,

  quick: {
    state: "open",
    soldOut: false,
    longQueue: false,
    special: "Sinigang na hipon",
  },
}

export const REPORT_LIMIT = 5

export type BizStatus = "draft" | "live" | "pending" | "needs-docs" | "verified"

type Toast = {
  id: number
  text: string
  expression?: Expression
  action?: ToastAction
  undo?: () => void
}

type ToastAction = {
  label: string
  to: string
}

type Ctx = {
  d: BizData

  set: (fn: (d: BizData) => BizData) => Promise<{ error: string | null }>

  setLocal: (fn: (d: BizData) => BizData) => Promise<void>

  lang: Lang

  t: (tl: string, en: string) => string

  setLangPref: (l: LangPref) => void

  status: BizStatus

  verified: boolean

  toast: Toast | null

  showToast: (t: Omit<Toast, "id">) => void

  dismissToast: () => void

  loading: boolean

  loadError: string | null

  retryLoad: () => void

  signOut: () => Promise<{ error: string | null }>

  loadDemo: () => void

  reset: () => void
}

const C = createContext<Ctx | null>(null)

const queryLang = (): Lang | null => {
  const l = new URLSearchParams(location.search).get("lang")

  return l === "tl" || l === "en" ? l : null
}

export function statusOf(b: BusinessProfile): BizStatus {
  if (!b.live) return "draft"

  const v = b.verification.status

  return v === "verified"
    ? "verified"
    : v === "pending"
      ? "pending"
      : v === "needs-docs" || v === "rejected"
        ? "needs-docs"
        : "live"
}

export function BizProvider({ children }: { children: ReactNode }) {
  // Dito nilo-load at sini-sync ang workspace ng owner; tingnan ang error state bago mag-render ng dashboard.
  const preview = isBizPreview()
  const [data, setData] = useState<BizData>(preview ? demoData : initialData)

  const [storedLang, setStoredLang] = usePersistentState<LangPref | null>(
    "biz-lang",
    null,
  )

  const [toast, setToast] = useState<Toast | null>(null)

  const [loading, setLoading] = useState(!preview)

  const [loadError, setLoadError] = useState<string | null>(null)

  const dataRef = useRef(data)

  const workspaceUserIdRef = useRef<string | null>(null)

  const storedLangRef = useRef(storedLang)

  storedLangRef.current = storedLang

  const saveQueue = useRef<Promise<void>>(Promise.resolve())

  const [loadVersion, setLoadVersion] = useState(0)

  const forced = getForcedState()

  useEffect(() => {
    if (preview) return
    let active = true

    let hasCachedWorkspace = false

    setLoadError(null)

    void (async () => {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (!active) return

      const user = sessionData.session?.user

      if (!user) {
        workspaceUserIdRef.current = null

        const next = { ...initialData, langPref: storedLangRef.current }

        dataRef.current = next

        setData(next)

        setLoading(false)

        return
      }

      workspaceUserIdRef.current = user.id

      const cached = readWorkspaceCache(user.id)

      const businessUser =
        user.user_metadata?.role === "business" ||
        (sessionStorage.getItem(AUTH_INTENT_KEY) === "signup" &&
          sessionStorage.getItem(AUTH_ROLE_KEY) === "business")

      if (cached) {
        hasCachedWorkspace = true

        const cachedWorkspace = {
          ...cached.workspace,

          langPref: storedLangRef.current,

          session:
            cached.workspace.business.id || businessUser
              ? {
                  method: user.phone ? "mobile" as const : "email" as const,

                  contact: user.email ?? user.phone ?? "",
                }
              : null,

          profile: {
            ...cached.workspace.profile,

            email: cached.workspace.profile.email || user.email || "",

            mobile: cached.workspace.profile.mobile || user.phone || "",
          },
        }

        dataRef.current = cachedWorkspace

        setData(cachedWorkspace)

        setLoading(false)
      } else {
        setLoading(true)
      }

      const workspaceBeforeLoad = dataRef.current
      const result = await loadOwnedWorkspace()

      if (result.error) throw new Error(result.error)

      if (!active) return
      if (dataRef.current !== workspaceBeforeLoad) {
        setLoading(false)
        return
      }

      const session =
        result.data || businessUser
          ? {
              method: user.phone ? "mobile" as const : "email" as const,

              contact: user.email ?? user.phone ?? "",
            }
          : null

      const workspace = result.data ?? initialData

      const loadedWorkspace = {
        ...workspace,

        langPref: storedLangRef.current,

        session,

        profile: {
          ...workspace.profile,

          name:
            workspace.profile.name ||
            String(
              user.user_metadata?.name ?? user.user_metadata?.full_name ?? "",
            ),

          email: workspace.profile.email || user.email || "",

          mobile: workspace.profile.mobile || user.phone || "",
        },
      }

      dataRef.current = loadedWorkspace

      setData(loadedWorkspace)

      writeWorkspaceCache(user.id, loadedWorkspace)

      setLoadError(null)

      setLoading(false)
    })().catch((error: unknown) => {
      if (!active) return

      if (hasCachedWorkspace) {
        setToast({
          id: Date.now(),

          text:
            error instanceof Error
              ? `Using saved business data. Refresh failed: ${error.message}`
              : "Using saved business data. Refresh failed.",
        })

        setLoadError(null)
      } else {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Business data could not be loaded.",
        )
      }

      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [loadVersion, preview])

  useEffect(() => {
    if (preview) return
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          clearWorkspaceCache(workspaceUserIdRef.current)

          workspaceUserIdRef.current = null

          const next = { ...initialData, langPref: storedLangRef.current }

          dataRef.current = next

          setData(next)

          setLoadError(null)

          setLoading(false)
        } else if (
          event === "USER_UPDATED" ||
          (event === "SIGNED_IN" &&
            session?.user.id !== workspaceUserIdRef.current)
        ) {
          setLoadVersion((version) => version + 1)
        }
      },
    )

    return () => authListener.subscription.unsubscribe()
  }, [preview])

  const view = useMemo<BizData>(() => {
    let v = data

    const b = v.business

    const ver = (s: BusinessProfile["verification"]["status"]) => ({
      ...v,
      business: {
        ...b,
        live: true,
        verification: { ...b.verification, status: s },
      },
    })

    if (forced === "verified") v = ver("verified")

    if (forced === "unverified") v = ver("none")

    if (forced === "needs-docs") v = ver("needs-docs")

    if (forced === "pending") v = ver("pending")

    if (forced === "fresh") v = { ...v, business: emptyBusiness, updated: {} }

    if (forced === "setup-ready")
      v = {
        ...v,
        business: {
          ...b,
          live: false,
          verification: { ...b.verification, status: "none" },
          status: {
            basics: "done",
            location: "done",
            hours: "done",
            contact: "done",
            menu: "done",
          },
        },
      }

    if (forced === "draft")
      v = {
        ...v,
        business: {
          ...b,
          live: false,
          verification: { ...b.verification, status: "none" },
          status: { basics: "done", location: "done" },
        },
      }

    return v
  }, [data, forced])

  const lang: Lang =
    queryLang() ??
    (data.langPref === "device" || data.langPref == null
      ? deviceLang()
      : data.langPref)

  const t = useCallback(
    (tl: string, en: string) => (lang === "en" ? en : tl),
    [lang],
  )

  const setLocal = useCallback((fn: (d: BizData) => BizData) => {
    const operation = saveQueue.current.then(() => {
      const next = fn(dataRef.current)
      dataRef.current = next
      setData(next)
      writeWorkspaceCache(workspaceUserIdRef.current, next)
    })
    saveQueue.current = operation
    return operation
  }, [])

  const set = useCallback((fn: (d: BizData) => BizData) => {
    const operation = saveQueue.current.then(async () => {
      const previous = dataRef.current
      const next = fn(previous)

      if (
        isBizPreview() ||
        JSON.stringify(previous.business) === JSON.stringify(next.business)
      ) {
        dataRef.current = next
        setData(next)
        writeWorkspaceCache(workspaceUserIdRef.current, next)
        return { error: null }
      }

      const { data: savedBusinessId, error } = await supabase.rpc(
        "save_business_workspace",
        { p_workspace: persistedWorkspace(next) },
      )

      if (error) throw new Error(error.message)

      const saved =
        typeof savedBusinessId === "string" && !next.business.id
          ? { ...next, business: { ...next.business, id: savedBusinessId } }
          : next

      dataRef.current = saved
      setData(saved)
      writeWorkspaceCache(workspaceUserIdRef.current, saved)
      return { error: null }
    }).catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Business changes could not be saved."
      setToast({ id: Date.now(), text: message })
      return { error: message }
    })

    saveQueue.current = operation.then(() => undefined)
    return operation
  }, [])

  const showToast = useCallback(
    (x: Omit<Toast, "id">) => setToast({ ...x, id: Date.now() }),
    [],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      showToast({ text: error.message })

      return { error: error.message }
    }

    const next = { ...initialData, langPref: storedLangRef.current }

    clearWorkspaceCache(workspaceUserIdRef.current)

    workspaceUserIdRef.current = null

    dataRef.current = next

    setData(next)

    try {
      await clearBitinaryBrowserCache()
    } catch (cacheError: unknown) {
      const message =
        cacheError instanceof Error
          ? cacheError.message
          : "Browser cache could not be cleared."

      showToast({
        text: `Signed out, but Bitinary cache could not be cleared: ${message}`,
      })

      return { error: message }
    }

    return { error: null }
  }, [showToast])

  const status = statusOf(view.business)

  const value: Ctx = {
    d: view,

    set,

    setLocal,

    lang,

    t,

    setLangPref: (l) => {
      setStoredLang(l)

      dataRef.current = { ...dataRef.current, langPref: l }

      setData(dataRef.current)
    },

    status,

    verified: status === "verified",

    toast,

    showToast,

    dismissToast: () => setToast(null),

    loading,

    loadError,

    retryLoad: () => setLoadVersion((version) => version + 1),

    signOut,

    loadDemo: () =>
      showToast({
        text: "Demo data is disabled for database-backed business accounts.",
      }),

    reset: () =>
      showToast({ text: "Business data cannot be reset from this screen." }),
  }

  return (
    <C.Provider value={value}>
      <LangOverride
        lang={lang}
        setLang={(l) => {
          setStoredLang(l)

          dataRef.current = { ...dataRef.current, langPref: l }

          setData(dataRef.current)
        }}
        chosen={!!data.langPref}
      >
        {children}
      </LangOverride>
    </C.Provider>
  )
}

export function useBiz() {
  const c = useContext(C)

  if (!c) throw new Error("useBiz outside BizProvider")

  return c
}

/** Shorthand for patching the business profile. */

export function useBusiness() {
  const { d, set } = useBiz()

  const setBusiness = useCallback(
    (b: BusinessProfile | ((b: BusinessProfile) => BusinessProfile)) =>
      set((x) => ({
        ...x,
        business: typeof b === "function" ? b(x.business) : b,
      })),
    [set],
  )

  return [d.business, setBusiness] as const
}
