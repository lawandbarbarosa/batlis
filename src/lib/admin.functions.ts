import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const langEnum = z.enum(["en", "de", "ar", "ko"]);
const cefrEnum = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
const videoCategoryEnum = z.enum(["podcast", "animation", "movie", "show", "talking", "music", "documentary", "news", "other"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error("role check failed");
  if (!data) throw new Error("Forbidden");
}

/* -------------------- IS ADMIN -------------------- */
export const getIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: Boolean(data) };
  });

/* -------------------- ADMIN CONTENT READS -------------------- */
export const adminListLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: lessons } = await context.supabase
      .from("lessons")
      .select("*, lesson_exercises(*)")
      .eq("course_id", data.courseId)
      .order("order_index");
    return { lessons: lessons ?? [] };
  });

export const adminListCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum, cefr: cefrEnum }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: level } = await context.supabase
      .from("levels")
      .select("id")
      .eq("language_code", data.language)
      .eq("cefr", data.cefr)
      .maybeSingle();
    if (!level) return { levelId: null, courses: [] };
    const { data: courses } = await context.supabase
      .from("courses")
      .select("*, lessons(id)")
      .eq("level_id", level.id)
      .order("order_index");
    return { levelId: level.id, courses: courses ?? [] };
  });

export const adminListVocab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum, cefr: cefrEnum }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: words } = await context.supabase
      .from("vocab_words")
      .select("*")
      .eq("language_code", data.language)
      .eq("level_cefr", data.cefr)
      .order("word");
    return { words: words ?? [] };
  });

export const adminListVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: videos } = await context.supabase
      .from("videos")
      .select("*")
      .eq("language_code", data.language)
      .order("level_cefr");
    return { videos: videos ?? [] };
  });

// Powers Admin > Highlights: every highlighted word across every video's
// transcript (all languages), plus two running totals — total words
// transcribed and total video runtime. Both totals are computed live from
// transcript_json / duration_seconds on every request rather than stored
// anywhere, so they automatically include videos uploaded/transcribed after
// this was built, with no separate counter to keep in sync.
interface VideoInsightHighlight {
  id: string;
  start_index: number;
  end_index: number;
  word: string;
  part_of_speech?: string | null;
  meaning_en?: string | null;
  meaning_ku_sorani?: string | null;
  meaning_ku_badini?: string | null;
}
interface VideoInsightLine {
  en?: string;
  highlights?: VideoInsightHighlight[];
}

export const adminGetVideoInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: videos } = await context.supabase
      .from("videos")
      .select("id, title, language_code, level_cefr, category, duration_seconds, transcript_json")
      .order("created_at", { ascending: false });

    const rows = videos ?? [];
    let totalWordsTranscribed = 0;
    let totalDurationSeconds = 0;
    let videosMissingDuration = 0;
    const highlights: Array<{
      key: string;
      word: string;
      part_of_speech: string;
      meaning_en: string;
      meaning_ku_sorani: string;
      meaning_ku_badini: string;
      video_id: string;
      video_title: string;
      language_code: string;
      level_cefr: string;
    }> = [];

    for (const v of rows) {
      if (v.duration_seconds) totalDurationSeconds += v.duration_seconds;
      else videosMissingDuration += 1;

      const lines = (Array.isArray(v.transcript_json) ? v.transcript_json : []) as unknown as VideoInsightLine[];
      for (const line of lines) {
        totalWordsTranscribed += (line.en ?? "").split(/\s+/).filter(Boolean).length;
        for (const h of line.highlights ?? []) {
          highlights.push({
            key: `${v.id}:${h.id}`,
            word: h.word,
            part_of_speech: h.part_of_speech || "other",
            meaning_en: h.meaning_en || "",
            meaning_ku_sorani: h.meaning_ku_sorani || "",
            meaning_ku_badini: h.meaning_ku_badini || "",
            video_id: v.id,
            video_title: v.title,
            language_code: v.language_code,
            level_cefr: v.level_cefr,
          });
        }
      }
    }

    return {
      totalVideos: rows.length,
      totalWordsTranscribed,
      totalDurationSeconds,
      videosMissingDuration,
      highlights,
    };
  });

export const adminListBooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: books } = await context.supabase
      .from("books")
      .select("*")
      .eq("language_code", data.language)
      .order("level_cefr");
    return { books: books ?? [] };
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, display_name, ui_dialect, active_target_lang, created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    return {
      users: (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] })),
    };
  });

/* -------------------- ADMIN WRITES -------------------- */
export const adminUpsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      level_id: z.string().uuid(),
      order_index: z.number().int().min(0),
      title_sorani: z.string().min(1).max(200),
      title_badini: z.string().min(1).max(200),
      title_en: z.string().max(200).optional(),
      description_sorani: z.string().max(1000).optional(),
      description_badini: z.string().max(1000).optional(),
      description_en: z.string().max(1000).optional(),
      cover_image_path: z.string().max(500).optional().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const row = { ...data, cover_image_path: data.cover_image_path || null };
    const { data: saved, error } = await context.supabase.from("courses").upsert(row).select().single();
    if (error) throw new Error(error.message);
    return { course: saved };
  });

export const adminDeleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const lessonStepSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("word"),
    target: z.string().min(1).max(200),
    kurdish_sorani: z.string().max(200).optional(),
    kurdish_badini: z.string().max(200).optional(),
    audio_url: z.string().max(500).optional().or(z.literal("")),
  }),
  z.object({
    type: z.literal("sentence"),
    target: z.string().min(1).max(500),
    kurdish_sorani: z.string().max(500).optional(),
    kurdish_badini: z.string().max(500).optional(),
    audio_url: z.string().max(500).optional().or(z.literal("")),
  }),
  z.object({
    type: z.literal("image"),
    url: z.string().max(500),
    caption: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal("tip"),
    text: z.string().min(1).max(1000),
  }),
]);

export const adminUpsertLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      level_id: z.string().uuid(),
      course_id: z.string().uuid(),
      order_index: z.number().int().min(0),
      title_sorani: z.string().min(1).max(200),
      title_badini: z.string().min(1).max(200),
      title_en: z.string().max(200).optional(),
      summary_sorani: z.string().max(1000).optional(),
      summary_badini: z.string().max(1000).optional(),
      summary_en: z.string().max(1000).optional(),
      grammar_md_sorani: z.string().max(20000).optional(),
      grammar_md_badini: z.string().max(20000).optional(),
      grammar_md_en: z.string().max(20000).optional(),
      dialogue_json: z.array(z.object({ speaker: z.string(), text: z.string(), translation_sorani: z.string().optional(), translation_badini: z.string().optional() })).default([]),
      steps_json: z.array(lessonStepSchema).default([]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const row = { ...data };
    const { data: saved, error } = await context.supabase.from("lessons").upsert(row).select().single();
    if (error) throw new Error(error.message);
    return { lesson: saved };
  });

export const adminDeleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("lessons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpsertExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      lesson_id: z.string().uuid(),
      order_index: z.number().int().min(0),
      type: z.enum(["multiple_choice", "fill_blank", "translate", "listening"]),
      prompt_json: z.record(z.string(), z.unknown()),
      answer_json: z.record(z.string(), z.unknown()),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: saved, error } = await context.supabase.from("lesson_exercises").upsert(data as any).select().single();
    if (error) throw new Error(error.message);
    return { exercise: saved };
  });

export const adminDeleteExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("lesson_exercises").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpsertVocab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      language_code: langEnum,
      level_cefr: cefrEnum,
      topic: z.string().min(1).max(100),
      word: z.string().min(1).max(200),
      kurdish_sorani: z.string().min(1).max(200),
      kurdish_badini: z.string().min(1).max(200),
      pronunciation: z.string().max(200).optional(),
      example_sentence: z.string().max(500).optional(),
      example_sorani: z.string().max(500).optional(),
      example_badini: z.string().max(500).optional(),
      audio_url: z.string().url().max(500).optional().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const payload = { ...data, audio_url: data.audio_url || null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: saved, error } = await context.supabase.from("vocab_words").upsert(payload as any).select().single();
    if (error) throw new Error(error.message);
    return { word: saved };
  });

export const adminDeleteVocab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("vocab_words").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Existing rows loaded straight from Supabase can have `null` in any nullable text
// column (e.g. an untouched `description`, or a transcript line whose Kurdish
// translation was never filled in). z.string().optional() only tolerates a MISSING
// key (undefined), not an explicit null, so re-saving such a row used to throw
// "Expected string, received null". These helpers accept null too and normalize it
// to a plain string so the rest of the app (which always expects a string) is safe.
const nullableStr = (max: number) => z.string().max(max).nullish().transform((v) => v ?? "");
const highlightSchema = z.object({
  id: z.string().max(100),
  start_index: z.number().int().min(0),
  end_index: z.number().int().min(0),
  word: z.string().min(1).max(200),
  part_of_speech: z.string().max(50).nullish().transform((v) => v || "other"),
  meaning_en: nullableStr(500),
  meaning_ku_sorani: nullableStr(500),
  meaning_ku_badini: nullableStr(500),
});

export const adminUpsertVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      language_code: langEnum,
      level_cefr: cefrEnum,
      category: videoCategoryEnum.optional().nullable(),
      youtube_id: z.string().max(50).optional().nullable(),
      video_path: z.string().max(500).optional().nullable(),
      banner_path: z.string().max(500).optional().nullable(),
      title: z.string().min(1).max(300),
      description: z.string().max(2000).optional().nullable(),
      duration_seconds: z.number().int().min(0).nullable().optional(),
      transcript_json: z.array(z.object({
        t: z.number().optional(),
        en: z.string(),
        ku_sorani: z.string().optional().nullable(),
        ku_badini: z.string().optional().nullable(),
        highlights: z.array(highlightSchema).optional().default([]),
      })).default([]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const payload = { ...data, category: data.category || null, youtube_id: data.youtube_id || null, video_path: data.video_path || null, banner_path: data.banner_path || null };
    const { data: saved, error } = await context.supabase.from("videos").upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return { video: saved };
  });

// A content block is either a text paragraph or an inline image, distinguished
// by `type` (existing rows predate this field and are treated as "paragraph").
// All fields are null/undefined-tolerant for the same reason as nullableStr
// above, and every field is present on every block so the shape stays uniform
// regardless of which kind it is.
const bookParagraphSchema = z.object({
  type: z.enum(["paragraph", "image"]).nullish().transform((v) => v ?? "paragraph"),
  text: nullableStr(20000),
  ku_sorani: z.string().optional().nullable(),
  ku_badini: z.string().optional().nullable(),
  highlights: z.array(highlightSchema).optional().default([]),
  image_path: nullableStr(500),
  caption: nullableStr(300),
});

export const adminUpsertBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      language_code: langEnum,
      level_cefr: cefrEnum,
      title: z.string().min(1).max(300),
      author: z.string().max(200).optional().nullable(),
      description: z.string().max(2000).optional().nullable(),
      cover_path: z.string().max(500).optional().nullable(),
      content_json: z.array(bookParagraphSchema).default([]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const payload = { ...data, author: data.author || null, cover_path: data.cover_path || null };
    const { data: saved, error } = await context.supabase.from("books").upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return { book: saved };
  });

/* -------------------- TRANSCRIBE UPLOADED VIDEO -------------------- */
export const transcribeVideoFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ElevenLabs is not connected");

    // Let ElevenLabs pull the video directly from storage instead of
    // buffering it in the Worker.
    const { data: signed, error: signError } = await context.supabase.storage
      .from("videos")
      .createSignedUrl(data.path, 3600);
    if (signError || !signed?.signedUrl) {
      throw new Error(signError?.message || "Could not create a signed URL for the video");
    }

    const fd = new FormData();
    fd.append("model_id", "scribe_v1");
    fd.append("source_url", signed.signedUrl);
    fd.append("tag_audio_events", "false");
    fd.append("diarize", "false");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: fd,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Transcription failed [${res.status}]: ${body}`);
    }
    const json = (await res.json()) as { words?: Array<{ text: string; start: number; end: number; type?: string }> };
    const words = (json.words ?? []).filter((w) => w.type !== "spacing" && w.text?.trim());

    // Group words into lines: break on sentence-ending punctuation, long silences, or >14 words
    const lines: Array<{ t: number; en: string }> = [];
    let cur: typeof words = [];
    let lastEnd = 0;
    for (const w of words) {
      const gap = cur.length ? w.start - lastEnd : 0;
      if (cur.length >= 14 || gap > 1.2) {
        if (cur.length) lines.push({ t: cur[0].start, en: cur.map((x) => x.text).join(" ").replace(/\s+([.,!?;:])/g, "$1").trim() });
        cur = [];
      }
      cur.push(w);
      lastEnd = w.end;
      if (/[.!?]$/.test(w.text) && cur.length >= 3) {
        lines.push({ t: cur[0].start, en: cur.map((x) => x.text).join(" ").replace(/\s+([.,!?;:])/g, "$1").trim() });
        cur = [];
      }
    }
    if (cur.length) lines.push({ t: cur[0].start, en: cur.map((x) => x.text).join(" ").replace(/\s+([.,!?;:])/g, "$1").trim() });

    return { lines: lines.map((l) => ({ ...l, ku_sorani: "", ku_badini: "" })) };
  });

/* -------------------- AUTO-TRANSLATE TRANSCRIPT -------------------- */
export const translateTranscriptLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      source_language: langEnum,
      lines: z.array(z.object({ en: z.string() })).min(1).max(400),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI is not connected");

    const srcName = { en: "English", de: "German", ar: "Arabic", ko: "Korean" }[data.source_language];
    const numbered = data.lines.map((l, i) => `${i + 1}. ${l.en}`).join("\n");

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator for a Kurdish language-learning app. Translate each numbered source line into both Kurdish Sorani (Arabic script) and Kurdish Badini (Kurmanji, Latin script). Keep meaning natural, concise, and matched line-by-line. Return ONLY strict JSON.",
        },
        {
          role: "user",
          content: `Source language: ${srcName}. Translate every line. Return JSON of shape {"translations":[{"i":1,"sorani":"...","badini":"..."}, ...]} with the SAME count and order as input.\n\nLines:\n${numbered}`,
        },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in your workspace.");
      throw new Error(`Translation failed [${res.status}]: ${t}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { translations?: Array<{ i?: number; sorani?: string; badini?: string }> } = {};
    try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }
    const translations = parsed.translations ?? [];
    const byIdx = new Map<number, { sorani: string; badini: string }>();
    for (const t of translations) {
      if (typeof t.i === "number") byIdx.set(t.i, { sorani: t.sorani ?? "", badini: t.badini ?? "" });
    }
    const out = data.lines.map((_, i) => byIdx.get(i + 1) ?? { sorani: "", badini: "" });
    return { translations: out };
  });

/* -------------------- AI: AUTO-TRANSLATE LESSON WORDS / SENTENCES -------------------- */
// Same idea as translateTranscriptLines above, but for the word/sentence steps
// authored in the course/lesson builder: the admin types the target-language
// word or example sentence and this fills in kurdish_sorani + kurdish_badini,
// so translations never have to be typed by hand.
export const translateLessonWords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      source_language: langEnum,
      items: z.array(z.object({ text: z.string().min(1).max(500) })).min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI is not connected");

    const srcName = { en: "English", de: "German", ar: "Arabic", ko: "Korean" }[data.source_language];
    const numbered = data.items.map((l, i) => `${i + 1}. ${l.text}`).join("\n");

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator for a Kurdish language-learning app. Translate each numbered word or sentence into both Kurdish Sorani (Arabic script) and Kurdish Badini (Kurmanji, Arabic script). Keep meaning natural and concise, matched line-by-line. Return ONLY strict JSON.",
        },
        {
          role: "user",
          content: `Source language: ${srcName}. Translate every line. Return JSON of shape {"translations":[{"i":1,"sorani":"...","badini":"..."}, ...]} with the SAME count and order as input.\n\nLines:\n${numbered}`,
        },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in your workspace.");
      throw new Error(`Translation failed [${res.status}]: ${t}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { translations?: Array<{ i?: number; sorani?: string; badini?: string }> } = {};
    try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }
    const translations = parsed.translations ?? [];
    const byIdx = new Map<number, { sorani: string; badini: string }>();
    for (const t of translations) {
      if (typeof t.i === "number") byIdx.set(t.i, { sorani: t.sorani ?? "", badini: t.badini ?? "" });
    }
    const out = data.items.map((_, i) => byIdx.get(i + 1) ?? { sorani: "", badini: "" });
    return { translations: out };
  });

/* -------------------- AI: GENERATE WORD MEANING (for highlight tool) -------------------- */
const posEnum = z.enum(["noun", "verb", "adjective", "adverb", "phrase", "other"]);

export const generateWordMeaning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      source_language: langEnum,
      word: z.string().min(1).max(200),
      context: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI is not connected");

    const srcName = { en: "English", de: "German", ar: "Arabic", ko: "Korean" }[data.source_language];

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a lexicographer for a Kurdish language-learning app. Given a word or short phrase highlighted inside a sentence, identify its part of speech AS USED IN THAT SENTENCE, give a short dictionary-style meaning in English, and translate that meaning into Kurdish Sorani (Arabic script) and Kurdish Badini (Kurmanji, Arabic script). Keep meanings brief (a few words, not a full sentence). Return ONLY strict JSON.",
        },
        {
          role: "user",
          content: `Source language: ${srcName}.\nSentence: ${data.context?.trim() || "(none)"}\nHighlighted word/phrase: "${data.word}"\n\nReturn JSON of shape {"part_of_speech":"noun|verb|adjective|adverb|phrase|other","meaning_en":"...","meaning_ku_sorani":"...","meaning_ku_badini":"..."}.`,
        },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in your workspace.");
      throw new Error(`Generation failed [${res.status}]: ${t}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { part_of_speech?: string; meaning_en?: string; meaning_ku_sorani?: string; meaning_ku_badini?: string } = {};
    try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }
    const pos = posEnum.safeParse(parsed.part_of_speech);
    return {
      part_of_speech: pos.success ? pos.data : "other",
      meaning_en: (parsed.meaning_en ?? "").trim(),
      meaning_ku_sorani: (parsed.meaning_ku_sorani ?? "").trim(),
      meaning_ku_badini: (parsed.meaning_ku_badini ?? "").trim(),
    };
  });

/* -------------------- AI: READ UPLOADED BOOK PAGES (OCR via vision model) -------------------- */
// Cloudflare Workers has no Buffer global, so base64-encode with the standard
// Web APIs (btoa is available there, same as in browsers).
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export const extractBookPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ paths: z.array(z.string().min(1).max(500)).min(1).max(10) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI is not connected");

    const imageParts: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    for (const path of data.paths) {
      const { data: file, error } = await context.supabase.storage.from("book-pages").download(path);
      if (error || !file) throw new Error(error?.message || `Could not read uploaded page: ${path}`);
      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      imageParts.push({ type: "image_url", image_url: { url: `data:${file.type || "image/jpeg"};base64,${base64}` } });
    }

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You transcribe photographed or scanned book pages for a language-learning app. Read only the body text of each page — skip page numbers, running headers/footers, and watermarks. Preserve paragraph breaks as separate items when a page has more than one paragraph. If a page is a picture/illustration with no meaningful body text, return an empty string for it. Return ONLY strict JSON.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Transcribe each of these ${data.paths.length} book page image(s), in the order given. Return JSON of shape {"pages":[{"i":1,"text":"..."},{"i":1,"text":"(second paragraph on page 1, if any)"},...]} — you may emit more than one entry for the same page index "i" if that page has multiple paragraphs, in reading order. Use 1-based index i matching the image order.`,
            },
            ...imageParts,
          ],
        },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in your workspace.");
      throw new Error(`Reading pages failed [${res.status}]: ${t}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { pages?: Array<{ i?: number; text?: string }> } = {};
    try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }

    // Group by page index so a page with several paragraphs yields several
    // strings, in order; a page the model left out entirely comes back as [].
    const byIdx = new Map<number, string[]>();
    for (const p of parsed.pages ?? []) {
      if (typeof p.i !== "number") continue;
      const text = (p.text ?? "").trim();
      if (!text) continue;
      const arr = byIdx.get(p.i) ?? [];
      arr.push(text);
      byIdx.set(p.i, arr);
    }
    const paragraphsByPage = data.paths.map((_, i) => byIdx.get(i + 1) ?? []);
    return { paragraphsByPage };
  });

export const adminDeleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("videos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("books").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), role: z.enum(["admin", "user"]), grant: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("admin_set_user_role", {
      _target_user_id: data.user_id,
      _role: data.role,
      _grant: data.grant,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- ELEVENLABS -------------------- */
export const getElevenLabsToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ agentId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ElevenLabs is not connected");
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(data.agentId)}`,
      { headers: { "xi-api-key": apiKey } },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ElevenLabs token error [${res.status}]: ${body}`);
    }
    const json = (await res.json()) as { token: string };
    return { token: json.token };
  });
