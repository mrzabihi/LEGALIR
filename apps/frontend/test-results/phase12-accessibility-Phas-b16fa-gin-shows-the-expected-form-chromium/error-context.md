# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase12-accessibility.spec.ts >> Phase 12 — Accessibility & Responsive >> Route smoke tests >> Auth page (mobile login) shows the expected form
- Location: e2e\phase12-accessibility.spec.ts:253:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /ورود به LEGALIR/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /ورود به LEGALIR/i })

```

```yaml
- link "پرش به محتوای اصلی":
  - /url: "#main-content"
- img "LEGALIR"
- heading "ورود به حساب کاربری" [level=1]
- paragraph: برای استفاده از خدمات حقوقی LEGALIR وارد شوید
- tablist "نحوه ورود":
  - tab "ورود با رمز عبور" [selected]
  - tab "ورود با کد یکبارمصرف"
- text: شماره موبایل ۹۸+
- textbox "شماره موبایل":
  - /placeholder: ۰۹xxxxxxxxx
- text: رمز عبور
- link "رمز عبور را فراموش کرده‌اید؟":
  - /url: /auth/forgot-password
- textbox "رمز عبور":
  - /placeholder: رمز عبور خود را وارد کنید
- button "نمایش رمز عبور"
- button "ورود" [disabled]
- link "ساخت حساب جدید":
  - /url: /auth/register
- link "بازیابی رمز عبور":
  - /url: /auth/forgot-password
- paragraph: با ورود، شرایط استفاده و حریم خصوصی را می‌پذیرم
- paragraph: سامانه جامع حقوقی لیگالیر
- alert
```

# Test source

```ts
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
  216 | 
  217 |     test("Hamburger menu is hidden on desktop viewport", async ({ page }) => {
  218 |       await page.setViewportSize({ width: 1280, height: 800 });
  219 |       await page.goto("/");
  220 |       await page.waitForSelector("body");
  221 | 
  222 |       const openBtn = page.getByRole("button", { name: /باز کردن منو/i });
  223 |       await expect(openBtn).not.toBeVisible();
  224 | 
  225 |       // Desktop nav should be visible instead
  226 |       const desktopNav = page.getByRole("navigation", { name: /ناوبری اصلی/i });
  227 |       await expect(desktopNav).toBeVisible();
  228 |     });
  229 |   });
  230 | 
  231 |   // =========================================================================
  232 |   // Route smoke tests
  233 |   // =========================================================================
  234 |   test.describe("Route smoke tests", () => {
  235 |     for (const route of APP_ROUTES) {
  236 |       test(`${route.label} page (${route.path}) loads without network errors`, async ({
  237 |         page,
  238 |       }) => {
  239 |         const errors: string[] = [];
  240 |         page.on("pageerror", (err) => errors.push(err.message));
  241 | 
  242 |         const response = await page.goto(route.path);
  243 |         await page.waitForSelector("body");
  244 | 
  245 |         // The page should return HTTP 200 (not 404/500)
  246 |         expect(response?.status()).toBe(200);
  247 | 
  248 |         // No uncaught JS errors
  249 |         expect(errors).toEqual([]);
  250 |       });
  251 |     }
  252 | 
  253 |     test("Auth page (mobile login) shows the expected form", async ({ page }) => {
  254 |       await page.goto("/auth/mobile");
  255 |       await page.waitForSelector("body");
  256 | 
  257 |       await expect(
  258 |         page.getByRole("heading", { name: /ورود به LEGALIR/i }),
> 259 |       ).toBeVisible();
      |         ^ Error: expect(locator).toBeVisible() failed
  260 |       await expect(page.getByLabel(/شماره موبایل/i)).toBeVisible();
  261 |       await expect(
  262 |         page.getByRole("button", { name: /ارسال کد تأیید|در حال ارسال/i }),
  263 |       ).toBeVisible();
  264 |     });
  265 |   });
  266 | 
  267 |   // =========================================================================
  268 |   // Dashboard with mocked auth
  269 |   // =========================================================================
  270 |   test.describe("Dashboard (mocked auth)", () => {
  271 |     test("Dashboard loads when authenticated", async ({ page }) => {
  272 |       await mockAuth(page);
  273 |       await page.goto("/dashboard");
  274 |       await page.waitForSelector("body");
  275 | 
  276 |       // The dashboard should load and the page shouldn't redirect away
  277 |       expect(page.url()).toContain("/dashboard");
  278 | 
  279 |       // The Sidebar or app shell should be visible
  280 |       // Look for the sidebar navigation or app shell elements
  281 |       const appShell = page.locator(
  282 |         '[data-testid="app-shell"], aside, [role="navigation"]',
  283 |       );
  284 |       // At least one structural element should exist
  285 |       await expect(page.locator("body")).toBeVisible();
  286 |     });
  287 | 
  288 |     test("Dashboard shows proper app shell on desktop", async ({ page }) => {
  289 |       await page.setViewportSize({ width: 1280, height: 800 });
  290 |       await mockAuth(page);
  291 |       await page.goto("/dashboard");
  292 |       await page.waitForSelector("body");
  293 | 
  294 |       expect(page.url()).toContain("/dashboard");
  295 |       await expect(page.locator("body")).toBeVisible();
  296 |     });
  297 | 
  298 |     test("Auth pages redirect to dashboard when already authenticated", async ({
  299 |       page,
  300 |     }) => {
  301 |       await mockAuth(page);
  302 |       await page.goto("/auth/mobile");
  303 |       await page.waitForSelector("body");
  304 | 
  305 |       // Should redirect to /dashboard
  306 |       await page.waitForURL("**/dashboard", { timeout: 5000 });
  307 |       expect(page.url()).toContain("/dashboard");
  308 |     });
  309 | 
  310 |     test("Unauthenticated user does not get app shell on dashboard", async ({
  311 |       page,
  312 |     }) => {
  313 |       // No mock auth — user is unauthenticated
  314 |       await page.goto("/dashboard");
  315 |       await page.waitForSelector("body");
  316 | 
  317 |       // The page should still load (children are rendered when !isAuthenticated)
  318 |       expect(page.url()).toContain("/dashboard");
  319 |     });
  320 |   });
  321 | 
  322 |   // =========================================================================
  323 |   // Touch targets (min 48px)
  324 |   // =========================================================================
  325 |   test.describe("Touch targets", () => {
  326 |     test("Primary CTA button has minimum 48x48px touch target", async ({
  327 |       page,
  328 |     }) => {
  329 |       await page.goto("/");
  330 |       await page.waitForSelector("body");
  331 | 
  332 |       const ctaBtn = page.getByRole("button", { name: /شروع کنید/i });
  333 |       await expect(ctaBtn).toBeVisible();
  334 | 
  335 |       const box = await ctaBtn.boundingBox();
  336 |       expect(box).not.toBeNull();
  337 |       // Both width and height should be at least 48px
  338 |       expect(box!.height).toBeGreaterThanOrEqual(44);
  339 |       expect(box!.width).toBeGreaterThanOrEqual(44);
  340 |     });
  341 | 
  342 |     test("Mobile menu open/close buttons have adequate touch size", async ({
  343 |       page,
  344 |     }) => {
  345 |       await page.setViewportSize({ width: 390, height: 844 });
  346 |       await page.goto("/");
  347 |       await page.waitForSelector("body");
  348 | 
  349 |       const openBtn = page.getByRole("button", { name: /باز کردن منو/i });
  350 |       const openBox = await openBtn.boundingBox();
  351 |       expect(openBox).not.toBeNull();
  352 |       expect(openBox!.width).toBeGreaterThanOrEqual(40);
  353 |       expect(openBox!.height).toBeGreaterThanOrEqual(40);
  354 |     });
  355 | 
  356 |     test("CTA buttons on landing page have minimum touch target size", async ({
  357 |       page,
  358 |     }) => {
  359 |       await page.goto("/");
```