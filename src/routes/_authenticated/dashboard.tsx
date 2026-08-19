import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getDashboard, updateActiveLanguage } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlagIcon } from "@/components/flag-icon";
import { ForwardArrow } from "@/components/dir-arrow";
import { Loader2, Flame, Trophy, BookOpen, PlayCircle, Library, Target, Sparkles } from "lucide-react";

// Languages with real authored lesson/vocab/video content. Everything else in
// the `languages` table still shows up in the switcher, just muted and
// labeled "coming soon" instead of being clickable — move a code in here
// once it actually has content behind it.
const AVAILABLE_LANGS: readonly string[] = ["en"];

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { t, dialect } = useDialect();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dash = useServerFn(getDashboard);
  const setLang = useServerFn(updateActiveLanguage);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dash({ data: {} }),
  });

  const langMut = useMutation({
    mutationFn: (language: "en" | "de" | "ar" | "ko") => setLang({ data: { language } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  useEffect(() => {
    if (!isLoading && data && !data.profile?.onboarding_completed_at) {
      navigate({ to: "/onboarding" });
    }
  }, [data, isLoading, navigate]);

  if (isLoading || !data) {
    return <AppShell><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary-ink" /></div></AppShell>;
  }

  const nameFor = (l: { name_sorani: string; name_badini: string; name_en: string }) =>
    dialect === "sorani" ? l.name_sorani : dialect === "badini" ? l.name_badini : l.name_en;

  const lang = (data.languages ?? []).find((l) => l.code === data.activeLang);
  const langLabel = lang ? nameFor(lang) : "";
  const displayName = data.profile?.display_name ?? "";
  const availableLanguages = (data.languages ?? []).filter((l) => AVAILABLE_LANGS.includes(l.code));
  const comingSoonLanguages = (data.languages ?? []).filter((l) => !AVAILABLE_LANGS.includes(l.code));

  return (
    <AppShell activeLang={data.activeLang ?? undefined}>
      {/* Header row */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{t("welcome_back")} 👋</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">{displayName}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {availableLanguages.map((l) => (
              <button
                key={l.code}
                type="button"
                disabled={langMut.isPending}
                onClick={() => l.code !== data.activeLang && langMut.mutate(l.code as "en" | "de" | "ar" | "ko")}
                className={`px-3 py-1.5 rounded-lg squircle text-sm border transition-colors disabled:opacity-60 ${
                  l.code === data.activeLang
                    ? "bg-primary text-primary-foreground border-primary-ink"
                    : "border-border bg-card hover:bg-accent"
                }`}
                title={l.name_en}
              >
                <span className="mr-1"><FlagIcon code={l.code} /></span>
                {nameFor(l)}
              </button>
            ))}
          </div>
          {comingSoonLanguages.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {comingSoonLanguages.map((l) => (
                <div
                  key={l.code}
                  title={l.name_en}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg squircle text-sm border border-border bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                >
                  <span className="mr-0.5 grayscale"><FlagIcon code={l.code} /></span>
                  {nameFor(l)}
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {t("coming_soon")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 auto-rows-[minmax(120px,auto)]">
        {/* Big continue card */}
        <div className="sm:col-span-2 lg:col-span-4 lg:row-span-2 bento-card p-5 sm:p-8 relative overflow-hidden">
          <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-primary/8 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> {t("continue_learning")}
            </div>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-semibold">
              {data.recentLesson
                ? (dialect === "badini"
                    ? data.recentLesson.title_badini
                    : dialect === "english"
                    ? (data.recentLesson.title_en ?? data.recentLesson.title_sorani)
                    : data.recentLesson.title_sorani)
                : `${langLabel} • ${data.level?.current_cefr ?? "A1"}`}
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md">
              {data.recentLesson ? t("continue_lesson") : t("hero_sub")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {data.recentLesson ? (
                <Button asChild size="lg" className="gradient-brand shadow-elegant">
                  <Link to="/lesson/$id" params={{ id: data.recentLesson.id }}>
                    {t("continue")}
                    <ForwardArrow dialect={dialect} className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="gradient-brand shadow-elegant">
                  <Link to="/learn/$lang" params={{ lang: data.activeLang ?? "en" }}>
                    {t("start")}
                    <ForwardArrow dialect={dialect} className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link to="/learn/$lang" params={{ lang: data.activeLang ?? "en" }}>{t("courses")}</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Streak */}
        <div className="lg:col-span-2 bento-card p-6 gradient-sun">
          <Flame className="h-6 w-6" />
          <div className="mt-3 text-4xl font-display font-bold">{data.profile?.streak_count ?? 0}</div>
          <div className="text-sm mt-1 opacity-80">{t("streak")} • {t("days")}</div>
        </div>

        {/* Level badge */}
        <div className="lg:col-span-2 bento-card p-6">
          <Trophy className="h-6 w-6 text-gold-ink" />
          <div className="mt-3 text-4xl font-display font-bold text-primary-ink">
            {data.level?.current_cefr ?? "A1"}
          </div>
          <div className="text-sm mt-1 text-muted-foreground">{t("current_level")} • {langLabel}</div>
        </div>

        {/* Words learned */}
        <div className="lg:col-span-2 bento-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("words_learned")}</div>
          <div className="mt-2 text-3xl font-display font-bold">{data.wordsLearnedCount}</div>
        </div>

        {/* Lessons completed */}
        <div className="lg:col-span-2 bento-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("lessons_completed")}</div>
          <div className="mt-2 text-3xl font-display font-bold">{data.completedCount}</div>
        </div>

        {/* Due for review */}
        <div className="lg:col-span-2 bento-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("due_for_review")}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-3xl font-display font-bold">{data.dueCount}</div>
            <div className="text-sm text-muted-foreground">{t("vocabulary")}</div>
          </div>
        </div>

        {/* Vocab quick access */}
        <Link to="/vocab/$lang" params={{ lang: data.activeLang ?? "en" }} className="lg:col-span-2 bento-card p-6 flex items-start justify-between hover:bg-accent/40 transition-colors">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("vocabulary")}</div>
            <div className="mt-1 font-display text-xl font-semibold">{t("flashcards")}</div>
          </div>
          <BookOpen className="h-8 w-8 text-primary-ink" />
        </Link>

        {/* Videos quick access */}
        <Link to="/videos/$lang" params={{ lang: data.activeLang ?? "en" }} className="lg:col-span-2 bento-card p-6 flex items-start justify-between hover:bg-accent/40 transition-colors">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("videos")}</div>
            <div className="mt-1 font-display text-xl font-semibold">{t("video_practice")}</div>
          </div>
          <PlayCircle className="h-8 w-8 text-primary-ink" />
        </Link>

        {/* Books quick access */}
        <Link to="/books/$lang" params={{ lang: data.activeLang ?? "en" }} className="lg:col-span-2 bento-card p-6 flex items-start justify-between hover:bg-accent/40 transition-colors">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("books")}</div>
            <div className="mt-1 font-display text-xl font-semibold">{t("book_practice")}</div>
          </div>
          <Library className="h-8 w-8 text-primary-ink" />
        </Link>
      </div>
    </AppShell>
  );
}
