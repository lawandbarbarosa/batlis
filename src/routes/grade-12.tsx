import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDialect, type Dialect } from "@/hooks/use-dialect";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import type { Grade12Unit } from "@/data/grade12-curriculum";
import { BookOpen, CheckCircle2, PenLine, Lightbulb, GraduationCap, Loader2 } from "lucide-react";

/**
 * Public study companion for KRG (Kurdistan Region Government) Grade 12
 * students studying English — six units following the general themes of the
 * Sunrise 12 curriculum, each with a grammar focus, vocabulary, a reading
 * passage, a self-check quiz, and a writing prompt. No sign-in required and
 * no backend calls; all content and grading run entirely client-side.
 */
export const Route = createFileRoute("/grade-12")({
  ssr: false,
  component: Grade12Page,
});

interface Grade12UnitRow {
  id: string;
  number: number;
  title_en: string;
  title_sorani: string;
  title_badini: string | null;
  theme_en: string;
  theme_sorani: string;
  theme_badini: string | null;
  grammar_json: unknown;
  vocabulary_json: unknown;
  reading_title: string;
  reading_passage: string;
  quiz_json: unknown;
  writing_prompt: string;
}

function rowToUnit(row: Grade12UnitRow): Grade12Unit {
  const grammar = (row.grammar_json ?? {}) as Grade12Unit["grammar"];
  return {
    id: row.id,
    number: row.number,
    title_en: row.title_en,
    title_sorani: row.title_sorani,
    title_badini: row.title_badini ?? undefined,
    theme_en: row.theme_en,
    theme_sorani: row.theme_sorani,
    theme_badini: row.theme_badini ?? undefined,
    grammar: {
      name_en: grammar.name_en ?? "",
      name_sorani: grammar.name_sorani ?? "",
      name_badini: grammar.name_badini || undefined,
      explanation: grammar.explanation ?? "",
      examples: Array.isArray(grammar.examples) ? grammar.examples : [],
    },
    vocabulary: Array.isArray(row.vocabulary_json) ? (row.vocabulary_json as Grade12Unit["vocabulary"]) : [],
    reading: { title: row.reading_title, passage: row.reading_passage },
    quiz: Array.isArray(row.quiz_json) ? (row.quiz_json as Grade12Unit["quiz"]) : [],
    writingPrompt: row.writing_prompt,
  };
}

function Grade12Page() {
  const { t, dialect } = useDialect();
  const dir = dialect === "english" ? "ltr" : "rtl";

  const unitsQ = useQuery({
    queryKey: ["grade12-units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grade12_units").select("*").order("number");
      if (error) throw new Error(error.message);
      return (data ?? []).map(rowToUnit);
    },
  });
  const tipsQ = useQuery({
    queryKey: ["grade12-tips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grade12_exam_tips").select("*").order("order_index");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({ en: row.tip_en, sorani: row.tip_sorani }));
    },
  });

  const units = unitsQ.data ?? [];
  const tips = tipsQ.data ?? [];

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [checkedUnits, setCheckedUnits] = useState<Record<string, boolean>>({});

  const unit = units.find((u) => u.id === selectedUnitId) ?? units[0];

  if (unitsQ.isLoading || tipsQ.isLoading) {
    return (
      <div dir={dir} className="min-h-screen">
        <SiteHeader />
        <div className="flex justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary-ink" />
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!unit) {
    return (
      <div dir={dir} className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-32 text-center text-muted-foreground">
          {t("no_data")}
        </div>
        <SiteFooter />
      </div>
    );
  }

  const title =
    dialect === "badini"
      ? (unit.title_badini ?? unit.title_sorani)
      : dialect === "english"
        ? unit.title_en
        : unit.title_sorani;
  const themeText =
    dialect === "badini"
      ? (unit.theme_badini ?? unit.theme_sorani)
      : dialect === "english"
        ? unit.theme_en
        : unit.theme_sorani;
  const grammarName =
    dialect === "badini"
      ? (unit.grammar.name_badini ?? unit.grammar.name_sorani)
      : dialect === "english"
        ? unit.grammar.name_en
        : unit.grammar.name_sorani;

  const isChecked = !!checkedUnits[unit.id];
  const answeredCount = unit.quiz.filter((q) => quizAnswers[q.id] !== undefined).length;
  const allAnswered = answeredCount === unit.quiz.length;
  const correctCount = unit.quiz.filter((q) => quizAnswers[q.id] === q.correctIndex).length;

  function selectAnswer(questionId: string, choiceIndex: number) {
    if (isChecked) return;
    setQuizAnswers((a) => ({ ...a, [questionId]: choiceIndex }));
  }

  function checkAnswers() {
    setCheckedUnits((c) => ({ ...c, [unit.id]: true }));
  }

  function retryQuiz() {
    setCheckedUnits((c) => ({ ...c, [unit.id]: false }));
    setQuizAnswers((a) => {
      const next = { ...a };
      unit.quiz.forEach((q) => delete next[q.id]);
      return next;
    });
  }

  return (
    <div dir={dir} className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 pt-14 sm:pt-20 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm text-primary-ink mb-6">
          <GraduationCap className="h-4 w-4" />
          {t("grade12_eyebrow")}
        </div>
        <h1 className="text-4xl md:text-6xl font-display font-bold leading-tight text-primary-ink">
          {t("grade12_title")}
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {t("grade12_sub")}
        </p>
        <p className="mt-4 text-xs text-muted-foreground/80 max-w-xl mx-auto leading-relaxed">
          {t("grade12_disclaimer")}
        </p>
      </section>

      {/* Units + content */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        {/* Unit picker: horizontal chips on small screens, sidebar on large */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 lg:hidden">
          {units.map((u) => (
            <UnitPill
              key={u.id}
              unit={u}
              active={u.id === unit.id}
              dialect={dialect}
              onSelect={() => setSelectedUnitId(u.id)}
            />
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <aside className="hidden lg:flex lg:flex-col gap-2 w-64 shrink-0 lg:sticky lg:top-24">
            <div className="text-xs uppercase tracking-wider text-muted-foreground px-1 mb-1">
              {t("grade12_units_label")}
            </div>
            {units.map((u) => (
              <UnitPill
                key={u.id}
                unit={u}
                active={u.id === unit.id}
                dialect={dialect}
                onSelect={() => setSelectedUnitId(u.id)}
                vertical
              />
            ))}
          </aside>

          <div className="flex-1 min-w-0 w-full space-y-6">
            {/* Unit header */}
            <div className="bento-card p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-2">
                <span className="h-9 w-9 shrink-0 rounded-lg squircle gradient-brand grid place-items-center font-display text-sm font-bold text-primary-foreground">
                  {unit.number}
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-bold">{title}</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">{themeText}</p>
            </div>

            {/* Grammar focus */}
            <div className="bento-card p-6 sm:p-8">
              <SectionHeading icon={<Lightbulb className="h-5 w-5" />} label={t("grammar")} />
              <h3 className="font-display text-xl font-semibold mt-3" dir="ltr">
                {grammarName}
              </h3>
              <p className="mt-3 text-sm sm:text-base leading-relaxed" dir="ltr">
                {unit.grammar.explanation}
              </p>
              <ul className="mt-4 space-y-2">
                {unit.grammar.examples.map((ex, i) => (
                  <li
                    key={i}
                    dir="ltr"
                    className="text-sm sm:text-base bg-muted/60 rounded-lg squircle px-4 py-3 leading-relaxed"
                  >
                    {ex}
                  </li>
                ))}
              </ul>
            </div>

            {/* Vocabulary */}
            <div className="bento-card p-6 sm:p-8">
              <SectionHeading icon={<BookOpen className="h-5 w-5" />} label={t("vocabulary")} />
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                {unit.vocabulary.map((w) => {
                  const gloss = dialect === "badini" ? (w.badini ?? w.sorani) : w.sorani;
                  return (
                    <div key={w.word} className="rounded-xl squircle border border-border p-4">
                      <div className="flex items-baseline gap-2 flex-wrap" dir="ltr">
                        <span className="font-display font-semibold text-lg">{w.word}</span>
                        <span className="text-xs text-muted-foreground italic">{w.pos}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5" dir="ltr">
                        {w.meaning_en}
                      </div>
                      <div className="text-base font-kurdish mt-1.5" dir="rtl">
                        {gloss}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 leading-relaxed" dir="ltr">
                        &ldquo;{w.example}&rdquo;
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reading passage */}
            <div className="bento-card p-6 sm:p-8">
              <SectionHeading
                icon={<BookOpen className="h-5 w-5" />}
                label={t("grade12_reading")}
              />
              <h3 className="font-display text-xl font-semibold mt-3" dir="ltr">
                {unit.reading.title}
              </h3>
              <p className="mt-3 leading-loose text-[15px] sm:text-base" dir="ltr">
                {unit.reading.passage}
              </p>
            </div>

            {/* Practice quiz */}
            <div className="bento-card p-6 sm:p-8">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <SectionHeading icon={<CheckCircle2 className="h-5 w-5" />} label={t("quiz")} />
                {isChecked && (
                  <div className="text-sm font-semibold text-primary-ink">
                    {t("grade12_score_label")}: {correctCount}/{unit.quiz.length}
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-6">
                {unit.quiz.map((q, qi) => {
                  const selected = quizAnswers[q.id];
                  return (
                    <div key={q.id}>
                      <div className="font-medium" dir="ltr">
                        {qi + 1}. {q.prompt}
                      </div>
                      <div className="mt-2.5 grid gap-2">
                        {q.choices.map((choice, ci) => {
                          let stateClass = "border-border hover:border-primary/40 bg-card";
                          if (isChecked) {
                            if (ci === q.correctIndex) stateClass = "border-success bg-success/10";
                            else if (ci === selected)
                              stateClass = "border-destructive bg-destructive/10 text-destructive";
                            else stateClass = "border-border opacity-60";
                          } else if (selected === ci) {
                            stateClass = "border-primary-ink bg-primary/10";
                          }
                          return (
                            <button
                              key={ci}
                              type="button"
                              dir="ltr"
                              disabled={isChecked}
                              onClick={() => selectAnswer(q.id, ci)}
                              className={`w-full text-left rounded-lg squircle border-2 px-4 py-2.5 text-sm sm:text-base transition-colors disabled:cursor-default ${stateClass}`}
                            >
                              {choice}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex gap-3">
                {!isChecked ? (
                  <Button className="gradient-brand" disabled={!allAnswered} onClick={checkAnswers}>
                    {t("grade12_check_answers")}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={retryQuiz}>
                    {t("retry")}
                  </Button>
                )}
              </div>
            </div>

            {/* Writing practice */}
            <div className="bento-card p-6 sm:p-8">
              <SectionHeading
                icon={<PenLine className="h-5 w-5" />}
                label={t("grade12_writing_prompt")}
              />
              <p className="mt-3 leading-relaxed" dir="ltr">
                {unit.writingPrompt}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Exam tips */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 pb-16 sm:pb-24">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-8">
          {t("grade12_exam_tips_title")}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {tips.map((tip, i) => {
            const text = dialect === "english" ? tip.en : tip.sorani;
            return (
              <div key={i} className="bento-card p-5 flex gap-3">
                <span className="h-7 w-7 shrink-0 rounded-lg squircle bg-gold/15 text-primary-ink grid place-items-center font-display text-xs font-bold">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function SectionHeading({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-primary-ink">
      {icon}
      <span className="text-xs uppercase tracking-wider font-semibold">{label}</span>
    </div>
  );
}

function UnitPill({
  unit,
  active,
  dialect,
  onSelect,
  vertical,
}: {
  unit: Grade12Unit;
  active: boolean;
  dialect: Dialect;
  onSelect: () => void;
  vertical?: boolean;
}) {
  const title =
    dialect === "badini"
      ? (unit.title_badini ?? unit.title_sorani)
      : dialect === "english"
        ? unit.title_en
        : unit.title_sorani;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`shrink-0 flex items-center gap-2.5 rounded-xl squircle border-2 transition-colors px-3 py-2.5 text-left ${
        vertical ? "w-full" : ""
      } ${active ? "border-primary-ink bg-primary/10" : "border-border hover:border-primary/40 bg-card"}`}
    >
      <span
        className={`h-7 w-7 shrink-0 rounded-lg squircle grid place-items-center font-display text-xs font-bold ${
          active ? "gradient-brand text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {unit.number}
      </span>
      <span className="text-sm font-medium">{title}</span>
    </button>
  );
}
