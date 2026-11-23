import {
  Bell,
  CloudOff,
  Download,
  Share,
  SquarePlus,
} from "lucide-react"

import { AnimatePresence, motion } from "motion/react"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  Link,
  Navigate,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from "react-router"

import { Jimbot } from "@/components/mascot/Jimbot"

import { Button } from "@/components/ui/Button"

import { Sheet } from "@/components/ui/Sheet"

import { cn } from "@/lib/cn"

import { isBizPreview } from "@/lib/forced"

import { useInstallPrompt } from "@/lib/useInstallPrompt"

import { useOnline } from "@/lib/useOnline"

import { relTime } from "./format"

import { ContentIcon, StatsIcon, UserIcon } from "./icons"

import { QuickUpdatePanel } from "./QuickUpdate"

import { BizProvider, useBiz } from "./store"

import { Avatar } from "./ui"

import { resolveBusinessImage } from "./db/assets"
import { updateNotification } from "./db/notifications"

/* ------------------------------ Root: provider, gate, toast, manifest ------------------------------ */

const FREE = /^\/biz\/(language|welcome|auth|signup|screens)/

function BizGate() {
  const { d, loading, loadError, retryLoad, t } = useBiz()

  const { pathname, search } = useLocation()

  if (loading)
    return (
      <main
        className="grid min-h-screen place-items-center p-6 text-center"
        role="status"
      >
        {t("Kinukuha ang datos ng negosyo…", "Loading business data…")}
      </main>
    )

  if (loadError)
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div role="alert" className="max-w-md">
          <p>{loadError}</p>
          <button
            className="mt-4 rounded-full bg-primary px-5 py-3 font-medium text-ink"
            onClick={retryLoad}
          >
            {t("Subukang muli", "Retry")}
          </button>
        </div>
      </main>
    )

  if (!isBizPreview()) {
    const authEntry =
      pathname === "/biz/auth" ||
      pathname === "/biz/auth/email" ||
      pathname === "/biz/auth/verify" ||
      pathname === "/biz/auth/recovery" ||
      pathname === "/biz/welcome"

    const businessSignup =
      pathname === "/biz/auth" &&
      new URLSearchParams(search).get("mode") === "signup"

    const passwordRecovery = pathname === "/biz/auth/recovery"

    if (d.session && authEntry && !businessSignup && !passwordRecovery)
      return (
        <Navigate to={d.business.name ? "/biz/stats" : "/biz/setup"} replace />
      )

    if (
      !d.session &&
      !d.langPref &&
      !pathname.startsWith("/biz/language") &&
      !pathname.startsWith("/biz/screens") &&
      pathname !== "/biz/auth/callback"
    )
      return <Navigate to="/biz/language" replace />

    if (d.session && pathname === "/biz/auth" && !search.includes("mode="))
      return (
        <Navigate to={d.business.name ? "/biz/stats" : "/biz/setup"} replace />
      )

    if (d.langPref && !d.session && !FREE.test(pathname))
      return <Navigate to="/biz/welcome" replace />
  }

  return (
    <>
      <Outlet />
      <BizToast />
      <ScrollRestoration />
    </>
  )
}

export function BizRoot() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')

    const prevHref = link?.getAttribute("href")

    const prevTitle = document.title

    link?.setAttribute("href", `${import.meta.env.BASE_URL}biz.webmanifest`)

    document.title = "Bitinary Business"

    const apple = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    )

    const prevApple = apple?.content

    if (apple) apple.content = "Bitinary Biz"

    return () => {
      if (link && prevHref) link.setAttribute("href", prevHref)

      document.title = prevTitle

      if (apple && prevApple) apple.content = prevApple
    }
  }, [])

  return (
    <BizProvider>
      <BizGate />
    </BizProvider>
  )
}

function BizToast() {
  const { toast, dismissToast, t } = useBiz()

  const navigate = useNavigate()

  useEffect(() => {
    if (!toast) return

    const tm = setTimeout(
      dismissToast,
      toast.action || toast.undo ? 5000 : 2600,
    )

    return () => clearTimeout(tm)
  }, [toast, dismissToast])

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[95] flex justify-center px-4 pt-[max(12px,env(safe-area-inset-top))]"
      aria-live="polite"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ y: -70, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="glass pointer-events-auto flex max-w-[460px] items-center gap-3 rounded-[22px] py-2 pl-2 pr-3 shadow-float"
          >
            <Jimbot
              crop="head"
              size={40}
              expression={toast.expression ?? "celebrating"}
              animate={false}
            />
            <p className="font-display text-[15px] font-medium text-fg">
              {toast.text}
            </p>
            {toast.undo && (
              <button
                onClick={() => (toast.undo!(), dismissToast())}
                className="ml-1 h-10 shrink-0 rounded-full bg-brown px-3 font-display text-[14px] font-medium text-cream dark:bg-elevated"
              >
                {t("I-undo", "Undo")}
              </button>
            )}
            {toast.action && (
              <button
                onClick={() => (navigate(toast.action!.to), dismissToast())}
                className="ml-1 h-10 shrink-0 rounded-full bg-primary px-3 font-display text-[14px] font-medium text-ink"
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------ Navigation ------------------------------ */

export function useNav() {
  const { t } = useBiz()

  return [
    {
      to: "/biz/stats",
      label: t("Pangkalahatan", "Overview"),
      short: t("Pangkalahatan", "Overview"),
      icon: StatsIcon,
    },

    {
      to: "/biz/content",
      label: t("Nilalaman", "Content"),
      short: t("Nilalaman", "Content"),
      icon: ContentIcon,
    },

    { to: "/biz/account", label: "Account", short: "Account", icon: UserIcon },
  ]
}

type SheetProps = {
  open: boolean
  onClose: () => void
}

function BusinessMark({ size = 44 }: { size?: number }) {
  const { d } = useBiz()

  const imagePath = d.business.logo || d.business.cover

  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    setImage(null)

    if (!imagePath) return

    void resolveBusinessImage(imagePath)

      .then((url) => {
        if (active) setImage(url)
      })

      .catch((error: unknown) => {
        console.error("Business profile image could not be loaded.", error)
      })

    return () => {
      active = false
    }
  }, [imagePath])

  return image ? (
    <img
      src={image}
      alt=""
      className="shrink-0 rounded-[14px] object-cover ring-2 ring-cream/30"
      style={{ width: size, height: size }}
    />
  ) : (
    <Avatar
      name={d.business.name || "B"}
      size={size}
      className="rounded-[14px]"
    />
  )
}

function Sidebar() {
  const nav = useNav()

  const { pathname } = useLocation()

  const { d, t } = useBiz()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col bg-brown px-4 pb-5 pt-6 text-cream xl:flex dark:border-r dark:border-line dark:bg-surface">
      <div className="flex items-center gap-3 px-1">
        <BusinessMark />
        <div className="min-w-0">
          <p className="truncate font-display text-[16px] font-semibold leading-tight">
            {d.business.name || t("Negosyo mo", "Your business")}
          </p>
          <p className="text-[13px] text-[#E8CDB9]">Bitinary Business</p>
        </div>
      </div>
      <nav
        aria-label={t("Pangunahing navigation", "Main navigation")}
        className="mt-6 flex flex-col gap-1"
      >
        {nav.map((n) => {
          const active = pathname.startsWith(n.to)

          const I = n.icon

          return (
            <Link
              key={n.to}
              to={n.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-12 items-center gap-3 rounded-[14px] px-3 font-display text-[15px] font-medium",
                active ? "text-ink" : "text-cream/85 hover:bg-white/10",
              )}
            >
              {active && (
                <motion.span
                  layoutId="biz-side"
                  className="absolute inset-0 rounded-[14px] bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <I active={active} className="relative shrink-0" />
              <span className="relative leading-tight">{n.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 rounded-[16px] bg-white/8 p-2.5">
        <Jimbot crop="head" shape="squircle" size={36} />
        <div className="min-w-0 text-[13px]">
          <p className="truncate font-display font-semibold">
            {d.profile.name || "Owner"}
          </p>
          <p className="text-[#E8CDB9]">Owner</p>
        </div>
      </div>
    </aside>
  )
}

function Rail() {
  const nav = useNav()

  const { pathname } = useLocation()

  const { t } = useBiz()

  return (
    <nav
      aria-label={t("Pangunahing navigation", "Main navigation")}
      className="fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col items-center gap-2 bg-brown py-5 md:flex xl:hidden dark:border-r dark:border-line dark:bg-surface"
    >
      <div className="mb-4">
        <BusinessMark size={46} />
      </div>
      {nav.map((n) => {
        const active = pathname.startsWith(n.to)

        const I = n.icon

        return (
          <Link
            key={n.to}
            to={n.to}
            aria-label={n.label}
            title={n.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-14 w-14 items-center justify-center rounded-[18px]",
              active ? "text-ink" : "text-cream/85 hover:bg-white/10",
            )}
          >
            {active && (
              <motion.span
                layoutId="biz-rail"
                className="absolute inset-0 rounded-[18px] bg-primary"
              />
            )}
            <I active={active} className="relative" />
          </Link>
        )
      })}
    </nav>
  )
}

function TabBar() {
  const nav = useNav()

  const { pathname } = useLocation()

  const { t } = useBiz()

  return (
    <nav
      aria-label={t("Pangunahing navigation", "Main navigation")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className="glass pointer-events-auto mx-auto flex h-[66px] max-w-[460px] items-center justify-between rounded-[30px] px-1.5 shadow-float">
        {nav.map((n) => {
          const active = pathname.startsWith(n.to)

          const I = n.icon

          return (
            <li key={n.to} className="flex-1">
              <Link
                to={n.to}
                aria-current={active ? "page" : undefined}
                aria-label={n.label}
                className={cn(
                  "relative mx-auto flex h-[54px] w-full max-w-[78px] flex-col items-center justify-center gap-0.5 rounded-[24px]",
                  active ? "text-ink" : "text-muted dark:text-[#C9A893]",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="biz-tab"
                    className="absolute inset-0 rounded-[24px] bg-primary"
                  />
                )}
                <I active={active} className="relative" />
                <span className="relative max-w-full truncate px-1 font-display text-[11px] font-medium leading-none">
                  {n.short}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/* ------------------------------ Top bar ------------------------------ */

function IconBtn({
  label,
  onClick,
  children,
  badge,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg hover:bg-sunken dark:hover:bg-elevated"
    >
      {children}
      {!!badge && (
        <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

function TopBar({ onBell }: { onBell: () => void }) {
  const { d, t } = useBiz()

  const install = useInstallPrompt()

  const [installHelp, setInstallHelp] = useState(false)

  const unread = d.notifs.filter((n) => !n.read).length

  const requestInstall = async () => {
    if (install.canPrompt) {
      await install.install()

      return
    }

    setInstallHelp(true)
  }

  return (
    <>
      <div className="glass sticky top-0 z-30 border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-16 items-center gap-2 px-3 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 md:hidden">
            <BusinessMark size={36} />
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-semibold leading-tight">
                {d.business.name || "Bitinary Business"}
              </p>
            </div>
          </div>
          <div className="hidden flex-1 md:block" />
          {!install.isStandalone && (
            <>
              <span className="hidden sm:block">
                <Button
                  size="md"
                  icon={<Download size={18} />}
                  onClick={requestInstall}
                >
                  {t("I-install", "Install app")}
                </Button>
              </span>
              <span className="sm:hidden">
                <IconBtn
                  label={t("I-install ang app", "Install app")}
                  onClick={requestInstall}
                >
                  <Download size={21} className="text-link" />
                </IconBtn>
              </span>
            </>
          )}
          <IconBtn
            label={t("Mga notification", "Notifications")}
            onClick={onBell}
            badge={unread}
          >
            <Bell size={21} strokeWidth={1.75} />
          </IconBtn>
        </div>
      </div>
      <Sheet
        open={installHelp}
        onClose={() => setInstallHelp(false)}
        title={t("Idagdag sa Home Screen", "Install Bitinary Business")}
      >
        <ol className="space-y-3 text-body">
          {install.isIOS ? (
            <>
              <li className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sunken">
                  <Share size={20} />
                </span>
                {t(
                  "I-tap ang Share sa ibaba ng Safari.",
                  "Tap Share at the bottom of Safari.",
                )}
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sunken">
                  <SquarePlus size={20} />
                </span>
                {t(
                  "Piliin ang Add to Home Screen.",
                  "Choose Add to Home Screen.",
                )}
              </li>
            </>
          ) : (
            <>
              <li>
                {t("Buksan ang menu ng browser.", "Open your browser menu.")}
              </li>
              <li>
                {t(
                  "Piliin ang Install app o Add to Home screen.",
                  "Choose Install app or Add to Home screen.",
                )}
              </li>
            </>
          )}
        </ol>
        <Button block className="mt-5" onClick={() => setInstallHelp(false)}>
          {t("Sige", "Done")}
        </Button>
      </Sheet>
    </>
  )
}

function NotifSheet({ open, onClose }: SheetProps) {
  const { d, setLocal, t, lang } = useBiz()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const navigate = useNavigate()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Mga notification", "Notifications")}
    >
      {error && <p role="alert" className="mb-3 text-danger">{t("Hindi na-save. Subukan ulit.", "Could not mark as read. Try again.")}</p>}
      {!d.notifs.length && <p className="text-fg-2">{t("Walang notification.", "No notifications yet.")}</p>}
      <ul className="space-y-2">
        {d.notifs.map((n) => (
          <li key={n.id}>
            <button
              disabled={pending !== null}
              onClick={async () => {
                if (!n.read) {
                  setError(false)
                  setPending(n.id)
                  const { error } = await updateNotification(n.id, { read_at: new Date().toISOString() })
                  setPending(null)
                  if (error) { setError(true); return }
                  await setLocal((x) => ({ ...x, notifs: x.notifs.map((m) => m.id === n.id ? { ...m, read: true } : m) }))
                }
                onClose()
                if (n.to.startsWith("/biz/")) navigate(n.to)
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-[16px] p-3 text-left",
                n.read ? "bg-transparent" : "bg-sunken dark:bg-elevated",
              )}
            >
              <Jimbot
                crop="head"
                size={40}
                expression={
                  n.kind === "review"
                    ? "celebrating"
                    : n.kind === "report-week"
                      ? "idea"
                      : n.kind === "report"
                        ? "pointing"
                        : "waving"
                }
                animate={false}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold leading-snug">
                  {n[lang]}
                </span>
                <span className="text-[13px] text-fg-2">
                  {relTime(n.at, lang)}
                </span>
              </span>
              {!n.read && (
                <span
                  className="h-2.5 w-2.5 rounded-full bg-primary"
                  aria-label={t("Hindi pa nababasa", "Unread")}
                />
              )}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

/* ------------------------------ Shell ------------------------------ */

export type BizShellContext = { openQuickUpdate: () => void }

export function BizShell() {
  const { t, status, d } = useBiz()
  const online = useOnline()
  const [sheet, setSheet] = useState<"quick" | "bell" | null>(null)
  const quickDirty = useRef(false)
  const markQuickDirty = useCallback((dirty: boolean) => { quickDirty.current = dirty }, [])
  const closeSheet = useCallback(() => {
    markQuickDirty(false)
    setSheet(null)
  }, [markQuickDirty])
  const cancelQuick = () => {
    if (!quickDirty.current || window.confirm(t("Itapon ang hindi na-save na update?", "Discard the unsaved update?"))) closeSheet()
  }
  const allowQuick = status === "verified" && !!d.business.id && !isBizPreview()

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Sidebar />
      <Rail />
      <div className="min-h-dvh pb-28 md:ml-[84px] md:pb-10 xl:ml-[264px]">
        <TopBar onBell={() => setSheet("bell")} />
        {!online && (
          <div role="status" className="mx-4 mt-3 flex items-center gap-3 rounded-[16px] bg-caution-bg px-4 py-3 text-caution md:mx-8">
            <CloudOff size={20} className="shrink-0" />
            <p className="text-[15px] font-semibold">
              {t("Offline ka. Kumonekta ulit para makapag-save.", "You're offline. Reconnect to save changes.")}
            </p>
          </div>
        )}
        <Outlet context={{ openQuickUpdate: () => { if (allowQuick) setSheet("quick") } } satisfies BizShellContext} />
      </div>
      <TabBar />
      <Sheet open={sheet === "quick" && allowQuick} onClose={cancelQuick} title={t("Mabilis na Update", "Quick Update")}>
        <QuickUpdatePanel onDone={closeSheet} onCancel={cancelQuick} onDirtyChange={markQuickDirty} />
      </Sheet>
      <NotifSheet open={sheet === "bell"} onClose={closeSheet} />
    </div>
  )
}
