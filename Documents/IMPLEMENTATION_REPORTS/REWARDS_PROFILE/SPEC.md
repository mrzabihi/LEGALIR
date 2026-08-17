7c0c3360-ecb1-4e83-8a39-a8fe449ba672
01a2e331-3014-4408-a55e-6f756eed9004
user
user
بسیار خب . حالا میخام ورژن بعدی رو شروعکنی به انجام دادن. همه تسکها رو به ترتیب بافرض اینکه تمامی درخواست هات OK  و APPROVE  داری رو انجام بده 
LEGALIR — Favicon + Profile Completion + Rewards & Loyalty System
Incremental Implementation Prompt for SIMOCODE CLI
You are working on the existing and currently running LEGALIR product.
This is NOT a rebuild.
Do not change the current product architecture, authentication, navigation structure, working routes, subscription system, OTP implementation, Chat architecture, or stable functionality unless a minimal change is strictly required for the tasks below.
Your mission is to implement the following features professionally and safely:
1.    Complete Favicon / Web App Icon support
2.    Fix the Profile Completion bug
3.    Redesign Profile Completion into a real 0–100% system
4.    Remove the Dashboard completion card automatically at 100%
5.    Add a new LEGALIR Points / Rewards system
6.    Show user score beside the Avatar in the application header
7.    Persist all points correctly in the Development Database
8.    Prepare the Rewards architecture for future subscription purchases using points
________________________________________
TASK 0 — USE ALL AVAILABLE AGENTS, SKILLS, HOOKS AND CLI CAPABILITIES
Before implementation, discover every relevant capability already installed in the repository.
Search recursively for:
•    Agents
•    Subagents
•    Skills
•    Hooks
•    MCP tools
•    CLI tools
•    Repository instructions
•    AGENTS.md
•    CLAUDE.md
•    Skill folders
•    Design tools
•    Testing tools
•    Database tools
Especially use, when available:
•    UI UX PRO MAX
•    Senior Frontend Developer
•    Senior Full Stack Developer
•    Senior Backend Developer
•    Senior Architecture
•    Design System
•    Product Manager
•    Senior Product Designer
•    Database Engineer
•    Security Reviewer
•    QA Engineer
•    E2E Testing
•    Accessibility
•    Responsive Design
•    Performance Engineer
•    Code Review Agent
Do not merely mention them in the final report.
Actually assign work to them.
Suggested ownership:
UI UX PRO MAX
Review:
•    Profile completion card
•    Extended profile UX
•    Header Points Card
•    Rewards visualization
•    Empty and complete states
•    Mobile layout
•    Desktop layout
•    Light/Dark themes
Senior Frontend Developer
Implement:
•    profile progress state
•    React Query synchronization
•    header rewards card
•    favicon metadata
•    responsive UI
•    animations
•    state transitions
Senior Full Stack Developer
Implement:
•    points APIs
•    user progress APIs
•    reward events
•    transaction consistency
Senior Backend Developer
Implement:
•    profile completion calculation
•    reward ledger
•    purchase rewards
•    daily visit reward
Senior Architecture
Review:
•    source of truth
•    event/idempotency architecture
•    future redemption architecture
Database Engineer
Implement:
•    migrations
•    reward ledger
•    reward rules
•    indexes
•    unique constraints
QA
Test:
•    profile 25% bug
•    50% state
•    100% state
•    rewards
•    daily visit duplication
•    purchase rewards
•    favicon
•    responsive layout
Use Hooks where available for:
•    post-edit testing
•    lint/typecheck
•    UI validation
•    database migration validation
•    regression checks
________________________________________
TASK 1 — PROTECT CURRENT PRODUCT
Before modifying anything:
1.    Inspect Git state.
2.    Record:
o    branch
o    commit SHA
o    current version
o    migrations
o    working tree
3.    Create a new development branch/version according to the repository convention.
4.    Do not overwrite an existing released version.
Create:
DOCUMENTS/IMPLEMENTATION_REPORTS/REWARDS_PROFILE/BASELINE.md
Document:
•    current favicon state
•    current profile fields
•    current completion calculation
•    current Dashboard behavior
•    current Header/Avatar component
•    current subscription/payment events
•    current database models
•    current user-session model
Do not start by rewriting code.
Audit first.
________________________________________
TASK 2 — READ DOCUMENTS AND EXISTING CODE
Read relevant files recursively inside:
DOCUMENTS/
Especially:
•    PRD
•    FSD
•    User Journey
•    Profile requirements
•    Subscription requirements
•    Design System
•    Architecture
•    Database design
•    Frontend implementation reports
Inspect actual code for:
•    /dashboard
•    /profile
•    application header
•    Avatar
•    user menu
•    theme system
•    current profile mutation
•    Dashboard query
•    Profile query
•    React Query keys
•    Zustand stores if any
•    database User/Profile models
•    payment success workflow
•    subscription activation workflow
Do not create duplicate mechanisms.
________________________________________
TASK 3 — COMPLETE FAVICON SUPPORT
LEGALIR must have a proper Favicon and application icon across:
•    Public website
•    Landing Page
•    Authenticated Web App
•    Desktop browsers
•    Mobile browsers
•    Mobile home-screen shortcut where supported
•    PWA metadata if the project already supports it
Use the existing approved LEGALIR logo / mark.
Do NOT redesign the brand.
Inspect existing approved assets first.
Prefer the compact LEGALIR brand mark for very small icon sizes rather than trying to squeeze a long wordmark into 16×16.
If the approved asset contains an unwanted background, generate a clean transparent derivative from the same approved asset without changing its design.
________________________________________
TASK 4 — FAVICON ASSET SET
Create/use the appropriate asset set according to the project's framework.
For a Next.js App Router project, use the framework-native metadata conventions where appropriate.
Support at minimum:
•    favicon.ico
•    SVG or high-resolution PNG icon
•    Apple Touch Icon
•    192×192 app icon
•    512×512 app icon
•    maskable icon if manifest/PWA exists
Potential assets:
favicon.ico
icon.svg
icon-192.png
icon-512.png
apple-touch-icon.png
Do not duplicate files unnecessarily if Next.js already supports generated metadata assets.
Make sure transparent edges render correctly.
________________________________________
TASK 5 — WEB MANIFEST / METADATA
If a Web Manifest exists, update it.
If the application already has PWA metadata, preserve its architecture.
Required brand information:
Name:
LEGALIR
Persian name where supported:
لیگالیر
Theme colors must align with the approved brand.
Do not make Web App icons disappear in Dark OS mode.
Add correct HTML/Next metadata.
Verify browser requests do NOT return 404 for:
•    favicon
•    app icon
•    apple touch icon
•    manifest
________________________________________
TASK 6 — FAVICON QA
Test favicon on:
•    Landing
•    Dashboard
•    Login
•    Profile
•    Blog if enabled
•    unknown/404 route
Verify:
•    browser tab icon appears
•    no favicon 404
•    transparent background is correct
•    icon is recognizable at small size
•    mobile shortcut metadata works where supported
Document results.
________________________________________
TASK 7 — FIX THE EXISTING PROFILE COMPLETION BUG
Known current behavior:
Dashboard:
http://localhost:3000/dashboard
shows:
تکمیل پروفایل ۲۵٪
Supporting copy:
«برای استفاده از تمام امکانات، پروفایل خود را تکمیل کنید»
User presses:
«تکمیل پروفایل»
and goes to:
http://localhost:3000/profile
User completes the existing Profile fields.
However, Dashboard still displays:
25%.
This is a bug.
Find the actual root cause.
Do NOT hide it with UI hacks.
Audit:
•    Profile persistence
•    API response
•    database update
•    mutation
•    React Query
•    query invalidation
•    Dashboard summary
•    stale cache
•    derived completion state
•    duplicate calculation functions
•    hard-coded 25
•    initial seed values
________________________________________
TASK 8 — ONE SOURCE OF TRUTH FOR PROFILE COMPLETION
There must be exactly ONE authoritative Profile Completion calculation.
Preferred approach:
Backend/domain computes:
profile_completion_percentage
Frontend displays the result.
Do not independently calculate:
25%
on Dashboard,
another value on Profile,
and another value in Header.
If the architecture intentionally uses frontend calculation, centralize it into a single domain utility.
But Backend-derived completion is preferred.
________________________________________
TASK 9 — NEW PROFILE COMPLETION MODEL
Change Profile Completion into TWO major stages.
STAGE A — Basic Profile
Total contribution:
50%
The fields that currently exist and are already expected on /profile
represent the first half of profile completion.
The exact required fields must be discovered from the existing implementation and product documents.
Examples may currently include:
•    نام
•    نام خانوادگی
•    شهر
•    شغل / حوزه فعالیت
•    other currently approved required fields
Do NOT invent additional mandatory sensitive fields.
Once ALL currently required Basic Profile fields are completed:
Dashboard must show:
تکمیل پروفایل ۵۰٪
Not 25%.
Persist this state.
Reloading the page must still show 50%.
Logging out and logging in must still show 50%.
________________________________________
TASK 10 — SECOND 50%: LEGALIR EXTENDED PROFILE
The remaining:
50%
must come from completing a second Profile section.
First inspect DOCUMENTS and current product requirements for already-approved fields.
If approved Extended Profile fields already exist:
USE THEM.
Do not create duplicates.
If no approved Extended Profile specification exists, implement a configurable low-risk default called:
«پروفایل حقوقی من»
Suggested non-sensitive fields:
1.    نوع کاربر
o    شخصی
o    کسب‌وکار / سازمان
2.    استان
3.    حوزه‌های حقوقی مورد نیاز
o    حداقل یک مورد
o    قراردادها
o    املاک
o    خانواده
o    تجارت
o    مطالبات
o    کار
o    سایر
4.    هدف اصلی استفاده از لیگالیر
o    مشاوره حقوقی
o    بررسی قرارداد
o    ساخت قرارداد
o    تحلیل سند
o    آموزش حقوقی
o    مدیریت امور حقوقی
If equivalent information already exists in Profile, reuse it.
Do NOT duplicate fields.
Do NOT request:
•    National ID
•    court credentials
•    government passwords
•    sensitive identity data
unless an existing approved LEGALIR document explicitly requires them.
________________________________________
TASK 11 — EXTENDED PROFILE WEIGHTS
Design this as a configurable completion rule.
Do not scatter magic percentages across React components.
Concept:
Basic Profile        = 50%
Extended Profile     = 50%
Total                = 100%
Within Extended Profile:
If four equally weighted sections are used:
user_type             12.5%
province              12.5%
legal_interests       12.5%
primary_use_case      12.5%
This produces:
50%
62.5%
75%
87.5%
100%
The UI may round appropriately for display.
But store/calculate accurately.
If existing product requirements define different fields or weights:
follow those requirements instead.
________________________________________
TASK 12 — PROFILE UI REDESIGN
Use UI UX PRO MAX.
The Profile page should clearly show two sections:
اطلاعات پایه
Status:
کامل / ناقص
Contribution:
50%
پروفایل حقوقی من
Status:
کامل / ناقص
Contribution:
50%
Create a polished progress visualization.
Possible design:
Circular progress
+
step cards
or:
Segmented progress bar:
اطلاعات پایه        ██████████ 50%
پروفایل حقوقی       ░░░░░░░░░░ 0%
Do not make it look like a developer progress bar.
Use proper LEGALIR Design System.
________________________________________
TASK 13 — DASHBOARD PROFILE CARD STATES
The Dashboard Profile Completion card must behave dynamically.
0–49%
Show:
«پروفایل خود را تکمیل کنید»
50%
Show:
«اطلاعات پایه تکمیل شد»
Supporting:
«برای تکمیل پروفایل حقوقی و دریافت تجربه شخصی‌سازی‌شده، مرحله دوم را تکمیل کنید.»
CTA:
«ادامه تکمیل پروفایل»
51–99%
Show current progress.
100%
REMOVE the Dashboard Profile Completion card.
Do not leave a useless:
«پروفایل ۱۰۰٪ کامل»
on the Dashboard.
At 100%, the onboarding task is complete.
________________________________________
TASK 14 — IMMEDIATE PROFILE SYNCHRONIZATION
After Profile Save:
1.    persist database
2.    return updated profile
3.    recompute completion
4.    invalidate Profile query
5.    invalidate Dashboard query
6.    invalidate Header/User summary if necessary
7.    update UI immediately
No page refresh should be required.
No stale 25%.
________________________________________
TASK 15 — PROFILE COMPLETION REWARD
When user reaches:
100% Profile Completion
for the FIRST TIME:
award:
1000 LEGALIR Points
Rule:
PROFILE_COMPLETED = +1000
This reward must only happen ONCE per account.
If user later removes a profile field and completes it again:
DO NOT award another 1000.
Use an idempotent reward event.
________________________________________
TASK 16 — INTRODUCE LEGALIR POINTS
Create a new product concept:
امتیاز لیگالیر
Internal naming can be:
LEGALIR Points
or:
RewardPoints
This is a user loyalty/rewards system.
It must be backed by the Development Database.
Do NOT store the authoritative balance in:
•    LocalStorage
•    cookies
•    Zustand
•    frontend-only state
Frontend may cache/display it.
Backend/database is source of truth.
________________________________________
TASK 17 — APPROVED REWARD RULES
Create configurable Reward Rules.
Initial approved rules:
Complete Profile
Event:
PROFILE_COMPLETED
Reward:
1000 points
Frequency:
Once per account.
________________________________________
Daily Visit
Event:
DAILY_VISIT
Reward:
100 points
Frequency:
Maximum once per calendar day.
Do NOT award 100 points on every refresh.
Do NOT award multiple times for:
•    opening multiple tabs
•    refreshing
•    navigating between routes
•    API retries
Use the user's LEGALIR business timezone.
For the Iranian product, use the project's approved timezone strategy.
If no strategy exists:
use:
Asia/Tehran
for determining the reward day.
Store event timestamps in UTC.
________________________________________
Friend Referral
Future event:
REFERRAL_COMPLETED
Reward:
500 points
This feature is NOT implemented yet.
Create the reward rule and architecture.
Keep triggering disabled behind a Feature Flag.
Do not create fake referral success.
________________________________________
Silver Subscription Purchase
Event:
SUBSCRIPTION_SILVER_PURCHASED
Reward:
850 points
Award after successful completed purchase only.
________________________________________
Gold Subscription Purchase
Event:
SUBSCRIPTION_GOLD_PURCHASED
Reward:
1000 points
Award after successful completed purchase only.
________________________________________
Diamond Subscription Purchase
Event:
SUBSCRIPTION_DIAMOND_PURCHASED
Reward:
1500 points
Award after successful completed purchase only.
________________________________________
TASK 18 — PURCHASE REWARD SAFETY
Subscription rewards must be connected to the existing successful payment/subscription activation flow.
Do NOT award points when:
•    user opens checkout
•    payment begins
•    payment is pending
•    payment fails
•    payment is cancelled
Only award after confirmed successful purchase.
Use:
payment_id
order_id
subscription_purchase_id
or the current canonical transaction identifier as an idempotency key.
The same purchase must NEVER award points twice.
________________________________________
TASK 19 — REFUNDS / REVERSALS
Prepare the architecture for future refunds.
If a payment is later refunded/reversed and the current payment system supports this:
create a compensating ledger transaction.
Example:
DIAMOND_PURCHASE +1500

PAYMENT_REFUND -1500
Do not delete historical reward entries.
Use ledger accounting.
________________________________________
TASK 20 — REWARD LEDGER ARCHITECTURE
Do NOT implement points as:
user.points += 100
without transaction history.
Create a proper ledger.
Suggested entity:
RewardLedgerEntry
Fields:
id
user_id
event_type
points_delta
source_type
source_id
idempotency_key
description
metadata
created_at
Examples:
PROFILE_COMPLETED     +1000
DAILY_VISIT            +100
SILVER_PURCHASE        +850
GOLD_PURCHASE         +1000
DIAMOND_PURCHASE      +1500
Balance:
SUM(points_delta)
You may maintain a cached balance for performance,
but ledger remains authoritative.
________________________________________
TASK 21 — REWARD RULE ENTITY / CONFIGURATION
Avoid hardcoding every score in UI.
Create configuration/domain rules such as:
PROFILE_COMPLETED = 1000
DAILY_VISIT = 100
REFERRAL_COMPLETED = 500
SILVER_PURCHASE = 850
GOLD_PURCHASE = 1000
DIAMOND_PURCHASE = 1500
These can be:
•    DB-backed rules
•    domain configuration
•    typed configuration
according to existing architecture.
Frontend only receives/display values.
________________________________________
TASK 22 — DATABASE MIGRATIONS
Extend the existing database.
Do NOT introduce a second DB.
Potential entities:
RewardLedgerEntry
RewardRule
DailyRewardClaim
RewardRedemption
Only add what is required by current architecture.
Suggested unique protections:
Daily reward:
UNIQUE(user_id, reward_date, event_type)
Profile reward:
UNIQUE(user_id, event_type)
Purchase reward:
UNIQUE(idempotency_key)
This must remain safe under concurrent requests.
________________________________________
TASK 23 — DAILY VISIT DEFINITION
A "daily visit" should mean a meaningful authenticated LEGALIR visit.
Do not reward just loading a public Landing page.
Recommended rule:
Authenticated user enters the Web App / Dashboard successfully.
Backend attempts:
claimDailyVisitReward(user_id)
If today's reward already exists:
return:
awarded = false
If not:
create:
+100
return:
awarded = true
points = 100
The call itself must be idempotent.
________________________________________
TASK 24 — DAILY REWARD MICRO-INTERACTION
When 100 daily points are awarded:
show a subtle polished UI event.
Example:
+۱۰۰ امتیاز
Supporting:
«امتیاز حضور امروز به حساب شما اضافه شد.»
Use:
•    Snackbar
•    compact animated badge
•    subtle count-up
Do NOT show a huge blocking modal every day.
Respect:
prefers-reduced-motion.
________________________________________
TASK 25 — HEADER POINTS CARD
When Profile Completion reaches 100%, the Dashboard completion card disappears.
At the same time, show a new compact card/pill next to the Avatar in the application's top-left header area as requested.
Label:
«امتیاز من»
Example:
🏅 ۲٬۳۵۰
امتیاز
Use a professional LEGALIR icon rather than emoji in final implementation.
The score component must:
•    be compact
•    be clearly readable
•    work in Light Theme
•    work in Dark Theme
•    work on Desktop
•    adapt on Tablet
•    not break Header layout
•    not overlap Avatar
Use UI UX PRO MAX to design it.
________________________________________
TASK 26 — MOBILE POINTS DISPLAY
Do not force a large points card into a small mobile header.
Create responsive behavior.
Possible Mobile version:
compact icon + number:
◆ ۲۳۵۰
or display inside the user/Profile sheet.
The points balance must still be easily discoverable.
Test:
375
390
430
No overlap with:
•    navigation
•    Floating Chat
•    header actions
•    Avatar
________________________________________
TASK 27 — POINTS CARD INTERACTION
The Points Card should be clickable/tappable.
Open:
«امتیازهای من»
This can be:
•    a section inside Profile
•    a Bottom Sheet
•    a dedicated subpage
Follow current app architecture.
Do not unnecessarily add another primary navigation item.
________________________________________
TASK 28 — "MY POINTS" EXPERIENCE
Create a polished view.
Header:
امتیازهای من
Show:
Current balance
Example:
۳٬۸۵۰ امتیاز
Then:
راه‌های کسب امتیاز
Cards:
تکمیل پروفایل
+1000
status: دریافت شده / تکمیل کنید
سر زدن روزانه
+100
status: امروز دریافت شده / دریافت نشده
دعوت از دوستان
+500
status: به‌زودی
خرید اشتراک نقره‌ای
+850
خرید اشتراک طلایی
+1000
خرید اشتراک الماس
+1500
Use real RewardRule values from API.
Do not duplicate magic values in the component.
________________________________________
TASK 29 — POINT HISTORY
Show:
تاریخچه امتیازها
Examples:
+۱۰۰۰
تکمیل پروفایل
امروز

+۱۰۰
حضور روزانه
امروز

+۱۵۰۰
خرید اشتراک الماس
...
Use actual RewardLedger data.
Support pagination if needed.
No fake activity for NEW_USER.
________________________________________
TASK 30 — FUTURE SUBSCRIPTION PURCHASE WITH POINTS
Future requirement:
Users will later be able to use accumulated LEGALIR Points
to purchase or discount subscriptions.
Do NOT fully activate this commercial flow now unless existing product requirements already define conversion rates.
There is currently NO approved conversion such as:
1000 points = X تومان
Therefore:
DO NOT invent one.
Prepare architecture.
Possible future domain:
RewardRedemption
Fields:
id
user_id
points_used
redemption_type
target_plan
status
created_at
completed_at
Feature flag:
rewardRedemptionEnabled = false
________________________________________
TASK 31 — FUTURE REDEMPTION UI
Inside My Points, show a tasteful future section:
«استفاده از امتیاز»
Copy:
«به‌زودی می‌توانید از امتیازهای لیگالیر برای دریافت مزایا و اشتراک‌ها استفاده کنید.»
Do NOT show a fake conversion rate.
Do NOT allow a nonfunctional purchase button.
Use:
«به‌زودی»
state.
When the real redemption rules are approved later, this architecture can be activated.
________________________________________
TASK 32 — PROFILE COMPLETION + POINTS CONNECTION
The UI should communicate the reward before completion.
When profile is 50%:
show:
«پروفایل حقوقی خود را تکمیل کنید و ۱۰۰۰ امتیاز دریافت کنید.»
At 100%:
show a one-time success interaction:
«پروفایل شما تکمیل شد»
+۱۰۰۰ امتیاز
Then remove Dashboard Profile Completion card.
Do not replay the reward animation on every refresh.
________________________________________
TASK 33 — APIs
Follow the existing API convention.
Potential endpoints:
GET /api/v1/me/profile-completion

GET /api/v1/rewards/summary

GET /api/v1/rewards/history

GET /api/v1/rewards/rules

POST /api/v1/rewards/daily-visit/claim
Do not use these exact names if current repository conventions differ.
Reuse existing:
GET /me
or Dashboard summary if appropriate.
Avoid unnecessary round-trips.
A Dashboard response may include:
profile_completion

reward_balance

daily_reward_state
if that better fits the current architecture.
________________________________________
TASK 34 — EXAMPLE PROFILE COMPLETION RESPONSE
Preferred typed structure:
{
  "percentage": 50,
  "basicProfile": {
    "completed": true,
    "percentage": 50
  },
  "extendedProfile": {
    "completed": false,
    "percentage": 0,
    "missingFields": [
      "userType",
      "province",
      "legalInterests",
      "primaryUseCase"
    ]
  }
}
Do not expose internal sensitive data unnecessarily.
________________________________________
TASK 35 — EXAMPLE REWARDS SUMMARY
Example concept:
{
  "balance": 2350,
  "today": {
    "visitRewardClaimed": true,
    "pointsAwarded": 100
  },
  "availableRules": {
    "profileCompleted": 1000,
    "dailyVisit": 100,
    "referralCompleted": 500,
    "silverPurchase": 850,
    "goldPurchase": 1000,
    "diamondPurchase": 1500
  }
}
Use current API response conventions instead of forcing this exact JSON if the project uses another standard.
________________________________________
TASK 36 — TRANSACTION SAFETY
Reward creation must happen inside a database transaction where appropriate.
Examples:
Profile reaches 100%
→ commit profile
→ create reward if not already granted
or use a safe domain event/outbox according to the existing architecture.
Successful plan purchase:
→ confirm payment
→ activate subscription
→ create reward ledger entry
Do not leave cases where:
subscription activates
but reward silently fails forever.
If an event-driven architecture already exists:
use it.
________________________________________
TASK 37 — NO CLIENT-SIDE REWARD TRUST
Never trust client requests such as:
giveMePoints = 1500
Frontend must never decide how many points are awarded.
Backend receives or derives the event.
Backend determines the configured reward.
Example:
Purchase:
Backend sees:
plan = DIAMOND
Then:
RewardRule(DIAMOND_PURCHASE) = 1500
Frontend only displays the result.
________________________________________
TASK 38 — SECURITY / ABUSE PREVENTION
Protect against:
•    refresh farming
•    multi-tab daily reward farming
•    duplicate purchase events
•    repeated profile completion
•    client-manipulated reward amounts
•    fake subscription events
•    replay requests
Use:
•    unique constraints
•    idempotency keys
•    backend validation
•    transaction boundaries
Log reward security events without logging sensitive profile data.
________________________________________
TASK 39 — ANALYTICS
Create privacy-safe events such as:
profile_completion_progressed

profile_completed

reward_earned

daily_visit_reward_claimed

rewards_panel_opened

reward_redemption_teaser_viewed
Do NOT send:
•    profile field values
•    sensitive legal data
•    unnecessary PII
into analytics.
________________________________________
TASK 40 — LIGHT / DARK THEME
Authenticated Web App continues to support:
•    Light
•    Dark
All new components must work in both.
Review:
•    Dashboard completion card
•    Profile progress
•    Extended Profile
•    Header Points Card
•    My Points
•    Reward History
•    Daily reward Snackbar
Use semantic theme tokens.
Do not add hard-coded white backgrounds.
Do not add unreadable gold text.
________________________________________
TASK 41 — UI UX PRO MAX REVIEW
Run UI UX PRO MAX after implementation.
Review:
1.    Profile 50% state
2.    Profile 100% state
3.    Dashboard before completion
4.    Dashboard after completion
5.    Header points card
6.    My Points page/panel
7.    Reward history
8.    Daily reward interaction
9.    Mobile
10.    Desktop
11.    Light
12.    Dark
Classify:
CRITICAL
HIGH
MEDIUM
LOW
Fix all CRITICAL and HIGH findings.
________________________________________
TASK 42 — REQUIRED E2E: FAVICON
Run browser E2E.
Verify:
Landing
→ favicon present
Dashboard
→ favicon present
Profile
→ favicon present
404
→ favicon present
No favicon HTTP 404.
________________________________________
TASK 43 — REQUIRED E2E: PROFILE 25% BUG
Start with user whose current Basic Profile is incomplete.
Complete all current Basic Profile fields.
Save.
Assert:
Dashboard no longer displays 25%.
Assert:
Dashboard displays:
50%.
Refresh.
Assert:
50%.
Logout/login.
Assert:
50%.
________________________________________
TASK 44 — REQUIRED E2E: EXTENDED PROFILE
At Basic Profile = 50%.
Complete Extended Profile fields.
After each step:
verify progress increases.
Complete all required fields.
Assert:
100%.
Refresh.
Assert:
100%.
Dashboard:
Profile Completion card must NOT exist.
________________________________________
TASK 45 — REQUIRED E2E: PROFILE REWARD
Before completion:
reward balance = X
Complete Profile to 100%.
Assert:
balance = X + 1000
Refresh.
Assert:
no additional reward.
Remove/re-add a profile field.
Complete again.
Assert:
NO second +1000.
________________________________________
TASK 46 — REQUIRED E2E: DAILY VISIT
First authenticated visit today:
+100.
Refresh:
+0.
Open second tab:
+0.
Navigate Home → Services → Profile:
+0.
Logout/login same day:
+0.
Simulate next valid calendar day in test:
+100.
________________________________________
TASK 47 — REQUIRED E2E: SILVER PURCHASE
Perform successful DEV/Mock purchase:
Silver.
Assert:
subscription activates.
Reward:
+850.
Retry payment callback.
Assert:
NO duplicate +850.
________________________________________
TASK 48 — REQUIRED E2E: GOLD PURCHASE
Successful Gold purchase:
+1000.
Duplicate event:
+0.
________________________________________
TASK 49 — REQUIRED E2E: DIAMOND PURCHASE
Successful Diamond purchase:
+1500.
Duplicate payment event:
+0.
Header balance updates.
History shows transaction.
________________________________________
TASK 50 — REQUIRED E2E: HEADER
At 100% Profile:
Dashboard onboarding Profile card absent.
Header:
points card visible beside Avatar.
Desktop:
fully readable.
Mobile:
responsive representation.
Click:
opens My Points.
________________________________________
TASK 51 — REQUIRED E2E: NEW USER
NEW_USER:
•    no fake reward history
•    balance should reflect only genuinely seeded/earned rules
•    incomplete Profile
•    completion card visible
•    extended completion available
•    no phantom subscription rewards
________________________________________
TASK 52 — DATABASE SEED
Update Development seed scenarios coherently.
Possible users:
NEW_USER
PROFILE_50_USER
PROFILE_100_USER
SILVER_USER
GOLD_USER
DIAMOND_USER
Ensure their reward ledgers mathematically match their displayed balances.
Do NOT write a balance of 5000 while ledger sums to 2500.
Seed consistency is mandatory.
________________________________________
TASK 53 — TEST DATABASE MIGRATION
Test:
empty database
↓
migrations
↓
seed
↓
application startup
↓
profile
↓
rewards
Then restart database/app.
Assert:
Profile Completion persists.
Reward ledger persists.
Balance persists.
Daily claim persists.
________________________________________
TASK 54 — PERFORMANCE
Do not add unnecessary API calls on every route render.
Daily visit claim should not fire repeatedly from many components.
Centralize authenticated session/app-entry behavior.
Reward summary should use appropriate React Query caching.
Profile update should invalidate only relevant queries.
Avoid unnecessary global re-renders.
________________________________________
TASK 55 — ACCESSIBILITY
Ensure:
•    Progress has accessible label
•    Points balance is screen-reader understandable
•    Icons have accessible names
•    Reward cards support keyboard
•    Color is not the only signal
•    Progress does not rely only on Gold color
•    Focus state works Light/Dark
________________________________________
TASK 56 — REQUIRED DOCUMENTATION
Create:
DOCUMENTS/IMPLEMENTATION_REPORTS/REWARDS_PROFILE/FAVICON_IMPLEMENTATION.md
Create:
DOCUMENTS/IMPLEMENTATION_REPORTS/REWARDS_PROFILE/PROFILE_COMPLETION_ARCHITECTURE.md
Include:
•    root cause of 25% bug
•    first 50%
•    second 50%
•    required fields
•    source of truth
•    cache invalidation
Create:
DOCUMENTS/IMPLEMENTATION_REPORTS/REWARDS_PROFILE/REWARD_SYSTEM_ARCHITECTURE.md
Include:
•    reward rules
•    ledger
•    idempotency
•    purchase events
•    daily visit
•    profile reward
•    future referral
•    future redemption
Create:
DOCUMENTS/IMPLEMENTATION_REPORTS/REWARDS_PROFILE/DATABASE_CHANGES.md
Create:
DOCUMENTS/IMPLEMENTATION_REPORTS/REWARDS_PROFILE/E2E_RESULTS.md
________________________________________
TASK 57 — FINAL QUALITY GATE
Before declaring completion, run:
•    install
•    lint
•    typecheck
•    unit tests
•    backend tests
•    integration tests
•    E2E
•    accessibility tests
•    frontend production build
•    database migration
•    database seed
•    database persistence test
Verify:
•    Favicon exists
•    no favicon 404
•    Profile no longer stuck at 25%
•    Basic Profile = 50%
•    Extended Profile reaches 100%
•    Dashboard card disappears at 100%
•    Profile completion reward = 1000 once
•    Daily visit reward = 100 once/day
•    Referral = 500 configured but disabled
•    Silver purchase = 850
•    Gold purchase = 1000
•    Diamond purchase = 1500
•    purchase rewards are idempotent
•    Header Points Card works
•    Mobile Header works
•    Light Theme works
•    Dark Theme works
•    Reward History works
•    no fake balances
•    no reward farming
•    previous LEGALIR functionality remains intact
________________________________________
TASK 58 — FINAL IMPLEMENTATION RULE
Do not stop after producing an audit.
Do not stop after producing documentation.
Actually implement and validate every task.
Preserve the current LEGALIR structure.
Do not rewrite stable modules.
Use existing Agents, Skills and Hooks aggressively but intelligently.
The final experience should make Profile Completion and LEGALIR Points feel like a native part of the product rather than an added-on gamification widget.
The progression should feel coherent:
ثبت‌نام
↓
تکمیل اطلاعات پایه
↓
50%
↓
تکمیل پروفایل حقوقی
↓
100%
↓
+1000 امتیاز
↓
کارت تکمیل پروفایل از Dashboard حذف می‌شود
↓
امتیاز من کنار Avatar نمایش داده می‌شود
↓
فعالیت روزانه و خرید اشتراک امتیاز بیشتری ایجاد می‌کند
↓
در نسخه آینده امتیازها برای مزایا و اشتراک قابل استفاده خواهند بود
Implement this entire flow end-to-end.

3a58eb1c-2f3b-4027-b1ca-acc9d685fbcf
2026-08-16T07:52:23.162Z
acceptEdits
external
cli
d:\LegalIR Project\apps\frontend
e113257e-7eea-48b2-a9a1-f7fa4978616a
unknown
feature/legalir-v0.2-ui-ai-upgrade
valiant-mixing-whale