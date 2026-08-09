━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. READ PRODUCT DOCUMENTS FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before designing anything, recursively inspect and read all relevant documents in the repository folder:

`DOCUMENTS/`

Especially read and understand documents related to:

- Product Vision
- Jurisdiction & Legal Scope
- User Roles, Personas & RBAC
- Feature Scope, MVP & Release Roadmap
- User Journeys & Service Blueprints
- PRD
- FSD
- System Architecture & Technical Design
- Development Roadmap & Sprint Planning

The DOCUMENTS folder is the source of truth for the product.

Before implementation, create a short design interpretation summary at:

`DOCUMENTS/IMPLEMENTATION_REPORTS/FRONTEND/DESIGN_SYSTEM_DISCOVERY_SUMMARY.md`

That summary must include:

- Product identity summary
- Product tone and personality
- Target user expectations
- Brand constraints
- UX constraints
- Legal trust requirements
- RTL and Persian UI constraints
- Mobile and responsive requirements
- Main product surfaces that the design system must support

Do not start implementation before understanding the product.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. PRODUCT CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Product name:
LEGALIR

Product definition:
LEGALIR is an Iranian intelligent platform for laws, legal knowledge, legal contracts, legal document analysis, AI-assisted legal consultation, legal references, and legal workflows.

It is a Persian-language legal product.
It must feel trustworthy, minimal, premium, modern, and highly usable.
It must not look noisy, overly futuristic, or visually childish.
It must not look like a colorful startup template.
It must not feel generic.

It must communicate:
- legal trust
- clarity
- precision
- calm professionalism
- intelligence
- structure
- authority
- modernity

Do not design LEGALIR like:
- a crypto dashboard
- a gaming app
- a neon AI tool
- a generic SaaS template
- an overly decorative or glassmorphism-heavy interface

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. LANGUAGE, CULTURE, AND LAYOUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEGALIR is initially:

- Persian only
- RTL-first
- built for Iranian users
- aligned with Iranian legal culture

All UI must:
- use Persian language
- use correct RTL alignment
- use natural Iranian Persian wording
- use culturally appropriate structure
- support Persian number formatting where useful
- support Toman for visible pricing
- support later English extension, but English is not active now

Set:
- `lang="fa"`
- `dir="rtl"`

Typography and spacing must work beautifully in Persian.

Do not use awkward Arabic phrasing or machine-translated Persian.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. DESIGN DIRECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Design philosophy:

- minimal
- neutral
- calm
- elegant
- structured
- highly legible
- professional
- modern
- simple but premium
- easy to understand
- serious but not cold
- visually refined without excessive decoration

Design-system foundation:
Material Design V2

Important:
Use Material Design V2 as the structural and behavioral foundation, but adapt it to a custom LEGALIR visual identity.
Do not produce a generic Google-looking interface.
Do not migrate silently to Material 3 visual language.

Use simple, understandable, and professional UI patterns.
Use restrained use of color.
Do not make the interface overly colorful.
Do not overuse accent colors.
Do not create visual clutter.

The design should feel like:
“A premium Iranian legal workspace with AI assistance.”

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. VISUAL IDENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create a complete visual identity direction for LEGALIR.

Define:

- brand personality
- visual tone
- visual hierarchy principles
- logo approach
- iconography approach
- typography approach
- spacing philosophy
- motion philosophy
- component philosophy

The brand should feel:

- trustworthy
- calm
- authoritative
- refined
- modern
- precise
- intelligent
- clean

Avoid:
- aggressive gradients
- saturated rainbow palettes
- loud contrast without purpose
- over-decoration
- high-noise illustrations
- overcomplicated shapes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. COLOR PALETTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define a restrained, professional, neutral-first palette.

Use a minimal and elegant palette with one strong primary family, one secondary family, and a robust neutral system.

Use this as the base brand direction:

## Primary palette (Deep Legal Navy)
- Primary 900: #0B1220
- Primary 800: #0F172A
- Primary 700: #162033
- Primary 600: #1E2A40
- Primary 500: #26344C
- Primary 400: #40516B
- Primary 300: #64748B
- Primary 200: #94A3B8
- Primary 100: #CBD5E1
- Primary 50:  #F1F5F9

This palette should carry the core brand.

## Secondary palette (Muted Gold / Sand Gold)
Use a refined, muted gold that feels premium and legal, not flashy:

- Secondary 900: #5C4822
- Secondary 800: #71572A
- Secondary 700: #8A6A33
- Secondary 600: #A37C3C
- Secondary 500: #B08D57
- Secondary 400: #C3A574
- Secondary 300: #D5BE97
- Secondary 200: #E7D9BE
- Secondary 100: #F3ECDD
- Secondary 50:  #FBF8F1

Use secondary color sparingly for:
- selected highlights
- premium emphasis
- active support states
- important decorative restraint
- logo accent if needed

Do not overuse gold in text-heavy surfaces.

## Neutral palette
Use a strong neutral system for surfaces, borders, text, and elevation:

- Neutral 950: #0A0A0B
- Neutral 900: #111827
- Neutral 800: #1F2937
- Neutral 700: #374151
- Neutral 600: #4B5563
- Neutral 500: #6B7280
- Neutral 400: #9CA3AF
- Neutral 300: #D1D5DB
- Neutral 200: #E5E7EB
- Neutral 100: #F3F4F6
- Neutral 50:  #F9FAFB
- Neutral 0:   #FFFFFF

## Semantic colors
Keep semantic colors professional and muted:

Success:
- #1F6F50

Warning:
- #B7791F

Error:
- #B42318

Info:
- #2563EB

Use semantic colors with moderation and clarity.

## Dark theme
Create a full dark theme derived from:
- dark navy
- warm gold accents
- soft neutral text
- low-glare surfaces
- clear elevation

The dark mode must feel premium and comfortable, not high-contrast and harsh.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. TYPOGRAPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Primary font:
Vazir

Use Vazir as the primary Persian UI font.

Define a complete typography scale for Material Design V2 adapted to LEGALIR:

- Display
- Headline
- Title
- Subtitle
- Body
- Caption
- Button
- Overline / Label

Typography principles:

- Persian readability first
- balanced line-height
- strong legal reading comfort
- good density for dashboards and documents
- consistent text rhythm
- no tiny unreadable text
- no oversized headings without hierarchy

Make sure typography works well for:
- dashboards
- chat
- legal references
- source drawers
- forms
- contracts
- document analysis reports
- pricing
- mobile layouts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. LOGO SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create a default logo direction for LEGALIR.

Requirements:
- clean
- typographic
- modern
- simple
- professional
- not overly symbolic
- must work in Persian product context
- must work on light and dark themes
- must work in navbar, splash screen, app icon, and favicon

Create:

1. Primary wordmark:
   “LegalIR” or “LEGALIR” in a professional typographic treatment

2. Optional compact mark / monogram:
   - L
   - LI
   - or a geometric legal-inspired mark

Visual inspiration should come from:
- structure
- law
- precision
- document order
- legal balance
- institutional trust

But do not make a cliché courtroom logo.
Avoid:
- literal scales of justice if they look generic
- gavels
- overly traditional legal icon clichés
- overcomplex emblems

The logo should be simple enough to become a product-grade SaaS identity.

Create:
- primary logo
- compact logo
- app mark
- favicon concept
- monochrome versions
- light/dark usage guidance

Implement default SVG assets if possible.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. ICONOGRAPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define a default iconography system.

Requirements:
- simple
- clear
- minimal
- line-based or line-with-soft-fill
- highly legible
- consistent stroke system
- aligned with Material Design V2 behavior
- suitable for legal and dashboard contexts

Iconography should support:
- dashboard
- chat
- citations
- documents
- contracts
- profile
- settings
- subscription
- upload
- analysis
- warnings
- success
- legal sources
- references
- history
- memory
- navigation

Avoid playful or exaggerated icons.

Pick or define a consistent icon style and use it throughout.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. MOTION AND UX FEEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define motion guidelines for LEGALIR.

The motion system should be:
- elegant
- subtle
- meaningful
- responsive
- not overwhelming
- premium

Use motion for:
- splash screen
- page transitions
- drawer opening
- tabs
- hover/focus feedback
- button press
- OTP success
- loading progress
- AI generation states
- document processing states
- contract generation steps
- theme switching

Splash requirements:
- 4-second startup splash
- polished and animated
- reflects legal precision + AI sophistication
- works in dark and light themes
- uses the logo properly
- smooth transition into the product

Respect:
- performance
- reduced motion preferences
- no unnecessary repetition

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. COMPONENT SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create a full design-system foundation for the frontend.

At minimum define and implement visual specs and reusable UI for:

- App shell
- Top app bar
- Sidebar
- Bottom navigation (mobile)
- Buttons
- Icon buttons
- Text inputs
- Phone input
- OTP input
- Select
- Search field
- Cards
- Sheets / drawers
- Dialogs
- Tabs
- Chips
- Badges
- Alerts
- Snackbar / Toast
- Table
- Mobile card list alternative
- Stepper
- Empty state
- Error state
- Loading state
- Skeleton
- Progress bar
- Circular progress
- Legal disclaimer
- Citation chip
- Source reference card
- Document status badge
- Risk badge
- Subscription plan card
- Pricing comparison block
- Dashboard widgets
- Chat message bubbles
- AI answer sections
- File upload zone
- Contract wizard blocks

Each component must support:
- light theme
- dark theme
- RTL
- responsive layouts
- hover
- focus
- pressed
- disabled
- error
- loading when relevant

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. MAIN PRODUCT SURFACES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply the design system consistently across these product surfaces:

Public:
- Landing
- Pricing
- Features
- About
- Login
- Register

Authentication:
- Mobile number entry
- OTP verification
- Auth profile completion

Application:
- Dashboard / Workplace
- Chat
- Chat detail
- Documents
- Document detail
- Contracts
- Contract create
- Contract detail
- History
- Memory
- Subscription
- Profile
- Settings

If any data is missing, create coherent mock UX and mock content instead of leaving any page incomplete.

No page should look unfinished.
No route should remain blank.
No section should contain only placeholder text.

Design everything as a complete product.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. RESPONSIVE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The entire system must be fully responsive.

Support:
- mobile
- tablet
- desktop

Use mobile-first thinking.

Make sure:
- navigation works well on mobile
- pricing works on mobile
- chat works on mobile
- source drawers work on mobile
- file upload works on mobile
- contract flows work on mobile
- legal reading remains readable on small screens

Avoid horizontal overflow.
Avoid desktop-only tables with no mobile strategy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. DESIGN SYSTEM DELIVERABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create and implement:

1. A documented design system foundation
2. Design tokens
3. Theme tokens
4. Light/dark themes
5. Brand guidelines
6. Logo usage guidance
7. Typography scale
8. Color usage rules
9. Iconography guidance
10. Motion guidance
11. Component library
12. Surface guidance
13. Responsive rules
14. Accessibility rules
15. Figma-like structure in code if possible
16. A `/design-system` route showing all components and states

Also create:

`DOCUMENTS/IMPLEMENTATION_REPORTS/FRONTEND/VISUAL_IDENTITY_AND_DESIGN_SYSTEM.md`

This file must include:
- brand principles
- color system
- typography
- logo direction
- iconography
- motion principles
- component principles
- accessibility rules
- responsive rules
- theme behavior
- examples of application on product pages

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. IMPLEMENTATION BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implement the design system in code, not only as documentation.

Requirements:
- use strict TypeScript
- use reusable components
- avoid duplication
- do not hard-code styles page by page if they belong in tokens/components
- align the frontend with the brand system
- use the repository architecture
- preserve consistency everywhere

If you need to choose between:
- flashy visuals
- and clarity + trust

always choose:
clarity + trust

If you need to choose between:
- too much color
- and a restrained premium interface

always choose:
restrained premium interface

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. QUALITY BAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This must feel like the work of:
- a senior product design team
- a senior design systems team
- a serious legal SaaS company

The result must be:
- polished
- consistent
- minimal
- understandable
- premium
- professional
- cohesive
- ready to scale

No random UI.
No inconsistent color use.
No generic template leftovers.
No color chaos.
No incomplete branding.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. FINAL TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now do the following:

1. Read the repository and all relevant files in `DOCUMENTS`
2. Discover and use all appropriate agents and skills
3. Use `ui-ux-pro-max` heavily if available
4. Define the full visual identity of LEGALIR
5. Define the full design system of LEGALIR
6. Implement it in the frontend foundation
7. Create or refine the logo and icon defaults
8. Apply the system across the major public and app surfaces
9. Create the `/design-system` route
10. Produce documentation and implementation reports
11. Use mock data wherever real data is missing
12. Do not leave any page visually incomplete
13. Make everything responsive, RTL, Persian-first, and theme-aware

Start with reading `DOCUMENTS` and creating the design discovery summary.
Then proceed to define the visual identity and implement the design system.