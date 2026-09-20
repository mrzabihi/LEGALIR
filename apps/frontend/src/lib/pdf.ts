// ============================================================
// LEGALIR — PDF.js loader (client-only, lazy)
// ============================================================
// pdfjs-dist is heavy, so it is imported dynamically the first time a
// PDF actually needs rendering — never on the document list or any
// other route. The worker is resolved through `new URL(..., import.meta.url)`
// so the bundler emits it as an asset; no manual copy into /public is
// needed and the version can never drift from the API.
// ============================================================

import type * as PdfjsModule from "pdfjs-dist";

type Pdfjs = typeof PdfjsModule;

let pdfjsPromise: Promise<Pdfjs> | null = null;

/** Load (once) and configure the pdf.js module. */
export function loadPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}
