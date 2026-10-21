// ============================================================
// LEGALIR — Landing exhibit manifest
// ============================================================
// One entry per illustration the landing page is allowed to show. Every
// file lives under `public/assets/landing/` and is served from this
// origin; nothing is fetched from a CDN or read from `DESIGN/` at runtime
// (`npm run check:assets` enforces that rule).
//
// The alt text is descriptive on purpose: each drawing carries a beat in
// the narrative (a pile of documents, a chaos-to-order grid, a hand
// offering help), so a screen-reader user gets the same story a sighted
// visitor gets. A purely ornamental image would get `alt=""` instead —
// none of these are ornamental.
//
// `width`/`height` are the real pixel dimensions of the files (1024²).
// Declaring them lets `next/image` reserve the box before the bytes land,
// which is what keeps CLS at zero while the visitor scrolls.

export interface ExhibitArt {
  /** Root-relative path under `public/`. */
  src: string;
  width: number;
  height: number;
  /** Persian description of what is actually drawn. */
  alt: string;
  /** The museum wall label printed under the plate. */
  caption: { title: string; note: string };
}

const SIZE = { width: 1024, height: 1024 };

function art(
  file: string,
  alt: string,
  title: string,
  note: string,
  size: { width: number; height: number } = SIZE,
): ExhibitArt {
  return {
    src: `/assets/landing/${file}.webp`,
    ...size,
    alt,
    caption: { title, note },
  };
}

export const EXHIBIT = {
  /**
   * Hero — the commissioned hero plate: a robed figure at a desk, writing in
   * an open book, a gavel, the constitution, and a window onto a bookshelf.
   * It arrived as a 1024×1280 (4:5) portrait with a transparent surround, so
   * it is declared with its real ratio here rather than the set's 1:1.
   */
  heroDesk: art(
    "hero-legalir-desk",
    "نمای پشت میز یک حقوقدان با ردای قضایی در حال نوشتن در کتابی باز؛ مهر، پیکان، ترازو، قانون اساسی و قفسهٔ کتاب در پس‌زمینه و برگه‌هایی که در هوا می‌چرخند",
    "میز حقوقی",
    "یک پرسش، یک تحلیل مستند، یک تصمیم روشن",
    { width: 1024, height: 1280 },
  ),

  /** Opening — the problem: documents arrive as an unreadable pile. */
  complexity: art(
    "minimal-16-document-complexity",
    "دسته‌ای بلند و درهم از برگه‌های قرارداد که با خطوط پیچیده به هم بسته شده‌اند",
    "پیچیدگی اسناد",
    "بندها، ارجاع‌ها، و آن‌چه نانوشته می‌ماند",
  ),

  /** The turn — chaos resolving into an ordered grid. */
  order: art(
    "minimal-13-problem-solving",
    "خطوط درهم در یک سو که به‌تدریج مرتب می‌شوند و به شبکه‌ای منظم از خانه‌های مربع و دایره می‌رسند",
    "از ابهام به ساختار",
    "همان مسئله، این بار مرتب‌شده",
  ),

  /** Consultation — two people, one conversation. */
  consultation: art(
    "minimal-04-consultation",
    "دو انسان نشسته روبه‌روی هم در حال گفت‌وگو، با میزی کوچک میان آن‌ها",
    "گفت‌وگو",
    "پیش از هر سند، یک پرسش روشن",
  ),

  /** Traceability — a document whose lines are traced back to sources. */
  traceability: art(
    "minimal-12-legal-technology",
    "برگی از سند که از لبه‌های آن خطوطی به گره‌های بیرونی کشیده شده و هر بند را به منبعی وصل می‌کند",
    "ارجاع",
    "هر بند، به منبع خودش",
  ),

  /** Knowledge — a tree growing out of stacked books. */
  knowledge: art(
    "minimal-05-intelligent-assistance",
    "درختی که از میان برگ‌های باز یک کتاب روی دسته‌ای از کتاب‌ها می‌روید و شاخه‌هایش بالا می‌گیرد",
    "دانش حقوقی",
    "قانون، رویه و تفسیر در یک تنه",
  ),

  /** Contract analysis — clauses marked and underlined. */
  contractAnalysis: art(
    "minimal-09-contract-analysis",
    "برگی از قرارداد با بندهایی که علامت تیک خورده‌اند و دو بند با خط آبی زیر کشیده شده است",
    "تحلیل قرارداد",
    "بندهای مهم، مشخص‌شده",
  ),

  /** Drafting — a fresh sheet waiting for a pen. */
  drafting: art(
    "minimal-10-document-creation",
    "برگه‌های تازه روی هم افتاده با یک جای امضا و خودنویس مشکی روی آن‌ها",
    "پیش‌نویس",
    "از پاسخ‌ها تا سند آمادهٔ بازبینی",
  ),

  /** Drafting, secondary — one contract, several domains. */
  contractDomains: art(
    "minimal-17-contract-drafting",
    "یک برگ قرارداد در مرکز که با خطوطی به سه دایره وصل است: خانه، خودرو و دو حلقهٔ ازدواج",
    "دامنهٔ قراردادها",
    "املاک، خودرو، خانواده و کسب‌وکار",
  ),

  /** Calculators — a mechanical calculator wired to a circuit. */
  calculator: art(
    "minimal-20-vintage-calculator-ai",
    "ماشین‌حساب مکانیکی قدیمی با دستهٔ چرخان که از کنارش مدارهای الکترونیکی بیرون می‌آید",
    "محاسبه",
    "عدد دقیق، جای حدس",
  ),

  /** Human review — a magnifier over a clause at a table. */
  review: art(
    "minimal-18-agreement-review",
    "دو نفر دو طرف یک میز، سندی میان آن‌ها و ذره‌بینی که روی یکی از بندها گرفته شده است",
    "بازبینی انسانی",
    "وقتی تصمیم به چشم متخصص نیاز دارد",
  ),

  /** Specialists — the robe on its hanger. */
  judgment: art(
    "minimal-07-judge-judgment",
    "ردای قضایی گشاد که با چوب‌لباسی آویزان است و چین‌های پارچه در آن دیده می‌شود",
    "مسیر تخصصی",
    "ارجاع به وکیل تأییدشده",
  ),

  // DELIBERATELY ABSENT: `minimal-14-legal-precision.webp` (a classical
  // column drawn to scale). It is the one file in the set that lands on a
  // brief ban — «ستون‌های دادگاه» — and a drawn column reads as exactly
  // that cliché no matter how technical the measurement lines are. The
  // chapter that would have used it («۱۰ · دقت») is printed as a wall-text
  // room instead: see `LandingExhibit` with no `art`. The file itself stays
  // in `public/assets/landing/` (it is part of the supplied source set) but
  // no route references it, so no visitor ever downloads it.

  /** Sources — a clause graph anchored to a document. */
  sources: art(
    "minimal-08-legal-knowledge",
    "برگی از متن حقوقی که با گره‌ها و خطوط به شبکه‌ای از منابع بالای صفحه و کناره‌های آن وصل شده است",
    "منبع‌شناسی",
    "قانون، رأی وحدت رویه، بخشنامه",
  ),

  /** Companionship — a hand reaching down to someone climbing. */
  helpingHand: art(
    "minimal-19-helping-hand",
    "دست بزرگی که به سوی انسانی که از پله‌ها بالا می‌رود دراز شده و کمانی آبی میان آن دو است",
    "همراهی",
    "قدم‌به‌قدم، تا رسیدن به تصمیم",
  ),

  /** Trust — an open palm holding a sphere. */
  guidance: art(
    "minimal-11-trust-guidance",
    "کف دستی باز که کره‌ای آبی را نگه داشته است، با خطوط نازک انگشتان",
    "امانت",
    "موضوع شما، دست‌نخورده و روشن",
  ),

  /** Final CTA — the closed book. */
  lawPrinciples: art(
    "minimal-01-law-principles",
    "کتابی ضخیم و بسته در کنار چند برگهٔ لای‌خورده که یکی از آن‌ها نشانگر آبی دارد",
    "اصول حقوق",
    "کتاب بسته، وقتی مسیر روشن است",
  ),
} as const;

export type ExhibitKey = keyof typeof EXHIBIT;
