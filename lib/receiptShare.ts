/**
 * Receipt → PNG → Share flow.
 *
 * Takes a DOM node (the rendered <MonthlyReceipt /> element) and snapshots
 * it via `html-to-image`. On Capacitor-native platforms the resulting PNG
 * is written to the cache directory and handed off to the system share
 * sheet. On the web we download it as a file.
 *
 * Why `html-to-image` (not `html2canvas`):
 *   html2canvas parses every CSS color it encounters through its own
 *   regex-based color engine, which throws on modern CSS color functions
 *   like `lab()`, `oklch()`, and `color-mix()` that Tailwind v4 emits. On
 *   Android WebView it surfaces as the toast "Attempting to parse an
 *   unsupported color function 'lab'". `html-to-image` instead embeds the
 *   live DOM subtree into an SVG `<foreignObject>` and rasterises it, so
 *   any color the browser understands works natively. Zero color-parsing
 *   bugs.
 *
 * Kept separate from the component so the snapshot logic is testable and
 * reusable (e.g. future yearly receipt, annual recap email, etc.).
 */

import { toPng } from "html-to-image";

/**
 * Capture a DOM node as a PNG Blob. Scale 2× for retina-crisp screenshots
 * when the image gets shared to Instagram / WhatsApp stories.
 */
async function captureNodeAsBlob(node: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    // Do not override the node's own background; the receipt has a warm
    // paper gradient baked in.
    backgroundColor: undefined,
    // Inline any @font-face and external resources so the exported image
    // renders the same on the receiving device (IG, WhatsApp, Gmail).
    cacheBust: true,
    skipFonts: false,
  });
  const res = await fetch(dataUrl);
  return await res.blob();
}

/** Convert a Blob to a base64 string (no data-URL prefix). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:image/png;base64,"
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Snapshot the receipt and hand it off to the native share sheet (Android),
 * or trigger a browser download (web). Throws on fatal failure so the
 * caller can surface a toast.
 */
export async function shareReceipt(
  node: HTMLElement,
  filename: string,
  title: string
): Promise<void> {
  const blob = await captureNodeAsBlob(node);

  // Native path — Capacitor Filesystem + Share.
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");

      const base64 = await blobToBase64(blob);
      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      const { uri } = await Filesystem.getUri({
        path: filename,
        directory: Directory.Cache,
      });

      await Share.share({
        title,
        text: title,
        url: uri,
        dialogTitle: "Share your monthly receipt",
      });
      return;
    }
  } catch {
    // Fall through to web download if anything in the native path fails.
  }

  // Web fallback — trigger a download.
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
