// ============================================================
// LEGALIR — Inheritance legal sources (مبنای قانونی)
// ============================================================
// The article references the engine relies on, kept in one place so
// the result can cite exactly what it applied and nothing more.
//
// IMPORTANT — verification policy:
//   These are the *stable* structural articles of the Civil Code
//   (طبقات، حجب، فرض و رد). They are not annual rates, so they do not
//   live in a versioned dataset. They were last reviewed by hand on
//   `REVIEWED_AT`; any amendment to the Civil Code must be reflected
//   here before the next release.
//
// Pure data module — no I/O.

/** Gregorian date a human last checked these references. */
export const REVIEWED_AT = "2026-09-22";

/** The instrument these articles belong to. */
export const INSTRUMENT_FA = "قانون مدنی جمهوری اسلامی ایران — باب دوم: در ارث";

/** A single article the engine may cite. */
export interface LegalArticle {
  /** Article number, e.g. «۸۶۲». */
  numberFa: string;
  /** Short Persian statement of the rule the engine applies. */
  summaryFa: string;
}

export const ARTICLES: Record<string, LegalArticle> = {
  a862: {
    numberFa: "۸۶۲",
    summaryFa:
      "وراث به سه طبقه تقسیم می‌شوند: طبقه اول پدر، مادر و اولاد و اولاد اولاد؛ طبقه دوم اجداد و برادر و خواهر و اولاد آنها؛ طبقه سوم عمو و عمه و دایی و خاله و اولاد آنها.",
  },
  a863: {
    numberFa: "۸۶۳",
    summaryFa:
      "وراث طبقه بعدی در صورتی ارث می‌برند که از طبقه پیشین هیچ وارثی نباشد؛ زوج و زوجه در هر حال ارث می‌برند.",
  },
  a864: {
    numberFa: "۸۶۴",
    summaryFa:
      "در میان وراث یک طبقه، آنکه به میت نزدیک‌تر است ارث می‌برد و دورتر محجوب می‌شود.",
  },
  a867: {
    numberFa: "۸۶۷",
    summaryFa: "حجب بر دو قسم است: حجب از اصل ارث و حجب از سهم.",
  },
  a868: {
    numberFa: "۸۶۸",
    summaryFa:
      "حجب از اصل ارث آن است که وارث به‌کلی از ارث محروم شود؛ مانند محرومیت اولاد اولاد با وجود اولاد.",
  },
  a869: {
    numberFa: "۸۶۹",
    summaryFa:
      "حجب از سهم آن است که وارث از فرض بالاتر به فرض پایین‌تر آید؛ مانند کاهش سهم زوج از یک‌دوم به یک‌چهارم و زوجه از یک‌چهارم به یک‌هشتم.",
  },
  a870: {
    numberFa: "۸۷۰",
    summaryFa: "حجب از سهم تنها در مورد زوج و زوجه و مادر جاری می‌شود.",
  },
  a884: {
    numberFa: "۸۸۴",
    summaryFa:
      "اولاد اولاد در صورت نبودن اولادِ میت، قائم‌مقام والد خود شده و سهم او را می‌برند و آن را به نسبت سهم‌الارث میان خود تقسیم می‌کنند.",
  },
  a885: {
    numberFa: "۸۸۵",
    summaryFa:
      "اگر برای میت اولادِ بلاواسطه باشد، اولادِ آن اولاد ارث نمی‌برند؛ مگر آنکه والدشان پیش از میت فوت کرده باشد.",
  },
  a886: {
    numberFa: "۸۸۶",
    summaryFa:
      "اگر وارث میت فقط یک دختر باشد، نصف ترکه را می‌برد و اگر دو دختر یا بیشتر باشد، دو ثلث ترکه را به‌طور مساوی تقسیم می‌کنند.",
  },
  a887: {
    numberFa: "۸۸۷",
    summaryFa: "اگر وارث میت پسر و دختر باشد، پسر دو برابر دختر ارث می‌برد.",
  },
  a888: {
    numberFa: "۸۸۸",
    summaryFa: "اگر وارث میت فقط پسر باشد، ترکه به‌طور مساوی میان آنان تقسیم می‌شود.",
  },
  a906: {
    numberFa: "۹۰۶",
    summaryFa:
      "اگر وارث میت فقط پدر و مادر باشد، مادر یک‌سوم و پدر دو‌سوم ترکه را می‌برد.",
  },
  a907: {
    numberFa: "۹۰۷",
    summaryFa:
      "اگر وارث میت پدر و مادر و یک دختر باشد، دختر نصف، مادر یک‌ششم و پدر یک‌ششم می‌برد و مازاد به نسبت سهم‌الارث میان پدر و دختر تقسیم می‌شود.",
  },
  a908: {
    numberFa: "۹۰۸",
    summaryFa:
      "اگر وارث میت پدر و مادر و یک پسر باشد، پدر و مادر هر یک یک‌ششم و پسر بقیه ترکه را می‌برد.",
  },
  a909: {
    numberFa: "۹۰۹",
    summaryFa:
      "اگر وارث میت پدر و مادر و چند اولاد باشد، پدر و مادر هر یک یک‌ششم می‌برند و بقیه میان اولاد به نسبت پسر دو برابر دختر تقسیم می‌شود.",
  },
  a910: {
    numberFa: "۹۱۰",
    summaryFa:
      "مادر در صورتی که برای میت اولاد یا اولاد اولاد باشد، یک‌ششم ترکه را می‌برد.",
  },
  a914: {
    numberFa: "۹۱۴",
    summaryFa:
      "اگر وارث میت منحصر به یک یا چند نفر باشد که سهم آنان کمتر از ترکه باشد و وارث دیگری نباشد، مازاد ترکه به نسبت سهم‌الارث میان آنان تقسیم می‌شود.",
  },
  a916: {
    numberFa: "۹۱۶",
    summaryFa:
      "اگر برای میت وارثی به غیر از زوج یا زوجه نباشد، تمام ترکه به زوج یا زوجه می‌رسد.",
  },
  a923: {
    numberFa: "۹۲۳",
    summaryFa:
      "اگر وارث میت برادر و خواهر باشد، برادر دو برابر خواهر ارث می‌برد و اگر فقط برادر یا فقط خواهر باشد، ترکه به‌طور مساوی تقسیم می‌شود.",
  },
  a936: {
    numberFa: "۹۳۶",
    summaryFa:
      "وارث طبقه سوم عمو و عمه و دایی و خاله و اولاد آنان هستند و در صورت نبودن وارث طبقه پیشین ارث می‌برند.",
  },
  a946: {
    numberFa: "۹۴۶",
    summaryFa:
      "زوج در صورت نبودن اولاد و اولاد اولاد برای میت، نصف ترکه و در صورت وجود آنان، یک‌چهارم ترکه را می‌برد.",
  },
  a947: {
    numberFa: "۹۴۷",
    summaryFa:
      "زوجه در صورت نبودن اولاد و اولاد اولاد برای میت، یک‌چهارم ترکه و در صورت وجود آنان، یک‌هشتم ترکه را می‌برد؛ و در صورت تعدد زوجات، این سهم میان آنان به‌طور مساوی تقسیم می‌شود.",
  },
  a948: {
    numberFa: "۹۴۸",
    summaryFa:
      "زوجه از عرصه زمین ارث نمی‌برد و تنها از قیمت اعیان (ساختمان و درخت) و اموال منقول سهم می‌برد.",
  },
};

/** Look up an article by key, throwing when the key is unknown. */
export function article(key: string): LegalArticle {
  const a = ARTICLES[key];
  if (!a) throw new Error(`Unknown inheritance article: ${key}`);
  return a;
}

/** Render a list of article keys as «ماده ۸۶۲» strings. */
export function citeArticles(keys: string[]): string[] {
  return keys.map((k) => `ماده ${article(k).numberFa}`);
}
