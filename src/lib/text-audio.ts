// Shared between the book reading page (client) and the read-aloud audio
// server function (server). Word indices computed here must match exactly
// on both sides, or the highlight-as-it's-read effect drifts out of sync
// with the audio.

export interface WordSpan {
  word: string;
  /** Character offset of the first character of this word in the source text. */
  start: number;
  /** Character offset of the last character of this word in the source text (inclusive). */
  end: number;
}

/** Splits text into words the same way everywhere: runs of non-whitespace. */
export function tokenizeWords(text?: string | null): string[] {
  return (text ?? "").match(/\S+/g) ?? [];
}

/** Same tokenization as tokenizeWords, but keeps each word's character offsets. */
export function computeWordSpans(text?: string | null): WordSpan[] {
  const t = text ?? "";
  const spans: WordSpan[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    spans.push({ word: m[0], start: m.index, end: m.index + m[0].length - 1 });
  }
  return spans;
}

/**
 * Small, fast, non-cryptographic hash (djb2) used only to detect when a
 * paragraph's text has changed since its read-aloud audio was generated, so
 * we know to regenerate instead of serving stale audio/timings.
 */
export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = (h * 33 + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}
