import { Link, Navigate, createBrowserRouter, useLocation, useParams, useRouteError } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { AccountHome, HelpPage, PreferencesPage, ProfilePage } from '@/biz/pages/Account'
import { Analytics } from '@/biz/pages/Analytics'
import { Backgrounds } from '@/biz/pages/Backgrounds'
import { Comments } from '@/biz/pages/Comments'
import { Composer } from '@/biz/pages/Composer'
import { BizAuthCallback, BizContact, BizLanguage, BizLive, BizMethod, BizName, BizPasswordRecovery, BizReady, BizSetupHub, BizSummary, BizVerify, BizWelcome } from '@/biz/pages/Onboarding'
import { Overview } from '@/biz/pages/Overview'
import { Posts } from '@/biz/pages/Posts'
import { ReviewDetail, Reviews } from '@/biz/pages/Reviews'
import { BizScreenIndex } from '@/biz/ScreenIndex'
import { BizRoot, BizShell } from '@/biz/Shell'
import { Root } from '@/components/layout/Root'
import { Account } from '@/screens/Account'
import { HomeFull, HomeV1 } from '@/screens/Home'
import { ItineraryScreen } from '@/screens/Itinerary'
import { JimbotScreen } from '@/screens/Jimbot'
import { CreateMoment } from '@/screens/moments/CreateMoment'
import { MomentsCamera } from '@/screens/moments/MomentsCamera'
import { MomentsMap } from '@/screens/moments/MomentsMap'
import { NotFound } from '@/screens/NotFound'
import { PersonalizeHub } from '@/screens/personalize/Hub'
import { Preferences } from '@/screens/Preferences'
import { ReelsViewer } from '@/screens/ReelsViewer'
import { ComponentSheet, MascotSheet, ScreenIndex } from '@/screens/ScreenIndex'
import { SearchScreen } from '@/screens/Search'
import { ShopDetailScreen } from '@/screens/ShopDetail'
import { BusinessesScreen } from '@/screens/Businesses'
import { LanguagePick, Splash, Welcome } from '@/screens/signup/Entry'
import { ContactStep, EmailAuthCallback, MethodStep, NameStep, PasswordRecoveryStep, ReadyStep, RoleStep, VerifyStep } from '@/screens/signup/Signup'
import { ConsoleRoot, RequireDevAccount } from '@/dev/console/Shell'
import { Overview as DevOverview } from '@/dev/console/Overview'
import { UsersPage, UserDetail } from '@/dev/console/Users'
import { BusinessesPage, ModerationPage, AnnouncementsPage, FlagsPage, DataToolsPage, ActivityLogPage } from '@/dev/console/Ops'
import { VerificationPage, VerificationDetail } from '@/dev/console/Verification'
import { BannersPage, BannerEditor } from '@/dev/console/Banners'
import { ThemePage } from '@/dev/console/Theme'
import { TeamPage as DevTeamPage } from '@/dev/console/Team'

const basename = new URL(import.meta.env.BASE_URL, window.location.origin).pathname.replace(/\/$/, '') || undefined

function LegacyBusinessSetup() {
  const { id } = useParams()
  return <Navigate to={id ? '/biz/setup/' + encodeURIComponent(id) : '/biz/setup'} replace />
}

function RouteErrorFallback() {
  const error = useRouteError()
  const { pathname } = useLocation()
  const businessRoute = pathname.startsWith('/biz')
  const detail = error instanceof Error ? error.message : 'An unexpected application error occurred.'

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 py-10 text-fg">
      <section role="alert" className="w-full max-w-lg rounded-[28px] bg-surface p-7 shadow-card sm:p-9">
        <p className="font-display text-sm font-semibold uppercase tracking-wide text-primary">Bitinary</p>
        <h1 className="mt-2 text-h2">Hindi maipakita ang page</h1>
        <p className="mt-2 text-body text-fg-2">
          Nagkaroon ng hindi inaasahang problema. Maaari mong subukang i-reload ang page o bumalik sa simula.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => window.location.reload()} className="min-h-12 rounded-full bg-primary px-5 font-display font-semibold text-ink">
            I-reload ang page
          </button>
          <Link to={businessRoute ? '/biz/language' : '/'} className="inline-flex min-h-12 items-center rounded-full border border-line px-5 font-display font-semibold">
            Bumalik sa simula
          </Link>
        </div>
        <details className="mt-6 text-sm text-fg-2">
          <summary className="cursor-pointer font-semibold">Mga teknikal na detalye</summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-background p-3 font-mono text-xs">{detail}</pre>
        </details>
      </section>
    </main>
  )
}

// Dito ang source of truth ng URL paths at pag-group ng traveler, business, at dev screens.
export const router = createBrowserRouter(
  [
    {
      path: '/bitinarydev',
      Component: ConsoleRoot,
      errorElement: <RouteErrorFallback />,
      children: [
        {
          Component: RequireDevAccount,
          children: [
            { index: true, Component: DevOverview },
            { path: 'users', Component: UsersPage },
            { path: 'users/:id', Component: UserDetail },
            { path: 'businesses', Component: BusinessesPage },
            { path: 'verification', Component: VerificationPage },
            { path: 'verification/:placeId', Component: VerificationDetail },
            { path: 'moderation', Component: ModerationPage },
            { path: 'banners', Component: BannersPage },
            { path: 'banners/new', Component: BannerEditor },
            { path: 'banners/:id', Component: BannerEditor },
            { path: 'announcements', Component: AnnouncementsPage },
            { path: 'theme', Component: ThemePage },
            { path: 'flags', Component: FlagsPage },
            { path: 'data', Component: DataToolsPage },
            { path: 'log', Component: ActivityLogPage },
            { path: 'team', Component: DevTeamPage },
          ],
        },
      ],
    },
    {
      // Hiwalay ang Business app: sarili nito ang sign-in, shell, at workspace data.
      path: '/biz',
      Component: BizRoot,
      errorElement: <RouteErrorFallback />,
      children: [
        { index: true, element: <Navigate to="/biz/stats" replace /> },
        { path: 'screens', element: import.meta.env.DEV ? <BizScreenIndex /> : <Navigate to="/biz/stats" replace /> },
        { path: 'language', Component: BizLanguage },
        { path: 'welcome', Component: BizWelcome },
        { path: 'auth', Component: BizMethod },
        { path: 'auth/callback', Component: BizAuthCallback },
        { path: 'auth/recovery', Component: BizPasswordRecovery },
        { path: 'auth/verify', Component: BizVerify },
        { path: 'auth/email', Component: BizContact },
        { path: 'signup/name', Component: BizName },
        { path: 'signup/ready', Component: BizReady },
        { path: 'setup', Component: BizSetupHub },
        { path: 'setup/summary', Component: BizSummary },
        { path: 'setup/menu', element: <Navigate to="/biz/stats/backgrounds#menu" replace /> },
        { path: 'setup/photos', element: <Navigate to="/biz/stats/backgrounds#photos" replace /> },
        { path: 'setup/:id', Component: BizSetupHub },
        { path: 'live', Component: BizLive },
        {
          Component: BizShell,
          children: [
            { path: 'stats', Component: Overview },
            { path: 'stats/analytics', Component: Analytics },
            { path: 'stats/backgrounds', Component: Backgrounds },
            { path: 'jimbot', element: <Navigate to="/biz/stats" replace /> },
            { path: 'search/*', element: <Navigate to="/biz/stats" replace /> },
            { path: 'content', Component: Posts },
            { path: 'content/new', Component: Composer },
            { path: 'content/edit/:id', Component: Composer },
            { path: 'content/comments', Component: Comments },
            { path: 'content/reviews', Component: Reviews },
            { path: 'content/reviews/cases/*', element: <Navigate to="/biz/content/reviews" replace /> },
            { path: 'content/reviews/:id', Component: ReviewDetail },
            { path: 'account', Component: AccountHome },
            { path: 'account/profile', Component: ProfilePage },
            { path: 'account/team', element: <Navigate to="/biz/account" replace /> },
            { path: 'account/qr', element: <Navigate to="/biz/account" replace /> },
            { path: 'account/deals', element: <Navigate to="/biz/account" replace /> },
            { path: 'account/boost', element: <Navigate to="/biz/account" replace /> },
            { path: 'account/reservations', element: <Navigate to="/biz/account" replace /> },
            { path: 'account/billing', element: <Navigate to="/biz/account" replace /> },
            { path: 'account/preferences', Component: PreferencesPage },
            { path: 'account/help', Component: HelpPage },
            { path: '*', element: <Navigate to="/biz/stats" replace /> },
          ],
        },
      ],
    },
    {
      path: '/',
      Component: Root,
      errorElement: <RouteErrorFallback />,
      children: [
        { path: 'splash', Component: Splash },
        { path: 'language', Component: LanguagePick },
        { path: 'welcome', Component: Welcome },
        { path: 'onboarding', element: <Navigate to="/welcome" replace /> },
        { path: 'role', element: <Navigate to="/signup/role" replace /> },
        { path: 'signup/role', Component: RoleStep },
        { path: 'auth', Component: MethodStep },
        { path: 'auth/callback', Component: EmailAuthCallback },
        { path: 'auth/recovery', Component: PasswordRecoveryStep },
        { path: 'auth/email', Component: ContactStep },
        { path: 'auth/verify', Component: VerifyStep },
        { path: 'signup/name', Component: NameStep },
        { path: 'signup/ready', Component: ReadyStep },
        { path: 'personalize', Component: PersonalizeHub },
        { path: 'personalize/:id', Component: PersonalizeHub },
        { path: 'business', element: <Navigate to="/biz/stats" replace /> },
        { path: 'business/setup/:id', element: <LegacyBusinessSetup /> },
        { path: 'business/setup', element: <Navigate to="/biz/setup" replace /> },
        { path: 'business/hub', element: <Navigate to="/biz/setup" replace /> },
        { path: 'business/preview', element: <Navigate to="/biz/setup/summary" replace /> },
        { path: 'business/live', element: <Navigate to="/biz/stats" replace /> },
        { path: 'reels/:id', Component: ReelsViewer },
        { path: 'screens', Component: ScreenIndex },
        { path: 'screens/components', Component: ComponentSheet },
        { path: 'screens/mascot', Component: MascotSheet },
        {
          Component: AppShell,
          children: [
            { index: true, Component: HomeFull },
            { path: 'home-v1', Component: HomeV1 },
            { path: 'jimbot', Component: JimbotScreen },
            { path: 'search', Component: SearchScreen },
            { path: 'shop/:id', Component: ShopDetailScreen },
            { path: 'negosyo', Component: BusinessesScreen },
            { path: 'itinerary/:id', Component: ItineraryScreen },
            { path: 'moments', Component: MomentsCamera },
            { path: 'moments/map', Component: MomentsMap },
            { path: 'moments/create', Component: CreateMoment },
            { path: 'account', Component: Account },
            { path: 'account/preferences', Component: Preferences },
            { path: '*', Component: NotFound },
          ],
        },
      ],
    },
  ],
  { basename },
)
