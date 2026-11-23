import {
  ArrowRight,
  AtSign,
  Check,
  Globe,
  LogIn,
  Mail,
  PencilLine,
  Rocket,
  Smartphone,
  Sparkles,
} from "lucide-react"

import { motion } from "motion/react"

import { useEffect, useRef, useState } from "react"

import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router"

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"

import { DAYS, type BizThemeId, type BusinessProfile } from "@/app/account"

import { FlowLayout } from "@/components/flow/FlowLayout"

import {
  GoogleLogo,
  PasswordField,
  SelectCard,
  StrengthMeter,
  TextField,
} from "@/components/flow/Fields"

import { TermsConsentCard } from "@/components/auth/TermsConsentCard"

import { Jimbot } from "@/components/mascot/Jimbot"

import { HubLayout } from "@/components/onboarding/HubLayout"

import {
  CompletenessRing,
  OptTag,
  ReqTag,
  SavedNote,
  StepHeader,
  ThemeCard,
} from "@/components/onboarding/Kit"

import { SuccessScreen } from "@/components/onboarding/Templates"

import { Button } from "@/components/ui/Button"

import { Segmented } from "@/components/ui/Segmented"


import {
  REQUIRED_BIZ,
  bizThemes,
  bizTypeOpts,
  dayLabel,
  getBizThemesForType,
  label,
} from "@/data/themes"

import { cn } from "@/lib/cn"

import { getForcedState, isEmbed } from "@/lib/forced"

import { authRedirectUrl } from "@/lib/authRedirectUrl"

import {
  resendSignupConfirmation,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from "@/lib/passwordAuth"

import { AUTH_INTENT_KEY, AUTH_ROLE_KEY } from "@/lib/authFlow"

import { useBreakpoint } from "@/lib/useMedia"

import { useOnline } from "@/lib/useOnline"

import { supabase } from "@/lib/supabase"

import { turnstileSiteKey } from "@/lib/turnstile"

import { BizThemeForm } from "@/screens/business/BizThemes"

import { PasswordRecoveryPage } from "@/screens/signup/PasswordRecovery"

import { formatPH, validEmail } from "@/screens/signup/Signup"

import { loadOwnedBusiness } from "../db/businesses"

import { saveOwnerProfile } from "../db/ownerProfile"

import { useBiz, type LangPref } from "../store"

import { BizStatusChip } from "../ui"

function Weave({ id }: { id: string }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
      aria-hidden
    >
      <defs>
        <pattern
          id={id}
          width="34"
          height="34"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path d="M0 17h34M17 0v34" stroke="#2B130A" strokeWidth="2.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

function useResume() {
  const { set } = useBiz()

  const loc = useLocation()

  useEffect(() => {
    if (!isEmbed()) set((x) => ({ ...x, resume: loc.pathname + loc.search }))

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, loc.search])
}

const aside = (t: (a: string, b: string) => string) => ({
  asideTitle: t("Palaguin ang negosyo mo", "Grow your business"),
  asideBody: t(
    "Panatilihing sariwa ang impormasyon, mag-post, at makita ang resulta, nang madali.",
    "Keep your info fresh, post content and see results, with very little effort.",
  ),
})

/* ------------------------------ Language picker (first launch) ------------------------------ */

export function BizLanguage() {
  const { d, setLangPref } = useBiz()

  const navigate = useNavigate()

  const [pick, setPick] = useState<LangPref>(d.langPref ?? "en")

  const en = pick !== "tl"

  return (
    <main className="relative flex min-h-dvh flex-col bg-primary md:flex-row">
      <Weave id="bl-weave" />
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pt-[max(24px,env(safe-area-inset-top))]">
        <p className="absolute left-5 top-[max(16px,env(safe-area-inset-top))] font-display text-[20px] font-bold text-white">
          Bitinary <span className="text-ink">Business</span>
        </p>
        <Jimbot
          expression="waving"
          variant="standalone"
          size={240}
          className="max-h-[32vh] w-auto md:max-h-[50vh]"
        />
        <p className="mt-2 rounded-full bg-ink/85 px-4 py-1.5 font-display text-[14px] font-semibold text-cream">
          Hello! · Kumusta!
        </p>
      </div>
      <section className="relative rounded-t-[32px] bg-surface px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-6 text-fg md:my-auto md:mr-10 md:w-[440px] md:rounded-[32px] md:shadow-float xl:mr-24">
        <div className="flex items-center gap-2 text-link">
          <Globe size={20} />{" "}
          <span className="font-display text-[14px] font-semibold">
            Language · Wika
          </span>
        </div>
        <h1 className="mt-1 text-title">
          {en ? "Choose your language" : "Pumili ng wika"}
        </h1>
        <p className="mt-1 text-body text-fg-2">
          {en
            ? "Change it anytime from the globe button."
            : "Palitan anumang oras gamit ang globe button."}
        </p>
        <div role="radiogroup" className="mt-5 space-y-3">
          <SelectCard
            selected={pick === "en"}
            onClick={() => setPick("en")}
            icon={
              <span className="font-display text-[18px] font-bold">EN</span>
            }
            title="English"
            body="Use Bitinary Business in English"
          />
          <SelectCard
            selected={pick === "tl"}
            onClick={() => setPick("tl")}
            icon={
              <span className="font-display text-[18px] font-bold">TL</span>
            }
            title="Tagalog"
            body="Gamitin ang Bitinary Business sa Tagalog"
          />
          <SelectCard
            selected={pick === "device"}
            onClick={() => setPick("device")}
            icon={<Smartphone size={24} />}
            title={en ? "Follow device" : "Sundin ang device"}
            body={
              en ? "Match your phone's language" : "Ayon sa wika ng phone mo"
            }
          />
        </div>
        <Button
          block
          size="lg"
          className="mt-5"
          onClick={() => (
            setLangPref(pick), navigate("/biz/welcome", { replace: true })
          )}
        >
          {en ? "Continue" : "Magpatuloy"}
        </Button>
      </section>
    </main>
  )
}

/* ------------------------------ Welcome ------------------------------ */

export function BizWelcome() {
  const { d, t } = useBiz()

  const navigate = useNavigate()

  useEffect(() => {
    if (d.session && !isEmbed())
      navigate(
        d.business.live || d.business.name ? "/biz/stats" : "/biz/setup",
        { replace: true },
      )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="relative flex min-h-dvh flex-col bg-primary md:flex-row">
      <Weave id="bw-weave" />
      <div className="relative flex flex-1 flex-col pt-[max(14px,env(safe-area-inset-top))]">
        <p className="px-5 font-display text-[20px] font-bold text-white">
          Bitinary <span className="text-ink">Business</span>
        </p>
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <Jimbot
            expression="waving"
            variant="standalone"
            size={260}
            className="max-h-[34vh] w-auto md:max-h-[50vh]"
          />
          <span className="mt-2 rounded-full bg-ink/85 px-3.5 py-1.5 font-display text-[14px] font-semibold text-cream">
            {t(
              "Para sa karinderya, kapihan, resort at tour",
              "For carinderias, cafés, resorts and tours",
            )}
          </span>
        </div>
      </div>
      <section className="relative rounded-t-[32px] bg-surface px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-6 text-fg md:my-auto md:mr-10 md:w-[440px] md:rounded-[32px] md:shadow-float xl:mr-24">
        <h1 className="text-title">
          {t(
            "Ang negosyo mo, mas madaling hanapin",
            "Your business, easier to find",
          )}
        </h1>
        <p className="mt-2 text-body text-fg-2">
          {t(
            "I-update ang info, mag-post, sagutin ang review at tingnan ang resulta, sa ilang tap lang.",
            "Update your info, post, answer reviews and see results in a few taps.",
          )}
        </p>
        {d.resume && !d.session && (
          <button
            onClick={() => navigate(d.resume!)}
            className="mt-4 flex w-full items-center gap-3 rounded-[18px] border-2 border-primary bg-primary/10 p-3 text-left"
          >
            <Sparkles size={20} className="text-link" />
            <span className="font-display text-[15px] font-semibold">
              {t("Ituloy kung saan ka huminto", "Continue where you left off")}
            </span>
          </button>
        )}
        <Button
          block
          size="lg"
          className="mt-5"
          onClick={() => navigate("/biz/auth?mode=signup")}
        >
          {t("Gumawa ng business account", "Create a business account")}
        </Button>
        <Button
          block
          variant="ghost"
          className="mt-1 !h-12"
          icon={<LogIn size={18} />}
          onClick={() => navigate("/biz/auth?mode=login")}
        >
          {t("Mag-sign in", "Sign in")}
        </Button>
      </section>
    </main>
  )
}

/* ------------------------------ Sign-up steps ------------------------------ */

export function BizMethod() {
  useResume()

  const { t, set, showToast } = useBiz()

  const [params, setParams] = useSearchParams()

  const navigate = useNavigate()

  const online = useOnline()

  const mode = params.get("mode") === "login" ? "login" : "signup"

  const [acceptedTerms, setAcceptedTerms] = useState(false)

  useEffect(() => {
    let active = true

    void (async () => {
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        showToast({ text: sessionError.message })

        return
      }

      const user = data.session?.user

      if (!user || !active) return

      let keepSignupIntent = false

      if (mode === "signup" && user.user_metadata?.role !== "business") {
        const { error } = await supabase.auth.updateUser({
          data: { role: "business" },
        })

        if (error) {
          showToast({
            text: `Could not save your account type: ${error.message}`,
          })

          keepSignupIntent = true
        }
      }

      if (!active) return

      const email = user.email ?? ""

      set((x) => ({
        ...x,
        session: { method: "google", contact: email },
        profile: {
          ...x.profile,
          google: email,
          email: x.profile.email || email,
        },
      }))

      if (!keepSignupIntent) {
        sessionStorage.removeItem(AUTH_INTENT_KEY)

        sessionStorage.removeItem(AUTH_ROLE_KEY)
      }

      navigate(mode === "login" ? "/biz/stats" : "/biz/signup/name", {
        replace: true,
      })
    })()

    return () => {
      active = false
    }
  }, [mode, navigate, set, showToast])

  const google = async () => {
    sessionStorage.setItem(AUTH_INTENT_KEY, mode)

    if (mode === "signup") sessionStorage.setItem(AUTH_ROLE_KEY, "business")
    else sessionStorage.removeItem(AUTH_ROLE_KEY)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",

      options: {
        redirectTo: authRedirectUrl("biz/auth", { mode }),
        queryParams: { prompt: "select_account" },
      },
    })

    if (error) {
      sessionStorage.removeItem(AUTH_INTENT_KEY)

      sessionStorage.removeItem(AUTH_ROLE_KEY)

      showToast({ text: `Google sign-in failed: ${error.message}` })
    }
  }

  const Btn = ({
    icon,
    l,
    sub,
    onClick,
  }: {
    icon: React.ReactNode
    l: string
    sub: string
    onClick: () => void
  }) => (
    <motion.button
      whileTap={{ scale: 0.98 }}
      disabled={!online || (mode === "signup" && !acceptedTerms)}
      onClick={onClick}
      className="flex min-h-[68px] w-full items-center gap-4 rounded-[20px] border border-line bg-surface px-4 text-left shadow-card disabled:opacity-50"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sunken">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-display text-[16px] font-semibold">
          {l}
        </span>
        <span className="text-[14px] text-fg-2">{sub}</span>
      </span>
    </motion.button>
  )

  return (
    <FlowLayout
      pose="waving"
      {...aside(t)}
      header={
        <StepHeader
          step={1}
          total={4}
          onBack={() => navigate("/biz/welcome")}
        />
      }
    >
      <Segmented
        className="mt-1 w-full"
        value={mode}
        onChange={(m) => {
          setAcceptedTerms(false)
          setParams({ mode: m }, { replace: true })
        }}
        options={[
          { value: "signup", label: t("Gumawa ng account", "Create account") },
          { value: "login", label: t("Mag-sign in", "Sign in") },
        ]}
      />
      <h1 className="mt-6 text-title">
        {mode === "signup"
          ? t("Paano ka magsa-sign up?", "How do you want to sign up?")
          : t("Maligayang pagbabalik!", "Welcome back!")}
      </h1>
      {!online && (
        <p className="mt-3 rounded-[16px] bg-danger-bg p-3 text-[15px] font-semibold text-danger">
          {t(
            "Walang internet. Subukan ulit kapag may signal.",
            "No internet. Try again when you have signal.",
          )}
        </p>
      )}
      <div className="mt-6 space-y-3">
        <Btn
          icon={<GoogleLogo size={22} />}
          l={t("Magpatuloy gamit ang Google", "Continue with Google")}
          sub={t("Walang code na kailangan", "No code needed")}
          onClick={google}
        />
        <Btn
          icon={<Mail size={20} className="text-link" />}
          l={t(
            "Gamit ang email at password",
            "Continue with email and password",
          )}
          sub={t("Gumamit ng email at password", "Use your email and password")}
          onClick={() => navigate(`/biz/auth/email?mode=${mode}`)}
        />
      </div>
      {mode === "signup" && (
        <TermsConsentCard
          checked={acceptedTerms}
          onCheckedChange={setAcceptedTerms}
          t={t}
        />
      )}
    </FlowLayout>
  )
}

export function BizContact() {
  useResume()

  const [params] = useSearchParams()

  const { t } = useBiz()

  const navigate = useNavigate()

  const mode = params.get("mode") ?? "signup"

  const [v, setV] = useState(getForcedState() === "invalid" ? "81234" : "")

  const [password, setPassword] = useState("")

  const [confirmPassword, setConfirmPassword] = useState("")

  const [err, setErr] = useState<string | null>(
    getForcedState() === "invalid" ? "invalid" : null,
  )

  const ok = validEmail(v)

  const [busy, setBusy] = useState(false)

  const [captchaToken, setCaptchaToken] = useState<string>()

  const captchaRef = useRef<TurnstileInstance | null>(null)

  const go = async () => {
    if (!ok) return setErr("invalid")

    if (password.length < 8)
      return setErr("Use a password with at least 8 characters.")

    if (mode === "signup" && password !== confirmPassword)
      return setErr("Passwords do not match.")

    setBusy(true)

    const to = v.trim().toLowerCase()

    try {
      const result =
        mode === "login"
          ? await signInWithEmailPassword(to, password, captchaToken)
          : await signUpWithEmailPassword(
              to,
              password,
              "business",
              "biz/auth/callback",
              captchaToken,
            )

      if (result.error) {
        setErr(result.error)

        return
      }

      if (mode === "login" && result.user?.user_metadata?.role !== "business") {
        const businessResult = await loadOwnedBusiness()

        if (businessResult.error) return setErr(businessResult.error)

        if (!businessResult.data) {
          await supabase.auth.signOut()

          return setErr(
            t(
              "Hindi pang-negosyo ang account na ito.",
              "This is not a business account.",
            ),
          )
        }
      }

      if (mode === "signup" && !result.hasSession) {
        navigate(`/biz/auth/verify?to=${encodeURIComponent(to)}&mode=signup`)
      } else {
        navigate(`/biz/auth?mode=${mode}`, { replace: true })
      }
    } catch (submitError: unknown) {
      setErr(
        submitError instanceof Error
          ? submitError.message
          : "Could not complete email authentication.",
      )
    } finally {
      setBusy(false)

      captchaRef.current?.reset()

      setCaptchaToken(undefined)
    }
  }

  const errorMessage =
    err === "invalid"
      ? t("Mukhang mali ang email.", "That email doesn't look right.")
      : err === "Passwords do not match."
        ? t("Hindi magkapareho ang password.", "Passwords do not match.")
        : err?.startsWith("Use a password")
          ? t(
              "Gumamit ng password na hindi bababa sa 8 character.",
              "Use a password with at least 8 characters.",
            )
          : err

  return (
    <FlowLayout
      pose="waving"
      {...aside(t)}
      header={
        <StepHeader
          step={1}
          total={4}
          onBack={() => navigate(`/biz/auth?mode=${mode}`)}
        />
      }
      footer={
        <Button
          block
          size="lg"
          disabled={
            !v ||
            password.length < 8 ||
            (mode === "signup" && password !== confirmPassword) ||
            busy ||
            (!!turnstileSiteKey && !captchaToken)
          }
          onClick={go}
        >
          {mode === "signup"
            ? t("Gumawa ng account", "Create account")
            : t("Mag-sign in", "Sign in")}
        </Button>
      }
    >
      <div className="mt-2 flex h-16 w-16 items-center justify-center rounded-[20px] bg-primary text-ink">
        <AtSign size={30} />
      </div>
      <h1 className="mt-4 text-title">
        {t("Ano ang email mo?", "What's your email?")}
      </h1>
      <p className="mt-1 text-body text-fg-2">
        {mode === "signup"
          ? t(
              "Gumawa ng business account gamit ang email at password.",
              "Create your business account with an email and password.",
            )
          : t(
              "Mag-sign in gamit ang email at password mo.",
              "Sign in with your email and password.",
            )}
      </p>
      <div className="mt-6">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="business@example.com"
          value={v}
          onChange={(e) => (setV(e.target.value), setErr(null))}
          error={err ? errorMessage : null}
        />
        <div className="mt-4 space-y-3">
          <PasswordField
            label={t("Password", "Password")}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => (setPassword(e.target.value), setErr(null))}
          />
          {mode === "signup" && (
            <>
              <StrengthMeter password={password} />
              <PasswordField
                label={t("Kumpirmahin ang password", "Confirm password")}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => (
                  setConfirmPassword(e.target.value), setErr(null)
                )}
              />
            </>
          )}
        </div>
        {turnstileSiteKey && (
          <div className="mt-4">
            <Turnstile
              ref={captchaRef}
              siteKey={turnstileSiteKey}
              onSuccess={setCaptchaToken}
              onExpire={() => setCaptchaToken(undefined)}
              onError={() => setCaptchaToken(undefined)}
            />
          </div>
        )}
        {mode === "login" && (
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() =>
              navigate(
                `/biz/auth/recovery?email=${encodeURIComponent(v.trim().toLowerCase())}`,
              )
            }
          >
            {t("Nakalimutan ang password?", "Forgot password?")}
          </Button>
        )}
      </div>
      <SavedNote className="mt-6" />
    </FlowLayout>
  )
}

export function BizVerify() {
  useResume()

  const [params] = useSearchParams()

  const { t } = useBiz()

  const navigate = useNavigate()

  const to = params.get("to") ?? ""

  const mode = params.get("mode") ?? "signup"

  const [err, setErr] = useState<string | null>(null)

  const [resendAt, setResendAt] = useState(() => Date.now() + 30000)

  const [busy, setBusy] = useState(false)

  const [resendReady, setResendReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(
      () => setResendReady(true),
      Math.max(0, resendAt - Date.now()),
    )

    return () => window.clearTimeout(timer)
  }, [resendAt])

  const resend = async () => {
    setBusy(true)

    setErr(null)

    const { error } = await resendSignupConfirmation(to)

    setBusy(false)

    if (error) {
      setErr(error)

      return
    }

    setResendAt(Date.now() + 30000)

    setResendReady(false)
  }

  return (
    <FlowLayout
      pose="pointing"
      {...aside(t)}
      header={<StepHeader step={2} total={4} onBack={() => navigate(-1)} />}
    >
      <div className="mt-2 flex h-16 w-16 items-center justify-center rounded-[20px] bg-primary text-ink">
        <Mail size={30} />
      </div>
      <h1 className="mt-4 text-title">
        {t("Kumpirmahin ang email mo", "Confirm your email")}
      </h1>
      <p className="mt-1 text-body text-fg-2">
        {t(
          "Nagpadala kami ng verification email sa",
          "We sent a verification email to",
        )}{" "}
        <b className="text-fg">{to}</b>.{" "}
        {t(
          "Buksan ito para kumpirmahin ang account mo.",
          "Open it to confirm your account.",
        )}
      </p>
      {err && (
        <p role="alert" className="mt-4 text-[15px] font-semibold text-danger">
          {t(
            `Hindi maipadala ang email: ${err}`,
            `Could not send email: ${err}`,
          )}
        </p>
      )}
      <p className="mt-4 rounded-[18px] bg-sunken p-4 text-[14px] text-fg-2 dark:bg-elevated">
        {t(
          "Tingnan din ang spam o junk folder. Ang link ay para lang sa iyo.",
          "Check your spam or junk folder too. The link is for you only.",
        )}
      </p>
      <div className="mt-5">
        {resendReady ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void resend()}
          >
            {busy
              ? t("Ipinapadala…", "Sending…")
              : t("Ipadala ulit ang email", "Resend email")}
          </Button>
        ) : (
          <p className="font-display text-[15px] text-fg-2">
            {t(
              "Maghintay sandali bago humingi ng panibagong email.",
              "Please wait a moment before requesting another email.",
            )}
          </p>
        )}
      </div>
    </FlowLayout>
  )
}

export function BizPasswordRecovery() {
  const { t } = useBiz()

  return <PasswordRecoveryPage business t={t} />
}

export function BizAuthCallback() {
  const [params] = useSearchParams()

  const mode = params.get("mode") === "login" ? "login" : "signup"

  const to = params.get("to") ?? ""

  const { t, d } = useBiz()

  const navigate = useNavigate()

  const [error, setError] = useState<string | null>(null)

  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    void supabase.auth
      .getSession()
      .then(async ({ data, error: sessionError }) => {
        if (!active) return

        if (sessionError) {
          setError(sessionError.message)
        } else if (!data.session) {
          setError(
            t(
              "Hindi valid o expired na ang verification email.",
              "This verification email is invalid or expired.",
            ),
          )
        } else {
          const user = data.session.user

          let isBusinessAccount = user.user_metadata?.role === "business"

          if (!isBusinessAccount) {
            const businessResult = await loadOwnedBusiness()

            if (businessResult.error) throw new Error(businessResult.error)

            isBusinessAccount = !!businessResult.data
          }

          if (!active) return

          if (!isBusinessAccount) {
            setError(
              t(
                "Hindi pang-negosyo ang account na ito. Gumamit ng business account o mag-sign up.",
                "This is not a business account. Use a business account or sign up.",
              ),
            )
          } else {
            navigate(mode === "login" ? "/biz/stats" : "/biz/signup/name", {
              replace: true,
            })
          }
        }

        setChecking(false)
      })
      .catch((sessionError: unknown) => {
        if (active) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : "Could not verify the email.",
          )

          setChecking(false)
        }
      })

    return () => {
      active = false
    }
  }, [d.langPref, mode, navigate, t])

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 py-10 text-fg">
      <section
        role={error ? "alert" : "status"}
        className="w-full max-w-md rounded-[28px] bg-surface p-7 text-center shadow-card"
      >
        <Mail size={32} className="mx-auto text-primary" />
        <h1 className="mt-4 text-h2">
          {checking
            ? t("Sinusuri ang verification…", "Verifying your email…")
            : error
              ? t("Hindi makumpirma ang email", "Could not verify email")
              : t("Tagumpay", "Success")}
        </h1>
        {error && <p className="mt-2 text-body text-fg-2">{error}</p>}
        {error && (
          <Button
            className="mt-5"
            onClick={() =>
              navigate(
                mode === "signup" && to
                  ? `/biz/auth/verify?to=${encodeURIComponent(to)}&mode=signup`
                  : `/biz/auth/email?mode=${mode}`,
                { replace: true },
              )
            }
          >
            {mode === "signup"
              ? t(
                  "Ipadala ulit ang verification email",
                  "Resend verification email",
                )
              : t("Bumalik sa pag-sign in", "Back to sign in")}
          </Button>
        )}
      </section>
    </main>
  )
}

export function BizName() {
  useResume()

  const { d, set, t, showToast } = useBiz()

  const navigate = useNavigate()

  const [err, setErr] = useState(false)

  const [saving, setSaving] = useState(false)

  const p = d.profile

  const setP = (patch: Partial<typeof p>) =>
    set((x) => ({ ...x, profile: { ...x.profile, ...patch } }))

  const continueSignup = async () => {
    if (p.name.trim().length < 2) {
      setErr(true)

      return
    }

    setSaving(true)

    const result = await saveOwnerProfile({
      name: p.name.trim(),

      nickname: p.nickname.trim(),

      mobile: p.mobile.trim(),
    })

    setSaving(false)

    if (result.error || !result.data) {
      showToast({
        text:
          result.error ??
          t("Hindi na-save ang profile mo.", "Could not save your profile."),
      })

      return
    }

    set((x) => ({ ...x, profile: { ...x.profile, ...result.data } }))

    navigate("/biz/signup/ready")
  }

  return (
    <FlowLayout
      pose="waving"
      {...aside(t)}
      header={<StepHeader step={3} total={4} onBack={() => navigate(-1)} />}
      footer={
        <Button
          block
          size="lg"
          disabled={saving}
          onClick={() => void continueSignup()}
        >
          {saving ? t("Sine-save…", "Saving…") : t("Magpatuloy", "Continue")}
        </Button>
      }
    >
      <div className="flex items-end gap-1 md:hidden">
        <Jimbot
          expression="waving"
          variant="standalone"
          size={120}
          className="-ml-2"
        />
        <p className="mb-6 rounded-[20px] rounded-bl-md bg-surface px-4 py-2.5 font-display text-[15px] font-medium shadow-card">
          {t("Ano ang pangalan mo?", "What's your name?")}
        </p>
      </div>
      <h1 className="mt-2 text-title">
        {t("Ikaw ang may-ari?", "Tell us about you")}
      </h1>
      <div className="mt-6 space-y-5">
        <TextField
          label={t("Buong pangalan", "Full name")}
          value={p.name}
          placeholder="Business Owner"
          onChange={(e) => (setP({ name: e.target.value }), setErr(false))}
          error={err ? t("Ilagay ang pangalan mo.", "Enter your name.") : null}
        />
        <TextField
          label={t("Palayaw", "Nickname")}
          optional
          value={p.nickname}
          placeholder="Business"
          onChange={(e) => setP({ nickname: e.target.value })}
          hint={t(
            "Ganito ka babatiin ni Jimbot.",
            "How Jimbot will greet you.",
          )}
        />
      </div>
      <SavedNote className="mt-6" />
    </FlowLayout>
  )
}

export function BizReady() {
  const { d, t } = useBiz()

  const navigate = useNavigate()

  return (
    <SuccessScreen
      title={t("Handa na ang account mo!", "Your account is ready!")}
      chip={
        <span className="rounded-full bg-ink/85 px-3.5 py-1.5 font-display text-[13px] font-semibold text-cream">
          {t("Hakbang 4 sa 4", "Step 4 of 4")}
        </span>
      }
      body={t(
        `Salamat, ${d.profile.nickname || d.profile.name.split(" ")[0] || "Ka-negosyo"}! Ngayon, i-setup natin ang negosyo. Apat na tema lang ang kailangan para mag-live.`,
        `Thanks, ${d.profile.nickname || d.profile.name.split(" ")[0] || "partner"}! Now let's set up your business. Only four themes are required to go live.`,
      )}
      actions={
        <Button
          block
          size="lg"
          iconRight={<ArrowRight size={18} />}
          onClick={() => navigate("/biz/setup", { replace: true })}
        >
          {t("I-setup ang negosyo", "Set up my business")}
        </Button>
      }
    />
  )
}

/* ------------------------------ Business hub ------------------------------ */

function useFormCtx() {
  const { set, showToast } = useBiz()

  const { d } = useBiz()

  return {
    business: d.business,

    setBusiness: (
      fn: BusinessProfile | ((b: BusinessProfile) => BusinessProfile),
    ) =>
      set((x) => {
        const nb = typeof fn === "function" ? fn(x.business) : fn

        const updated = { ...x.updated }

        Object.entries(nb.status).forEach(
          ([k, v]) =>
            v === "done" &&
            x.business.status[(k as BizThemeId)] !== "done" &&
            (updated[k] = new Date().toISOString()),
        )

        return { ...x, business: nb, updated }
      }),

    showToast: (x: {
      text: string
      expression?: "celebrating" | "pointing" | "sleeping" | "idea"
    }) => showToast(x),
  }
}

export function BizSetupHub() {
  const { id } = useParams<{ id?: BizThemeId }>()

  const { d, t, lang, status } = useBiz()

  const navigate = useNavigate()

  const desktop = useBreakpoint() === "desktop"

  const ctx = useFormCtx()

  const b = d.business

  const req = REQUIRED_BIZ.filter((r) => b.status[r] === "done").length

  const ready = req === 4

  const businessThemes = getBizThemesForType(b.type)

  const done = businessThemes.filter((x) => b.status[x.id] === "done").length

  const onDone = () => navigate("/biz/setup", { replace: true })

  if (id && !desktop)
    return (
      <BizThemeForm
        key={id}
        id={id}
        ctx={ctx}
        onDone={onDone}
        onBack={() => navigate("/biz/setup")}
      />
    )

  const list = (
    <>
      <section className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <BizStatusChip status={status} />
          <h1 className="mt-2 flex items-center gap-2 text-title">
            {b.name || t("I-setup ang negosyo mo", "Set up your business")}{" "}
          </h1>
          <p className="mt-1 text-body text-fg-2">
            {ready
              ? t(
                  "Handa ka nang mag-live! Opsyonal ang iba.",
                  "You can go live now! The rest is optional.",
                )
              : t(
                  `${4 - req} na lang bago ka makapag-live. Pindutin ang Save sa bawat tema para ma-save ang mga pagbabago.`,
                  `${4 - req} more before you can go live. Save each theme to keep your changes.`,
                )}
          </p>
        </div>
        <CompletenessRing
          value={done / businessThemes.length}
          size={92}
          caption={`${done}/${businessThemes.length}`}
        />
      </section>
      {ready && !b.live && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[24px] bg-primary p-4">
          <Jimbot
            expression="celebrating"
            variant="standalone"
            size={72}
            className="-my-2"
          />
          <p className="min-w-0 flex-1 font-display text-[18px] font-bold text-white">
            {t("Kumpleto ang kailangan!", "Required themes done!")}
          </p>
          <Button
            variant="brown"
            size="lg"
            iconRight={<ArrowRight size={18} />}
            onClick={() => navigate("/biz/setup/summary")}
          >
            {t("Suriin at mag-live", "Review and go live")}
          </Button>
        </div>
      )}
      <div className="mt-6 flex items-center gap-2">
        <h2 className="text-h3">
          {t("Kailangan para makapag-live", "Needed to go live")}
        </h2>
        <ReqTag />
        <span className="ml-auto font-display text-[15px] font-semibold text-fg-2">
          {req}/4
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-1 xl:gap-2.5">
        {businessThemes
          .filter((x) => x.required)
          .map((x) => (
            <ThemeCard
              key={x.id}
              layout={desktop ? "row" : "tile"}
              icon={x.icon}
              title={x[lang]}
              minutes={x.minutes}
              status={b.status[x.id]}
              active={id === x.id}
              onClick={() => navigate(`/biz/setup/${x.id}`)}
            />
          ))}
      </div>
      <div className="mt-7 flex items-center gap-2">
        <h2 className="text-h3">{t("Opsyonal", "Optional")}</h2>
        <OptTag />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-1 xl:gap-2.5">
        {businessThemes
          .filter((x) => !x.required)
          .map((x) => (
            <ThemeCard
              key={x.id}
              layout={desktop ? "row" : "tile"}
              icon={x.icon}
              title={x[lang]}
              minutes={x.minutes}
              status={b.status[x.id]}
              active={id === x.id}
              onClick={() => navigate(`/biz/setup/${x.id}`)}
            />
          ))}
      </div>
    </>
  )

  const pane = id ? (
    <BizThemeForm
      key={id}
      id={id}
      ctx={ctx}
      embedded
      onDone={onDone}
      onBack={() => navigate("/biz/setup")}
    />
  ) : (
    <section className="flex h-full flex-col items-center justify-center rounded-[28px] bg-surface p-10 text-center shadow-card">
      <Jimbot expression="idea" variant="standalone" size={200} />
      <h2 className="mt-4 text-h2">
        {t("Apat na tema lang ang kailangan", "Only four themes are required")}
      </h2>
      <p className="mt-2 max-w-[380px] text-body text-fg-2">
        {t(
          "Lahat ay tina-type mo mismo. Puwedeng laktawan ang opsyonal at tapusin mamaya.",
          "Everything is typed by you. Optional themes can be skipped and finished later.",
        )}
      </p>
      <Button
        className="mt-6"
        onClick={() =>
          navigate(
            `/biz/setup/${REQUIRED_BIZ.find((r) => b.status[r] !== "done") ?? "menu"}`,
          )
        }
      >
        {t("Simulan ang susunod", "Start the next one")}
      </Button>
    </section>
  )

  return (
    <HubLayout
      onBack={() => navigate(b.live ? "/biz/stats" : "/biz/welcome")}
      list={list}
      pane={pane}
      footer={
        <Button
          block
          variant="secondary"
          size="lg"
          onClick={() => navigate("/biz/stats")}
        >
          {b.live
            ? t("Pumunta sa Statistika", "Go to Statistics")
            : t("Pumunta sa Pangkalahatan", "Go to Overview")}
        </Button>
      }
    />
  )
}

/* ------------------------------ Summary + go live ------------------------------ */

export function BizSummary() {
  const { d, set, t, lang, showToast } = useBiz()

  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  const b = d.business

  const missing = REQUIRED_BIZ.filter((r) => b.status[r] !== "done")

  const open = DAYS.filter((x) => !b.hours[x].closed)

  const rows: [BizThemeId, string, string][] = [
    [
      "basics",
      t("Negosyo", "Business"),
      `${b.name || "—"} · ${label(bizTypeOpts, b.type, lang) ?? "—"} · ${b.price ?? "—"}`,
    ],

    [
      "location",
      t("Lokasyon", "Location"),
      `${b.address || "—"}, ${b.city || "—"} · ${
        b.pin ? t("may pin", "pin placed") : t("walang pin", "no pin")
      }`,
    ],

    [
      "hours",
      t("Oras", "Hours"),
      `${open.map((x) => dayLabel[x][lang === "en" ? 1 : 0].slice(0, 3)).join(", ")} · ${
        b.hours.mon.allDay ? "24h" : `${b.hours.mon.open}–${b.hours.mon.close}`
      }`,
    ],

    [
      "contact",
      "Contact",
      `${b.contactName || "—"} · +63 ${formatPH(b.mobile)}`,
    ],
  ]

  const goLive = async () => {
    if (saving || missing.length) return
    setSaving(true)
    const result = await set((x) => ({
      ...x,
      business: {
        ...x.business,
        live: true,
        liveAt: new Date().toISOString(),
      },
      resume: null,
    }))
    setSaving(false)
    if (result.error) {
      showToast({ text: result.error, expression: "unsure" })
      return
    }
    navigate("/biz/live", { replace: true })
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto max-w-[760px] px-5 pb-12 pt-[max(16px,env(safe-area-inset-top))]">
        <Button variant="ghost" onClick={() => navigate("/biz/setup")}>
          ← {t("Bumalik", "Back")}
        </Button>
        <h1 className="mt-2 text-title">
          {t("Suriin bago mag-live", "Review before going live")}
        </h1>
        <p className="mt-1 text-body text-fg-2">
          {t(
            "Ito ang mga detalyeng inilagay mo. Puwedeng baguhin anumang oras.",
            "These are the details you entered. You can edit them anytime.",
          )}
        </p>
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-[20px] bg-surface shadow-card">
          {rows.map(([id, l, v]) => {
            const ok = b.status[id] === "done"

            return (
              <li
                key={id}
                className="flex min-h-16 items-center gap-3 px-4 py-3"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    ok
                      ? "bg-ok text-white dark:text-ink"
                      : "bg-danger-bg text-danger",
                  )}
                >
                  {ok ? <Check size={16} strokeWidth={3} /> : "!"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-display text-[15px] font-semibold">
                    {l} <ReqTag className="h-5 px-2 text-[11px]" />
                  </span>
                  <span className="block text-[15px] text-fg-2">{v}</span>
                </span>
                <button
                  onClick={() => navigate(`/biz/setup/${id}`)}
                  aria-label={t(`I-edit ang ${l}`, `Edit ${l}`)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-link hover:bg-sunken"
                >
                  <PencilLine size={19} />
                </button>
              </li>
            )
          })}
          <li className="flex min-h-14 items-center gap-3 px-4 py-3 text-[15px] text-fg-2">
            <OptTag />
            {t(
              `${bizThemes.filter((x) => !x.required && b.status[x.id] === "done").length} sa 6 na opsyonal ang tapos`,
              `${bizThemes.filter((x) => !x.required && b.status[x.id] === "done").length} of 6 optional themes done`,
            )}
          </li>
        </ul>
        <div className="mt-4 rounded-[18px] bg-caution-bg p-4 text-[15px] text-caution">
          <p className="font-display font-semibold">
            {t("Habang hindi pa na-verify:", "While not yet verified:")}
          </p>
          <p className="mt-1">
            {t(
              "Magagamit mo ang Quick Update, posts at basic stats. Bubukas ang Verified badge, deals, boosts at reservations pagka-verify.",
              "You can use Quick Update, posts and basic stats. The Verified badge, deals, boosts and reservations unlock after verification.",
            )}
          </p>
        </div>
        <Button
          block
          size="lg"
          className="mt-5 !h-16 !text-[19px]"
          icon={<Rocket size={22} />}
          disabled={missing.length > 0 || saving}
          onClick={() => void goLive()}
        >
          {saving ? t("Sine-save…", "Saving…") : t("Simulan na", "Go live")}
        </Button>
        {missing.length > 0 && (
          <p className="mt-2 text-center text-[15px] font-semibold text-danger">
            {t(
              `Tapusin muna ang ${missing.length} na kailangan. Mananatiling Draft ang negosyo.`,
              `Finish ${missing.length} required theme(s) first. Your business stays a Draft.`,
            )}
          </p>
        )}
      </div>
    </div>
  )
}

export function BizLive() {
  const { t, d } = useBiz()

  const navigate = useNavigate()
  const verified = d.business.verification.status === "verified"

  return (
    <SuccessScreen
      title={
        verified
          ? t("Live na ang negosyo mo!", "Your business is live!")
          : t("Tapos na ang profile mo!", "Your profile is ready!")
      }
      chip={<BizStatusChip status={verified ? "verified" : "live"} className="bg-white" />}
      body={t(
        verified
          ? `Live na sa traveler search ang ${d.business.name || "negosyo mo"}.`
          : `${d.business.name || "Negosyo mo"} ay hindi pa lalabas sa traveler search hangga't hindi kumpleto ang verification.`,
        verified
          ? `${d.business.name || "Your business"} is live in traveler search.`
          : `${d.business.name || "Your business"} will not appear in traveler search until verification is complete.`,
      )}
      actions={
        <>
          <Button
            block
            size="lg"
            onClick={() => navigate("/biz/stats", { replace: true })}
          >
            {t("Pumunta sa Pangkalahatan", "Go to Overview")}
          </Button>
          {!verified && (
            <Button
              block
              variant="ghost"
              className="!h-12"
              onClick={() => navigate("/biz/stats/backgrounds#verify")}
            >
              {t("Mag-verify ngayon", "Verify now")}
            </Button>
          )}
        </>
      }
    />
  )
}
