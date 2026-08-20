import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCourse } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import { AppShell } from "@/components/app-shell";
import { BackArrow } from "@/components/dir-arrow";
import { Loader2 } from "lucide-react";
import { LessonPath } from "@/components/lesson-path";

const paramsSchema = z.object({ id: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/course/$id")({
  parseParams: (p) => paramsSchema.parse(p),
  component: CourseView,
});

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
        <Link to="/learn/$lang" params={{ lang: langCode as "en" | "de" | "ar" | "ko" }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <BackArrow dialect={dialect} className="h-3.5 w-3.5" />
          {t("courses")}
        </Link>
        <div className="flex items-center gap-3">
          {cefr && (
            <div className="h-11 w-11 rounded-xl squircle grid place-items-center gradient-brand text-primary-foreground font-display text-sm font-bold shrink-0">
              {cefr}
            </div>
          )}
          <h1 className="font-display text-3xl sm:text-4xl font-bold">{title}</h1>
        </div>
        {description && <p className="mt-3 text-muted-foreground max-w-xl">{description}</p>}

        <div className="mt-8">
          {data.lessons.length === 0 ? (
            <p className="text-muted-foreground">{t("no_data")}</p>
          ) : (
            <LessonPath lessons={data.lessons} dialect={dialect} t={t} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
