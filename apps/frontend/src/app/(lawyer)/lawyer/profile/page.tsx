// ============================================================
// LEGALIR — Lawyer workbench · Professional profile (پروفایل حرفه‌ای)
// ============================================================
// The self-service surface for §6: identity, bar-licence details,
// specializations, city/coverage, bio, the professional portrait and the two
// availability switches. Prices live on /lawyer/rates and the settlement
// account on /lawyer/bank — this page links to both rather than duplicating
// them.
//
// The completeness panel is server-computed (`profileCompleteness`) and lists
// exactly the gaps that can restrict new referrals, so the lawyer always knows
// what is missing rather than guessing.
//
// The page reads and writes through the SAME lawyer profile row the public
// marketplace and the admin panel render — no parallel copy.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import {
  useLawyerProfile,
  useUpdateLawyerAvatar,
  useUpdateLawyerProfile,
} from "@/hooks/useLawyerPortal";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorBlock,
  Field,
  InlineNotice,
  LoadingBlock,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { SwitchRow, snackbar } from "@legalir/ui";
import { ApiClientError } from "@/lib/api/errors";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IRAN_PROVINCES,
  LAWYER_VERIFICATION_FA,
  taxonomyByType,
  taxonomyLabel,
} from "@legalir/types";
import type {
  LawyerLocation,
  LawyerProfile,
  LawyerProfileCompleteness,
  LawyerSpecialty,
} from "@legalir/types";
import { IconDelete, IconDocument, IconPerson, IconRefresh, IconUpload } from "@/lib/icons";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";

interface FormState {
  fullName: string;
  professionalTitle: string;
  licenseNumber: string;
  licenseAuthority: string;
  licenseYear: string;
  bio: string;
  specializations: LawyerSpecialty[];
  locations: LawyerLocation[];
  acceptingRequests: boolean;
  acceptingClients: boolean;
}

function formFrom(profile: LawyerProfile): FormState {
  return {
    fullName: profile.fullName ?? "",
    professionalTitle: profile.professionalTitle ?? "",
    licenseNumber: profile.licenseNumber ?? "",
    licenseAuthority: profile.licenseAuthority ?? "",
    licenseYear: profile.licenseYear == null ? "" : String(profile.licenseYear),
    bio: profile.bio ?? "",
    specializations: profile.specializations ?? [],
    locations: profile.locations ?? [],
    acceptingRequests: profile.acceptingRequests,
    acceptingClients: profile.acceptingClients ?? true,
  };
}

function CompletenessPanel({ completeness }: { completeness: LawyerProfileCompleteness }) {
  if (completeness.complete) {
    return (
      <InlineNotice tone="success">
        پروفایل شما کامل است و می‌توانید ارجاع جدید دریافت کنید.
      </InlineNotice>
    );
  }
  return (
    <Card className="mb-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-body-2 font-bold text-on-surface">تکمیل پروفایل</h2>
          <p className="mt-1 text-caption text-muted">
            تا تکمیل موارد زیر، ممکن است ارجاع جدیدی دریافت نکنید.
          </p>
        </div>
        <Badge tone="warning">{toPersianNumber(completeness.percent)}٪</Badge>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container"
        role="progressbar"
        aria-valuenow={completeness.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="درصد تکمیل پروفایل"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${completeness.percent}%` }}
        />
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {completeness.missing.map((gap) => (
          <li key={gap.key}>
            <Link
              href={gap.href}
              className="inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-soft px-2.5 py-1 text-caption text-warning-700 transition-colors hover:border-warning-300"
            >
              {gap.labelFa}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProfileContent({
  profile,
  completeness,
}: {
  profile: LawyerProfile;
  completeness: LawyerProfileCompleteness;
}) {
  const saveProfile = useUpdateLawyerProfile();
  const saveAvatar = useUpdateLawyerAvatar();
  const [form, setForm] = useState<FormState>(() => formFrom(profile));
  const [error, setError] = useState<string | null>(null);

  const [specialtyInput, setSpecialtyInput] = useState("");
  const [specialtyYears, setSpecialtyYears] = useState("");

  const [provinceInput, setProvinceInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [remoteInput, setRemoteInput] = useState(true);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState("");

  const specialtyNodes = useMemo(() => taxonomyByType("SPECIALTY"), []);
  const cities = useMemo(() => {
    const province = IRAN_PROVINCES.find((p) => p.nameFa === provinceInput);
    return province?.cities ?? [];
  }, [provinceInput]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addSpecialty() {
    if (!specialtyInput) return;
    if (form.specializations.some((s) => s.category === specialtyInput)) return;
    const years = Number(specialtyYears);
    set("specializations", [
      ...form.specializations,
      {
        category: specialtyInput,
        yearsExperience: Number.isFinite(years) ? Math.max(0, Math.floor(years)) : 0,
      },
    ]);
    setSpecialtyInput("");
    setSpecialtyYears("");
  }

  function removeSpecialty(category: string) {
    set(
      "specializations",
      form.specializations.filter((s) => s.category !== category)
    );
  }

  function addLocation() {
    if (!provinceInput || !cityInput) return;
    if (form.locations.some((l) => l.province === provinceInput && l.city === cityInput)) return;
    set("locations", [
      ...form.locations,
      { province: provinceInput, city: cityInput, remote: remoteInput },
    ]);
    setCityInput("");
  }

  function removeLocation(province: string, city: string) {
    set(
      "locations",
      form.locations.filter((l) => !(l.province === province && l.city === city))
    );
  }

  async function save() {
    setError(null);
    if (form.fullName.trim().length < 3) {
      setError("نام و نام خانوادگی باید دست‌کم ۳ نویسه باشد.");
      return;
    }
    if (form.licenseNumber.trim() && !/^\d{3,20}$/.test(form.licenseNumber.trim())) {
      setError("شمارهٔ پروانهٔ وکالت باید فقط رقم باشد (۳ تا ۲۰ رقم).");
      return;
    }
    const year = form.licenseYear.trim() === "" ? null : Number(form.licenseYear);
    if (year !== null && (!Number.isInteger(year) || year < 1300 || year > 1500)) {
      setError("سال صدور پروانه معتبر نیست.");
      return;
    }

    try {
      await saveProfile.mutateAsync({
        fullName: form.fullName.trim(),
        professionalTitle: form.professionalTitle.trim() || null,
        licenseNumber: form.licenseNumber.trim() || null,
        licenseAuthority: form.licenseAuthority.trim() || null,
        licenseYear: year,
        bio: form.bio.trim(),
        specializations: form.specializations,
        locations: form.locations,
        acceptingRequests: form.acceptingRequests,
        acceptingClients: form.acceptingClients,
      });
      snackbar.show({ message: "پروفایل ذخیره شد.", variant: "success" });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : "ذخیرهٔ پروفایل ناموفق بود.");
    }
  }

  function onAvatarPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      snackbar.show({ message: "حجم تصویر باید کمتر از ۲ مگابایت باشد.", variant: "error" });
      return;
    }
    if (!AVATAR_ACCEPT.split(",").includes(file.type)) {
      snackbar.show({
        message: "فقط تصاویر PNG، JPEG یا WebP پشتیبانی می‌شوند.",
        variant: "error",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(typeof reader.result === "string" ? reader.result : null);
      setAvatarName(file.name);
    };
    reader.onerror = () => snackbar.show({ message: "خواندن فایل ناموفق بود.", variant: "error" });
    reader.readAsDataURL(file);
  }

  async function uploadAvatar() {
    if (!avatarPreview) return;
    const comma = avatarPreview.indexOf(",");
    const format = avatarPreview.slice(5, avatarPreview.indexOf(";"));
    if (comma < 0) {
      snackbar.show({ message: "فایل تصویر نامعتبر است.", variant: "error" });
      return;
    }
    try {
      await saveAvatar.mutateAsync({
        avatarData: avatarPreview.slice(comma + 1),
        avatarFileName: avatarName,
        avatarFormat: format,
      });
      snackbar.show({ message: "تصویر پروفایل ثبت شد.", variant: "success" });
      setAvatarPreview(null);
      setAvatarName("");
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiClientError ? err.userMessage : "آپلود تصویر ناموفق بود.",
        variant: "error",
      });
    }
  }

  async function clearAvatar() {
    try {
      await saveAvatar.mutateAsync({ avatarUrl: null, avatarType: "demo" });
      snackbar.show({ message: "تصویر پروفایل حذف شد.", variant: "success" });
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiClientError ? err.userMessage : "حذف تصویر ناموفق بود.",
        variant: "error",
      });
    }
  }

  const shownAvatar = avatarPreview ?? profile.avatarUrl;
  const initial = (profile.fullName || "و").trim().charAt(0);

  return (
    <div>
      <PageHeader
        title="پروفایل حرفه‌ای"
        description="اطلاعاتی که در پروفایل عمومی و کارتابل شما نمایش داده می‌شود."
        icon={<IconPerson size={22} />}
        actions={
          <Button
            loading={saveProfile.isPending}
            onClick={() => void save()}
            startIcon={<IconRefresh size={15} />}
          >
            ذخیرهٔ تغییرات
          </Button>
        }
      />

      <CompletenessPanel completeness={completeness} />

      {error && (
        <InlineNotice tone="error" className="mb-4">
          {error}
        </InlineNotice>
      )}

      <div className="grid gap-5 laptop:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="space-y-5">
          {/* Identity + licence */}
          <Card>
            <CardHeader title="هویت و پروانهٔ وکالت" />
            <CardBody className="space-y-3">
              <div className="grid gap-3 tablet:grid-cols-2">
                <Field label="نام و نام خانوادگی" required>
                  <TextInput
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    placeholder="مثلاً: سارا محمدی"
                  />
                </Field>
                <Field label="عنوان حرفه‌ای" hint="مثلاً «وکیل پایه یک دادگستری»">
                  <TextInput
                    value={form.professionalTitle}
                    onChange={(e) => set("professionalTitle", e.target.value)}
                  />
                </Field>
                <Field label="شمارهٔ پروانهٔ وکالت" hint="فقط رقم">
                  <TextInput
                    value={form.licenseNumber}
                    onChange={(e) => set("licenseNumber", e.target.value)}
                    inputMode="numeric"
                    dir="ltr"
                  />
                </Field>
                <Field label="مرجع صدور پروانه" hint="مثلاً کانون وکلای مرکز">
                  <TextInput
                    value={form.licenseAuthority}
                    onChange={(e) => set("licenseAuthority", e.target.value)}
                  />
                </Field>
                <Field label="سال صدور پروانه (هجری شمسی)">
                  <TextInput
                    value={form.licenseYear}
                    onChange={(e) => set("licenseYear", e.target.value)}
                    inputMode="numeric"
                    dir="ltr"
                  />
                </Field>
                <div>
                  <span className="mb-1 block text-caption font-medium text-on-surface-variant">
                    وضعیت تأیید
                  </span>
                  <Badge tone={profile.verificationStatus === "VERIFIED" ? "success" : "neutral"}>
                    {LAWYER_VERIFICATION_FA[profile.verificationStatus]}
                  </Badge>
                  {profile.verificationNote && (
                    <p className="mt-1 text-caption text-muted">{profile.verificationNote}</p>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Bio */}
          <Card>
            <CardHeader
              title="معرفی کوتاه"
              subtitle={`${toPersianNumber(form.bio.length)} از ۳۰۰۰ نویسه`}
            />
            <CardBody>
              <Field label="دربارهٔ من">
                <TextArea
                  rows={5}
                  value={form.bio}
                  maxLength={3000}
                  onChange={(e) => set("bio", e.target.value)}
                  placeholder="تخصص، سابقه و رویکرد کاری خود را کوتاه بنویسید…"
                />
              </Field>
            </CardBody>
          </Card>

          {/* Specializations */}
          <Card>
            <CardHeader title="تخصص‌ها" subtitle="حداقل یک تخصص برای دریافت ارجاع لازم است." />
            <CardBody>
              {form.specializations.length === 0 ? (
                <p className="mb-3 text-body-2 text-muted">هنوز تخصصی ثبت نکرده‌اید.</p>
              ) : (
                <ul className="mb-3 flex flex-wrap gap-2">
                  {form.specializations.map((s) => (
                    <li key={s.category}>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-surface-container px-3 py-1 text-caption text-on-surface">
                        {taxonomyLabel(s.category)}
                        {s.yearsExperience > 0 && (
                          <span className="text-muted">
                            · {toPersianNumber(s.yearsExperience)} سال
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeSpecialty(s.category)}
                          className="ms-1 rounded-full p-0.5 text-muted hover:bg-surface-hover hover:text-error-600"
                          aria-label={`حذف تخصص ${taxonomyLabel(s.category)}`}
                        >
                          <IconDelete size={13} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <Field label="افزودن تخصص">
                    <Select
                      value={specialtyInput}
                      onChange={(e) => setSpecialtyInput(e.target.value)}
                      aria-label="انتخاب تخصص"
                    >
                      <option value="">انتخاب کنید…</option>
                      {specialtyNodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.nameFa}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="w-28">
                  <Field label="سابقه (سال)">
                    <TextInput
                      value={specialtyYears}
                      onChange={(e) => setSpecialtyYears(e.target.value)}
                      inputMode="numeric"
                      dir="ltr"
                    />
                  </Field>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addSpecialty}
                  disabled={!specialtyInput}
                >
                  افزودن
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Locations */}
          <Card>
            <CardHeader
              title="شهر و محدودهٔ خدمات"
              subtitle="محل فعالیت و امکان انجام کار به‌صورت آنلاین."
            />
            <CardBody>
              {form.locations.length === 0 ? (
                <p className="mb-3 text-body-2 text-muted">هنوز محدوده‌ای ثبت نکرده‌اید.</p>
              ) : (
                <ul className="mb-3 divide-y divide-divider">
                  {form.locations.map((l) => (
                    <li
                      key={`${l.province}-${l.city}`}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <span className="text-body-2 text-on-surface">
                        {l.province} · {l.city}
                        {l.remote && <span className="ms-2 text-caption text-muted">آنلاین</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLocation(l.province, l.city)}
                        className="rounded-full p-1 text-muted hover:bg-surface-hover hover:text-error-600"
                        aria-label={`حذف ${l.city}`}
                      >
                        <IconDelete size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <div className="w-full tablet:w-44">
                  <Field label="استان">
                    <Select
                      value={provinceInput}
                      onChange={(e) => {
                        setProvinceInput(e.target.value);
                        setCityInput("");
                      }}
                      aria-label="استان"
                    >
                      <option value="">انتخاب کنید…</option>
                      {IRAN_PROVINCES.map((p) => (
                        <option key={p.slug} value={p.nameFa}>
                          {p.nameFa}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="w-full tablet:w-44">
                  <Field label="شهر">
                    <Select
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      aria-label="شهر"
                      disabled={!provinceInput}
                    >
                      <option value="">{provinceInput ? "انتخاب کنید…" : "ابتدا استان"}</option>
                      {cities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <SwitchRow
                  label="پذیرش پرونده به‌صورت آنلاین"
                  checked={remoteInput}
                  onChange={(e) => setRemoteInput(e.target.checked)}
                  className="w-auto"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addLocation}
                  disabled={!provinceInput || !cityInput}
                >
                  افزودن
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          {/* Portrait */}
          <Card>
            <CardHeader title="تصویر پروفایل" subtitle="PNG، JPEG یا WebP — حداکثر ۲ مگابایت" />
            <CardBody>
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-surface-container">
                  {shownAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a data URI or an API-served portrait, never optimizable
                    <img
                      src={shownAvatar}
                      alt={profile.fullName || "تصویر پروفایل"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-headlineSmall font-bold text-muted">{initial}</span>
                  )}
                </div>

                <input
                  id="lawyer-avatar-input"
                  type="file"
                  accept={AVATAR_ACCEPT}
                  onChange={onAvatarPick}
                  className="sr-only"
                />
                <div className="flex flex-wrap justify-center gap-2">
                  <label
                    htmlFor="lawyer-avatar-input"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-medium border border-divider px-3 py-2 text-caption font-medium text-on-surface-variant transition-colors hover:border-primary-300 hover:text-primary"
                  >
                    <IconUpload size={14} /> انتخاب تصویر
                  </label>
                  {profile.avatarUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void clearAvatar()}
                      loading={saveAvatar.isPending && !avatarPreview}
                      startIcon={<IconDelete size={14} />}
                    >
                      حذف
                    </Button>
                  )}
                </div>

                {avatarPreview && (
                  <Button
                    size="sm"
                    onClick={() => void uploadAvatar()}
                    loading={saveAvatar.isPending}
                  >
                    ثبت تصویر «{avatarName}»
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Availability */}
          <Card>
            <CardHeader
              title="پذیرش ارجاع"
              subtitle="این وضعیت بلافاصله بر ارجاع‌های جدید اثر می‌گذارد."
            />
            <CardBody>
              <SwitchRow
                label="پذیرش درخواست جدید"
                description="اگر خاموش باشد، درخواست تازه‌ای به شما ارجاع نمی‌شود."
                checked={form.acceptingRequests}
                onChange={(e) => set("acceptingRequests", e.target.checked)}
              />
              <SwitchRow
                label="پذیرش موکل جدید"
                description="وضعیتی که در پروفایل عمومی دیده می‌شود."
                checked={form.acceptingClients}
                onChange={(e) => set("acceptingClients", e.target.checked)}
              />
            </CardBody>
          </Card>

          {/* Links to sibling surfaces */}
          <Card>
            <CardHeader title="بخش‌های دیگر" />
            <CardBody className="space-y-2">
              <Link
                href="/lawyer/rates"
                className="flex items-center justify-between rounded-medium border border-divider px-3 py-2.5 text-body-2 text-on-surface transition-colors hover:border-primary-300 hover:bg-surface-hover"
              >
                <span className="flex items-center gap-2">
                  <IconDocument size={16} /> نرخ خدمات
                </span>
                <span className="text-caption text-muted">قیمت هر خدمت</span>
              </Link>
              <Link
                href="/lawyer/bank"
                className="flex items-center justify-between rounded-medium border border-divider px-3 py-2.5 text-body-2 text-on-surface transition-colors hover:border-primary-300 hover:bg-surface-hover"
              >
                <span className="flex items-center gap-2">
                  <IconDocument size={16} /> حساب تسویه
                </span>
                <span className="text-caption text-muted">اطلاعات بانکی</span>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function LawyerProfilePage() {
  const query = useLawyerProfile();

  if (query.isLoading) return <LoadingBlock rows={6} />;
  if (query.isError || !query.data)
    return <ErrorBlock message="خطا در بارگذاری پروفایل" onRetry={() => query.refetch()} />;

  // Re-seed the form from the saved row whenever the server version changes.
  return (
    <ProfileContent
      key={query.data.profile.updatedAt}
      profile={query.data.profile}
      completeness={query.data.completeness}
    />
  );
}
