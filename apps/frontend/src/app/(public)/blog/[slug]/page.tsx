"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  IconCalendar,
  IconPerson,
  IconCategory,
  IconArrowBack,
  IconArrowForward,
  IconLinkSource,
  IconServices,
  IconStar,
  IconClose,
  IconCheck,
} from "@/lib/icons";

// ============================================================
// Types & Mock Data
// ============================================================

interface Citation {
  id: number;
  text: string;
  source: string;
  sourceUrl: string;
  description: string;
}

interface ArticleSection {
  headingId: string;
  heading: string;
  paragraphs: string[];
}

interface ArticleData {
  slug: string;
  title: string;
  category: string;
  author: string;
  authorTitle: string;
  authorBio: string;
  publishedDate: string;
  readingTime: number;
  excerpt: string;
  imageColor: string;
  sections: ArticleSection[];
  citations: Citation[];
  relatedSources: {
    title: string;
    slug: string;
    type: string;
  }[];
  relatedServices: {
    title: string;
    description: string;
    href: string;
  }[];
}

const articles: Record<string, ArticleData> = {
  "vajh-eltizam-contracts": {
    slug: "vajh-eltizam-contracts",
    title: "وجه التزام در قراردادها: راهنمای جامع حقوقی",
    category: "قراردادها",
    author: "دکتر مریم حسینی",
    authorTitle: "وکیل پایه یک دادگستری",
    authorBio:
      "دکتر مریم حسینی، وکیل پایه یک دادگستری با بیش از ۱۵ سال سابقه در حوزه حقوق قراردادها و داوری تجاری. عضو کانون وکلای دادگستری مرکز.",
    publishedDate: "۱۵ مرداد ۱۴۰۵",
    readingTime: 12,
    excerpt:
      "وجه التزام یکی از مهم‌ترین شروط قراردادی است که طرفین برای تضمین اجرای تعهدات درج می‌کنند. در این مقاله نحوه تعیین، مطالبه و تعدیل وجه التزام بر اساس قوانین ایران و رویه قضایی را بررسی می‌کنیم.",
    imageColor: "from-primary-700 to-primary-900",
    sections: [
      {
        headingId: "intro",
        heading: "مقدمه",
        paragraphs: [
          "در روابط قراردادی، تضمین اجرای تعهدات همواره یکی از دغدغه‌های اصلی طرفین است. قانون‌گذار برای حمایت از متعهدٌله و پیشگیری از نقض قرارداد، نهادهای مختلفی را پیش‌بینی کرده که یکی از مهم‌ترین آن‌ها «وجه التزام» یا «شرط کیفری» است.",
          "وجه التزام مبلغی است که طرفین در زمان انعقاد قرارداد به عنوان خسارت ناشی از عدم انجام یا تأخیر در انجام تعهد تعیین می‌کنند. این نهاد حقوقی ریشه در ماده ۲۳۰ قانون مدنی دارد و در عمل، کاربرد گسترده‌ای در انواع قراردادها از جمله پیمانکاری، خرید و فروش، اجاره و مشارکت دارد.",
        ],
      },
      {
        headingId: "definition",
        heading: "تعریف و ماهیت حقوقی",
        paragraphs: [
          "وجه التزام (Penalty Clause) در حقوق ایران به معنای مبلغی است که طرفین قرارداد به طور مقطوع به عنوان خسارت ناشی از تخلف از انجام تعهدات قراردادی پیش‌بینی می‌کنند. طبق ماده ۲۳۰ قانون مدنی: «اگر در ضمن معامله شرط شود که در صورت تخلف، متخلف مبلغی به عنوان خسارت تأدیه نماید، حاکم نمی‌تواند او را به بیشتر یا کمتر از آنچه ملزم شده است محکوم کند.» [۱]",
          "ماهیت وجه التزام ترکیبی از دو کارکرد «جبران خسارت» و «ضمانت اجرا» است. به عبارت دیگر، هدف اولیه آن جبران زیان‌های احتمالی ناشی از نقض قرارداد است، اما در عین حال کارکرد بازدارندگی نیز دارد و طرفین را به اجرای دقیق تعهدات ترغیب می‌کند.",
          "تفکیک وجه التزام از خسارت واقعی اهمیت زیادی دارد. در حقوق ایران، برخلاف برخی نظام‌های حقوقی مانند کامن‌لا، وجه التزام حتی در صورت عدم ورود خسارت نیز قابل مطالبه است. این ویژگی وجه التزام را به ابزاری قدرتمند برای تضمین اجرای قرارداد تبدیل کرده است. [۲]",
        ],
      },
      {
        headingId: "conditions",
        heading: "شرایط صحت وجه التزام",
        paragraphs: [
          "برای آن‌که شرط وجه التزام دارای اعتبار حقوقی باشد، باید شرایط زیر رعایت شود:",
        ],
      },
      {
        headingId: "amount",
        heading: "نحوه تعیین مبلغ",
        paragraphs: [
          "تعیین مبلغ وجه التزام باید به صورت صریح و مشخص باشد. مبلغ می‌تواند به صورت مقطوع (مثلاً یک میلیارد ریال) یا درصدی از مبلغ کل قرارداد (مثلاً ۱۰٪ ارزش قرارداد) تعیین شود. رویه قضایی ایران مبالغ مبهم و غیرقابل تعیین را نمی‌پذیرد. [۳]",
          "نکته بسیار مهم در تعیین مبلغ، رعایت تناسب با موضوع قرارداد است. اگرچه در ماده ۲۳۰ قانون مدنی تصریح شده که دادگاه نمی‌تواند مبلغ وجه التزام را تغییر دهد، اما در رویه قضایی معاصر، دادگاه‌ها در مواردی که مبلغ «نامتعارف و گزاف» باشد، با استناد به قواعد انصاف و نظم عمومی، اقدام به تعدیل می‌کنند.",
        ],
      },
      {
        headingId: "enforcement",
        heading: "شرایط مطالبه و اجرا",
        paragraphs: [
          "برای مطالبه وجه التزام، متعهدٌله باید اثبات کند که: اولاً، تعهد اصلی وجود داشته و معتبر بوده است. ثانیاً، متعهد از انجام تعهد خودداری کرده یا در اجرای آن تأخیر داشته است. ثالثاً، تخلف قابل انتساب به متعهد باشد (نه ناشی از قوه قاهره).",
          "توجه داشته باشید که اثبات ورود خسارت واقعی برای مطالبه وجه التزام ضروری نیست — این یکی از مهم‌ترین مزایای درج شرط وجه التزام است. متعهدٌله صرفاً با اثبات تخلف می‌تواند مبلغ مقرر را مطالبه کند، حتی اگر در عمل زیانی متوجه او نشده باشد.",
        ],
      },
    ],
    citations: [
      {
        id: 1,
        text: "ماده ۲۳۰ قانون مدنی",
        source: "قانون مدنی جمهوری اسلامی ایران",
        sourceUrl: "/legal-library/civil-code",
        description:
          "مطابق این ماده، طرفین می‌توانند مبلغ مقطوعی را به عنوان خسارت ناشی از عدم انجام تعهد پیش‌بینی کنند و دادگاه حق تغییر آن را ندارد.",
      },
      {
        id: 2,
        text: "رأی وحدت رویه شماره ۷۳۳ دیوان عالی کشور",
        source: "آرای وحدت رویه دیوان عالی کشور",
        sourceUrl: "/legal-library/unified-precedent-733",
        description:
          "در این رأی، دیوان عالی کشور تأکید کرده که وجه التزام مستقل از خسارت واقعی است و صرف تخلف از شرط برای مطالبه آن کافی است.",
      },
      {
        id: 3,
        text: "نظریه مشورتی شماره ۷/۹۹/۱۴۰۲ اداره کل حقوقی قوه قضاییه",
        source: "نظریات مشورتی قوه قضاییه",
        sourceUrl: "/legal-library/advisory-opinion-7991402",
        description:
          "اداره کل حقوقی مقرر داشته که مبلغ وجه التزام باید معین و متناسب با موضوع تعهد باشد و تعیین مبالغ نامتعارف برخلاف نظم عمومی است.",
      },
    ],
    relatedSources: [
      {
        title: "قانون مدنی — مواد ۲۲۱ تا ۲۳۰",
        slug: "civil-code-obligations",
        type: "قانون",
      },
      {
        title: "قانون آیین دادرسی مدنی — دعاوی قراردادی",
        slug: "civil-procedure-contracts",
        type: "قانون",
      },
      {
        title: "کنوانسیون بیع بین‌المللی کالا (CISG) — الحاق ایران",
        slug: "cisg-iran",
        type: "معاهده",
      },
    ],
    relatedServices: [
      {
        title: "تحلیل هوشمند قرارداد",
        description:
          "با بارگذاری قرارداد خود، تحلیل حقوقی کامل شامل بندهای پرریسک و پیشنهاد اصلاح دریافت کنید.",
        href: "/auth/mobile?intent=document",
      },
      {
        title: "تولید پیش‌نویس قرارداد",
        description:
          "با پاسخ به پرسش‌نامه، پیش‌نویس قرارداد شخصی‌سازی‌شده با شروط استاندارد دریافت کنید.",
        href: "/auth/mobile?intent=contract",
      },
    ],
  },

  "malk-mustajir-legal-guide": {
    slug: "malk-mustajir-legal-guide",
    title: "راهنمای حقوقی مالک و مستأجر: آنچه باید بدانید",
    category: "املاک و مستغلات",
    author: "علی رضایی",
    authorTitle: "مشاور حقوقی املاک",
    authorBio:
      "علی رضایی، مشاور حقوقی املاک و مدرس دوره‌های حقوق قراردادهای اجاره. دارای ۱۰ سال تجربه در تنظیم و داوری اختلافات موجر و مستأجر.",
    publishedDate: "۱۰ مرداد ۱۴۰۵",
    readingTime: 15,
    excerpt:
      "رابطه مالک و مستأجر از رایج‌ترین و پرچالش‌ترین موضوعات حقوقی در ایران است. در این راهنما، حقوق و تکالیف قانونی طرفین، شرایط فسخ و تخلیه، سرقفلی و حق کسب و پیشه را به زبان ساده توضیح می‌دهیم.",
    imageColor: "from-secondary-600 to-secondary-800",
    sections: [
      {
        headingId: "intro",
        heading: "مقدمه",
        paragraphs: [
          "رابطه استیجاری میان موجر (مالک) و مستأجر یکی از شایع‌ترین روابط حقوقی در جامعه ایران است. پیچیدگی‌های این رابطه از یک‌سو ناشی از تعدد قوانین حاکم (قانون مدنی، قانون روابط موجر و مستأجر ۱۳۵۶ و ۱۳۷۶) و از سوی دیگر ناشی از شرایط خاص اقتصادی مانند نوسانات بازار مسکن است.",
          "در این راهنما تلاش می‌کنیم مهم‌ترین جنبه‌های حقوقی رابطه مالک و مستأجر را به زبانی ساده و کاربردی توضیح دهیم تا هر دو طرف قرارداد با آگاهی کامل از حقوق و تکالیف خود اقدام به انعقاد اجاره‌نامه کنند.",
        ],
      },
      {
        headingId: "laws",
        heading: "قوانین حاکم بر رابطه موجر و مستأجر",
        paragraphs: [
          "در نظام حقوقی ایران، سه مجموعه قانونی اصلی بر روابط استیجاری حاکم است. قانون مدنی (مواد ۴۶۶ تا ۵۰۶) به عنوان قانون عام، اصول کلی عقد اجاره را بیان می‌کند. قانون روابط موجر و مستأجر مصوب ۱۳۵۶ عمدتاً ناظر بر اماکن تجاری و کسبی است و مفهوم «سرقفلی» و «حق کسب و پیشه و تجارت» در این قانون تعریف شده است. [۱]",
          "قانون روابط موجر و مستأجر مصوب ۱۳۷۶ نیز عمدتاً ناظر بر اماکن مسکونی است و شرایط تخلیه، تعدیل اجاره‌بها و تعیین مدت اجاره در این قانون پیش‌بینی شده است. نکته مهم این است که تشخیص قانون حاکم بر هر رابطه استیجاری بستگی به تاریخ انعقاد قرارداد و نوع ملک دارد.",
        ],
      },
      {
        headingId: "rights-duties-malk",
        heading: "حقوق و تکالیف مالک (موجر)",
        paragraphs: [
          "موجر مکلف است عین مستأجره را در وضعیتی قابل بهره‌برداری به مستأجر تحویل دهد و در طول مدت اجاره، تعمیرات اساسی را انجام دهد. در مقابل، موجر حق دریافت اجاره‌بها در مواعد مقرر و استرداد ملک پس از پایان مدت اجاره را دارد.",
          "موجر نمی‌تواند در طول مدت اجاره، بدون دلیل موجه و بدون طی تشریفات قانونی، مستأجر را تخلیه کند. حتی پس از پایان مدت اجاره نیز، تخلیه مستلزم طی مراحل قانونی و صدور دستور تخلیه از مرجع صالح است. [۲]",
        ],
      },
      {
        headingId: "rights-duties-mustajir",
        heading: "حقوق و تکالیف مستأجر",
        paragraphs: [
          "مستأجر حق استفاده از عین مستأجره را در چارچوب قرارداد دارد و موجر نمی‌تواند در این حق ممانعت ایجاد کند. همچنین مستأجر در برابر اشخاص ثالث حق طرح دعوای تصرف عدوانی و ممانعت از حق دارد.",
          "از جمله تکالیف مستأجر می‌توان به پرداخت به‌موقع اجاره‌بها، استفاده متعارف از ملک، انجام تعمیرات جزئی، خودداری از تغییر کاربری بدون رضایت موجر و استرداد ملک پس از پایان مدت اجاره اشاره کرد.",
        ],
      },
    ],
    citations: [
      {
        id: 1,
        text: "قانون روابط موجر و مستأجر مصوب ۱۳۵۶",
        source: "قوانین موجر و مستأجر",
        sourceUrl: "/legal-library/landlord-tenant-1356",
        description:
          "این قانون ناظر بر اماکن تجاری و کسبی است و مفاهیم سرقفلی و حق کسب و پیشه را تعریف کرده است.",
      },
      {
        id: 2,
        text: "تصمیم شورای عالی مسکن — مصوبه ساماندهی بازار اجاره",
        source: "مصوبات شورای عالی مسکن",
        sourceUrl: "/legal-library/housing-council-rent-regulation",
        description:
          "مصوبه اخیر شورای عالی مسکن در خصوص سقف افزایش اجاره‌بها و ضوابط تخلیه در شرایط خاص بازار.",
      },
    ],
    relatedSources: [
      {
        title: "قانون مدنی — عقد اجاره (مواد ۴۶۶ تا ۵۰۶)",
        slug: "civil-code-lease",
        type: "قانون",
      },
      {
        title: "قانون روابط موجر و مستأجر ۱۳۷۶ — متن کامل",
        slug: "landlord-tenant-law-1376",
        type: "قانون",
      },
      {
        title: "آیین‌نامه اجرایی قانون روابط موجر و مستأجر",
        slug: "landlord-tenant-bylaw",
        type: "آیین‌نامه",
      },
    ],
    relatedServices: [
      {
        title: "تحلیل هوشمند قرارداد",
        description:
          "اجاره‌نامه خود را بارگذاری کنید و تحلیل حقوقی کامل از بندهای مهم و ریسک‌های آن دریافت کنید.",
        href: "/auth/mobile?intent=document",
      },
      {
        title: "مشاوره حقوقی با AI",
        description:
          "سوالات خود درباره رابطه موجر و مستأجر را بپرسید و پاسخ مبتنی بر قانون و رویه قضایی دریافت کنید.",
        href: "/auth/mobile?intent=chat",
      },
    ],
  },

  "ai-legal-analysis-future": {
    slug: "ai-legal-analysis-future",
    title: "هوش مصنوعی و آینده تحلیل حقوقی در ایران",
    category: "تجارت",
    author: "سارا محمدی",
    authorTitle: "پژوهشگر حقوق و فناوری",
    authorBio:
      "سارا محمدی، پژوهشگر حوزه حقوق و فناوری و دانش‌آموخته حقوق تجارت بین‌الملل از دانشگاه تهران. حوزه تمرکز: کاربرد هوش مصنوعی در نظام‌های حقوقی.",
    publishedDate: "۵ مرداد ۱۴۰۵",
    readingTime: 8,
    excerpt:
      "فناوری هوش مصنوعی به سرعت در حال تغییر شیوه ارائه خدمات حقوقی در جهان است. در این مقاله نقش AI در تحلیل اسناد حقوقی، پیش‌بینی آرای قضایی و دسترسی‌پذیر کردن دانش حقوقی را از منظر نظام حقوقی ایران بررسی می‌کنیم.",
    imageColor: "from-primary-600 to-secondary-700",
    sections: [
      {
        headingId: "intro",
        heading: "مقدمه",
        paragraphs: [
          "هوش مصنوعی (AI) دیگر یک مفهوم آینده‌نگرانه نیست — امروزه ابزارهای مبتنی بر AI در حال تغییر بنیادین صنعت حقوقی در سراسر جهان هستند. از تحلیل خودکار اسناد حقوقی تا پیش‌بینی نتایج دعاوی، AI به وکلا و عموم مردم کمک می‌کند تا تصمیمات آگاهانه‌تری بگیرند.",
          "در ایران نیز با ظهور پلتفرم‌هایی مانند LEGALIR، استفاده از هوش مصنوعی در حوزه حقوق وارد مرحله جدیدی شده است. اما فرصت‌ها و چالش‌های این فناوری در بستر نظام حقوقی ایران چیست؟",
        ],
      },
      {
        headingId: "opportunities",
        heading: "فرصت‌های هوش مصنوعی در حقوق ایران",
        paragraphs: [
          "یکی از مهم‌ترین کاربردهای AI در حقوق ایران، تحلیل پیشرفته مواد قانونی، آرای قضایی و نظریات مشورتی است. سیستم‌های هوش مصنوعی می‌توانند با پردازش حجم عظیمی از داده‌های حقوقی، الگوهای پنهان را شناسایی و ارتباط میان قوانین مختلف را کشف کنند. [۱]",
          "همچنین AI می‌تواند به «دسترسی‌پذیر کردن عدالت» کمک کند. بسیاری از شهروندان به دلیل هزینه‌های بالای مشاوره حقوقی از پیگیری حقوق خود منصرف می‌شوند. ابزارهای AI می‌توانند با ارائه تحلیل اولیه رایگان یا کم‌هزینه، این شکاف را کاهش دهند.",
        ],
      },
      {
        headingId: "challenges",
        heading: "چالش‌ها و محدودیت‌ها",
        paragraphs: [
          "مهم‌ترین چالش استفاده از AI در حقوق ایران، مسئله «اعتبار و قابلیت استناد» اطلاعات تولیدشده توسط هوش مصنوعی است. نظام قضایی ایران هنوز چارچوب مشخصی برای به رسمیت شناختن تحلیل‌های AI به عنوان مستند قانونی ندارد. [۲]",
        ],
      },
    ],
    citations: [
      {
        id: 1,
        text: "گزارش رصدخانه فناوری حقوقی ۱۴۰۴",
        source: "مرکز پژوهش‌های مجلس شورای اسلامی",
        sourceUrl: "/legal-library/legal-tech-observatory-1404",
        description:
          "گزارش جامع مرکز پژوهش‌های مجلس در خصوص وضعیت فناوری‌های حقوقی در ایران و چالش‌های پیش رو.",
      },
      {
        id: 2,
        text: "ماده ۳ قانون تجارت الکترونیکی و الزامات اعتبار داده‌های الکترونیکی",
        source: "قانون تجارت الکترونیکی",
        sourceUrl: "/legal-library/ecommerce-law-article3",
        description:
          "ضوابط قانونی برای اعتبار و قابلیت استناد اسناد و داده‌های الکترونیکی در نظام حقوقی ایران.",
      },
    ],
    relatedSources: [
      {
        title: "قانون تجارت الکترونیکی — متن کامل",
        slug: "electronic-commerce-law",
        type: "قانون",
      },
      {
        title: "سند ملی هوش مصنوعی جمهوری اسلامی ایران",
        slug: "national-ai-document",
        type: "سند راهبردی",
      },
    ],
    relatedServices: [
      {
        title: "تحلیل حقوقی با هوش مصنوعی",
        description:
          "مسئله حقوقی خود را مطرح کنید و تحلیل ساختاریافته با استناد به قوانین دریافت کنید.",
        href: "/auth/mobile?intent=chat",
      },
      {
        title: "تحلیل و بررسی اسناد",
        description:
          "قراردادها و اسناد خود را بارگذاری کنید و بندهای پرریسک را شناسایی کنید.",
        href: "/auth/mobile?intent=document",
      },
    ],
  },

  "divorce-legal-process-guide": {
    slug: "divorce-legal-process-guide",
    title: "روند قانونی طلاق توافقی: مراحل، مدارک و نکات مهم",
    category: "خانواده",
    author: "دکتر مریم حسینی",
    authorTitle: "وکیل پایه یک دادگستری",
    authorBio:
      "دکتر مریم حسینی، وکیل پایه یک دادگستری با بیش از ۱۵ سال سابقه در حوزه حقوق خانواده و دعاوی طلاق.",
    publishedDate: "۱ مرداد ۱۴۰۵",
    readingTime: 10,
    excerpt:
      "طلاق توافقی سریع‌ترین و کمدردسرترین روش انحلال نکاح در حقوق ایران است. در این مقاله گام‌به‌گام مراحل طلاق توافقی، مدارک مورد نیاز، حقوق مالی زوجه و حضانت فرزندان را شرح می‌دهیم.",
    imageColor: "from-primary-800 to-neutral-900",
    sections: [
      {
        headingId: "intro",
        heading: "مقدمه",
        paragraphs: [
          "طلاق توافقی به عنوان یکی از انواع طلاق در نظام حقوقی ایران، روشی است که در آن زوجین با توافق یکدیگر تصمیم به پایان دادن به زندگی مشترک می‌گیرند. در این نوع طلاق، برخلاف طلاق‌های یک‌طرفه، زوجین در خصوص کلیه مسائل از جمله مهریه، نفقه، جهیزیه و حضانت فرزندان به توافق می‌رسند.",
          "مزیت اصلی طلاق توافقی، کاهش زمان رسیدگی و هزینه‌های دادرسی است. در حالی که طلاق‌های یک‌طرفه ممکن است ماه‌ها یا حتی سال‌ها طول بکشد، طلاق توافقی معمولاً ظرف چند هفته نهایی می‌شود.",
        ],
      },
      {
        headingId: "steps",
        heading: "مراحل گام‌به‌گام طلاق توافقی",
        paragraphs: [
          "مرحله اول: مراجعه به دفاتر مشاوره خانواده. طبق قانون حمایت خانواده مصوب ۱۳۹۱، زوجین متقاضی طلاق توافقی ابتدا باید به یکی از مراکز مشاوره خانواده قوه قضاییه مراجعه کنند. مشاور پس از ۳ تا ۵ جلسه، نظر خود را به دادگاه ارائه می‌دهد. [۱]",
          "مرحله دوم: تنظیم دادخواست طلاق توافقی. در این مرحله، وکیل یا زوجین شخصاً دادخواستی را با قید «طلاق توافقی» به همراه مدارک مورد نیاز به دادگاه خانواده تقدیم می‌کنند. مدارک شامل: سند ازدواج، شناسنامه طرفین، کارت ملی، و گواهی عدم بارداری زوجه است.",
          "مرحله سوم: حضور در دادگاه و صدور رأی. قاضی پس از بررسی توافقات، در صورت احراز صحت و عدم مغایرت با قوانین آمره، گواهی عدم امکان سازش صادر می‌کند. این گواهی پس از ۳ ماه اعتبار قانونی دارد و زوجین باید در این مدت به دفترخانه مراجعه کنند.",
        ],
      },
    ],
    citations: [
      {
        id: 1,
        text: "قانون حمایت خانواده مصوب ۱۳۹۱ — مواد ۲۵ و ۲۶",
        source: "قانون حمایت خانواده",
        sourceUrl: "/legal-library/family-protection-law-1391",
        description:
          "مواد ۲۵ و ۲۶ قانون حمایت خانواده الزام به مشاوره قبل از طلاق توافقی را مقرر داشته است.",
      },
    ],
    relatedSources: [
      {
        title: "قانون حمایت خانواده مصوب ۱۳۹۱",
        slug: "family-protection-law-1391",
        type: "قانون",
      },
      {
        title: "قانون مدنی — مواد ۱۱۳۳ تا ۱۱۵۷ (انحلال نکاح)",
        slug: "civil-code-dissolution",
        type: "قانون",
      },
    ],
    relatedServices: [
      {
        title: "تحلیل حقوقی هوشمند",
        description:
          "سوالات حقوقی خانواده خود را مطرح کنید و تحلیل مبتنی بر قوانین روز دریافت کنید.",
        href: "/auth/mobile?intent=chat",
      },
    ],
  },
};

// Post navigation order (for prev/next)
const postOrder = [
  "vajh-eltizam-contracts",
  "malk-mustajir-legal-guide",
  "ai-legal-analysis-future",
  "divorce-legal-process-guide",
];

// ============================================================
// Sub-components
// ============================================================

/** Inline citation popup */
function CitationMarker({
  citation,
}: {
  citation: Citation;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-labelSmall font-bold hover:bg-primary-200 transition-colors align-middle mx-0.5"
        aria-label={`منبع ${citation.id}`}
        title={citation.source}
      >
        {citation.id}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />

          {/* Popup */}
          <div className="absolute bottom-full right-0 mb-2 w-72 bg-surface border border-neutral-200 rounded-large shadow-elevation-8 p-4 z-40 animate-slide-up-fade">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 left-2 text-neutral-400 hover:text-neutral-600 transition-colors"
              aria-label="بستن"
            >
              <IconClose size={14} />
            </button>
            <p className="text-labelLarge text-primary-700 mb-1">
              [{citation.id}] {citation.text}
            </p>
            <p className="text-caption text-neutral-500 mb-3 leading-relaxed">
              {citation.description}
            </p>
            <Link
              href={citation.sourceUrl}
              className="inline-flex items-center gap-1 text-labelSmall text-primary-600 hover:text-primary-800 transition-colors"
            >
              <IconLinkSource size={12} />
              {citation.source}
            </Link>
          </div>
        </>
      )}
    </span>
  );
}

/** Table of Contents */
function TableOfContents({ sections }: { sections: ArticleSection[] }) {
  const [collapsed, setCollapsed] = useState(false);

  const headings = sections.filter(
    (s) => s.headingId !== "intro"
  ).length > 0
    ? sections
    : sections;

  return (
    <nav className="rounded-xl bg-neutral-50 border border-neutral-200 p-5">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full text-left"
      >
        <h4 className="text-titleMedium text-primary-800">
          فهرست مطالب
        </h4>
        <span className="text-caption text-neutral-400">
          {collapsed ? "نمایش" : "پنهان"}
        </span>
      </button>

      {!collapsed && (
        <ul className="mt-4 space-y-2 animate-slide-up-fade">
          {headings.map((section) => (
            <li key={section.headingId}>
              <a
                href={`#${section.headingId}`}
                className="block text-body-2 text-neutral-600 hover:text-primary-700 transition-colors py-1 border-r-2 border-transparent hover:border-primary-400 pr-3 leading-relaxed"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

/** Share Button */
function ShareButton({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/blog/${slug}`;
    const shareData = { title, url };

    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or not supported - fall back to copy
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard failed - silently ignore
    }
  }, [title, slug]);

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-body-2 text-neutral-600 bg-neutral-50 border border-neutral-300 hover:border-primary-300 hover:text-primary-700 transition-all"
      aria-label="اشتراک‌گذاری"
    >
      {copied ? (
        <>
          <IconCheck size={16} className="text-success" />
          <span className="text-success text-caption">کپی شد</span>
        </>
      ) : (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="shrink-0"
            aria-hidden="true"
          >
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
          </svg>
          اشتراک‌گذاری
        </>
      )}
    </button>
  );
}

/** Bookmark Button */
function BookmarkButton() {
  const [bookmarked, setBookmarked] = useState(false);

  return (
    <button
      onClick={() => setBookmarked(!bookmarked)}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-body-2 border transition-all ${
        bookmarked
          ? "bg-secondary-50 text-secondary-700 border-secondary-300"
          : "bg-neutral-50 text-neutral-600 border-neutral-300 hover:border-primary-300 hover:text-primary-700"
      }`}
      aria-label={bookmarked ? "حذف از نشان‌ها" : "ذخیره در نشان‌ها"}
    >
      <IconStar
        size={16}
        className={bookmarked ? "text-secondary-600" : ""}
      />
      {bookmarked ? "ذخیره شد" : "ذخیره"}
    </button>
  );
}

/** Not Found State */
function NotFoundState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center min-h-[60vh]">
      <div className="h-20 w-20 rounded-full bg-neutral-100 flex items-center justify-center mb-6">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-neutral-300"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </div>
      <h2 className="text-h2 text-primary-800 mb-3">مقاله مورد نظر یافت نشد</h2>
      <p className="text-body-1 text-neutral-500 mb-8 max-w-md leading-relaxed">
        مقاله‌ای با این آدرس وجود ندارد. ممکن است حذف شده باشد یا آدرس را اشتباه
        وارد کرده باشید.
      </p>
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 rounded-medium bg-primary-700 text-white px-6 py-3 text-button hover:bg-primary-800 transition-colors touch-target shadow-elevation-1"
      >
        <IconArrowBack size={18} rtlFlip />
        بازگشت به وبلاگ
      </Link>
    </div>
  );
}

// ============================================================
// Main Article Detail Page
// ============================================================

export default function BlogArticlePage() {
  const params = useParams();
  const slug = params?.["slug"] as string;

  const article = articles[slug];

  // Compute prev/next posts
  const { prevPost, nextPost } = useMemo(() => {
    const idx = postOrder.indexOf(slug);
    const prevSlug: string | undefined = postOrder[idx - 1];
    const nextSlug: string | undefined = postOrder[idx + 1];
    return {
      prevPost: idx > 0 && prevSlug ? articles[prevSlug] : null,
      nextPost:
        idx < postOrder.length - 1 && nextSlug ? articles[nextSlug] : null,
    };
  }, [slug]);

  // Not found state
  if (!article) {
    return <NotFoundState />;
  }

  return (
    <>
      {/* ========================================================
          Article Header
          ======================================================== */}
      <header className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-12 tablet:py-16">
        <div className="mx-auto max-w-4xl px-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-caption text-primary-200/70 mb-6">
            <Link href="/blog" className="hover:text-white transition-colors">
              وبلاگ
            </Link>
            <span className="text-primary-300/50">/</span>
            <span className="text-primary-100/80">{article.category}</span>
          </div>

          {/* Category badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-labelSmall bg-white/15 text-white/90 border border-white/20 mb-4">
            <IconCategory size={12} />
            {article.category}
          </span>

          {/* Title */}
          <h1 className="text-h1 text-white mb-4 leading-snug">
            {article.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-body-2 text-primary-100/70">
            <span className="flex items-center gap-1.5">
              <IconPerson size={16} />
              {article.author}
            </span>
            <span className="text-primary-200/40 hidden tablet:inline">
              |
            </span>
            <span className="flex items-center gap-1.5">
              <IconCalendar size={16} />
              {article.publishedDate}
            </span>
            <span className="text-primary-200/40 hidden tablet:inline">
              |
            </span>
            <span className="tabular-nums">{article.readingTime} دقیقه مطالعه</span>
          </div>
        </div>
      </header>

      {/* ========================================================
          Cover Image Placeholder
          ======================================================== */}
      <section className="bg-neutral-100 border-b border-neutral-200">
        <div className="mx-auto max-w-4xl">
          <div
            className={`bg-gradient-to-br ${article.imageColor} h-48 tablet:h-64 flex items-center justify-center relative overflow-hidden`}
          >
            {/* Abstract shapes */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-6 right-8 w-28 h-28 rounded-full border-2 border-white" />
              <div className="absolute bottom-3 left-10 w-20 h-20 rounded-full border border-white" />
              <div className="absolute top-14 left-14 w-36 h-36 rounded-full border border-white/60" />
              <div className="absolute -bottom-3 right-24 w-24 h-24 rounded-full border-2 border-white/50" />
            </div>
            <div className="relative z-10 text-center">
              <span className="text-white/80 text-body-1 block mb-1">
                LEGALIR Blog
              </span>
              <span className="text-white/40 text-caption">
                تصویر مقاله
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          Article Content with Sidebar (ToC on laptop+)
          ======================================================== */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex gap-10">
            {/* Main content */}
            <div className="flex-1 min-w-0 max-w-[720px] mx-auto">
              {/* Article sections */}
              <div className="prose-custom space-y-10">
                {article.sections.map((section) => (
                  <section key={section.headingId} id={section.headingId}>
                    <h2 className="text-h2 text-primary-800 mb-4 pb-2 border-b border-divider">
                      {section.heading}
                    </h2>
                    {section.paragraphs.map((paragraph, pIdx) => (
                      <p
                        key={pIdx}
                        className="text-body-1 text-neutral-700 leading-loose mb-4 text-justify"
                      >
                        {/* Parse inline citation markers like [۱] */}
                        {paragraph
                          .split(/(\[[۱۲۳۴۵۶۷۸۹]\])/g)
                          .map((part, partIdx) => {
                            const match = part.match(/\[([۱۲۳۴۵۶۷۸۹])\]/);
                            if (match && match[1]) {
                              const persianDigits = "۱۲۳۴۵۶۷۸۹";
                              const citationId = persianDigits.indexOf(
                                match[1]
                              );
                              const citation =
                                article.citations[citationId];
                              if (citation) {
                                return (
                                  <CitationMarker
                                    key={partIdx}
                                    citation={citation}
                                  />
                                );
                              }
                            }
                            return part;
                          })}
                      </p>
                    ))}
                  </section>
                ))}
              </div>

              {/* Divider */}
              <hr className="my-12 border-divider" />

              {/* ====================================================
                  Related Sources
                  ==================================================== */}
              {article.relatedSources.length > 0 && (
                <section className="mb-12">
                  <h3 className="text-h3 text-primary-800 mb-5 flex items-center gap-2">
                    <IconLinkSource size={22} className="text-primary-600" />
                    منابع مرتبط
                  </h3>
                  <div className="grid tablet:grid-cols-2 gap-4">
                    {article.relatedSources.map((source) => (
                      <Link
                        key={source.slug}
                        href={`/legal-library/${source.slug}`}
                        className="flex items-start gap-3 p-4 rounded-xl border border-neutral-200 bg-surface hover:border-primary-300 hover:bg-primary-50/50 transition-all group/source"
                      >
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-primary-50 text-primary-700 text-labelSmall shrink-0 mt-0.5 group-hover/source:bg-primary-100 transition-colors">
                          <IconLinkSource size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-body-2 text-primary-800 font-medium mb-0.5 group-hover/source:text-primary-600 transition-colors line-clamp-2">
                            {source.title}
                          </p>
                          <span className="text-caption text-neutral-400">
                            {source.type}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* ====================================================
                  Related Services CTA Cards
                  ==================================================== */}
              {article.relatedServices.length > 0 && (
                <section className="mb-12">
                  <h3 className="text-h3 text-primary-800 mb-5 flex items-center gap-2">
                    <IconServices size={22} className="text-primary-600" />
                    خدمات مرتبط LEGALIR
                  </h3>
                  <div className="grid tablet:grid-cols-2 gap-4">
                    {article.relatedServices.map((service) => (
                      <Link
                        key={service.title}
                        href={service.href}
                        className="p-5 rounded-xl bg-gradient-to-br from-primary-50 to-secondary-50 border border-primary-100/50 hover:shadow-elevation-4 transition-all group/service"
                      >
                        <h4 className="text-titleMedium text-primary-800 mb-2 group-hover/service:text-primary-600 transition-colors">
                          {service.title}
                        </h4>
                        <p className="text-body-2 text-neutral-500 mb-4 leading-relaxed">
                          {service.description}
                        </p>
                        <span className="inline-flex items-center gap-1 text-button text-primary-700 group-hover/service:gap-2 transition-all">
                          شروع کنید
                          <IconArrowBack size={14} rtlFlip />
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* ====================================================
                  Author Bio
                  ==================================================== */}
              <section className="mb-12 p-6 rounded-xl bg-neutral-50 border border-neutral-200">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <IconPerson size={24} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-titleMedium text-primary-800 mb-0.5">
                      {article.author}
                    </p>
                    <p className="text-caption text-neutral-400 mb-3">
                      {article.authorTitle}
                    </p>
                    <p className="text-body-2 text-neutral-600 leading-relaxed">
                      {article.authorBio}
                    </p>
                  </div>
                </div>
              </section>

              {/* ====================================================
                  Share + Bookmark Row
                  ==================================================== */}
              <div className="flex flex-wrap items-center gap-3 mb-12 pt-6 border-t border-divider">
                <ShareButton title={article.title} slug={article.slug} />
                <BookmarkButton />
              </div>

              {/* ====================================================
                  Previous / Next Post Navigation
                  ==================================================== */}
              <nav className="grid tablet:grid-cols-2 gap-4 pt-6 border-t border-divider">
                {prevPost ? (
                  <Link
                    href={`/blog/${prevPost.slug}`}
                    className="group flex items-start gap-3 p-4 rounded-xl border border-neutral-200 bg-surface hover:border-primary-300 hover:bg-primary-50/50 transition-all"
                  >
                    <span className="text-neutral-400 group-hover:text-primary-600 transition-colors mt-0.5 shrink-0">
                      <IconArrowForward size={20} />
                    </span>
                    <div className="text-right min-w-0">
                      <span className="text-caption text-neutral-400 block mb-1">
                        مقاله قبلی
                      </span>
                      <span className="text-body-2 text-primary-800 font-medium line-clamp-2 group-hover:text-primary-600 transition-colors">
                        {prevPost.title}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div />
                )}

                {nextPost && (
                  <Link
                    href={`/blog/${nextPost.slug}`}
                    className="group flex items-start gap-3 p-4 rounded-xl border border-neutral-200 bg-surface hover:border-primary-300 hover:bg-primary-50/50 transition-all tablet:text-left"
                  >
                    <div className="min-w-0">
                      <span className="text-caption text-neutral-400 block mb-1">
                        مقاله بعدی
                      </span>
                      <span className="text-body-2 text-primary-800 font-medium line-clamp-2 group-hover:text-primary-600 transition-colors">
                        {nextPost.title}
                      </span>
                    </div>
                    <span className="text-neutral-400 group-hover:text-primary-600 transition-colors mt-0.5 shrink-0">
                      <IconArrowBack size={20} />
                    </span>
                  </Link>
                )}
              </nav>
            </div>

            {/* Sidebar: Table of Contents (laptop+) */}
            <aside className="hidden laptop:block w-64 shrink-0">
              <div className="sticky top-24">
                <TableOfContents sections={article.sections} />

                {/* Quick nav back */}
                <div className="mt-6">
                  <Link
                    href="/blog"
                    className="flex items-center gap-2 text-body-2 text-neutral-500 hover:text-primary-700 transition-colors"
                  >
                    <IconArrowBack size={16} rtlFlip />
                    همه مقالات
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ========================================================
          Bottom CTA
          ======================================================== */}
      <section className="bg-neutral-50 border-t border-neutral-200 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-h2 text-primary-800 mb-3">
            سوال حقوقی دارید؟
          </h2>
          <p className="text-body-1 text-neutral-500 mb-8 max-w-lg mx-auto leading-relaxed">
            از هوش مصنوعی LEGALIR بپرسید و تحلیل حقوقی با استناد به قوانین
            معتبر دریافت کنید. کاملاً رایگان و بدون نیاز به ثبت‌نام اولیه.
          </p>
          <Link
            href="/auth/mobile?intent=chat"
            className="inline-block rounded-medium bg-primary-700 text-white px-10 py-4 text-button hover:bg-primary-800 transition-colors touch-target shadow-elevation-1 hover:shadow-elevation-4"
          >
            شروع پرسش و پاسخ حقوقی
          </Link>
        </div>
      </section>
    </>
  );
}
