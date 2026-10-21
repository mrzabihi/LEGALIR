// The whole `e2e/` directory, working files included.
//
// `playwright.config.ts` deliberately narrows the default run to the contract
// suite (see its header). Playwright has no `--test-ignore` CLI flag and npm
// scripts here run under `cmd.exe`, where an `PW_…=1` prefix inside a script
// body is not portable — so the escape hatch is a second config that reuses
// the base wholesale and empties the ignore list. Everything else (webServer,
// projects, reporters, baseURL) comes from the base by reference, so the two
// runs can never drift apart.
import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

export default defineConfig({ ...base, testIgnore: [] });
