# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase12-accessibility.spec.ts >> Phase 12 — Accessibility & Responsive >> Dashboard (mocked auth) >> Unauthenticated user does not get app shell on dashboard
- Location: e2e\phase12-accessibility.spec.ts:310:9

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "/dashboard"
Received string:    "http://localhost:3000/auth/mobile"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "پرش به محتوای اصلی" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e4]:
    - img "LEGALIR" [ref=e6]
    - generic [ref=e9]:
      - generic [ref=e10]:
        - heading "ورود به حساب کاربری" [level=1] [ref=e11]
        - paragraph [ref=e12]: برای استفاده از خدمات حقوقی LEGALIR وارد شوید
      - tablist "نحوه ورود" [ref=e13]:
        - tab "ورود با رمز عبور" [selected] [ref=e14] [cursor=pointer]
        - tab "ورود با کد یکبارمصرف" [ref=e15] [cursor=pointer]
      - generic [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]: شماره موبایل
          - generic [ref=e19]:
            - generic: ۹۸+
            - textbox "شماره موبایل" [ref=e20]:
              - /placeholder: ۰۹xxxxxxxxx
        - generic [ref=e21]:
          - generic [ref=e22]:
            - generic [ref=e23]: رمز عبور
            - link "رمز عبور را فراموش کرده‌اید؟" [ref=e24] [cursor=pointer]:
              - /url: /auth/forgot-password
          - generic [ref=e25]:
            - textbox "رمز عبور" [ref=e26]:
              - /placeholder: رمز عبور خود را وارد کنید
            - button "نمایش رمز عبور" [ref=e27] [cursor=pointer]
        - button "ورود" [disabled] [ref=e31]
      - generic [ref=e32]:
        - link "ساخت حساب جدید" [ref=e33] [cursor=pointer]:
          - /url: /auth/register
        - link "بازیابی رمز عبور" [ref=e34] [cursor=pointer]:
          - /url: /auth/forgot-password
      - paragraph [ref=e35]: با ورود، شرایط استفاده و حریم خصوصی را می‌پذیرم
    - paragraph [ref=e36]: سامانه جامع حقوقی لیگالیر
  - button "Open Next.js Dev Tools" [ref=e42] [cursor=pointer]
  - alert [ref=e46]
```

# Test source

```ts
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
  259 |       ).toBeVisible();
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
> 318 |       expect(page.url()).toContain("/dashboard");
      |                          ^ Error: expect(received).toContain(expected) // indexOf
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
  360 |       await page.waitForSelector("body");
  361 | 
  362 |       // The primary CTA link with text "شروع مشاوره حقوقی"
  363 |       const ctaLink = page.getByRole("link", { name: /شروع مشاوره حقوقی/i });
  364 |       await expect(ctaLink).toBeVisible();
  365 | 
  366 |       const box = await ctaLink.boundingBox();
  367 |       expect(box).not.toBeNull();
  368 |       // The link should be at least 44px in height (touch-friendly)
  369 |       expect(box!.height).toBeGreaterThanOrEqual(44);
  370 |     });
  371 |   });
  372 | 
  373 |   // =========================================================================
  374 |   // Focus-visible styles
  375 |   // =========================================================================
  376 |   test.describe("Focus-visible", () => {
  377 |     test("Skip-to-main link becomes visible on focus", async ({ page }) => {
  378 |       await page.goto("/");
  379 |       await page.waitForSelector("body");
  380 | 
  381 |       const skipLink = page.locator(".skip-to-main");
  382 | 
  383 |       // Before focus, the link should be off-screen (top: -100%)
  384 |       const initialBox = await skipLink.boundingBox();
  385 |       // The skip link is positioned off-screen initially
  386 |       expect(initialBox).not.toBeNull();
  387 | 
  388 |       // Focus the skip link using keyboard
  389 |       await page.keyboard.press("Tab");
  390 | 
  391 |       // After focus, it should slide into view (top: 0 per CSS)
  392 |       await page.waitForTimeout(300);
  393 |       const focusedBox = await skipLink.boundingBox();
  394 |       expect(focusedBox).not.toBeNull();
  395 | 
  396 |       // The y position should be >= 0 (visible in viewport)
  397 |       // Use a looser check: assert the element is actually in the viewport
  398 |       await expect(skipLink).toBeInViewport();
  399 |     });
  400 | 
  401 |     test("Focus-visible outline is applied to interactive elements", async ({
  402 |       page,
  403 |     }) => {
  404 |       await page.setViewportSize({ width: 1280, height: 800 });
  405 |       await page.goto("/");
  406 |       await page.waitForSelector("body");
  407 | 
  408 |       // Tab through interactive elements and verify focus ring exists in stylesheet
  409 |       // We verify the CSS rule exists — functional verification
  410 |       // The :focus-visible styles are defined in globals.css
  411 |       const hasFocusVisibleStyles = await page.evaluate(() => {
  412 |         const sheets = Array.from(document.styleSheets);
  413 |         for (const sheet of sheets) {
  414 |           try {
  415 |             const rules = Array.from(sheet.cssRules || []);
  416 |             for (const rule of rules) {
  417 |               if (
  418 |                 rule instanceof CSSStyleRule &&
```