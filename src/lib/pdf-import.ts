// Client-side PDF import for the Books admin panel.
//
// Turns an uploaded PDF into the same shape the existing "Upload book (AI
// reads it)" photo flow produces, but smarter about it:
//   - Pages that have a real text layer (i.e. almost any PDF exported from a
//     word processor, ebook tool, or "print to PDF") are read directly via
//     pdf.js's text layer. This is instant and free — no AI call needed.
//   - Pages with no usable text layer (a scanned page, or a page that's a
//     pure illustration) fall back to a rendered page image, exactly like a
//     photographed page, so the caller can run it through the same AI OCR
//     step (extractBookPages) that photo uploads already use.
//   - Any embedded raster images on a page that already has real text (a
//     diagram or photo sitting next to a paragraph) are cropped out and
//     returned separately, in top-to-bottom order, so they can be inserted
//     as inline "image" blocks right where they belong.
//
// pdfjs-dist is loaded dynamically so it never bloats the main bundle —
// it's only fetched when an admin actually picks a PDF to import.

export interface ExtractedPdfPage {
  pageNumber: number;
  /** Paragraphs read from the PDF's text layer, in reading order. Empty when the page has no usable text layer. */
  paragraphs: string[];
  /** True when this page had no usable text layer and needs the AI OCR pass, same as a photographed page. */
  needsOcr: boolean;
  /** Only set when needsOcr is true: a rendered image of the whole page, ready to upload to the "book-pages" bucket. */
  pageImage?: Blob;
  /** Embedded images found on this page (only populated when needsOcr is false), top-to-bottom. */
  images: Blob[];
}

// Render scale for both the OCR fallback image and the source canvas we crop
// embedded images out of. High enough to stay legible/crisp, low enough that
// a page image stays a reasonable upload size.
const RENDER_SCALE = 2;
// Minimum size (in rendered pixels) for something to count as a real inline
// image rather than a bullet, rule, or decorative glyph.
const MIN_IMAGE_DIMENSION = 48;
// Skip an "embedded image" that covers almost the entire page — on a page
// that otherwise has a real text layer this is virtually always a
// background/watermark, not content worth pulling out on its own.
const MAX_IMAGE_AREA_RATIO = 0.92;
// Safety cap so a pathological page (e.g. a tiled decorative background)
// can't flood the book with dozens of image blocks.
const MAX_IMAGES_PER_PAGE = 6;
// A page with fewer than this many extracted characters is treated as
// having no usable text layer.
const MIN_TEXT_LENGTH = 8;

type PdfjsLib = typeof import("pdfjs-dist");

let pdfjsLibPromise: Promise<PdfjsLib> | undefined;

async function loadPdfJs(): Promise<PdfjsLib> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjsLib;
    })();
  }
  return pdfjsLibPromise;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      type,
      quality,
    );
  });
}

type TextContentItem = Awaited<
  ReturnType<import("pdfjs-dist").PDFPageProxy["getTextContent"]>
>["items"][number];

/** Group a page's text items into lines (by y-position), then lines into paragraphs (by vertical gap). Works regardless of script direction (LTR or RTL), since it only looks at vertical position. */
function groupIntoParagraphs(items: TextContentItem[]): string[] {
  type Line = { y: number; parts: Array<{ x: number; str: string }> };
  const lines: Line[] = [];
  for (const item of items) {
    // TextContentItem is a union that also includes marked-content markers
    // with no `str`/`transform` (section boundaries, etc) — skip those.
    if (!("str" in item) || !("transform" in item)) continue;
    if (!item.str || !item.str.trim()) continue;
    const y = Math.round(item.transform[5] * 10) / 10;
    let line = lines.find((l) => Math.abs(l.y - y) < 2);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x: item.transform[4], str: item.str });
  }
  // PDF y grows upward, so sort top-to-bottom.
  lines.sort((a, b) => b.y - a.y);
  const lineTexts = lines
    .map((l) => {
      l.parts.sort((a, b) => a.x - b.x);
      return {
        y: l.y,
        text: l.parts
          .map((p) => p.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      };
    })
    .filter((l) => l.text);

  if (lineTexts.length === 0) return [];

  const gaps: number[] = [];
  for (let i = 1; i < lineTexts.length; i++) gaps.push(lineTexts[i - 1].y - lineTexts[i].y);
  const sortedGaps = gaps.slice().sort((a, b) => a - b);
  const medianGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 14;

  const paragraphs: string[] = [];
  let current = lineTexts[0].text;
  for (let i = 1; i < lineTexts.length; i++) {
    const gap = lineTexts[i - 1].y - lineTexts[i].y;
    // A gap noticeably bigger than the typical line-to-line gap on this page
    // means a new paragraph (or a new page section); otherwise it's just the
    // next line of the same paragraph.
    if (medianGap > 0 && gap > medianGap * 1.6) {
      paragraphs.push(current);
      current = lineTexts[i].text;
    } else {
      current += " " + lineTexts[i].text;
    }
  }
  paragraphs.push(current);
  return paragraphs;
}

export async function extractPdfBook(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractedPdfPage[]> {
  const pdfjsLib = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({
    data,
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  }).promise;

  const { OPS, Util } = pdfjsLib;
  const results: ExtractedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const textContent = await page.getTextContent();
    const paragraphs = groupIntoParagraphs(textContent.items);
    const totalChars = paragraphs.reduce((n, p) => n + p.length, 0);
    const needsOcr = totalChars < MIN_TEXT_LENGTH;

    // Render the page once — used either as the OCR fallback image, or as
    // the source we crop embedded images out of.
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser");
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    if (needsOcr) {
      const pageImage = await canvasToBlob(canvas, "image/jpeg", 0.85);
      results.push({ pageNumber, paragraphs: [], needsOcr: true, pageImage, images: [] });
      onProgress?.(pageNumber, pdf.numPages);
      continue;
    }

    // Walk the operator list, tracking the current transform matrix, to
    // find where each embedded image lands on the rendered canvas.
    const opList = await page.getOperatorList();
    const stack: number[][] = [];
    let ctm: number[] = [1, 0, 0, 1, 0, 0];
    const pageArea = viewport.width * viewport.height;
    const found: Array<{ minX: number; minY: number; w: number; h: number }> = [];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i] as number[];
      if (fn === OPS.save) {
        stack.push(ctm);
      } else if (fn === OPS.restore) {
        ctm = stack.pop() ?? ctm;
      } else if (fn === OPS.transform) {
        ctm = Util.transform(ctm, args);
      } else if (fn === OPS.paintImageXObject || fn === OPS.paintImageMaskXObject) {
        const combined = Util.transform(ctm, viewport.transform);
        const corners: Array<[number, number]> = [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ].map((p) => {
          const arr: [number, number] = [p[0], p[1]];
          Util.applyTransform(arr, combined);
          return arr;
        });
        const xs = corners.map((c) => c[0]);
        const ys = corners.map((c) => c[1]);
        const minX = Math.max(0, Math.min(...xs));
        const minY = Math.max(0, Math.min(...ys));
        const maxX = Math.min(canvas.width, Math.max(...xs));
        const maxY = Math.min(canvas.height, Math.max(...ys));
        const w = maxX - minX;
        const h = maxY - minY;
        if (w < MIN_IMAGE_DIMENSION || h < MIN_IMAGE_DIMENSION) continue;
        if (w * h > pageArea * MAX_IMAGE_AREA_RATIO) continue;
        found.push({ minX, minY, w, h });
        if (found.length >= MAX_IMAGES_PER_PAGE) break;
      }
    }

    // Top-to-bottom reading order.
    found.sort((a, b) => a.minY - b.minY);

    const images: Blob[] = [];
    for (const box of found) {
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = Math.round(box.w);
      cropCanvas.height = Math.round(box.h);
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) continue;
      cropCtx.drawImage(
        canvas,
        box.minX,
        box.minY,
        box.w,
        box.h,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height,
      );
      images.push(await canvasToBlob(cropCanvas, "image/png"));
    }

    results.push({ pageNumber, paragraphs, needsOcr: false, images });
    onProgress?.(pageNumber, pdf.numPages);
  }

  return results;
}
