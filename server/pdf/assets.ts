import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
    // Next to this module locally; from the project root in bundled serverless deployments.
    const at = (name: string) =>
      readFile(new URL(`./assets/${name}`, import.meta.url)).catch(() =>
        readFile(join(process.cwd(), "server/pdf/assets", name)),
      );
    const [regular, bold, logoJpg] = await Promise.all([at("DejaVuSans.ttf"), at("DejaVuSans-Bold.ttf"), at("logo.jpg")]);
    return { regular, bold, logoJpg };
  })();
  return cached;
}
