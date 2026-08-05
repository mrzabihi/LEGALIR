// ============================================================
// LEGALIR — MSW Server Integration (for SSR/SSG)
// ============================================================

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
