import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getBooks } from "@/lib/learn.functions";
import { supabase } from "@/integrations/supabase/client";
import { useDialect } from "@/hooks/use-dialect";
import { AppShell } from "@/components/app-shell";
import { Loader2, BookOpen } from "lucide-react";

const paramsSchema = z.object({ lang: z.enum(["en", "de", "ar", "ko"]) });

function getBookCover(coverPath: string | null | undefined): string | null {
  if (coverPath) {
    return supabase.storage.from("book-covers").getPublicUrl(coverPath).data.publicUrl;
  }
  return null;
}

export const Route = createFileRoute("/_authenticated/books/$lang")({
  parseParams: (p) => paramsSchema.parse(p),
  component: Books,
});

function Books() {
  const { lang } = Route.useParams();
  const { t } = useDialect();
  const fn = useServerFn(getBooks);
  const { data, isLoading } = useQuery({
    queryKey: ["books", lang],
    queryFn: () => fn({ data: { language: lang } }),
  });

  if (isLoading) return <AppShell activeLang={lang}><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;

  return (
    <AppShell activeLang={lang}>
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-8">{t("book_practice")}</h1>
        {(data?.books ?? []).length === 0 ? (
          <p className="text-muted-foreground">{t("no_books")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(data?.books ?? []).map((b) => {
              const cover = getBookCover(b.cover_path);
              return (
                <Link key={b.id} to="/book/$id" params={{ id: b.id }} className="bento-card overflow-hidden hover:scale-[1.02] transition-transform">
                  <div className="relative aspect-[3/4] bg-muted">
                    {cover ? (
                      <img
                        src={cover}
                        alt={b.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center">
                        <BookOpen className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-background/90 text-xs font-bold">{b.level_cefr}</div>
                  </div>
                  <div className="p-4">
                    <div className="font-display font-semibold line-clamp-2" dir="ltr">{b.title}</div>
                    {b.author && <div className="text-xs text-muted-foreground mt-1 line-clamp-1" dir="ltr">{b.author}</div>}
                    {b.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.description}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
