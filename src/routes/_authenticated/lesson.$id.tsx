import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { z } from "zod";
import { getLesson, submitLessonQuiz } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ForwardArrow, BackArrow } from "@/components/dir-arrow";
import { Loader2, CheckCircle2, XCircle, RotateCw, Volume2 } from "lucide-react";

const paramsSchema = z.object({ id: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/lesson/$id")({
  parseParams: (p) => paramsSchema.parse(p),
  component: LessonRunner,
});

type Step = "intro" | "words" | "exercises" | "result";

type LessonStep =
  | { type: "word"; target: string; kurdish_sorani?: string; kurdish_badini?: string; audio_url?: string; image_url?: string }
  | { type: "sentence"; target: string; kurdish_sorani?: string; kurdish_badini?: string; audio_url?: string; image_url?: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "tip"; text: string };

const TTS_LOCALE: Record<string, string> = { en: "en-US", de: "de-DE", ar: "ar-SA", ko: "ko-KR" };

function speakText(text: string, langCode: string) {
  if (typeof window === "undefined" || !text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = TTS_LOCALE[langCode] ?? "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
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
  const [wordIdx, setWordIdx] = useState(0);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number } | null>(null);

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

  const steps: LessonStep[] = Array.isArray(data?.lesson?.steps_json) ? (data?.lesson?.steps_json as LessonStep[]) : [];
  const wordLangCode: string = (data?.lesson as unknown as { levels?: { language_code?: string } } | undefined)?.levels?.language_code ?? "en";
  const currentWordStep = steps[wordIdx];

  // Auto-play the pronunciation the moment a word/sentence step comes into view.
  useEffect(() => {
    if (step !== "words" || !currentWordStep) return;
    if (currentWordStep.type === "word" || currentWordStep.type === "sentence") {
      if (currentWordStep.audio_url) {
        const audio = new Audio(currentWordStep.audio_url);
        audio.play().catch(() => { /* autoplay may be blocked; the speaker button still works */ });
      } else {
        speakText(currentWordStep.target, wordLangCode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, wordIdx]);

  if (isLoading || !data) {
    return <AppShell><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  }

  const lesson = data.lesson;
  const exercises = data.exercises;
  const title = dialect === "badini"
    ? lesson.title_badini
    : dialect === "english"
    ? (lesson.title_en ?? lesson.title_sorani)
    : lesson.title_sorani;
  const grammar = dialect === "badini"
    ? lesson.grammar_md_badini
    : dialect === "english"
    ? (lesson.grammar_md_en ?? lesson.grammar_md_sorani)
    : lesson.grammar_md_sorani;
  const langCode: string = (lesson as unknown as { levels?: { language_code?: string } }).levels?.language_code ?? "en";

  if (step === "intro") {
    return (
      <AppShell activeLang={langCode}>
        <div className="max-w-3xl mx-auto py-6">
          {data.isSoloCourse ? (
            <button onClick={() => navigate({ to: "/learn/$lang", params: { lang: langCode as "en" | "de" | "ar" | "ko" } })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
              <BackArrow dialect={dialect} className="h-3.5 w-3.5" />
              {t("courses")}
            </button>
          ) : (
            <button onClick={() => navigate({ to: "/course/$id", params: { id: lesson.course_id } })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
              <BackArrow dialect={dialect} className="h-3.5 w-3.5" />
              {t("back_to_course")}
            </button>
          )}
          <h1 className="font-display text-3xl sm:text-4xl font-bold">{title}</h1>
          <div className="mt-8 bento-card p-5 sm:p-8 whitespace-pre-wrap leading-loose">
            {grammar}
          </div>
          {Array.isArray(lesson.dialogue_json) && lesson.dialogue_json.length > 0 && (
            <div className="mt-6 bento-card p-4 sm:p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{t("dialogue")}</div>
              <div className="space-y-3">
                {(lesson.dialogue_json as Array<{ speaker: string; text: string; translation_sorani?: string; translation_badini?: string }>).map((line, i) => (
                  <div key={i} className="border-r-4 border-primary/40 pr-4">
                    <div className="font-medium" dir="ltr"><span className="text-muted-foreground">{line.speaker}:</span> {line.text}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {dialect === "badini" ? line.translation_badini : line.translation_sorani}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-8 flex justify-end">
            {steps.length > 0 ? (
              <Button size="lg" className="gradient-brand" onClick={() => { setWordIdx(0); setStep("words"); }}>
                {t("words_sentences")} ({steps.length})
                <ForwardArrow dialect={dialect} className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" className="gradient-brand" onClick={() => setStep("exercises")} disabled={exercises.length === 0}>
                {t("exercises")} ({exercises.length})
                <ForwardArrow dialect={dialect} className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "words") {
    const s = currentWordStep;
    const isLast = wordIdx === steps.length - 1;
    const goNext = () => { if (isLast) setStep("exercises"); else setWordIdx((i) => i + 1); };
    return (
      <AppShell activeLang={langCode}>
        <div className="max-w-2xl mx-auto py-6">
          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>{wordIdx + 1} {t("of")} {steps.length}</span>
              <span>{t("words_sentences")}</span>
            </div>
            <Progress value={((wordIdx + 1) / steps.length) * 100} />
          </div>

          <div className="bento-card p-6 sm:p-10 text-center min-h-[280px] flex flex-col justify-center">
            {(s?.type === "word" || s?.type === "sentence") && (
              <>
                {s.image_url && (
                  <img
                    src={s.image_url}
                    alt={s.target}
                    className="max-h-52 w-auto mx-auto mb-5 rounded-xl squircle object-contain"
                  />
                )}
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <div className={s.type === "word" ? "text-4xl sm:text-5xl font-display font-bold" : "text-2xl sm:text-3xl font-display font-semibold"} dir="ltr">
                    {s.target}
                  </div>
                  <button
                    onClick={() => (s.audio_url ? new Audio(s.audio_url).play().catch(() => {}) : speakText(s.target, wordLangCode))}
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
            {s?.type === "image" && (
              <div>
                <img src={s.url} alt={s.caption ?? ""} className="max-h-64 mx-auto rounded-xl squircle object-contain" />
                {s.caption && <div className="mt-3 text-sm text-muted-foreground">{s.caption}</div>}
              </div>
            )}
            {s?.type === "tip" && (
              <div className="text-lg leading-relaxed whitespace-pre-wrap">{s.text}</div>
            )}
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setWordIdx((i) => Math.max(0, i - 1))} disabled={wordIdx === 0}>
              {t("back")}
            </Button>
            <Button onClick={goNext} className="gradient-brand" disabled={isLast && exercises.length === 0}>
              {isLast ? `${t("exercises")} (${exercises.length})` : t("next")}
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "exercises") {
    const ex = exercises[idx];
    const prompt = ex.prompt_json as { prompt: string; choices?: string[]; hint_sorani?: string; hint_badini?: string };
    const answered = !!answers[ex.id];
    const isLast = idx === exercises.length - 1;
    return (
      <AppShell activeLang={langCode}>
        <div className="max-w-2xl mx-auto py-6">
          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>{t("question")} {idx + 1} {t("of")} {exercises.length}</span>
              <span className="font-mono uppercase">{ex.type}</span>
            </div>
            <Progress value={((idx + 1) / exercises.length) * 100} />
          </div>

          <div className="bento-card p-5 sm:p-8">
            <h2 className="font-display text-2xl font-semibold" dir="ltr">{prompt.prompt}</h2>
            {(dialect === "badini" ? prompt.hint_badini : prompt.hint_sorani) && (
              <p className="mt-2 text-sm text-muted-foreground">
                {dialect === "badini" ? prompt.hint_badini : prompt.hint_sorani}
              </p>
            )}
            <div className="mt-6 space-y-3">
              {prompt.choices ? (
                prompt.choices.map((choice) => (
                  <button
                    key={choice}
                    dir="ltr"
                    onClick={() => setAnswers((a) => ({ ...a, [ex.id]: choice }))}
                    className={`w-full text-left p-4 rounded-xl squircle border-2 transition-all ${
                      answers[ex.id] === choice ? "border-primary-ink bg-primary/10" : "border-border hover:border-primary/40 bg-card"
                    }`}
                  >
                    {choice}
                  </button>
                ))
              ) : (
                <input
                  dir="ltr"
                  value={answers[ex.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [ex.id]: e.target.value }))}
                  className="w-full p-4 rounded-xl squircle border-2 border-border focus:border-primary-ink outline-none bg-card"
                  placeholder="..."
                />
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              {t("back")}
            </Button>
            {isLast ? (
              <Button onClick={() => submit.mutate()} disabled={!answered || submit.isPending} className="gradient-brand">
                {submit.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {t("submit")}
              </Button>
            ) : (
              <Button onClick={() => setIdx((i) => i + 1)} disabled={!answered} className="gradient-brand">
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
        <div className={`h-24 w-24 mx-auto rounded-full grid place-items-center shadow-elegant ${result?.passed ? "gradient-brand" : "bg-destructive/15"}`}>
          {result?.passed ? <CheckCircle2 className="h-12 w-12 text-primary-foreground" /> : <XCircle className="h-12 w-12 text-destructive" />}
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold">
          {result?.passed ? t("lesson_passed") : t("lesson_failed")}
        </h1>
        <div className="mt-4 text-6xl font-display font-bold text-primary-ink">{result?.score}%</div>
        <p className="mt-2 text-muted-foreground">{result?.correct} / {result?.total}</p>
        {!result?.passed && <p className="mt-2 text-sm text-muted-foreground">{t("pass_threshold")}</p>}

        <div className="mt-8 flex justify-center gap-3">
          {result?.passed ? (
            data.isSoloCourse ? (
              <Button asChild size="lg" className="gradient-brand"><Link to="/learn/$lang" params={{ lang: langCode as "en" | "de" | "ar" | "ko" }}>{t("continue")}<ForwardArrow dialect={dialect} className="ml-2 h-4 w-4" /></Link></Button>
            ) : (
              <Button asChild size="lg" className="gradient-brand"><Link to="/course/$id" params={{ id: lesson.course_id }}>{t("continue")}<ForwardArrow dialect={dialect} className="ml-2 h-4 w-4" /></Link></Button>
            )
          ) : (
            <Button size="lg" onClick={() => { setStep("intro"); setIdx(0); setAnswers({}); setResult(null); }} className="gradient-brand">
              <RotateCw className="ml-2 h-4 w-4" />
              {t("retry")}
            </Button>
          )}
          <Button asChild variant="outline" size="lg"><a href="/dashboard">{t("dashboard")}</a></Button>
        </div>
      </div>
    </AppShell>
  );
}
