import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { z } from "zod";
import { getLesson, submitLessonQuiz } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import type { TranslationKey } from "@/i18n/sorani";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ForwardArrow, BackArrow } from "@/components/dir-arrow";
import { Loader2, CheckCircle2, XCircle, RotateCw, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({ id: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/lesson/$id")({
  parseParams: (p) => paramsSchema.parse(p),
  component: LessonRunner,
});

type Step = "intro" | "flow" | "result";

interface WordHighlight {
  id: string;
  start_index: number;
  end_index: number;
  word: string;
  part_of_speech: string;
  meaning_en: string;
  meaning_ku_sorani: string;
  meaning_ku_badini: string;
}

type LessonStep =
  | {
      type: "word";
      target: string;
      kurdish_sorani?: string;
      kurdish_badini?: string;
      audio_url?: string;
      image_url?: string;
    }
  | {
      type: "sentence";
      target: string;
      kurdish_sorani?: string;
      kurdish_badini?: string;
      audio_url?: string;
      image_url?: string;
      highlights?: WordHighlight[];
    }
  | { type: "image"; url: string; caption?: string }
  | { type: "tip"; text: string }
  // A pointer at one of the lesson's own exercises, placed here in the
  // walkthrough on purpose — see buildFlowItems below for how this merges
  // with the trailing exercises into one combined flow.
  | { type: "exercise"; exerciseId: string };

interface ExerciseRow {
  id: string;
  type: string;
  prompt_json: unknown;
  answer_json: unknown;
}

type FlowItem = { kind: "step"; step: LessonStep } | { kind: "exercise"; exercise: ExerciseRow };

// Turns the lesson's steps + exercises into the single sequence the learner
// actually walks through. Any exercise referenced by a `{ type: "exercise" }`
// step plays right there, in place; every other exercise (which, for a
// lesson saved before this existed, is *all* of them) is appended after the
// last step — exactly the old "words, then the quiz" behavior, unchanged.
function buildFlowItems(steps: LessonStep[], exercises: ExerciseRow[]): FlowItem[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const referenced = new Set<string>();
  const items: FlowItem[] = [];
  for (const s of steps) {
    if (s.type === "exercise") {
      const ex = byId.get(s.exerciseId);
      if (ex) {
        items.push({ kind: "exercise", exercise: ex });
        referenced.add(ex.id);
      }
      // A dangling reference (exercise deleted after being placed inline)
      // is simply skipped — nothing left to show for it.
    } else {
      items.push({ kind: "step", step: s });
    }
  }
  for (const ex of exercises) {
    if (!referenced.has(ex.id)) items.push({ kind: "exercise", exercise: ex });
  }
  return items;
}

function tokenizeWords(text?: string): string[] {
  return (text || "").split(/\s+/).filter(Boolean);
}

interface TextSegment {
  text: string;
  highlight?: WordHighlight;
}

function buildSegments(words: string[], highlights: WordHighlight[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let i = 0;
  while (i < words.length) {
    const hl = highlights.find(
      (h) => h.start_index === i && h.end_index >= i && h.end_index < words.length,
    );
    if (hl) {
      segments.push({
        text: words.slice(hl.start_index, hl.end_index + 1).join(" "),
        highlight: hl,
      });
      i = hl.end_index + 1;
    } else {
      segments.push({ text: words[i] });
      i += 1;
    }
  }
  return segments;
}

function shuffleTokens<T>(tokens: T[]): T[] {
  const arr = tokens.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Landing back on the original order isn't much of a puzzle — try again.
  if (arr.length > 1 && arr.every((t, i) => t === tokens[i])) return shuffleTokens(tokens);
  return arr;
}

const POS_KEYS = ["noun", "verb", "adjective", "adverb", "phrase", "other"] as const;

const TTS_LOCALE: Record<string, string> = { en: "en-US", de: "de-DE", ar: "ar-SA", ko: "ko-KR" };

function speakText(text: string, langCode: string) {
  if (typeof window === "undefined" || !text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = TTS_LOCALE[langCode] ?? "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

// A sentence step's text, with any highlighted words rendered as tap
// targets that pop open their part of speech + English/Kurdish meaning —
// same interaction as the highlighted words on the video and book pages.
function HighlightedSentence({
  text,
  highlights,
  dialect,
  t,
}: {
  text: string;
  highlights: WordHighlight[];
  dialect: string;
  t: (key: TranslationKey) => string;
}) {
  const segments = buildSegments(tokenizeWords(text), highlights);
  return (
    <>
      {segments.map((seg, idx) => (
        <span key={idx}>
          {idx > 0 && " "}
          {seg.highlight ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="underline decoration-dotted decoration-2 underline-offset-4 hover:opacity-75 rounded transition"
                >
                  {seg.text}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-72 max-w-[calc(100vw-2rem)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-semibold text-base" dir="ltr">
                      {seg.text}
                    </span>
                    <Badge variant="secondary">
                      {(POS_KEYS as readonly string[]).includes(seg.highlight.part_of_speech)
                        ? t(`pos_${seg.highlight.part_of_speech}` as never)
                        : seg.highlight.part_of_speech}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {t("meaning_english")}
                    </div>
                    <div dir="ltr" className="text-sm">
                      {seg.highlight.meaning_en || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {t("meaning_kurdish")}
                    </div>
                    <div className="text-sm font-kurdish">
                      {dialect === "sorani"
                        ? seg.highlight.meaning_ku_sorani || seg.highlight.meaning_ku_badini || "—"
                        : dialect === "badini"
                          ? seg.highlight.meaning_ku_badini ||
                            seg.highlight.meaning_ku_sorani ||
                            "—"
                          : seg.highlight.meaning_ku_sorani ||
                            seg.highlight.meaning_ku_badini ||
                            "—"}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            seg.text
          )}
        </span>
      ))}
    </>
  );
}

// A word/sentence/image/tip step — the same content that used to make up
// the "words" phase, now just one possible flow item among several.
function StepView({
  step: s,
  dialect,
  t,
  wordLangCode,
}: {
  step: LessonStep;
  dialect: string;
  t: (key: TranslationKey) => string;
  wordLangCode: string;
}) {
  return (
    <div className="bento-card p-6 sm:p-10 text-center min-h-[280px] flex flex-col justify-center">
      {(s.type === "word" || s.type === "sentence") && (
        <>
          {s.image_url && (
            <img
              src={s.image_url}
              alt={s.target}
              className="max-h-52 w-auto mx-auto mb-5 rounded-xl squircle object-contain"
            />
          )}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div
              className={
                s.type === "word"
                  ? "text-4xl sm:text-5xl font-display font-bold"
                  : "text-2xl sm:text-3xl font-display font-semibold"
              }
              dir="ltr"
            >
              {s.type === "sentence" && s.highlights && s.highlights.length > 0 ? (
                <HighlightedSentence
                  text={s.target}
                  highlights={s.highlights}
                  dialect={dialect}
                  t={t}
                />
              ) : (
                s.target
              )}
            </div>
            <button
              onClick={() =>
                s.audio_url
                  ? new Audio(s.audio_url).play().catch(() => {})
                  : speakText(s.target, wordLangCode)
              }
              className="p-2 rounded-full hover:bg-accent"
              title={t("play_audio")}
            >
              <Volume2 className="h-5 w-5 text-primary-ink" />
            </button>
          </div>
          {(dialect === "badini" ? s.kurdish_badini : s.kurdish_sorani) && (
            <div className="mt-4 text-2xl font-kurdish" dir="rtl">
              {dialect === "badini" ? s.kurdish_badini : s.kurdish_sorani}
            </div>
          )}
        </>
      )}
      {s.type === "image" && (
        <div>
          <img
            src={s.url}
            alt={s.caption ?? ""}
            className="max-h-64 mx-auto rounded-xl squircle object-contain"
          />
          {s.caption && <div className="mt-3 text-sm text-muted-foreground">{s.caption}</div>}
        </div>
      )}
      {s.type === "tip" && (
        <div className="text-lg leading-relaxed whitespace-pre-wrap">{s.text}</div>
      )}
    </div>
  );
}

// The "rebuild this sentence" exercise: the learner taps the sentence's own
// (shuffled) words back into order. A wrong attempt is called out with a
// warning instead of just being marked wrong — the learner un-taps the
// words that don't belong and tries again, as many times as it takes,
// instead of losing the point on one try like the other exercise types.
function ReorderExercise({
  correct,
  solved,
  onSolved,
  t,
}: {
  correct: string;
  solved: boolean;
  onSolved: (answer: string) => void;
  t: (key: TranslationKey) => string;
}) {
  const [state] = useState(() => {
    const canonical = tokenizeWords(correct).map((text, id) => ({ id, text }));
    return { canonical, initialBank: solved ? [] : shuffleTokens(canonical) };
  });
  const [bank, setBank] = useState(state.initialBank);
  const [built, setBuilt] = useState(() => (solved ? state.canonical : []));
  const [wrong, setWrong] = useState(false);
  const { canonical } = state;

  if (canonical.length === 0) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }

  const pick = (token: { id: number; text: string }) => {
    if (solved) return;
    setBank((b) => b.filter((tk) => tk.id !== token.id));
    setBuilt((b) => [...b, token]);
    setWrong(false);
  };
  const unpick = (token: { id: number; text: string }) => {
    if (solved) return;
    setBuilt((b) => b.filter((tk) => tk.id !== token.id));
    setBank((b) => [...b, token]);
    setWrong(false);
  };
  const reset = () => {
    if (solved) return;
    setBank(shuffleTokens(canonical));
    setBuilt([]);
    setWrong(false);
  };
  const check = () => {
    const ok = built.length === canonical.length && built.every((tk, i) => tk.id === i);
    if (ok) onSolved(correct);
    else setWrong(true);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("reorder_instructions")}</p>
      <div
        dir="ltr"
        className={cn(
          "min-h-[3.5rem] rounded-xl border-2 p-3 flex flex-wrap gap-2 items-start content-start transition-colors",
          wrong
            ? "border-destructive/60 bg-destructive/5"
            : solved
              ? "border-primary-ink bg-primary/5"
              : "border-border bg-card",
        )}
      >
        {built.length === 0 && <span className="text-sm text-muted-foreground">…</span>}
        {built.map((tk) => (
          <button
            key={tk.id}
            type="button"
            onClick={() => unpick(tk)}
            disabled={solved}
            className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-sm font-medium disabled:opacity-90"
          >
            {tk.text}
          </button>
        ))}
      </div>
      {wrong && !solved && (
        <p className="text-sm text-destructive font-medium">{t("reorder_incorrect")}</p>
      )}
      {solved && <p className="text-sm text-primary-ink font-medium">{t("correct")}</p>}
      {!solved && (
        <div dir="ltr" className="flex flex-wrap gap-2">
          {bank.map((tk) => (
            <button
              key={tk.id}
              type="button"
              onClick={() => pick(tk)}
              className="px-3 py-1.5 rounded-lg border-2 border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors"
            >
              {tk.text}
            </button>
          ))}
        </div>
      )}
      {!solved && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reset}
            disabled={built.length === 0}
          >
            <RotateCw className="h-3.5 w-3.5 mr-1.5" /> {t("reset_answer")}
          </Button>
          <Button type="button" size="sm" onClick={check} disabled={bank.length > 0}>
            {t("check_answer")}
          </Button>
        </div>
      )}
    </div>
  );
}

// One quiz-style exercise: the four original single-shot types (pick a
// choice, or type an answer) plus the new "reorder" builder above.
function ExerciseView({
  exercise,
  dialect,
  t,
  answer,
  onAnswer,
}: {
  exercise: ExerciseRow;
  dialect: string;
  t: (key: TranslationKey) => string;
  answer?: string;
  onAnswer: (answer: string) => void;
}) {
  const prompt = exercise.prompt_json as {
    prompt: string;
    choices?: string[];
    hint_sorani?: string;
    hint_badini?: string;
  };
  const answerData = exercise.answer_json as { correct?: string };

  return (
    <div className="bento-card p-5 sm:p-8">
      <h2 className="font-display text-2xl font-semibold" dir="ltr">
        {prompt.prompt}
      </h2>
      {(dialect === "badini" ? prompt.hint_badini : prompt.hint_sorani) && (
        <p className="mt-2 text-sm text-muted-foreground">
          {dialect === "badini" ? prompt.hint_badini : prompt.hint_sorani}
        </p>
      )}
      <div className="mt-6">
        {exercise.type === "reorder" ? (
          <ReorderExercise
            correct={String(answerData.correct ?? "")}
            solved={!!answer}
            onSolved={onAnswer}
            t={t}
          />
        ) : prompt.choices ? (
          <div className="space-y-3">
            {prompt.choices.map((choice) => (
              <button
                key={choice}
                dir="ltr"
                onClick={() => onAnswer(choice)}
                className={`w-full text-left p-4 rounded-xl squircle border-2 transition-all ${
                  answer === choice
                    ? "border-primary-ink bg-primary/10"
                    : "border-border hover:border-primary/40 bg-card"
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
        ) : (
          <input
            dir="ltr"
            value={answer ?? ""}
            onChange={(e) => onAnswer(e.target.value)}
            className="w-full p-4 rounded-xl squircle border-2 border-border focus:border-primary-ink outline-none bg-card"
            placeholder="..."
          />
        )}
      </div>
    </div>
  );
}

function LessonRunner() {
  const { id } = Route.useParams();
  const { t, dialect } = useDialect();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getLesson);
  const submitFn = useServerFn(submitLessonQuiz);

  const { data, isLoading } = useQuery({
    queryKey: ["lesson", id],
    queryFn: () => fetchFn({ data: { lessonId: id } }),
  });

  const [step, setStep] = useState<Step>("intro");
  const [flowIdx, setFlowIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    correct: number;
    total: number;
  } | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          lessonId: id,
          answers: Object.entries(answers).map(([exerciseId, answer]) => ({ exerciseId, answer })),
        },
      }),
    onSuccess: (r) => {
      setResult(r);
      setStep("result");
      qc.invalidateQueries();
    },
  });

  const steps: LessonStep[] = Array.isArray(data?.lesson?.steps_json)
    ? (data?.lesson?.steps_json as LessonStep[])
    : [];
  const exercisesData = (data?.exercises ?? []) as ExerciseRow[];
  const flowItems = buildFlowItems(steps, exercisesData);
  const wordLangCode: string =
    (data?.lesson as unknown as { levels?: { language_code?: string } } | undefined)?.levels
      ?.language_code ?? "en";
  const current = flowItems[flowIdx];

  // Auto-play the pronunciation the moment a word/sentence step comes into view.
  useEffect(() => {
    if (step !== "flow" || !current || current.kind !== "step") return;
    const s = current.step;
    if (s.type === "word" || s.type === "sentence") {
      if (s.audio_url) {
        const audio = new Audio(s.audio_url);
        audio.play().catch(() => {
          /* autoplay may be blocked; the speaker button still works */
        });
      } else {
        speakText(s.target, wordLangCode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, flowIdx]);

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const lesson = data.lesson;
  const title =
    dialect === "badini"
      ? lesson.title_badini
      : dialect === "english"
        ? (lesson.title_en ?? lesson.title_sorani)
        : lesson.title_sorani;
  const grammar =
    dialect === "badini"
      ? lesson.grammar_md_badini
      : dialect === "english"
        ? (lesson.grammar_md_en ?? lesson.grammar_md_sorani)
        : lesson.grammar_md_sorani;
  const langCode: string =
    (lesson as unknown as { levels?: { language_code?: string } }).levels?.language_code ?? "en";

  // Shown on every step of the lesson so users can always jump straight back
  // to the course's lesson list (or the courses list for solo courses),
  // instead of only being able to go back one step/question at a time.
  const backToLessonsLink = data.isSoloCourse ? (
    <button
      onClick={() =>
        navigate({ to: "/learn/$lang", params: { lang: langCode as "en" | "de" | "ar" | "ko" } })
      }
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
    >
      <BackArrow dialect={dialect} className="h-3.5 w-3.5" />
      {t("courses")}
    </button>
  ) : (
    <button
      onClick={() => navigate({ to: "/course/$id", params: { id: lesson.course_id } })}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
    >
      <BackArrow dialect={dialect} className="h-3.5 w-3.5" />
      {t("back_to_course")}
    </button>
  );

  if (step === "intro") {
    return (
      <AppShell activeLang={langCode}>
        <div className="max-w-3xl mx-auto py-6">
          {backToLessonsLink}
          <h1 className="font-display text-3xl sm:text-4xl font-bold">{title}</h1>
          <div className="mt-8 bento-card p-5 sm:p-8 whitespace-pre-wrap leading-loose">
            {grammar}
          </div>
          {Array.isArray(lesson.dialogue_json) && lesson.dialogue_json.length > 0 && (
            <div className="mt-6 bento-card p-4 sm:p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                {t("dialogue")}
              </div>
              <div className="space-y-3">
                {(
                  lesson.dialogue_json as Array<{
                    speaker: string;
                    text: string;
                    translation_sorani?: string;
                    translation_badini?: string;
                  }>
                ).map((line, i) => (
                  <div key={i} className="border-r-4 border-primary/40 pr-4">
                    <div className="font-medium" dir="ltr">
                      <span className="text-muted-foreground">{line.speaker}:</span> {line.text}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {dialect === "badini" ? line.translation_badini : line.translation_sorani}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-8 flex justify-end">
            <Button
              size="lg"
              className="gradient-brand"
              onClick={() => {
                setFlowIdx(0);
                setStep("flow");
              }}
              disabled={flowItems.length === 0}
            >
              {t("start")} ({flowItems.length})
              <ForwardArrow dialect={dialect} className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "flow" && current) {
    const isLast = flowIdx === flowItems.length - 1;
    const answered = current.kind === "exercise" ? !!answers[current.exercise.id] : true;
    const goNext = () => setFlowIdx((i) => Math.min(flowItems.length - 1, i + 1));
    const goBack = () => setFlowIdx((i) => Math.max(0, i - 1));

    return (
      <AppShell activeLang={langCode}>
        <div className="max-w-2xl mx-auto py-6">
          {backToLessonsLink}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>
                {flowIdx + 1} {t("of")} {flowItems.length}
              </span>
              <span className={current.kind === "exercise" ? "font-mono uppercase" : undefined}>
                {current.kind === "exercise" ? current.exercise.type : t("words_sentences")}
              </span>
            </div>
            <Progress value={((flowIdx + 1) / flowItems.length) * 100} />
          </div>

          {current.kind === "step" ? (
            <StepView step={current.step} dialect={dialect} t={t} wordLangCode={wordLangCode} />
          ) : (
            <ExerciseView
              key={current.exercise.id}
              exercise={current.exercise}
              dialect={dialect}
              t={t}
              answer={answers[current.exercise.id]}
              onAnswer={(a) =>
                setAnswers((prev) => ({
                  ...prev,
                  [(current as Extract<FlowItem, { kind: "exercise" }>).exercise.id]: a,
                }))
              }
            />
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={goBack} disabled={flowIdx === 0}>
              {t("back")}
            </Button>
            {isLast ? (
              <Button
                onClick={() => submit.mutate()}
                disabled={!answered || submit.isPending}
                className="gradient-brand"
              >
                {submit.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {t("submit")}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!answered} className="gradient-brand">
                {t("next")}
              </Button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  // result
  return (
    <AppShell activeLang={langCode}>
      <div className="max-w-md mx-auto text-center py-16">
        <div className="text-left rtl:text-right">{backToLessonsLink}</div>
        <div
          className={`h-24 w-24 mx-auto rounded-full grid place-items-center shadow-elegant ${result?.passed ? "gradient-brand" : "bg-destructive/15"}`}
        >
          {result?.passed ? (
            <CheckCircle2 className="h-12 w-12 text-primary-foreground" />
          ) : (
            <XCircle className="h-12 w-12 text-destructive" />
          )}
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold">
          {result?.passed ? t("lesson_passed") : t("lesson_failed")}
        </h1>
        <div className="mt-4 text-6xl font-display font-bold text-primary-ink">
          {result?.score}%
        </div>
        <p className="mt-2 text-muted-foreground">
          {result?.correct} / {result?.total}
        </p>
        {!result?.passed && (
          <p className="mt-2 text-sm text-muted-foreground">{t("pass_threshold")}</p>
        )}

        <div className="mt-8 flex justify-center gap-3">
          {result?.passed ? (
            data.isSoloCourse ? (
              <Button asChild size="lg" className="gradient-brand">
                <Link to="/learn/$lang" params={{ lang: langCode as "en" | "de" | "ar" | "ko" }}>
                  {t("continue")}
                  <ForwardArrow dialect={dialect} className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="gradient-brand">
                <Link to="/course/$id" params={{ id: lesson.course_id }}>
                  {t("continue")}
                  <ForwardArrow dialect={dialect} className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )
          ) : (
            <Button
              size="lg"
              onClick={() => {
                setStep("intro");
                setFlowIdx(0);
                setAnswers({});
                setResult(null);
              }}
              className="gradient-brand"
            >
              <RotateCw className="ml-2 h-4 w-4" />
              {t("retry")}
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <a href="/dashboard">{t("dashboard")}</a>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
