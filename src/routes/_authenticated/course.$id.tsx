import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCourse } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import { AppShell } from "@/components/app-shell";
import { Loader2, Lock, CheckCircle2, PlayCircle } from "lucide-react";

const paramsSchema = z.object({ id: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/course/$id")({
  parseParams: (p) => paramsSchema.parse(p),
  component: CourseView,
});

interface LessonNode {
  id: string;
  title_sorani: string;
  title_badini: string;
  title_en: string | null;
  summary_sorani: string | null;
  summary_badini: string | null;
  summary_en: string | null;
  passed: boolean;
  unlocked: boolean;
  score: number;
}

function CourseView() {
  const { id } = Route.useParams();
  const { t, dialect } = useDialect();
  const fn = useServerFn(getCourse);
  const { data, isLoading } = useQuery({
    queryKey: ["course", id],
    queryFn: () => fn({ data: { courseId: id } }),
  });

  if (isLoading || !data) {
    return <AppShell><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  }

  const course = data.course;
  const langCode: string = (course as unknown as { levels?: { language_code?: string } }).levels?.language_code ?? "en";
  const cefr: string = (course as unknown as { levels?: { cefr?: string } }).levels?.cefr ?? "";
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

  return (
    <AppShell activeLang={langCode}>
      <div className="max-w-3xl mx-auto py-6">
        <Link to="/learn/$lang" params={{ lang: langCode as "en" | "de" | "ar" | "ko" }} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">← {t("courses")}</Link>
        <div className="flex items-center gap-3">
          {cefr && (
            <div className="h-11 w-11 rounded-xl squircle grid place-items-center gradient-brand text-primary-foreground font-display text-sm font-bold shrink-0">
              {cefr}
            </div>
          )}
          <h1 className="font-display text-3xl sm:text-4xl font-bold">{title}</h1>
        </div>
        {description && <p className="mt-3 text-muted-foreground max-w-xl">{description}</p>}

        <div className="mt-8 grid gap-3">
          {data.lessons.length === 0 ? (
            <p className="text-muted-foreground">{t("no_data")}</p>
          ) : (
            data.lessons.map((l: LessonNode) => (
              <LessonNode key={l.id} lesson={l} dialect={dialect} disabled={!l.unlocked} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

function LessonNode({ lesson, dialect, disabled }: {
  lesson: LessonNode;
  dialect: "sorani" | "badini" | "english";
  disabled: boolean;
}) {
  const title = dialect === "badini"
    ? lesson.title_badini
    : dialect === "english"
    ? (lesson.title_en ?? lesson.title_sorani)
    : lesson.title_sorani;
  const summary = dialect === "badini"
    ? lesson.summary_badini
    : dialect === "english"
    ? (lesson.summary_en ?? lesson.summary_sorani)
    : lesson.summary_sorani;

  const inner = (
    <div className={`bento-card p-5 flex items-start gap-4 ${disabled ? "opacity-50" : "hover:scale-[1.01] transition-transform"}`}>
      <div className={`h-11 w-11 rounded-xl squircle grid place-items-center shrink-0 ${
        lesson.passed ? "bg-success/15 text-success-ink" :
        lesson.unlocked ? "bg-gold/15 text-gold-ink" :
        "bg-muted text-muted-foreground"
      }`}>
        {lesson.passed ? <CheckCircle2 className="h-5 w-5" /> :
         lesson.unlocked ? <PlayCircle className="h-5 w-5" /> :
         <Lock className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold">{title}</div>
        {summary && <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{summary}</div>}
        {lesson.passed && <div className="text-xs text-success-ink mt-2">{lesson.score}%</div>}
      </div>
    </div>
  );

  return disabled ? inner : <Link to="/lesson/$id" params={{ id: lesson.id }}>{inner}</Link>;
}
