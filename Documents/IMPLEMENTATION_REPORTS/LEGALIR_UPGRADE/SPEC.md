هرکاری ه تا الان انجام دادی رو یک ورژن بزن و ذخیره کن . حالا میخام مشخصات ورژن بعدی رو بهت بدم که شامل تسک های زیر هست و انجام بدی:

# LEGALIR — Incremental UI/UX, Navigation, Blog & Real AI Chat Upgrade

## Critical Scope

You are working on the **existing LEGALIR product**.

LEGALIR is already implemented and running.

Do **NOT** rebuild the product from scratch.

Do **NOT** replace the existing architecture, navigation philosophy, authentication, OTP implementation, database technology, or working modules unless a minimal change is required for one of the requirements below.

This is an **incremental product upgrade**.

Preserve everything that already works.

Use a new development branch/version according to the repository's existing versioning strategy.

---

# 1. USE ALL RELEVANT AGENTS AND SKILLS

Before implementation, discover all Agents, Subagents, Skills, MCP tools, CLI capabilities, and repository instructions available inside the project.

Especially use:

* UI UX PRO MAX
* Senior Frontend Developer
* Senior Full Stack Developer
* Senior Backend Developer
* Senior Architecture
* Design System
* Senior Product Designer
* Product Manager
* Motion Designer
* Accessibility Specialist
* Responsive Design
* QA / E2E
* Security Reviewer
* API Architect
* Performance Engineer
* Content / SEO Specialist
* Code Review Agent

Do not simply list these agents.

Actually use them.

Suggested ownership:

**UI UX PRO MAX**
→ visual audit, Landing, Settings, Blog, cards, hierarchy, empty states, responsive UX

**Design System**
→ semantic colors, components, card states, typography, consistency

**Senior Frontend Developer**
→ implementation, responsive behavior, themes, routing, interactions

**Senior Full Stack Developer**
→ real Chat flow, service workflows, persistence

**Senior Architecture**
→ AI provider abstraction, secure API gateway, domain boundaries

**Security**
→ API keys, user data, external AI provider isolation

**QA**
→ full route, mobile, desktop, error-state and E2E verification

Run UI UX PRO MAX both **before** implementation and **after** implementation.

Fix all Critical and High findings before completion.

---

# 2. READ THE CURRENT PRODUCT FIRST

Before changing code:

Recursively inspect:

`DOCUMENTS/`

Also inspect:

* current Landing Page
* current Web App
* current navigation
* current hamburger menu
* current Profile page
* current Settings page if one exists
* current Blog implementation
* Legal Library / Legal Knowledge implementation
* Chat
* services
* contracts
* document analysis
* legal calculations
* legal consultation
* legal notices / اظهارنامه
* AI backend
* API-client layer
* database
* MSW
* themes
* current logo assets
* current design tokens
* routing
* 404 implementation

Preserve current working behavior.

---

# 3. LANDING PAGE — LIGHT THEME ONLY

The public LEGALIR Landing Page currently has Light/Dark theme issues.

Some cards and text use colors with insufficient contrast.

For the **Landing Page only**:

Remove Dark Theme.

The Landing Page must use **one single professionally designed Light Theme**.

Do not remove Dark Theme from the authenticated Web App.

Final rule:

**Landing**
→ Light only

**LEGALIR Web App**
→ Light + Dark

The Landing must not expose a theme toggle.

---

# 4. LANDING LIGHT THEME — COMPLETE VISUAL AUDIT

Use:

* UI UX PRO MAX
* Design System
* Senior Frontend Developer

Audit every Landing section.

Check:

* page background
* cards
* banners
* headings
* subtitles
* body text
* muted text
* CTA
* icons
* badges
* borders
* pricing
* blog cards
* service cards
* footer
* header

No text may disappear into its card background.

No low-contrast Gold-on-Light combinations.

No gray-on-gray unreadable labels.

Follow accessible contrast principles.

---

# 5. LANDING VISUAL DIRECTION

Keep the existing LEGALIR identity.

Use:

* warm white / soft neutral background
* Deep Navy
* muted Gold
* charcoal text
* restrained semantic colors
* Material Design-inspired surfaces
* subtle elevation
* premium spacing
* modern cards
* refined typography
* tasteful motion

The result should feel:

**Premium Iranian LegalTech**

Not:

* generic SaaS
* crypto
* colorful startup template
* Bootstrap admin
* excessive glassmorphism

---

# 6. AI / LEGAL SERVICE COPY — REMOVE WEAK NEGATIVE MESSAGING

Search the entire product for repeated user-facing messages such as:

* «خروجی هوش مصنوعی ممکن است اشتباه باشد»
* «این سرویس مشاوره حقوقی رسمی نیست»
* similar negative AI-first messaging

Do not leave repetitive fear-based copy across normal product surfaces.

Replace normal marketing/product copy with confident, professional LEGALIR positioning.

However:

Do **NOT** make unsupported claims such as:

* LEGALIR has reviewed every Iranian legal case
* LEGALIR is equivalent to thousands of judges
* every result is legally correct
* every answer is guaranteed
* AI is a licensed lawyer
* court outcomes are guaranteed

If there is no verifiable evidence, do not claim it.

---

# 7. APPROVED PRODUCT MESSAGING DIRECTION

Use messaging similar to:

### Primary

«خدمات تخصصی حقوقی با بهره‌گیری از هوش مصنوعی، منابع حقوقی و مدل زبانی تخصصی لیگالیر»

### Supporting copy

«لیگالیر با ترکیب مدل زبانی تخصصی، منابع حقوقی ساختاریافته، مستندات مرتبط و ابزارهای تحلیل حقوقی، امکان بررسی دقیق‌تر پرونده‌ها، قراردادها و مسائل حقوقی را فراهم می‌کند.»

### Stronger marketing copy

«دانش حقوقی، تحلیل هوشمند و منابع مستند؛ یکپارچه در لیگالیر.»

### Chat

«دستیار تخصصی حقوقی لیگالیر»

### Contract analysis

«تحلیل ساختاریافته قرارداد همراه با ریسک‌ها، مواد قانونی و منابع مرتبط»

### Document analysis

«بررسی هوشمند اسناد حقوقی همراه با ارجاعات و مستندات»

### Legal services

«خدمات حقوقی تخصصی با پشتیبانی فناوری و منابع ساختاریافته»

Use powerful but defensible copy.

Any disclosure explicitly required by Legal Scope / Terms / Consent must remain in the appropriate legal location.

Do not remove mandatory compliance text from Terms or Privacy.

---

# 8. NAVIGATION — PRESERVE PRIMARY STRUCTURE

Do not redesign the entire information architecture.

Preserve the existing primary navigation model.

However, improve the destination currently used for:

«پروفایل»

Convert it into a more complete:

**«تنظیمات»**

or:

**«تنظیمات و پروفایل»**

depending on current available space.

The top-level navigation must remain visually clean.

---

# 9. MOVE HIDDEN HAMBURGER ITEMS INTO SETTINGS

There are important menu items that currently exist primarily inside the Hamburger menu and are difficult to discover in Responsive UI.

Examples include:

* حافظه
* تاریخچه
* قراردادها
* اسناد
* اشتراک
* تنظیمات
* سرویس‌های متصل
* other existing secondary features

Make these features discoverable inside the new **Settings / Profile Hub**.

Do not remove existing routes.

Do not duplicate domain functionality.

Create clear visual entries.

---

# 10. SETTINGS & PROFILE HUB

Turn the current Profile destination into a polished Account Hub.

Suggested route should follow the existing route architecture.

The page must include:

## پروفایل من

* تصویر
* نام
* نام خانوادگی
* موبایل
* شهر
* شغل
* وضعیت تکمیل پروفایل
* ویرایش اطلاعات

## فضای حقوقی من

* گفت‌وگوهای من
* اسناد من
* قراردادهای من
* تاریخچه
* حافظه

## اشتراک

* پلن فعلی
* مصرف
* درخواست باقی‌مانده
* تاریخ اعتبار
* ارتقا

## سرویس‌های متصل

* integrations
* sync
* permissions

## تنظیمات

* تم Light/Dark
* اعلان‌ها
* حریم خصوصی
* نشست‌ها
* داده‌های حساب

## راهنما و محصول

* درباره لیگالیر
* پشتیبانی
* راهنما
* قوانین استفاده
* حریم خصوصی

Use attractive section cards and iconography.

Do not create one giant flat list.

---

# 11. ADD BLOG CARD INSIDE SETTINGS

Add a visually polished card:

**«وبلاگ حقوقی لیگالیر»**

Supporting text:

«راهنماها، آموزش‌ها، قوانین و مطالب کاربردی حقوقی»

CTA:

«مشاهده وبلاگ»

Use the existing Blog route/content.

Do not create another Blog implementation.

---

# 12. ADD BLOG CARD ON AUTHENTICATED HOME

Also add a Blog / Legal Education card or content section on the authenticated Home/Dashboard.

Examples:

### مطالب پیشنهادی

* وجه التزام در قرارداد چیست؟
* راهنمای مالک و مستأجر
* چگونه اظهارنامه تنظیم کنیم؟
* خسارت تأخیر تأدیه چگونه محاسبه می‌شود؟

Use existing Legal Library / Blog content.

Display source-backed content where available.

---

# 13. LANDING HEADER — ADD LEGAL BLOG

Add a header navigation item:

**«وبلاگ حقوقی»**

or an appropriate compact variant.

It should link to the existing Blog.

Do not duplicate content.

The current Blog content already created in the project must be used.

If Blog is currently behind a Feature Flag:

enable it for the Development Demo after verifying the pages are ready.

---

# 14. LANDING BLOG SECTION

Add a polished Blog preview section to the Landing Page.

Suggested title:

«مجله و آموزش حقوقی لیگالیر»

Suggested subtitle:

«راهنماهای کاربردی، قوانین، آرای مهم و تحلیل موضوعات حقوقی»

Display 3–6 high-quality cards.

Cards can show:

* عنوان
* دسته‌بندی
* زمان مطالعه
* نوع محتوا
* تاریخ
* منبع-related indicator

Use the actual existing Blog content.

Do not use Lorem Ipsum.

---

# 15. BLOG UX

Blog must feel like part of LEGALIR.

Not a generic WordPress page.

Use:

* strong Persian typography
* beautiful long-form reading
* table of contents
* source citations
* related laws
* related judgments
* related LEGALIR services
* related articles
* save/bookmark if already supported

Landing is Light-only.

Therefore Blog public pages may follow the public Light visual system unless current architecture intentionally defines otherwise.

---

# 16. REAL AI CHAT — DEVELOPMENT PROVIDER

The Chat currently needs to support actual generated conversations.

Do not rely exclusively on static canned responses.

Implement a real AI provider for Development.

CRITICAL SECURITY RULE:

**DO NOT PUT AN API KEY DIRECTLY IN FRONTEND CODE.**

Do not expose keys in:

* JavaScript bundle
* NEXT_PUBLIC variables
* browser network-visible config
* repository
* Git
* source maps

Do not use a shared "public API key" directly from the browser.

---

# 17. AI GATEWAY ARCHITECTURE

Use the current backend architecture.

Create/reuse:

`AiProvider`

or equivalent abstraction.

Architecture:

Frontend
↓
LEGALIR Backend AI Gateway
↓
AI Provider

The Frontend communicates only with LEGALIR Backend.

Provider credentials stay server-side.

Use environment variables.

Example:

`LEGALIR_AI_PROVIDER`

`LEGALIR_AI_MODEL`

`LEGALIR_AI_API_KEY`

Do not expose secrets client-side.

---

# 18. DEVELOPMENT AI PROVIDER

For Development:

Use one of these approaches, in this priority:

1. Existing configured AI provider already present in the project
2. A Provider with an available free development/free-tier allocation
3. Local/OpenAI-compatible Development provider already available
4. Local model through an existing supported runtime
5. Mock fallback when provider is unavailable

Do not hardcode a provider into UI components.

Do not build the architecture around a temporary free service.

The Provider must be replaceable.

Example interface:

```text
AiProvider

generate()
stream()
health()
models()
```

If Provider fails:

fallback gracefully to Development Mock if configured.

---

# 19. DO NOT SEARCH FOR OR EMBED LEAKED/PUBLIC API KEYS

Never:

* use keys found on GitHub
* scrape free shared keys
* use leaked keys
* embed a key supplied by an unknown public website
* commit secrets

If an API credential is needed:

use an environment variable.

Document the setup in DEV Runbook.

---

# 20. REAL CHAT — SERVICE CONTEXT

Real Chat must understand the service from which it was started.

Service contexts include:

* تنظیم قرارداد
* بررسی قرارداد
* مشاوره حقوقی
* تولید اظهارنامه
* تحلیل اسناد
* محاسبات حقوقی
* جست‌وجوی قوانین
* other existing LEGALIR services

Create/use:

`conversation_context`

or equivalent.

Example:

```text
service_type = contract_review
```

or:

```text
service_type = legal_consultation
```

---

# 21. CONTEXTUAL CHAT CREATION

When user starts from:

**بررسی قرارداد**

Chat must visually know:

«بررسی قرارداد»

When user starts from:

**تولید اظهارنامه**

Chat context:

«تنظیم اظهارنامه»

When user starts from:

**تحلیل سند**

Chat context:

«تحلیل سند»

When user starts from:

**محاسبات حقوقی**

Chat context:

«محاسبات حقوقی»

Display the context using the existing graphical Conversation Category Card.

Do not make every Chat appear generic.

---

# 22. CHAT FLOW

Correct flow:

User chooses a service

↓

LEGALIR prepares conversation context

↓

User enters question/data

↓

Conversation created

↓

User navigates to full Chat workspace

↓

message saved

↓

context passed to backend

↓

AI response streams

↓

references displayed when available

↓

conversation persisted

No duplicate conversation.

No message loss.

---

# 23. PROMPT / SYSTEM CONTEXT

The Backend AI Gateway should receive structured context.

Do not send a gigantic random prompt from the browser.

Use server-side prompt templates.

Input may include:

* selected service
* category
* user question
* conversation history
* uploaded document references
* legal sources
* user-authorized relevant context

Do not include unrelated sensitive data.

---

# 24. LEGAL SOURCE GROUNDING

Where LEGALIR already has:

* Legal Library
* LegalSource
* Citation
* References
* RAG
* verified source fixtures

use these sources with the real AI flow.

Preferred architecture:

Question
↓
determine context
↓
retrieve relevant sources
↓
AI answer
↓
citations
↓
source cards

Do not invent law citations.

If retrieval returns no reliable source:

do not generate fake source numbers.

---

# 25. CHAT STREAMING

If existing architecture supports SSE / Streaming:

use it.

Render:

* queued
* retrieving
* generating
* validating
* complete
* failed

Make it visually polished.

Use subtle motion.

Do not block the entire screen.

---

# 26. CHAT USAGE

Preserve current subscription / usage rules.

Real AI requests must count against the same usage accounting system used by the product.

Do not create a separate untracked Chat path.

If the user has:

Daily Trial

or:

Subscription Requests

follow the approved usage logic.

---

# 27. AI ERROR FALLBACK

If AI Provider is unavailable:

do not show a broken blank page.

Show:

«در حال حاضر اتصال به سرویس هوشمند امکان‌پذیر نیست.»

Action:

«تلاش دوباره»

If Development Mock fallback is enabled:

clearly switch internally without breaking UX.

Do not display internal provider names to normal users.

---

# 28. NO EMPTY PAGES — ABSOLUTE RULE

No registered LEGALIR route may be blank.

Never show:

* white blank page
* dark blank page
* TODO
* raw JSON
* only a heading
* broken skeleton forever
* dead CTA

Every route must have:

* content
* loading
* empty
* error
* forbidden where relevant
* not found where relevant

---

# 29. EMPTY STATES

Examples:

### Contracts

«هنوز قراردادی ایجاد نکرده‌اید.»

CTA:
«ساخت قرارداد»

### History

«تاریخچه شما هنوز خالی است.»

### Memory

«هنوز موردی در حافظه ذخیره نشده است.»

### Documents

«هنوز سندی اضافه نکرده‌اید.»

CTA:
«افزودن سند»

### Blog saved content

«هنوز مطلبی ذخیره نکرده‌اید.»

Always provide a relevant next action.

---

# 30. CUSTOM 404

Create or improve the Persian LEGALIR 404 page.

Do not use the framework default.

Design:

* minimal
* elegant
* brand-consistent
* responsive
* professional

Copy:

### «این صفحه پیدا نشد»

Supporting:

«ممکن است آدرس تغییر کرده باشد یا صفحه دیگر در دسترس نباشد.»

Actions:

**«بازگشت به خانه»**

Authenticated user:

**«رفتن به داشبورد»**

Use subtle LEGALIR visual elements.

Do not make the 404 childish.

---

# 31. WEB APP LOGO — FIX VISIBILITY

The LEGALIR logo inside the Web App is currently not visually clear enough.

Inspect the current asset.

Use the same successful presentation approach already used on the Landing Page.

Do not create a new brand identity.

Use the current approved logo.

---

# 32. LOGO TRANSPARENCY

If the current Web App logo file has an unwanted solid background:

create/use a transparent-background version of the same approved logo.

Do not visually redesign it.

Maintain:

* original shape
* original typography
* proportions
* brand colors

If a transparent version already exists in the project:

use that instead of creating another duplicate.

---

# 33. LOGO DISPLAY

Use the Web App logo with sufficient:

* size
* contrast
* padding
* clear space

Review it on:

Light theme

Dark theme

Desktop

Mobile

Sidebar

Navigation/Header

Authentication

Splash

Do not use a logo that disappears against the background.

If necessary create approved variants:

* dark-on-light
* light-on-dark

using the same brand mark.

---

# 34. SETTINGS CARD DESIGN

Inside Settings/Profile Hub, use visual cards for:

* Profile
* Subscription
* Documents
* Contracts
* History
* Memory
* Blog
* Connected Services
* Privacy
* Support

Cards should show useful status.

Examples:

**اسناد من**
`۳ سند`

**قراردادهای من**
`۲ قرارداد`

**اشتراک**
`طلایی`

**حافظه**
`۵ مورد ذخیره‌شده`

Use actual user data where available.

---

# 35. REAL DATA > MOCK DATA

Rendering priority:

1. Actual current user data
2. Development DB data
3. Verified deterministic seeded demo data
4. Mock fixture
5. Designed empty state

Never replace actual user content with mock data.

---

# 36. BLOG CONTENT

Use the Legal Education / Blog content already created.

Examples may include:

* ماده ۲۳۰ قانون مدنی
* ماده ۵۲۲ قانون آیین دادرسی مدنی
* رأی وحدت رویه ۸۰۵
* مالک و مستأجر
* تنظیم اظهارنامه
* وجه التزام
* خسارت تأخیر
* مطالبه وجه
* قراردادها

Keep:

LegalSource

different from:

BlogArticle.

Do not collapse them into one entity.

---

# 37. RESPONSIVE QA

Mandatory widths:

* 375
* 390
* 430
* 768
* 1024
* 1280
* 1440
* 1920

Test:

* Landing Header
* Blog navigation
* Landing Blog cards
* Settings
* Settings cards
* Profile
* Hamburger / secondary links
* Chat
* contextual Chat
* 404
* logo
* Web App navigation

No overflow.

No hidden buttons.

No unreadable labels.

---

# 38. MATERIAL DESIGN & DESIGN SYSTEM

Use existing Material Design-based LEGALIR system.

Do not introduce random component styles.

Audit:

* elevation
* spacing
* shape
* typography
* icon size
* touch target
* state layer
* motion
* cards
* lists

Maintain visual consistency.

---

# 39. WEB APP DARK / LIGHT

Authenticated Web App must continue supporting:

Light
Dark

Both must work correctly.

Do not apply the Landing Light-only restriction to Web App.

Review all new Settings/Profile components in both themes.

---

# 40. LANDING E2E

Test:

Open Landing.

Assert:

Light only.

No theme switch.

All content readable.

Header Blog visible.

Blog link works.

Blog section works.

CTA works.

No contrast issue.

---

# 41. SETTINGS E2E

Open Settings.

Verify:

Profile

Documents

Contracts

History

Memory

Subscription

Blog

Integrations

Privacy

Support

All entries must work.

No dead cards.

---

# 42. CHAT E2E — REAL PROVIDER

Development scenario:

Open:

مشاوره حقوقی

Enter a question.

Conversation created.

Navigate to Chat.

AI Gateway receives request.

Streaming starts.

Response displayed.

Conversation persists.

If Provider unavailable:

graceful fallback/error.

No frontend key exposure.

---

# 43. CHAT E2E — CONTRACT REVIEW

Open:

بررسی قرارداد

Chat Context Card:

«بررسی قرارداد»

Send question.

Verify:

service context reaches backend.

AI response appears.

References display when retrieval provides them.

---

# 44. CHAT E2E — LEGAL NOTICE

Open:

تنظیم اظهارنامه

Create conversation.

Verify category:

«تنظیم اظهارنامه»

Chat should not look identical to generic consultation.

---

# 45. SECURITY VALIDATION

Search built frontend bundle for:

API keys

Secrets

Tokens

Provider credentials

There must be none.

Verify:

AI credential exists server-side only.

Do not log full legal conversations in production-style logs.

Do not log uploaded document contents.

---

# 46. PERFORMANCE

Real Chat and polished UI must remain responsive.

Audit:

* bundle
* long Blog pages
* animations
* large logo
* cards
* Chat streaming
* re-renders

Use dynamic imports where appropriate.

Do not add massive dependencies without need.

---

# 47. REQUIRED IMPLEMENTATION REPORTS

Create:

`DOCUMENTS/IMPLEMENTATION_REPORTS/LEGALIR_UPGRADE/LANDING_LIGHT_THEME_AUDIT.md`

Include:

* contrast issues
* card issues
* old behavior
* new behavior
* tested viewports

Create:

`DOCUMENTS/IMPLEMENTATION_REPORTS/LEGALIR_UPGRADE/SETTINGS_INFORMATION_ARCHITECTURE.md`

Include:

* moved/discoverable features
* route mapping
* Settings sections

Create:

`DOCUMENTS/IMPLEMENTATION_REPORTS/LEGALIR_UPGRADE/AI_PROVIDER_ARCHITECTURE.md`

Include:

* provider abstraction
* backend gateway
* environment config
* fallback
* streaming
* security

Create:

`DOCUMENTS/IMPLEMENTATION_REPORTS/LEGALIR_UPGRADE/BLOG_INTEGRATION.md`

Create:

`DOCUMENTS/IMPLEMENTATION_REPORTS/LEGALIR_UPGRADE/LOGO_AUDIT.md`

Create:

`DOCUMENTS/IMPLEMENTATION_REPORTS/LEGALIR_UPGRADE/ROUTE_QA.md`

---

# 48. TEST & BUILD

Before completion run:

* lint
* typecheck
* unit tests
* integration tests
* E2E
* accessibility audit
* frontend build
* backend tests

Validate:

* Landing is Light-only
* Landing contrast fixed
* Blog visible in Landing header
* Blog cards work
* Settings hub complete
* Memory accessible
* History accessible
* Contracts accessible
* Documents accessible
* Blog accessible
* Web App logo clearly visible
* transparent logo variant correct
* Chat can generate real Development responses
* no API keys exposed
* service context works
* no page empty
* 404 works
* Web App Light works
* Web App Dark works
* mobile works
* desktop works

---

# 49. FINAL UI UX PRO MAX REVIEW

After implementation, run UI UX PRO MAX over:

1. Landing
2. Landing Header
3. Blog cards
4. Blog page
5. Settings/Profile Hub
6. Web App logo
7. Chat
8. service-context Chat
9. Empty States
10. 404
11. Mobile
12. Desktop
13. Light
14. Dark

Classify:

CRITICAL
HIGH
MEDIUM
LOW

Fix all:

CRITICAL
HIGH

before completion.

---

# 50. FINAL RULE

Do not stop after auditing.

Do not only produce documentation.

Implement the requested changes.

Do not damage current LEGALIR architecture.

Keep working features intact.

The resulting product must feel:

* significantly more polished
* easier to navigate
* visually clearer
* more trustworthy
* more powerful
* more cohesive
* more interactive
* more complete

and the AI experience must evolve from a static mocked chatbot into a secure, contextual, provider-backed **LEGALIR Legal Intelligence Assistant** suitable for Development and future Production integration.
