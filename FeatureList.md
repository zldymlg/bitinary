# Bitinary V1 Feature List

This is a product and pricing reference for the features represented in the current Version 1 codebase. It separates customer roles from internal tools and calls out screens that are still prototypes or use sample data. A feature appearing in the UI does not necessarily mean its pricing, external integration, or production workflow is complete.

## Status key

- **Available** - implemented for normal app use; database-backed where indicated.
- **Partial** - a working screen or workflow exists, but an important integration, data source, or end-to-end step is incomplete.
- **Demo / sample** - seeded content, illustrative metrics, or prototype-only behavior; do not sell as a production capability yet.
- **Internal** - for Bitinary operations, not a customer plan feature.

## User levels

### 1. Guest / unauthenticated visitor

- **Available:** Browse the traveler app, business categories, and public business profiles.
- **Available:** Search live, verified businesses by keyword, category, location, and price range.
- **Available:** See nearby verified dining businesses when location permission is granted; results use saved business coordinates.
- **Available:** View a live business profile's details, opening hours, menu, photos, posts, and reviews when those records exist.
- **Available:** Call a business, open its website, or open directions in Google Maps when contact/location data is available.
- **Available:** Use Jimbot for basic travel questions and business discovery. Jimbot uses rule-based intent handling and available database records; it is not a general-purpose AI concierge.
- **Available:** View the app on mobile or desktop and install the PWA when the browser supports installation.
- **Partial:** Browse static itinerary templates and edit a plan in the current browser session. An account is required to save a durable trip.
- **Demo / sample:** The standalone business directory, sample businesses, and sample Reels can use local demo data rather than live business records.
- **Not available:** Save an account-owned list, retain a trip across devices, or submit account-only interactions without signing in.

### 2. Traveler account

#### Account and preferences

- **Available:** Create/sign in with supported Google, email, or mobile flows; verification, password recovery, sign-out, and password updates are included.
- **Available:** Maintain a traveler profile and travel preferences, including budget, food, interests, companions, transport, pace, needs, and trip timing. Profile and personalization data are stored in Supabase.
- **Available:** Choose English or Tagalog, light/dark/system appearance, privacy consent, and app-level preferences. Some display and notification settings are stored only in the browser.
- **Available:** Add Bitinary to the device home screen as a PWA where supported.
- **Partial:** Account security settings support password management, but this is not a full device/session-management product.
- **Partial:** The traveler notification screen currently has an empty state; notification preference toggles are not a complete notification-delivery service.
- **Not available:** Data export and account deletion are represented by prompts, not completed export/deletion workflows.

#### Discover and interact

- **Available:** Search the live, verified business catalog and open dynamic business profiles.
- **Available:** View profile details, photos, menus, hours, contact information, map directions, posts, and reviews where businesses have published data.
- **Available:** Save and remove database-backed businesses from the traveler account.
- **Available:** Use post likes, comments, and review flows on eligible profiles where social interactions are enabled.
- **Available:** Share a business profile and report incorrect profile information.
- **Partial:** The "open now" search filter currently uses a text heuristic rather than calculating the result from business hours.
- **Partial:** Home location and nearest-business results work from location permission and verified records, but the personalized "For You" area currently has no matching-business feed.
- **Demo / sample:** Some static business cards, standalone directory content, and Reels interactions are sample/local rather than a complete live social feed.

#### Plan trips and use Jimbot

- **Available:** Start with itinerary templates, edit stop details, reorder stops, and see estimated budget totals.
- **Available:** Save a template itinerary and its stop snapshot to the traveler's account; saved trips can be reopened from another session after the itinerary-save database migration is applied.
- **Available:** Ask Jimbot about basic trip planning, budget, transport, packing, safety, weather topics, and business discovery. Business search uses live verified business records when available.
- **Available:** Signed-in travelers can revisit saved Jimbot conversations; conversation messages are stored in Supabase.
- **Partial:** Itinerary templates and their original stops are sample content. Jimbot answers are rule-based, and weather/safety answers are not a live forecast or emergency service.
- **Partial:** The app has business-side reservation management, but a complete traveler reservation-request flow is not currently exposed as a customer feature.

#### Moments

- **Available:** Capture a photo using the device camera, apply simple filters, add a caption, and save a private Moment.
- **Available:** Place Moments on a map using device location; browse the signed-in user's Moments and gallery filters.
- **Available:** Add collaborators to a Moment, attach additional photos, and remove collaborators/photos where permitted.
- **Available:** Moment photos use private Supabase Storage paths and signed URLs; saving to the map requires sign-in and location access.
- **Partial:** Moments are private/collaborative account content, not a public traveler social feed.

### 3. Business owner

#### Sign-up, setup, and public profile

- **Available:** Separate Bitinary Business sign-up and sign-in flows, including supported Google/email/mobile authentication and recovery.
- **Available:** Create and manage a business workspace with business name/type, location and map pin, opening hours, contact details, menu/prices, cover and photos, about text, specialties, languages, online links, and business goals.
- **Available:** Save the business workspace to Supabase and publish the business profile when required setup is complete.
- **Available:** Submit verification information and see draft, pending, more-documents-needed, or verified status.
- **Available:** Verified/live business profiles can be discovered by travelers and may appear in search, nearby results, and Jimbot results.
- **Available:** Update public business details, hours, menu items, and business media.

#### Day-to-day business tools

- **Available:** Business overview with Quick Update controls for open/closed state, sold-out status, queue status, and a daily special.
- **Available:** Profile Health Score and a checklist for details such as hours, photos, menu prices, contact information, and verification.
- **Available:** View available business metrics such as profile views, saves, itinerary additions, check-ins, ratings, comments, and deal activity.
- **Available:** Manage branches, staff records, account profile, language, appearance, Jimbot language matching, and notification preferences.
- **Available:** Generate and download business QR/check-in materials.
- **Available:** Business PWA entry point and responsive mobile/tablet/desktop layouts.

#### Content, engagement, and reputation

- **Available:** Create, edit, draft, schedule, and publish business posts, blog-style posts, and video/Reel content; upload business media to Supabase Storage.
- **Available:** Review comments and replies, hide/block/report actions where provided, and manage notifications.
- **Available:** Read reviews, reply as the business, and submit/report review cases with explanations or evidence where the workflow is available.
- **Partial:** A Facebook/cross-post control appears in the composer, but publishing to an external social network is not an implemented integration.
- **Partial:** Some review/comment/report screens carry later-phase labels and may contain prototype or sample states.

#### Growth and operations

- **Available, verification-gated:** Build deals such as Buy 1 Take 1, discounts, or add-ons; configure dates, times, limits, and QR/code redemption details.
- **Available, verification-gated:** Configure a boost by post, budget, duration, and audience/location target.
- **Available, verification-gated:** Configure queue/reservation settings and manage incoming business-side requests.
- **Available:** Business analytics screens provide date ranges, charts, funnel views, traffic sources, check-ins, search terms, peak hours, review insights, and report export controls.
- **Partial:** Some analytics comparisons, demand insights, reach estimates, and Jimbot-generated advice are illustrative; confirm their data source before including them in a paid promise.
- **Partial:** Boost budgets and estimated reach do not represent a complete ad-network purchase or payment integration.
- **Partial:** Reservation management is present on the business side, but the end-to-end traveler booking/request flow is not complete.
- **Partial:** Branch and team management screens exist, but staff invitation and role enforcement are not a complete production access-control flow.

### 4. Business manager and staff

- **Available in the UI:** The workspace defines Owner, Manager, and Staff roles with a permission matrix.
- **Available in the UI:** The matrix presents Quick Update access for all roles; posts/replies, business details, deals, and boosts for owners/managers; and billing plus staff/branch management for owners.
- **Partial:** The team screen can manage staff records and branches, but the displayed invite link is a prototype and the complete join/authentication and permission-enforcement flow is not confirmed. Do not price staff seats or promise strict role isolation until that flow is completed and tested.

### 5. Bitinary operations / developer admin

These are internal tools and should not be included in customer pricing:

- **Internal:** Admin overview and user/account management.
- **Internal:** Business directory administration, business verification, and moderation.
- **Internal:** Review/content moderation and platform announcements.
- **Internal:** Banner creation/management and theme/configuration tools.
- **Internal:** Feature flags, data tools, activity logs, and internal team management.
- **Internal:** Access is behind the developer/admin account gate.

## Pricing and release notes

### Traveler plans

- **Free (Guest and Traveler): PHP 0** - verified business search and profiles; call, website and Google Maps directions; saved businesses; likes, comments and reviews; basic Jimbot; itinerary editing and up to three saved trips; basic private Moments; PWA install; English and Tagalog.
- **Traveler Premium: PHP 149/month or PHP 1,490/year** - unlimited saved trips, extended Jimbot conversation history, and Moments collaborators with extra photos and storage. The annual plan represents 10 months of the monthly price.

The traveler billing sheet is a presentation mock; subscription quotas and entitlements are not enforced in the current app.

### Business plans and add-ons

- **Business Free: PHP 0** - business profile and verification submission, Quick Update, posts, basic stats, and Profile Health Score.
- **Business Plus: PHP 499/month** - analytics and report export, up to three branches, priority support, QR check-in materials, and deals after verification.
- **Team and Institutional Seats: PHP 550 per seat/year** - manager and staff accounts plus shared Quick Update and posting.
- **Business Onboarding Setup: PHP 500 per business** - assisted profile setup and verification-document help.
- **Post Boosting: from PHP 100** - custom budget; every PHP 10 added reaches an additional 30 people, with 300 people at the PHP 100 minimum.
- **Banner Ads: PHP 300 per banner/week** - traveler-app banner placement after review.

These are pricing concepts shown in the billing UI, not active subscription products:

- Plan selection is local UI state; it does not create or enforce a subscription.
- Payment methods and invoices are sample records; there is no completed payment-provider integration.
- No production billing, renewal, cancellation, tax, or entitlement enforcement should be assumed.

### Verification is separate from pricing

Deals, boosts, and reservations are shown as locked until a business is verified. This is a business-verification gate in the current app, not proof that those features belong to a paid subscription.

### Validate before selling

- Check the app's phase tags and demo states before treating a screen as generally available.
- Confirm each feature against a deployed Supabase project and its migrations; code in the repository does not mean a migration has already been applied.
- Clearly distinguish user-owned database records from local preferences, static templates, sample businesses, and seeded demo records.
- Do not advertise personalized recommendations, public Reels distribution, cross-posting, end-to-end bookings, real ad delivery, automated report delivery, account export/deletion, or paid-plan entitlements as complete without validating those workflows.

## Implementation map

- Traveler routes and account roles: [src/app/routes.tsx](./src/app/routes.tsx), [src/app/account.tsx](./src/app/account.tsx)
- Traveler home and discovery: [src/screens/Home.tsx](./src/screens/Home.tsx), [src/screens/Search.tsx](./src/screens/Search.tsx), [src/screens/DatabaseBusinessProfile.tsx](./src/screens/DatabaseBusinessProfile.tsx)
- Trips and Jimbot: [src/screens/Itinerary.tsx](./src/screens/Itinerary.tsx), [src/screens/Jimbot.tsx](./src/screens/Jimbot.tsx)
- Moments: [src/screens/moments/](./src/screens/moments/)
- Business app and phase inventory: [src/biz/ScreenIndex.tsx](./src/biz/ScreenIndex.tsx), [src/biz/pages/](./src/biz/pages/), [src/biz/db/](./src/biz/db/)
- Internal tools: [src/dev/console/](./src/dev/console/)
- Database schema and migrations: [supabase/schema.sql](./supabase/schema.sql), [supabase/migrations/](./supabase/migrations/)