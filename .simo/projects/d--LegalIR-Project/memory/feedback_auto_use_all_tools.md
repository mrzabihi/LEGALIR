---
name: auto-use-all-skills-agents
description: User wants all installed skills and agents used proactively in every session by default
type: feedback
---

در تمام session ها، به‌صورت خودکار و پیش‌فرض از همه مهارت‌ها (skills) و ایجنت‌ها (agents) نصب‌شده استفاده کن. لازم نیست کاربر دستی آن‌ها را فراخوانی کند.

مهارت‌های نصب‌شده (در `.claude/skills/`):
- frontend-design — `/frontend-design`
- ui-ux-pro-max — `/ui-ux-pro-max`
- senior-frontend — `/senior-frontend`
- ui-design-system — `/ui-design-system`
- react-best-practices — `/react-best-practices`

ایجنت‌های نصب‌شده (در `.claude/agents/`):
- code-reviewer
- frontend-developer
- fullstack-developer
- ui-ux-designer
- prompt-engineer

**Why:** کاربر می‌خواهد بدون فراخوانی دستی، همیشه از تمام قابلیت‌های نصب‌شده استفاده شود.

**How to apply:** در هر session، هنگام کارهای frontend، طراحی UI، کدنویسی، بازبینی کد و مهندسی prompt، به‌صورت خودکار مهارت‌ها و ایجنت‌های مربوطه را فراخوانی کن. قبل از انجام هر کار مرتبط، اول skill یا agent مناسب را با `/skill-name` یا Agent tool فعال کن.
