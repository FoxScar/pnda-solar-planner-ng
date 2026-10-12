import { readFile } from "node:fs/promises";

export interface PdfAssets {
  regular: Uint8Array;
  bold: Uint8Array;
  logoJpg: Uint8Array;
}

let cached: Promise<PdfAssets> | null = null;

/**
 * Fonts (DejaVu Sans — includes the ₦ glyph, see DejaVu-LICENSE.txt) and logo.
 * Loaded from disk once per process. A Workers build would import these as
 * binary modules instead and pass them to renderQuotePdf directly.
 */
export function loadPdfAssets(): Promise<PdfAssets> {
  cached ??= (async () => {
    const at = (name: string) => readFile(new URL(`./assets/${name}`, import.meta.url));
    const [regular, bold, logoJpg] = await Promise.all([at("DejaVuSans.ttf"), at("DejaVuSans-Bold.ttf"), at("logo.jpg")]);
    return { regular, bold, logoJpg };
  })();
  return cached;
}
