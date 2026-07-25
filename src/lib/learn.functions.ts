import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const langEnum = z.enum(["en", "de", "ar", "ko"]);
const cefrEnum = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
const videoCategoryEnum = z.enum(["podcast", "animation", "movie", "show", "talking", "music", "documentary", "news", "other"]);

/* -------------------- DASHBOARD -------------------- */
export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum.optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: languages }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("languages").select("*"),
    ]);
    const activeLang = data.language ?? profile?.active_target_lang ?? null;
    let levelRow = null as null | { current_cefr: string };
    let recentLesson = null as null | { id: string; title_sorani: string; title_badini: string; title_en: string | null };
    let dueCount = 0;
    let completedCount = 0;
    let wordsLearnedCount = 0;
    if (activeLang) {
      const [{ data: level }, { data: due }, { data: progress }, { data: vocabDone }] = await Promise.all([
        supabase.from("user_language_levels").select("current_cefr").eq("user_id", userId).eq("language_code", activeLang).maybeSingle(),
        supabase
          .from("user_vocab_progress")
          .select("id, vocab_words!inner(language_code)")
          .eq("user_id", userId)
          .lte("next_review_at", new Date().toISOString())
          .eq("vocab_words.language_code", activeLang),
        supabase
          .from("user_lesson_progress")
          .select("id, passed, lesson_id, last_attempt_at, lessons!inner(title_sorani, title_badini, title_en, level_id, levels!inner(language_code))")
          .eq("user_id", userId)
          .eq("lessons.levels.language_code", activeLang)
          .order("last_attempt_at", { ascending: false })
          .limit(20),
        supabase
          .from("user_vocab_progress")
          .select("id, vocab_words!inner(language_code)")
          .eq("user_id", userId)
          .gte("box", 3)
          .eq("vocab_words.language_code", activeLang),
      ]);
      levelRow = level ?? null;
      dueCount = due?.length ?? 0;
      completedCount = (progress ?? []).filter((p: { passed: boolean }) => p.passed).length;
      wordsLearnedCount = vocabDone?.length ?? 0;
      const recent = (progress ?? [])[0] as unknown as { lesson_id: string; lessons: { title_sorani: string; title_badini: string; title_en: string | null } } | undefined;
      if (recent) {
        recentLesson = { id: recent.lesson_id, title_sorani: recent.lessons.title_sorani, title_badini: recent.lessons.title_badini, title_en: recent.lessons.title_en };
      }
    }
    return { profile, languages: languages ?? [], activeLang, level: levelRow, recentLesson, dueCount, completedCount, wordsLearnedCount };
  });

/* -------------------- PROFILE -------------------- */
export const updateActiveLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("profiles").update({ active_target_lang: data.language }).eq("id", userId);
    // ensure a user_language_levels row exists
    await supabase.from("user_language_levels").upsert({ user_id: userId, language_code: data.language, current_cefr: "A1" }, { onConflict: "user_id,language_code" });
    return { ok: true };
  });

export const updateDialect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dialect: z.enum(["sorani", "badini", "english"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("profiles").update({ ui_dialect: data.dialect }).eq("id", userId);
    return { ok: true };
  });

/* -------------------- PLACEMENT -------------------- */
export const startPlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: questions } = await supabase
      .from("placement_questions")
      .select("id, difficulty_band, question_json, order_index")
      .eq("language_code", data.language)
      .order("order_index");
    return { questions: questions ?? [] };
  });

export const submitPlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      language: langEnum,
      answers: z.array(z.object({ questionId: z.string().uuid(), answer: z.string().max(500) })),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: questions } = await supabase
      .from("placement_questions")
      .select("id, difficulty_band, answer_json")
      .eq("language_code", data.language);
    const qmap = new Map((questions ?? []).map((q) => [q.id, q]));
    const bands: Record<string, { correct: number; total: number }> = {};
    let score = 0;
    for (const a of data.answers) {
      const q = qmap.get(a.questionId);
      if (!q) continue;
      const correct = String((q.answer_json as { correct?: string })?.correct ?? "").trim().toLowerCase() === a.answer.trim().toLowerCase();
      const band = q.difficulty_band as string;
      bands[band] ??= { correct: 0, total: 0 };
      bands[band].total += 1;
      if (correct) { bands[band].correct += 1; score += 1; }
    }
    // Assign highest band where >=70% correct, else lowest band attempted, default A1
    const order = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
    let assigned: (typeof order)[number] = "A1";
    for (const b of order) {
      const s = bands[b];
      if (s && s.total > 0 && s.correct / s.total >= 0.7) assigned = b;
    }
    await supabase.from("placement_attempts").insert({
      user_id: userId,
      language_code: data.language,
      score,
      total_questions: data.answers.length,
      assigned_cefr: assigned,
      answers_json: data.answers,
    });
    await supabase.from("user_language_levels").upsert(
      { user_id: userId, language_code: data.language, current_cefr: assigned },
      { onConflict: "user_id,language_code" },
    );
    await supabase.from("profiles").update({ active_target_lang: data.language }).eq("id", userId);
    return { score, total: data.answers.length, assigned };
  });

/* -------------------- LESSON TREE -------------------- */
/* -------------------- COURSES -------------------- */
export const getCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const [{ data: levels }, { data: userLevel }, { data: progress }] = await Promise.all([
      supabase
        .from("levels")
        .select("id, cefr, order_index, courses(id, order_index, title_sorani, title_badini, title_en, description_sorani, description_badini, description_en, cover_image_path, lessons(id))")
        .eq("language_code", data.language)
        .order("order_index"),
      supabase
        .from("user_language_levels")
        .select("current_cefr")
        .eq("user_id", userId)
        .eq("language_code", data.language)
        .maybeSingle(),
      supabase.from("user_lesson_progress").select("lesson_id, passed"),
    ]);
    const passedIds = new Set((progress ?? []).filter((p) => p.passed).map((p) => p.lesson_id));
    const currentCefr = userLevel?.current_cefr ?? "A1";
    const cefrOrder = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const currentIdx = cefrOrder.indexOf(currentCefr);
    const levelGroups = (levels ?? []).map((lvl) => {
      const cefrIdx = cefrOrder.indexOf(lvl.cefr as string);
      const levelUnlocked = cefrIdx <= currentIdx;
      const courses = [...(lvl.courses ?? [])]
        .sort((a, b) => a.order_index - b.order_index)
        .map((c) => {
          const lessonIds = (c.lessons ?? []).map((l: { id: string }) => l.id);
          return {
            id: c.id,
            title_sorani: c.title_sorani,
            title_badini: c.title_badini,
            title_en: c.title_en,
            description_sorani: c.description_sorani,
            description_badini: c.description_badini,
            description_en: c.description_en,
            coverImageUrl: c.cover_image_path ? supabase.storage.from("course-covers").getPublicUrl(c.cover_image_path).data.publicUrl : null,
            totalLessons: lessonIds.length,
            completedLessons: lessonIds.filter((id: string) => passedIds.has(id)).length,
          };
        });
      return { id: lvl.id, cefr: lvl.cefr, unlocked: levelUnlocked, courses };
    });
    return { levels: levelGroups, currentCefr };
  });

export const getCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: course } = await supabase
      .from("courses")
      .select("id, title_sorani, title_badini, title_en, description_sorani, description_badini, description_en, cover_image_path, level_id, levels(cefr, language_code), lessons(id, order_index, title_sorani, title_badini, title_en, summary_sorani, summary_badini, summary_en)")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course) throw new Error("Course not found");
    const { data: progress } = await supabase
      .from("user_lesson_progress")
      .select("lesson_id, passed, score")
      .eq("user_id", userId);
    const passedIds = new Set((progress ?? []).filter((p) => p.passed).map((p) => p.lesson_id));
    const scoreMap = new Map((progress ?? []).map((p) => [p.lesson_id, p.score]));
    const lessons = [...(course.lessons ?? [])].sort((a, b) => a.order_index - b.order_index);
    let prevPassed = true;
    const nodes = lessons.map((l) => {
      const passed = passedIds.has(l.id);
      const unlocked = prevPassed;
      prevPassed = passed;
      return {
        id: l.id,
        title_sorani: l.title_sorani,
        title_badini: l.title_badini,
        title_en: l.title_en,
        summary_sorani: l.summary_sorani,
        summary_badini: l.summary_badini,
        summary_en: l.summary_en,
        order_index: l.order_index,
        passed,
        unlocked,
        score: scoreMap.get(l.id) ?? 0,
      };
    });
    const { lessons: _omit, cover_image_path, ...courseInfo } = course;
    return { course: { ...courseInfo, coverImageUrl: cover_image_path ? supabase.storage.from("course-covers").getPublicUrl(cover_image_path).data.publicUrl : null }, lessons: nodes };
  });

/* -------------------- LESSON RUNNER -------------------- */
export const getLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lessonId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [{ data: lesson }, { data: exercises }] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, title_sorani, title_badini, title_en, grammar_md_sorani, grammar_md_badini, grammar_md_en, dialogue_json, steps_json, level_id, course_id, levels(cefr, language_code)")
        .eq("id", data.lessonId)
        .maybeSingle(),
      supabase.from("lesson_exercises").select("*").eq("lesson_id", data.lessonId).order("order_index"),
    ]);
    if (!lesson) throw new Error("Lesson not found");
    return { lesson, exercises: exercises ?? [] };
  });

export const submitLessonQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      lessonId: z.string().uuid(),
      answers: z.array(z.object({ exerciseId: z.string().uuid(), answer: z.string().max(500) })),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: exercises } = await supabase
      .from("lesson_exercises")
      .select("id, answer_json")
      .eq("lesson_id", data.lessonId);
    const emap = new Map((exercises ?? []).map((e) => [e.id, e]));
    let correct = 0;
    const total = data.answers.length;
    for (const a of data.answers) {
      const ex = emap.get(a.exerciseId);
      if (!ex) continue;
      const expected = String((ex.answer_json as { correct?: string })?.correct ?? "").trim().toLowerCase();
      if (expected === a.answer.trim().toLowerCase()) correct += 1;
    }
    const score = total === 0 ? 0 : Math.round((correct / total) * 100);
    const passed = score >= 70;
    const { data: existing } = await supabase
      .from("user_lesson_progress")
      .select("id, attempts, passed")
      .eq("user_id", userId)
      .eq("lesson_id", data.lessonId)
      .maybeSingle();
    const attempts = (existing?.attempts ?? 0) + 1;
    await supabase.from("user_lesson_progress").upsert(
      {
        user_id: userId,
        lesson_id: data.lessonId,
        score,
        passed: existing?.passed || passed,
        attempts,
        last_attempt_at: new Date().toISOString(),
        completed_at: passed ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,lesson_id" },
    );
    // bump streak
    const today = new Date().toISOString().slice(0, 10);
    const { data: profile } = await supabase.from("profiles").select("last_active_date, streak_count").eq("id", userId).maybeSingle();
    if (profile) {
      const last = profile.last_active_date;
      let newStreak = profile.streak_count ?? 0;
      if (last !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        newStreak = last === yesterday ? newStreak + 1 : 1;
      }
      await supabase.from("profiles").update({ last_active_date: today, streak_count: newStreak }).eq("id", userId);
    }
    return { score, correct, total, passed };
  });

/* -------------------- VOCAB -------------------- */
export const getDueFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum, cefr: cefrEnum.optional(), limit: z.number().min(1).max(50).default(20) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Get user's current level
    const { data: userLevel } = await supabase.from("user_language_levels").select("current_cefr").eq("user_id", userId).eq("language_code", data.language).maybeSingle();
    const cefr = data.cefr ?? userLevel?.current_cefr ?? "A1";
    // words at or below current level
    const order = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
    const allowed = order.slice(0, order.indexOf(cefr as (typeof order)[number]) + 1);
    const { data: allWords } = await supabase
      .from("vocab_words")
      .select("*")
      .eq("language_code", data.language)
      .in("level_cefr", allowed)
      .limit(100);
    const { data: progress } = await supabase.from("user_vocab_progress").select("*").eq("user_id", userId);
    const now = Date.now();
    const progMap = new Map((progress ?? []).map((p) => [p.word_id, p]));
    const scored = (allWords ?? []).map((w) => {
      const p = progMap.get(w.id);
      const due = p ? new Date(p.next_review_at).getTime() <= now : true;
      return { word: w, progress: p, due, box: p?.box ?? 0 };
    });
    const dueWords = scored.filter((s) => s.due).sort((a, b) => a.box - b.box).slice(0, data.limit);
    return { words: dueWords };
  });

export const reviewFlashcard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ wordId: z.string().uuid(), correct: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase.from("user_vocab_progress").select("*").eq("user_id", userId).eq("word_id", data.wordId).maybeSingle();
    const box = existing?.box ?? 1;
    const newBox = data.correct ? Math.min(box + 1, 6) : 1;
    const intervalDays = [0, 1, 2, 4, 7, 14, 30][newBox] ?? 1;
    const next = new Date(Date.now() + intervalDays * 86400000).toISOString();
    await supabase.from("user_vocab_progress").upsert(
      {
        user_id: userId,
        word_id: data.wordId,
        box: newBox,
        correct_count: (existing?.correct_count ?? 0) + (data.correct ? 1 : 0),
        incorrect_count: (existing?.incorrect_count ?? 0) + (data.correct ? 0 : 1),
        next_review_at: next,
      },
      { onConflict: "user_id,word_id" },
    );
    return { ok: true, newBox };
  });

/* -------------------- VIDEOS -------------------- */
export const getVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum, category: videoCategoryEnum.optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let query = supabase
      .from("videos")
      .select("id, youtube_id, banner_path, title, description, level_cefr, duration_seconds, category")
      .eq("language_code", data.language);
    if (data.category) query = query.eq("category", data.category);
    const { data: videos } = await query.order("level_cefr");
    return { videos: videos ?? [] };
  });

export const getVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: video } = await supabase.from("videos").select("*").eq("id", data.id).maybeSingle();
    if (!video) throw new Error("Video not found");
    return { video };
  });

/* -------------------- BOOKS -------------------- */
export const getBooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: langEnum }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: books } = await supabase.from("books").select("id, title, author, cover_path, description, level_cefr").eq("language_code", data.language).order("level_cefr");
    return { books: books ?? [] };
  });

export const getBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: book } = await supabase.from("books").select("*").eq("id", data.id).maybeSingle();
    if (!book) throw new Error("Book not found");
    return { book };
  });
