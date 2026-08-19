import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { startPlacement, submitPlacement } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ForwardArrow } from "@/components/dir-arrow";
import { Loader2, CheckCircle2 } from "lucide-react";

const paramsSchema = z.object({ lang: z.enum(["en", "de", "ar", "ko"]) });
const searchSchema = z.object({ from: z.enum(["onboarding"]).optional() });

export const Route = createFileRoute("/_authenticated/placement/$lang")({
  parseParams: (p) => paramsSchema.parse(p),
  validateSearch: (s) => searchSchema.parse(s),
  component: Placement,
});

interface Q { id: string; difficulty_band: string; question_json: { prompt: string; choices: string[]; hint_sorani?: string; hint_badini?: string } }

function Placement() {
  const { lang } = Route.useParams();
  const { from } = Route.useSearch();
  const { t, dialect } = useDialect();
  const navigate = useNavigate();
  const startFn = useServerFn(startPlacement);
  const submitFn = useServerFn(submitPlacement);
  const continueTo = from === "onboarding" ? "/onboarding/commitment" : "/dashboard";

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<{ assigned: string; score: number; total: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["placement", lang],
    queryFn: () => startFn({ data: { language: lang } }),
  });

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          language: lang,
          answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        },
      }),
    onSuccess: (r) => setResult({ assigned: r.assigned, score: r.score, total: r.total }),
  });

  if (isLoading) return <AppShell><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;

  const questions = ((data?.questions ?? []) as unknown) as Q[];

  if (result) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="h-20 w-20 mx-auto rounded-full gradient-brand grid place-items-center shadow-elegant">
            <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">{t("placement_result")}</h1>
          <p className="mt-2 text-muted-foreground">{t("your_score")}: {result.score} / {result.total}</p>
          <div className="mt-8 bento-card p-5 sm:p-8">
            <p className="text-sm text-muted-foreground">{t("placement_assigned")}</p>
            <div className="mt-2 font-display text-6xl font-bold text-primary-ink">{result.assigned}</div>
          </div>
          <Button asChild size="lg" className="mt-8 gradient-brand">
            <a href={continueTo}>
              {from === "onboarding" ? t("continue") : t("go_to_dashboard")}
              <ForwardArrow dialect={dialect} className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (questions.length === 0) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-muted-foreground">{t("no_words")}</p>
          <Button asChild className="mt-6"><a href={continueTo}>{t("skip_placement")}</a></Button>
        </div>
      </AppShell>
    );
  }

  const q = questions[idx];
  const isLast = idx === questions.length - 1;
  const answered = !!answers[q.id];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto py-8">
        <div className="mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>{t("question")} {idx + 1} {t("of")} {questions.length}</span>
            <span className="font-mono">{q.difficulty_band}</span>
          </div>
          <Progress value={((idx + 1) / questions.length) * 100} />
        </div>

        <div className="bento-card p-5 sm:p-8">
          <h2 className="font-display text-2xl font-semibold" dir="ltr">{q.question_json.prompt}</h2>
          <div className="mt-6 space-y-3">
            {q.question_json.choices.map((choice) => (
              <button
                key={choice}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: choice }))}
                dir="ltr"
                className={`w-full text-left p-4 rounded-xl squircle border-2 transition-all ${
                  answers[q.id] === choice
                    ? "border-primary-ink bg-primary/10"
                    : "border-border hover:border-primary/40 bg-card"
                }`}
              >
                {choice}
              </button>
            ))}
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
