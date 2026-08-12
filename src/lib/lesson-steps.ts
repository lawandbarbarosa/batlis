// Shared lesson-step model used by the admin lesson wizard, the admin lesson
// editor and (in shape) the learner lesson player. Kept out of the route file
// so both the wizard component and the admin page work from one definition.

export type LessonStep =
  | { type: "word"; target: string; kurdish_sorani?: string; kurdish_badini?: string; audio_url?: string; image_url?: string }
  | { type: "sentence"; target: string; kurdish_sorani?: string; kurdish_badini?: string; audio_url?: string; image_url?: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "tip"; text: string };

export function blankStep(type: LessonStep["type"]): LessonStep {
  if (type === "word" || type === "sentence") return { type, target: "", kurdish_sorani: "", kurdish_badini: "", audio_url: "", image_url: "" };
  if (type === "image") return { type, url: "", caption: "" };
  return { type, text: "" };
}

export const JSON_STEPS_EXAMPLE = `[
  { "type": "word", "target": "Hello", "kurdish_sorani": "", "kurdish_badini": "" },
  { "type": "sentence", "target": "Hello, my name is John." },
  { "type": "image", "url": "https://.../hello.png", "caption": "optional" },
  { "type": "tip", "text": "optional grammar aside" }
]`;

export const BLOCK_IMPORT_EXAMPLE = `{
  "title": "Greetings",
  "content": [
    { "type": "word", "word": "Hello", "translation": "سڵاو", "image": "images/hello.png", "sentence": "Hello, my name is John." },
    { "type": "word", "word": "Goodbye", "translation": "خواحافیز", "sentence": "Goodbye! See you tomorrow." }
  ]
}`;

export type ImportSummary = { words: number; sentences: number; images: number; tips: number; assetWarnings: number; skipped: Record<string, number> };

// Accepts either the app's own step shape (target/kurdish_sorani/kurdish_badini/audio_url)
// or the more natural "word bundle" shape from a hand-authored course JSON
// (word/translation/image/audio/sentence combined on one object) and normalizes
// either into the app's LessonStep[]. review/test/exam items aren't supported
// yet, so they're counted and skipped rather than silently dropped.
export function blockContentToSteps(content: unknown[]): { steps: LessonStep[]; summary: ImportSummary } {
  const steps: LessonStep[] = [];
  const summary: ImportSummary = { words: 0, sentences: 0, images: 0, tips: 0, assetWarnings: 0, skipped: {} };
  const asStr = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
  const asAsset = (v: unknown): string => {
    const s = asStr(v);
    if (s && !/^https?:\/\//i.test(s)) summary.assetWarnings++;
    return s;
  };

  for (const raw of content ?? []) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const type = typeof item.type === "string" ? item.type : undefined;

    if (type === "word") {
      steps.push({
        type: "word",
        target: asStr(item.word ?? item.target),
        kurdish_sorani: asStr(item.translation ?? item.kurdish_sorani),
        kurdish_badini: asStr(item.kurdish_badini),
        audio_url: item.audio || item.audio_url ? asAsset(item.audio ?? item.audio_url) : "",
        image_url: item.image || item.image_url ? asAsset(item.image ?? item.image_url) : "",
      });
      summary.words++;
      if (item.image || item.image_url) summary.images++;
      if (item.sentence) {
        steps.push({ type: "sentence", target: asStr(item.sentence), kurdish_sorani: "", kurdish_badini: "", audio_url: "", image_url: "" });
        summary.sentences++;
      }
    } else if (type === "sentence") {
      steps.push({
        type: "sentence",
        target: asStr(item.target ?? item.sentence),
        kurdish_sorani: asStr(item.kurdish_sorani ?? item.translation),
        kurdish_badini: asStr(item.kurdish_badini),
        audio_url: item.audio || item.audio_url ? asAsset(item.audio ?? item.audio_url) : "",
        image_url: item.image || item.image_url ? asAsset(item.image ?? item.image_url) : "",
      });
      summary.sentences++;
    } else if (type === "image") {
      steps.push({ type: "image", url: asAsset(item.url ?? item.image), caption: asStr(item.caption) });
      summary.images++;
    } else if (type === "tip") {
      steps.push({ type: "tip", text: asStr(item.text) });
      summary.tips++;
    } else {
      const key = type ?? "unknown";
      summary.skipped[key] = (summary.skipped[key] ?? 0) + 1;
    }
  }
  return { steps, summary };
}

/**
 * Turns whatever an admin pastes for ONE lesson into a title + steps.
 * Tolerates: a bare array of content items, `{ title, content }`,
 * `{ title, blocks: [...] }` (blocks are flattened into one lesson) and
 * `{ lesson: {...} }` wrappers.
 */
export function parseLessonJson(text: string): { title: string; steps: LessonStep[]; summary: ImportSummary } {
  const parsed = JSON.parse(text) as unknown;
  const root = (Array.isArray(parsed) ? { content: parsed } : ((parsed ?? {}) as Record<string, unknown>)) as Record<string, unknown>;
  const inner = (root.lesson ?? root.data ?? root) as Record<string, unknown>;

  const titleOf = (o: Record<string, unknown>) =>
    [o.title, o.lesson_title, o.name].find((v) => typeof v === "string" && v.trim()) as string | undefined;

  let content: unknown[] = [];
  if (Array.isArray(inner.content)) content = inner.content as unknown[];
  else if (Array.isArray(inner.blocks)) {
    for (const b of inner.blocks as Record<string, unknown>[]) {
      if (Array.isArray(b?.content)) content = content.concat(b.content as unknown[]);
    }
  } else if (Array.isArray(inner.words)) content = (inner.words as unknown[]).map((w) => ({ type: "word", ...(w as object) }));

  const { steps, summary } = blockContentToSteps(content);
  return { title: (titleOf(inner) ?? titleOf(root) ?? "").trim(), steps, summary };
}
