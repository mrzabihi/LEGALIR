# Settings Information Architecture

**Section:** §8–§10, §34
**Status:** Implemented

## Summary

The single-purpose Profile editor was converted into an **Account Hub**
(«تنظیمات و پروفایل») that surfaces every previously-hidden feature through
visual section cards. Nothing was deleted; every feature is now discoverable.

## Moved / discoverable features

| Feature | Before | After |
| --- | --- | --- |
| Profile editing | Standalone `/profile` editor | "پروفایل من" card in Account Hub |
| Theme toggle | Buried in `/settings` | "تنظیمات" card in Account Hub |
| Blog | Only on Landing | "وبلاگ حقوقی لیگالیر" hero card + Dashboard cards |
| Documents / Contracts / History / Memory | Separate nav entries | Consolidated in "فضای حقوقی من" grid |

## Route mapping

| Route | Destination |
| --- | --- |
| `/profile` | Account Hub (hub card: پروفایل من) |
| `/settings` | Notifications & privacy hub (اعلان‌ها و حریم خصوصی) |
| `/subscription` | Subscription management (مدیریت و ارتقا) |
| `/chat` | گفت‌وگوهای من |
| `/documents` | اسناد من |
| `/contracts` | قراردادهای من |
| `/history` | تاریخچه |
| `/memory` | حافظه |
| `/blog` | وبلاگ حقوقی لیگالیر |

## Settings sections

The Account Hub is organized into visual cards:

1. پروفایل من (identity + editable fields)
2. وبلاگ حقوقی لیگالیر (blog card)
3. فضای حقوقی من (documents, contracts, history, memory)
4. اشتراک (current plan + upgrade)
5. سرویس‌های متصل (integrations)
6. تنظیمات (theme + notifications/privacy)
7. پشتیبانی (support)

All section cards use consistent Material tokens (elevation, spacing, shape,
typography) per §38.
