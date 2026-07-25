import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getVideos } from "@/lib/learn.functions";
import { supabase } from "@/integrations/supabase/client";
import { useDialect } from "@/hooks/use-dialect";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle } from "lucide-react";

const paramsSchema = z.object({ lang: z.enum(["en", "de", "ar", "ko"]) });

// "all" is a UI-only filter value (not sent to the server); the rest match the
// public.video_category enum in the database.
const CATEGORY_FILTERS = ["all", "podcast", "animation", "movie", "show", "talking", "music", "documentary", "news", "other"] as const;
type CategoryFilter = (typeof CATEGORY_FILTERS)[number];

function getVideoThumbnail(bannerPath: string | null | undefined, youtubeId: string | null | undefined): string | null {
  if (bannerPath) {
    return supabase.storage.from("video-banners").getPublicUrl(bannerPath).data.publicUrl;
  }
  if (youtubeId) {
    return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  }
  return null;
}

export const Route = createFileRoute("/_authenticated/videos/$lang")({
  parseParams: (p) => paramsSchema.parse(p),
  component: Videos,
});

function Videos() {
  const { lang } = Route.useParams();
  const { t } = useDialect();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const fn = useServerFn(getVideos);
  const { data, isLoading } = useQuery({
    queryKey: ["videos", lang, category],
    queryFn: () => fn({ data: category === "all" ? { language: lang } : { language: lang, category } }),
  });

  if (isLoading) return <AppShell activeLang={lang}><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;

  return (
    <AppShell activeLang={lang}>
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-6">{t("video_practice")}</h1>
        <div className="flex gap-2 mb-8 flex-wrap">
          {CATEGORY_FILTERS.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={category === c ? "default" : "outline"}
              onClick={() => setCategory(c)}
            >
              {t(c === "all" ? "video_category_all" : (`video_category_${c}` as never))}
            </Button>
          ))}
        </div>
        {(data?.videos ?? []).length === 0 ? (
          <p className="text-muted-foreground">{t("no_words")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(data?.videos ?? []).map((v) => {
              const thumbnail = getVideoThumbnail(v.banner_path, v.youtube_id);
              return (
              <Link key={v.id} to="/video/$id" params={{ id: v.id }} className="bento-card overflow-hidden group hover:scale-[1.02] transition-transform">
                <div className="relative aspect-[4/3] bg-muted">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={v.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <PlayCircle className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors grid place-items-center">
                    <PlayCircle className="h-14 w-14 text-white drop-shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs font-bold">{v.level_cefr}</div>
                </div>
                <div className="p-4">
                  {v.category && (
                    <Badge variant="secondary" className="mb-1.5">
                      {t(`video_category_${v.category}` as never)}
                    </Badge>
                  )}
                  <div className="font-display font-semibold line-clamp-2" dir="ltr">{v.title}</div>
                  {v.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.description}</div>}
                </div>
              </Link>
            );})}
          </div>
        )}
      </div>
    </AppShell>
  );
}
