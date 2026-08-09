# LEGALIR — Design System Discovery Summary

**Date:** 2026-08-05  
**Version:** 1.0  
**Status:** Baseline for Implementation

---

## Product Identity Summary

LEGALIR is an Iranian LegalTech platform providing AI-assisted legal consultation, contract generation, document analysis, lawyer marketplace, and case management. It serves individual users, lawyers, and organizations with a Persian-first, RTL interface.

## Product Tone & Personality

- **Trustworthy** — legal precision is non-negotiable
- **Calm** — no aggressive colors or flashy animations
- **Authoritative** — backed by real legal sources and citations
- **Refined** — premium but not luxurious
- **Modern** — AI-native, not a traditional law firm website
- **Precise** — every element has purpose, no decoration for decoration's sake
- **Intelligent** — the AI is smart, the UI should reflect that
- **Clean** — minimal visual noise, maximum clarity

## Target User Expectations

- Iranian users, Persian language, RTL layout
- Mixed literacy levels — simplified language where possible
- Mobile-first — many users will access via phone
- Legal context demands clarity, not ambiguity
- Users expect professional seriousness, not playful design

## Brand Constraints

- Material Design V2 as structural foundation (not M3)
- Custom LEGALIR visual identity on top of M2 principles
- Restrained color usage — navy primary, gold secondary, neutral system
- No generic Google-looking interface
- No crypto/gaming/neon aesthetics
- No glassmorphism-heavy or overly decorative patterns

## UX Constraints

- RTL-first layout with CSS logical properties
- Persian typography (Vazir/Vazirmatn) with correct line heights
- All interactive elements must be keyboard accessible
- WCAG 2.2 AA minimum contrast (4.5:1 for text)
- Touch targets minimum 44x44px (48x48px preferred)
- Mobile-responsive for all core flows
- AI outputs must be clearly labeled with disclaimers
- Legal citations must be traceable and verifiable

## Legal Trust Requirements

- AI disclaimer on all AI-generated content
- Clear distinction between AI output, legal source, and lawyer advice
- Source citations with validity status (valid/amended/repealed)
- Risk levels clearly communicated
- Escalation path to human lawyer always visible
- Consent management for data sharing
- No guarantee of legal outcome

## RTL and Persian UI Constraints

- `lang="fa"` and `dir="rtl"` on HTML
- Vazir as primary Persian font
- CSS logical properties (start/end, not left/right)
- Toman for pricing display
- Natural Iranian Persian wording
- Mixed Persian/English text handling
- Direction-aware icons

## Mobile and Responsive Requirements

- Mobile-first breakpoints: 320px, 375px, 600px, 900px, 1024px, 1440px
- Core flows work on mobile: chat, document upload, contract wizard, payments
- No horizontal overflow
- Mobile navigation: bottom nav for app, drawer for public
- Tables have mobile card alternatives
- Safe area insets respected

## Main Product Surfaces

### Public
Landing page, Features, Pricing, About, Contact, Login/Register (mobile + OTP)

### Application
Dashboard, AI Chat, Document Analysis, Contract Generator, Lawyer Marketplace, History, Memory, Subscription, Profile, Settings

### Lawyer Panel
Dashboard, Case management, Calendar, Messages, Profile, Earnings

### Admin
User management, Lawyer verification, AI review, Content, Support, Audit
