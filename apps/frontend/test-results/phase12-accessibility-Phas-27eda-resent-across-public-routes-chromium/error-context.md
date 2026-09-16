# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase12-accessibility.spec.ts >> Phase 12 — Accessibility & Responsive >> Skip-to-main >> Skip-to-main link is present across public routes
- Location: e2e\phase12-accessibility.spec.ts:110:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/contact", waiting until "load"

```

# Test source

```ts
  15  | /** Simulate an authenticated session by writing to zustand's localStorage key. */
  16  | async function mockAuth(
  17  |   page: import("@playwright/test").Page,
  18  |   overrides?: {
  19  |     sessionId?: string;
  20  |     userId?: string;
  21  |     isNewUser?: boolean;
  22  |   },
  23  | ) {
  24  |   const sessionState = {
  25  |     state: {
  26  |       session: {
  27  |         sessionId: overrides?.sessionId ?? "test-session-id",
  28  |         userId: overrides?.userId ?? "test-user-id",
  29  |         mobileE164: "+989121234567",
  30  |         mobileDisplay: "۰۹۱۲۱۲۳۴۵۶۷",
  31  |         isNewUser: overrides?.isNewUser ?? false,
  32  |         createdAt: Date.now(),
  33  |       },
  34  |     },
  35  |     version: 0,
  36  |   };
  37  |   await page.evaluate(
  38  |     (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
  39  |     sessionState,
  40  |   );
  41  | }
  42  | 
  43  | /** A list of routes that should load without errors (smoke-test style). */
  44  | const APP_ROUTES = [
  45  |   { path: "/", label: "Landing" },
  46  |   { path: "/features", label: "Features" },
  47  |   { path: "/pricing", label: "Pricing" },
  48  |   { path: "/about", label: "About" },
  49  |   { path: "/contact", label: "Contact" },
  50  |   { path: "/auth/mobile", label: "Auth" },
  51  |   { path: "/register", label: "Register" },
  52  | ];
  53  | 
  54  | // ---------------------------------------------------------------------------
  55  | // Tests
  56  | // ---------------------------------------------------------------------------
  57  | 
  58  | test.describe("Phase 12 — Accessibility & Responsive", () => {
  59  |   // =========================================================================
  60  |   // RTL & Layout fundamentals
  61  |   // =========================================================================
  62  |   test.describe("RTL & Layout", () => {
  63  |     test("Landing page renders with RTL direction and Persian lang", async ({
  64  |       page,
  65  |     }) => {
  66  |       await page.goto("/");
  67  |       await page.waitForSelector("body");
  68  | 
  69  |       const html = page.locator("html");
  70  |       await expect(html).toHaveAttribute("dir", "rtl");
  71  |       await expect(html).toHaveAttribute("lang", "fa-IR");
  72  |     });
  73  | 
  74  |     test("Landing page has visible hero content", async ({ page }) => {
  75  |       await page.goto("/");
  76  |       await page.waitForSelector("h1");
  77  | 
  78  |       const heading = page.getByRole("heading", {
  79  |         name: /دستیار هوشمند حقوقی ایران/i,
  80  |       });
  81  |       await expect(heading).toBeVisible();
  82  | 
  83  |       // Also verify the three highlight cards are present
  84  |       await expect(
  85  |         page.getByRole("heading", { name: /تحلیل حقوقی با هوش مصنوعی/i }),
  86  |       ).toBeVisible();
  87  |       await expect(
  88  |         page.getByRole("heading", { name: /بررسی هوشمند اسناد/i }),
  89  |       ).toBeVisible();
  90  |       await expect(
  91  |         page.getByRole("heading", { name: /تولید پیش‌نویس قرارداد/i }),
  92  |       ).toBeVisible();
  93  |     });
  94  |   });
  95  | 
  96  |   // =========================================================================
  97  |   // Skip-to-main link
  98  |   // =========================================================================
  99  |   test.describe("Skip-to-main", () => {
  100 |     test("Skip-to-main link exists in the DOM", async ({ page }) => {
  101 |       await page.goto("/");
  102 |       await page.waitForSelector("body");
  103 | 
  104 |       const skipLink = page.locator(".skip-to-main");
  105 |       await expect(skipLink).toBeAttached();
  106 |       await expect(skipLink).toHaveText(/پرش به محتوای اصلی/i);
  107 |       await expect(skipLink).toHaveAttribute("href", "#main-content");
  108 |     });
  109 | 
  110 |     test("Skip-to-main link is present across public routes", async ({
  111 |       page,
  112 |     }) => {
  113 |       const publicRoutes = ["/features", "/pricing", "/about", "/contact"];
  114 |       for (const route of publicRoutes) {
> 115 |         await page.goto(route);
      |                    ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  116 |         await page.waitForSelector("body");
  117 |         await expect(page.locator(".skip-to-main")).toBeAttached();
  118 |       }
  119 |     });
  120 |   });
  121 | 
  122 |   // =========================================================================
  123 |   // Landing light-only theme (§3 / §40)
  124 |   // =========================================================================
  125 |   test.describe("Landing light-only theme", () => {
  126 |     test("Landing header has no theme toggle and is forced to light", async ({
  127 |       page,
  128 |     }) => {
  129 |       await page.goto("/");
  130 |       await page.waitForSelector("body");
  131 | 
  132 |       // The public landing header must not render a theme toggle.
  133 |       const themeBtn = page.locator(
  134 |         'button[aria-label="حالت تیره"], button[aria-label="حالت روشن"]',
  135 |       );
  136 |       await expect(themeBtn).toHaveCount(0);
  137 | 
  138 |       // ForceLightTheme keeps the document locked to light mode.
  139 |       await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  140 |     });
  141 | 
  142 |     test("Landing stays light on mobile viewport", async ({ page }) => {
  143 |       await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
  144 |       await page.goto("/");
  145 |       await page.waitForSelector("body");
  146 | 
  147 |       await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  148 |       await expect(
  149 |         page.locator('button[aria-label="حالت تیره"], button[aria-label="حالت روشن"]'),
  150 |       ).toHaveCount(0);
  151 |     });
  152 |   });
  153 | 
  154 |   // =========================================================================
  155 |   // Mobile menu
  156 |   // =========================================================================
  157 |   test.describe("Mobile menu", () => {
  158 |     test("Mobile menu opens and closes", async ({ page }) => {
  159 |       await page.setViewportSize({ width: 390, height: 844 });
  160 |       await page.goto("/");
  161 |       await page.waitForSelector("body");
  162 | 
  163 |       // Open menu
  164 |       const openBtn = page.getByRole("button", { name: /باز کردن منو/i });
  165 |       await expect(openBtn).toBeVisible();
  166 |       await openBtn.click();
  167 | 
  168 |       // Verify drawer is open — it contains a navigation with label "منوی موبایل"
  169 |       const mobileNav = page.getByRole("navigation", { name: /منوی موبایل/i });
  170 |       await expect(mobileNav).toBeVisible();
  171 | 
  172 |       // Verify nav items are present
  173 |       await expect(page.getByRole("link", { name: /صفحه اصلی/i })).toBeVisible();
  174 |       await expect(page.getByRole("link", { name: /قابلیت‌ها/i })).toBeVisible();
  175 | 
  176 |       // Close menu
  177 |       const closeBtn = page.getByRole("button", { name: /بستن منو/i });
  178 |       await expect(closeBtn).toBeVisible();
  179 |       await closeBtn.click();
  180 | 
  181 |       // Verify drawer is hidden
  182 |       await expect(mobileNav).not.toBeVisible();
  183 |     });
  184 | 
  185 |     test("Mobile menu closes on backdrop click", async ({ page }) => {
  186 |       await page.setViewportSize({ width: 390, height: 844 });
  187 |       await page.goto("/");
  188 |       await page.waitForSelector("body");
  189 | 
  190 |       // Open menu
  191 |       await page.getByRole("button", { name: /باز کردن منو/i }).click();
  192 |       await expect(
  193 |         page.getByRole("navigation", { name: /منوی موبایل/i }),
  194 |       ).toBeVisible();
  195 | 
  196 |       // Click the backdrop (the scrim div with aria-hidden)
  197 |       await page.locator(".bg-scrim").click();
  198 | 
  199 |       // Verify drawer is hidden
  200 |       await expect(
  201 |         page.getByRole("navigation", { name: /منوی موبایل/i }),
  202 |       ).not.toBeVisible();
  203 |     });
  204 | 
  205 |     test("Mobile menu close button exists and has correct aria-label", async ({
  206 |       page,
  207 |     }) => {
  208 |       await page.setViewportSize({ width: 390, height: 844 });
  209 |       await page.goto("/");
  210 |       await page.waitForSelector("body");
  211 | 
  212 |       await page.getByRole("button", { name: /باز کردن منو/i }).click();
  213 |       const closeBtn = page.getByRole("button", { name: /بستن منو/i });
  214 |       await expect(closeBtn).toBeVisible();
  215 |     });
```