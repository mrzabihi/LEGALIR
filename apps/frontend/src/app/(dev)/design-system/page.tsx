"use client";

import React, { useState } from "react";
import { useThemeStore } from "@/stores/theme-store";
import {
  Button,
  IconButton,
  TextField,
  OTPInput,
  Select,
  Checkbox,
  RadioGroup,
  Switch,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Dialog,
  ConfirmDialog,
  Drawer,
  Tooltip,
  Tabs,
  Chip,
  Badge,
  ProgressLinear,
  ProgressCircular,
  Skeleton,
  SkeletonCard,
  SkeletonList,
  EmptyState,
  ErrorState,
  snackbar,
} from "@legalir/ui";
import {
  IconSearch,
  IconMenu,
  IconClose,
  IconAdd,
  IconEdit,
  IconDelete,
  IconSettings,
  IconPerson,
  IconDarkMode,
  IconLightMode,
} from "@/lib/icons";
import { BottomNav } from "@/lib/layout-primitives";

// Helper for demo sections
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-headlineSmall text-onSurface mb-4 pb-2 border-b border-divider">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-titleSmall text-onSurfaceVariant mb-2">{title}</h3>
      <div className="flex flex-wrap items-center gap-3 p-3 bg-surfaceVariant/30 rounded-medium border border-divider/50">
        {children}
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  const { theme, toggleTheme } = useThemeStore();
  const [otpValue, setOtpValue] = useState("");
  const [selectedTab, setSelectedTab] = useState("tab1");
  const [selectValue, setSelectValue] = useState("");
  const [radioValue, setRadioValue] = useState("1");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(false);

  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="fa-IR">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur-sm border-b border-divider">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08]"
              aria-label="منو"
            >
              <IconMenu size={22} />
            </button>
            <h1 className="text-headlineSmall text-primary">Design System</h1>
            <Chip label="DEV" variant="outlined" />
          </div>
          <div className="flex items-center gap-2">
            <Chip
              label={theme === "dark" ? "تیره" : "روشن"}
              startIcon={theme === "dark" ? <IconDarkMode size={16} /> : <IconLightMode size={16} />}
              onClick={toggleTheme}
              variant="outlined"
            />
            <IconButton label="تنظیمات" size="medium">
              <IconSettings size={20} />
            </IconButton>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* --- Typography --- */}
        <Section title="تایپوگرافی — Typography">
          <div className="space-y-2">
            <p className="text-displayMedium text-onSurface">Display Medium</p>
            <p className="text-displaySmall text-onSurface">Display Small</p>
            <p className="text-headlineLarge text-onSurface">Headline Large</p>
            <p className="text-headlineSmall text-onSurface">Headline Small</p>
            <p className="text-titleLarge text-onSurface">Title Large</p>
            <p className="text-titleMedium text-onSurface">Title Medium</p>
            <p className="text-bodyLarge text-onSurface">Body Large — لورم ایپسوم متن ساختگی</p>
            <p className="text-bodyMedium text-onSurfaceVariant">
              Body Medium — لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ
            </p>
            <p className="text-bodySmall text-onSurfaceVariant">Body Small</p>
            <p className="text-labelLarge text-primary">Label Large</p>
            <p className="text-labelMedium text-onSurfaceVariant">LABEL MEDIUM</p>
          </div>
        </Section>

        {/* --- Colors --- */}
        <Section title="پالت رنگ — Color Palette">
          <SubSection title="Primary — Deep Legal Navy">
            <div className="grid grid-cols-5 tablet:grid-cols-10 gap-2">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => (
                <div key={n} className={`bg-primary-${n} ${n > 400 ? "text-white" : "text-primary-900"} p-3 rounded-medium text-center text-caption`}>
                  {n}
                </div>
              ))}
            </div>
          </SubSection>
          <SubSection title="Secondary — Muted Gold">
            <div className="grid grid-cols-5 tablet:grid-cols-10 gap-2">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => (
                <div key={n} className={`bg-secondary-${n} ${n > 500 ? "text-white" : "text-secondary-900"} p-3 rounded-medium text-center text-caption`}>
                  {n}
                </div>
              ))}
            </div>
          </SubSection>
          <SubSection title="Neutral">
            <div className="grid grid-cols-6 tablet:grid-cols-12 gap-2">
              {["0", 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => (
                <div key={n} className={`bg-neutral-${n} ${Number(n) > 500 || n === "950" ? "text-white" : "text-neutral-900"} p-3 rounded-medium text-center text-caption border border-neutral-200`}>
                  {n}
                </div>
              ))}
            </div>
          </SubSection>
          <SubSection title="Semantic">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Error", bg: "bg-error", fg: "text-white" },
                { label: "Warning", bg: "bg-warning", fg: "text-white" },
                { label: "Success", bg: "bg-success", fg: "text-white" },
                { label: "Info", bg: "bg-info", fg: "text-white" },
              ].map((c) => (
                <div key={c.label} className={`${c.bg} ${c.fg} px-4 py-2 rounded-medium text-center text-caption`}>
                  {c.label}
                </div>
              ))}
            </div>
          </SubSection>
        </Section>

        {/* --- Elevation --- */}
        <Section title="ارتفاع — Elevation">
          <div className="flex flex-wrap gap-4">
            {[1, 2, 3, 4, 8, 16, 24].map((level) => (
              <Card key={level} variant="elevated" className={`!shadow-elevation-${level}`}>
                <p className="text-labelMedium">سطح {level}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* --- Buttons --- */}
        <Section title="دکمه‌ها — Buttons">
          <SubSection title="Filled">
            <Button variant="filled" size="small">کوچک</Button>
            <Button variant="filled">متوسط</Button>
            <Button variant="filled" size="large">بزرگ</Button>
            <Button variant="filled" loading>در حال ارسال</Button>
            <Button variant="filled" disabled>غیرفعال</Button>
            <Button variant="filled" startIcon={<IconAdd size={18} />}>با آیکون</Button>
          </SubSection>
          <SubSection title="Outlined">
            <Button variant="outlined">متوسط</Button>
            <Button variant="outlined" size="large">بزرگ</Button>
          </SubSection>
          <SubSection title="Text">
            <Button variant="text">دکمه متنی</Button>
            <Button variant="text" startIcon={<IconEdit size={18} />}>ویرایش</Button>
          </SubSection>
          <SubSection title="Tonal">
            <Button variant="tonal">Tonal Button</Button>
          </SubSection>
          <SubSection title="Full Width">
            <Button fullWidth>دکمه تمام عرض</Button>
          </SubSection>
          <SubSection title="Icon Buttons">
            <IconButton label="جستجو" variant="standard"><IconSearch size={20} /></IconButton>
            <IconButton label="افزودن" variant="filled"><IconAdd size={20} /></IconButton>
            <IconButton label="حذف" variant="tonal"><IconDelete size={20} /></IconButton>
            <IconButton label="غیرفعال" disabled><IconClose size={20} /></IconButton>
          </SubSection>
        </Section>

        {/* --- Text Field --- */}
        <Section title="فیلد متنی — Text Field">
          <div className="flex flex-wrap items-start gap-4">
            <TextField label="نام و نام خانوادگی" defaultValue="" />
            <TextField label="ایمیل" defaultValue="user@example.com" variant="filled" />
            <TextField label="رمز عبور" type="password" errorText="رمز عبور الزامی است" />
            <TextField
              label="توضیحات"
              helperText="حداکثر ۲۰۰ کاراکتر"
              maxLength={200}
              showCharCount
              defaultValue="متن نمونه"
            />
            <TextField
              label="غیرفعال"
              disabled
              defaultValue="غیرقابل ویرایش"
            />
            <TextField label="همراه با آیکون" startIcon={<IconSearch size={18} />} endIcon={<IconClose size={14} />} />
          </div>
        </Section>

        {/* --- OTP Input --- */}
        <Section title="کد تأیید — OTP Input">
          <SubSection title="6-Digit OTP">
            <OTPInput value={otpValue} onChange={setOtpValue} />
          </SubSection>
          <SubSection title="With Error">
            <OTPInput value="12" onChange={/* noop */ () => undefined} hasError />
          </SubSection>
          <SubSection title="Disabled">
            <OTPInput value="123456" onChange={/* noop */ () => undefined} disabled />
          </SubSection>
        </Section>

        {/* --- Select --- */}
        <Section title="انتخابگر — Select">
          <div className="flex flex-wrap items-end gap-4">
            <Select
              label="شهر"
              placeholder="یک شهر انتخاب کنید"
              value={selectValue}
              onChange={(e) => setSelectValue(e.target.value)}
              options={[
                { value: "tehran", label: "تهران" },
                { value: "mashhad", label: "مشهد" },
                { value: "isfahan", label: "اصفهان" },
              ]}
            />
            <Select
              label="استان"
              errorText="انتخاب استان الزامی است"
              options={[{ value: "1", label: "تهران" }]}
            />
            <Select
              label="غیرفعال"
              disabled
              options={[{ value: "1", label: "گزینه" }]}
            />
          </div>
        </Section>

        {/* --- Checkbox, Radio, Switch --- */}
        <Section title="چک‌باکس، رادیو و سوییچ">
          <div className="grid tablet:grid-cols-3 gap-6">
            <SubSection title="Checkbox">
              <div className="flex flex-col gap-2">
                <Checkbox
                  checked={checkboxChecked}
                  onChange={(e) => setCheckboxChecked(e.target.checked)}
                  label="موافقت با شرایط"
                />
                <Checkbox label="غیرفعال" disabled />
              </div>
            </SubSection>
            <SubSection title="Radio Group">
              <RadioGroup
                name="demo"
                value={radioValue}
                onChange={setRadioValue}
                options={[
                  { value: "1", label: "گزینه اول" },
                  { value: "2", label: "گزینه دوم" },
                  { value: "3", label: "گزینه سوم (غیرفعال)", disabled: true },
                ]}
              />
            </SubSection>
            <SubSection title="Switch">
              <div className="flex flex-col gap-2">
                <Switch
                  checked={switchChecked}
                  onChange={(e) => setSwitchChecked(e.target.checked)}
                  label="اعلان‌ها"
                />
                <Switch label="غیرفعال" disabled />
              </div>
            </SubSection>
          </div>
        </Section>

        {/* --- Tabs --- */}
        <Section title="تب‌ها — Tabs">
          <SubSection title="Primary">
            <Tabs
              tabs={[
                { value: "tab1", label: "همه", badge: 12 },
                { value: "tab2", label: "فعال" },
                { value: "tab3", label: "غیرفعال", disabled: true },
              ]}
              value={selectedTab}
              onChange={setSelectedTab}
            />
          </SubSection>
          <SubSection title="Secondary">
            <Tabs
              variant="secondary"
              tabs={[
                { value: "s1", label: "تب اول" },
                { value: "s2", label: "تب دوم" },
              ]}
              value="s1"
              onChange={/* noop */ () => undefined}
            />
          </SubSection>
        </Section>

        {/* --- Chip, Badge --- */}
        <Section title="چیپ و نشان — Chip & Badge">
          <SubSection title="Chip">
            <Chip label="پیش‌فرض" />
            <Chip label="انتخاب شده" selected />
            <Chip label="Outline" variant="outlined" />
            <Chip label="با آیکون" startIcon={<IconPerson size={16} />} />
            <Chip label="قابل حذف" removable onRemove={/* noop */ () => undefined} />
            <Chip label="غیرفعال" disabled />
          </SubSection>
          <SubSection title="Badge">
            <div className="flex items-center gap-6">
              <Badge content={3} variant="error">
                <Button variant="outlined">پیام‌ها</Button>
              </Badge>
              <Badge content={42} max={99} variant="neutral">
                <Button variant="outlined">اعلان‌ها</Button>
              </Badge>
              <Badge dot variant="success">
                <Button variant="outlined">وضعیت</Button>
              </Badge>
            </div>
          </SubSection>
        </Section>

        {/* --- Progress --- */}
        <Section title="پیشرفت — Progress">
          <SubSection title="Linear">
            <div className="w-full space-y-3">
              <ProgressLinear value={60} showValue label="پیشرفت عمومی" />
              <ProgressLinear value={80} color="success" buffer={90} label="بارگذاری" />
              <ProgressLinear value={30} color="error" size="small" label="خطا" />
              <ProgressLinear variant="indeterminate" value={0} label="در حال پردازش" />
            </div>
          </SubSection>
          <SubSection title="Circular">
            <div className="flex items-center gap-4">
              <ProgressCircular value={75} showValue />
              <ProgressCircular value={45} color="secondary" size={64} />
              <ProgressCircular value={100} color="success" />
              <ProgressCircular value={20} color="error" size={64} showValue />
            </div>
          </SubSection>
        </Section>

        {/* --- Skeleton --- */}
        <Section title="اسکلتون — Skeleton">
          <div className="grid tablet:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard lines={2} />
            <SkeletonList items={2} />
          </div>
          <SubSection title="Inline">
            <div className="flex items-center gap-3">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="space-y-1.5">
                <Skeleton variant="text" width={160} />
                <Skeleton variant="text" width={100} />
              </div>
            </div>
          </SubSection>
        </Section>

        {/* --- Empty State & Error State --- */}
        <Section title="حالت خالی و خطا">
          <div className="grid tablet:grid-cols-2 gap-6">
            <Card variant="outlined">
              <EmptyState
                title="هنوز اطلاعاتی ندارید"
                description="با کلیک روی دکمه زیر اولین آیتم خود را بسازید"
                action={{ label: "ساخت جدید", onClick: () => snackbar.show({ message: "ساخته شد!" }) }}
              />
            </Card>
            <Card variant="outlined">
              <ErrorState
                title="خطا در بارگذاری"
                message="مشکلی در ارتباط با سرور پیش آمده است"
                onRetry={() => snackbar.show({ message: "تلاش مجدد...", variant: "info" })}
              />
            </Card>
          </div>
        </Section>

        {/* --- Cards --- */}
        <Section title="کارت‌ها — Cards">
          <div className="grid tablet:grid-cols-3 gap-4">
            <Card variant="elevated">
              <CardHeader><h3 className="text-titleMedium">کارت Elevated</h3></CardHeader>
              <CardContent><p className="text-bodyMedium text-onSurfaceVariant">محتوای نمونه</p></CardContent>
              <CardFooter>
                <Button variant="text" size="small">عملیات</Button>
              </CardFooter>
            </Card>
            <Card variant="filled">
              <CardContent><p className="text-bodyMedium">کارت Filled</p></CardContent>
            </Card>
            <Card variant="outlined" interactive>
              <CardContent><p className="text-bodyMedium">کارت Outlined (Interactive)</p></CardContent>
            </Card>
          </div>
        </Section>

        {/* --- Tooltip --- */}
        <Section title="راهنمای ابزار — Tooltip">
          <div className="flex items-center gap-4">
            <Tooltip content="راهنما">
              <Button variant="outlined">هاور کنید</Button>
            </Tooltip>
          </div>
        </Section>

        {/* --- Snackbar --- */}
        <Section title="اعلان — Snackbar">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => snackbar.show({ message: "عملیات با موفقیت انجام شد", variant: "success" })}>
              نمایش موفقیت
            </Button>
            <Button onClick={() => snackbar.show({ message: "خطایی رخ داده است", variant: "error" })}>
              نمایش خطا
            </Button>
            <Button
              onClick={() =>
                snackbar.show({
                  message: "آیتم حذف شد",
                  action: { label: "بازگردانی", onClick: () => snackbar.show({ message: "بازگردانی شد", variant: "success" }) },
                  duration: 8000,
                })
              }
            >
              با عملیات
            </Button>
          </div>
        </Section>

        {/* --- Dialogs --- */}
        <Section title="دیالوگ‌ها — Dialogs">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setDialogOpen(true)}>نمایش دیالوگ</Button>
            <Button onClick={() => setConfirmOpen(true)} variant="outlined">
              دیالوگ تأیید
            </Button>
          </div>

          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="نمونه دیالوگ"
            description="این یک دیالوگ نمونه با توضیحات است"
            actions={
              <>
                <Button variant="text" onClick={() => setDialogOpen(false)}>
                  انصراف
                </Button>
                <Button variant="filled" onClick={() => setDialogOpen(false)}>
                  تأیید
                </Button>
              </>
            }
          >
            <TextField label="نام" fullWidth />
          </Dialog>

          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false);
              snackbar.show({ message: "عملیات تأیید شد", variant: "success" });
            }}
            title="آیا مطمئن هستید؟"
            description="این عملیات قابل بازگشت نیست"
            destructive
          />
        </Section>

        {/* --- Drawer --- */}
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="منوی نمونه">
          <div className="space-y-2">
            {["گزینه اول", "گزینه دوم", "گزینه سوم"].map((item) => (
              <button
                key={item}
                className="w-full text-start p-3 rounded-medium hover:bg-onSurface/[0.08] transition-colors text-bodyMedium"
                onClick={() => setDrawerOpen(false)}
              >
                {item}
              </button>
            ))}
          </div>
        </Drawer>

        {/* --- Bottom Nav Demo --- */}
        <Section title="منوی پایین (موبایل)">
          <div className="border border-outline rounded-large overflow-hidden max-w-sm">
            <BottomNav
              activeKey="home"
              items={[
                { key: "home", label: "خانه", icon: <IconAdd size={22} />, badge: 3 },
                { key: "search", label: "جستجو", icon: <IconSearch size={22} /> },
                { key: "profile", label: "پروفایل", icon: <IconPerson size={22} /> },
              ]}
            />
          </div>
        </Section>

        {/* --- Responsive info --- */}
        <Section title="اطلاعات نمایشگر">
          <Card variant="outlined" className="inline-block">
            <div className="space-y-1 text-bodyMedium font-mono" dir="ltr">
              <p className="hidden mobile-s:block text-success">mobile-s: &gt;=320px ✓</p>
              <p className="hidden tablet:block text-success">tablet: &gt;=600px ✓</p>
              <p className="hidden desktop:block text-success">desktop: &gt;=1024px ✓</p>
              <p className="hidden wide:block text-success">wide: &gt;=1440px ✓</p>
            </div>
          </Card>
        </Section>
      </main>

      {/* Mobile padding bottom */}
      <div className="h-16 desktop:hidden" />
    </div>
  );
}
