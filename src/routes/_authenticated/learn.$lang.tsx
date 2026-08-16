import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { getCourses } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import { AppShell } from "@/components/app-shell";
import { Loader2, Lock, CheckCircle2, BookOpen } from "lucide-react";

const paramsSchema = z.object({ lang: z.enum(["en", "de", "ar", "ko"]) });

export const Route = createFileRoute("/_authenticated/learn/$lang")({
  parseParams: (p) => paramsSchema.parse(p),
  component: Learn,
});

interface CourseCard {
  id: string;
  title_sorani: string;
  title_badini: string;
  title_en: string | null;
  description_sorani: string | null;
  description_badini: string | null;
  description_en: string | null;
  coverImageUrl: string | null;
  totalLessons: number;
  completedLessons: number;
  soloLessonId: string | null;
  soloPassed: boolean;
  soloScore: number;
}

interface LevelGroup {
  id: string;
  cefr: string;
  unlocked: boolean;
  courses: CourseCard[];
}

function Learn() {
  const { lang } = Route.useParams();
  const { t, dialect } = useDialect();
  const fn = useServerFn(getCourses);
  const { data, isLoading } = useQuery({
    queryKey: ["courses", lang],
    queryFn: () => fn({ data: { language: lang } }),
  });
  const [selectedCefr, setSelectedCefr] = useState<string | null>(null);

  const levels = useMemo(() => (data?.levels ?? []) as LevelGroup[], [data]);
  const activeCefr = selectedCefr ?? data?.currentCefr ?? levels[0]?.cefr ?? "A1";
  const activeLevel = useMemo(() => levels.find((l) => l.cefr === activeCefr) ?? levels[0], [levels, activeCefr]);

  if (isLoading) return <AppShell activeLang={lang}><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;

  return (
    <AppShell activeLang={lang}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6">
          <h1 className="font-display text-3xl font-bold">{t("courses")}</h1>
          <div className="text-sm text-muted-foreground">{t("current_level")}: <span className="font-bold text-primary-ink">{data?.currentCefr}</span></div>
        </div>

        {/* Level picker as horizontal chips on small screens, where a sidebar doesn't fit */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 lg:hidden">
          {levels.map((lvl) => (
            <LevelPill key={lvl.id} lvl={lvl} active={lvl.cefr === activeLevel?.cefr} onSelect={() => setSelectedCefr(lvl.cefr)} t={t} />
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Level sidebar. It's first in DOM order, which in this app's RTL layout
              places it on the right — exactly where a Kurdish-reading learner expects
              a primary navigation panel to sit. */}
          <aside className="hidden lg:flex lg:flex-col gap-2 w-44 shrink-0 lg:sticky lg:top-24">
            {levels.map((lvl) => (
              <LevelPill key={lvl.id} lvl={lvl} active={lvl.cefr === activeLevel?.cefr} onSelect={() => setSelectedCefr(lvl.cefr)} t={t} vertical />
            ))}
          </aside>

          <div className="flex-1 min-w-0 w-full">
            {!activeLevel || activeLevel.courses.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">{t("no_courses")}</div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeLevel.courses.map((c) => (
                  <CourseCardItem key={c.id} course={c} cefr={activeLevel.cefr} dialect={dialect} t={t} disabled={!activeLevel.unlocked} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function LevelPill({ lvl, active, onSelect, t, vertical }: {
  lvl: LevelGroup;
  active: boolean;
  onSelect: () => void;
  t: (key: never) => string;
  vertical?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`shrink-0 flex items-center gap-2 rounded-xl squircle border-2 transition-colors px-3 py-2 ${vertical ? "w-full" : ""} ${
        active ? "border-primary-ink bg-primary/10" : "border-border hover:border-primary/40 bg-card"
      }`}
    >
      <span className={`h-8 w-8 shrink-0 rounded-lg squircle grid place-items-center font-display text-xs font-bold ${
        lvl.unlocked ? "gradient-brand text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}>
        {lvl.unlocked ? lvl.cefr : <Lock className="h-3.5 w-3.5" />}
      </span>
      <span className="text-sm font-medium">{t("level" as never)} {lvl.cefr}</span>
    </button>
  );
}

function CourseCardItem({ course, cefr, dialect, t, disabled }: {
  course: CourseCard;
  cefr: string;
  dialect: "sorani" | "badini" | "english";
  t: (key: never) => string;
  disabled: boolean;
}) {
  const title = dialect === "badini"
    ? course.title_badini
    : dialect === "english"
    ? (course.title_en ?? course.title_sorani)
    : course.title_sorani;
  const description = dialect === "badini"
    ? course.description_badini
    : dialect === "english"
    ? (course.description_en ?? course.description_sorani)
    : course.description_sorani;
  const complete = course.totalLessons > 0 && course.completedLessons === course.totalLessons;
  const isSolo = !!course.soloLessonId;

  const inner = (
    <div className={`bento-card overflow-hidden ${disabled ? "opacity-50" : "hover:scale-[1.01] transition-transform"}`}>
      <div className="relative aspect-[4/3] bg-muted">
        {course.coverImageUrl ? (
          <img src={course.coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/10 to-gold/10">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className={`absolute top-2 left-2 h-8 w-8 rounded-lg squircle grid place-items-center shadow-elegant ${
          complete ? "bg-success/90 text-success-ink" :
          disabled ? "bg-muted text-muted-foreground" :
          "gradient-brand text-primary-foreground"
        }`}>
          {complete ? <CheckCircle2 className="h-4 w-4" /> : disabled ? <Lock className="h-4 w-4" /> : <span className="text-[10px] font-display font-bold">{cefr}</span>}
        </div>
      </div>
      <div className="p-4">
        <div className="font-display font-semibold">{title}</div>
        {description && <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</div>}
        {isSolo ? (
          course.soloPassed && <div className="text-xs text-success-ink mt-2">{course.soloScore}%</div>
        ) : (
          <div className="text-xs text-muted-foreground mt-2">
            {course.completedLessons}/{course.totalLessons} {t("lessons" as never)}
          </div>
        )}
      </div>
    </div>
  );

  if (disabled) return inner;
  // A course that wraps just one lesson is, for the learner, that lesson —
  // tapping it should start the lesson immediately, not open a course page
  // that only shows the one thing they just tapped.
  return course.soloLessonId
    ? <Link to="/lesson/$id" params={{ id: course.soloLessonId }}>{inner}</Link>
    : <Link to="/course/$id" params={{ id: course.id }}>{inner}</Link>;
}
