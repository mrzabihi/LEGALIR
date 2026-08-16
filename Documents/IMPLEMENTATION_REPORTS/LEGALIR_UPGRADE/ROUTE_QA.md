# Route QA

**Section:** §28–§30, §48
**Status:** Implemented

## Empty states (all have a next action)

| Route | Empty copy | CTA |
| --- | --- | --- |
| `/contracts` | «هنوز قراردادی ایجاد نکرده‌اید» | «ساخت قرارداد» |
| `/history` | «تاریخچه شما هنوز خالی است» | «شروع گفتگو» |
| `/memory` | «هنوز موردی در حافظه ذخیره نشده است» | «شروع گفتگو» |
| `/documents` | «هنوز سندی اضافه نکرده‌اید» | «افزودن سند» |
| Dashboard Blog | «هنوز مطلبی در وبلاگ منتشر نشده است» | «مشاهده وبلاگ» |

## 404

- Global `not-found.tsx` and app-scoped `(app)/not-found.tsx` both use the
  approved copy «این صفحه پیدا نشد» / «ممکن است آدرس تغییر کرده باشد یا صفحه
  دیگر در دسترس نباشد».
- Actions: «بازگشت به خانه» + «رفتن به داشبورد» (authenticated user).
- Minimal, elegant, brand-consistent, responsive, professional — no
  framework default.

## Logo

Transparent mark used consistently; sidebar/top-bar now match the Landing
presentation (see LOGO_AUDIT.md).

## No blank pages

Every registered `(app)` and `(public)` route renders loading / content /
empty / error / not-found states; no TODO, raw JSON, or broken skeleton.
