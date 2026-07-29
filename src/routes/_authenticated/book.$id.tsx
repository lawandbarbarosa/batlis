import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { getBook } from "@/lib/learn.functions";
import { supabase } from "@/integrations/supabase/client";
import { useDialect } from "@/hooks/use-dialect";
import type { TranslationKey } from "@/i18n/sorani";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { hashText } from "@/lib/text-audio";

const paramsSchema = z.object({ id: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/book/$id")({
  parseParams: (p) => paramsSchema.parse(p),
  component: BookView,
});

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

interface BookParagraph {
  type?: "paragraph" | "image";
  text?: string;
  ku_sorani?: string;
  ku_badini?: string;
  highlights?: WordHighlight[];
  image_path?: string;
  caption?: string;
  /** Admin-uploaded, speech-recognized narration for this paragraph, if any (see the admin "Upload audio" panel). */
  audio_path?: string;
  audio_word_timings?: { start: number; end: number }[];
  audio_text_hash?: string;
}

function tokenizeWords(text?: string): string[] {
  return (text || "").split(/\s+/).filter(Boolean);
}

const POS_KEYS = ["noun", "verb", "adjective", "adverb", "phrase", "other"] as const;

interface TextSegment {
  text: string;
  highlight?: WordHighlight;
  wordStart: number;
  wordEnd: number;
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
        wordStart: hl.start_index,
        wordEnd: hl.end_index,
      });
      i = hl.end_index + 1;
    } else {
      segments.push({ text: words[i], wordStart: i, wordEnd: i });
      i += 1;
    }
  }
  return segments;
}

// Same tap-a-word-to-see-its-meaning interaction as the video transcript, plus an optional
// word-by-word highlight driven by read-aloud audio playback.
function ParagraphText({
  paragraph,
  dialect,
  t,
  activeWordIdx = -1,
}: {
  paragraph: BookParagraph;
  dialect: string;
  t: (key: TranslationKey) => string;
  activeWordIdx?: number;
}) {
  const words = tokenizeWords(paragraph.text);
  const segments = buildSegments(words, paragraph.highlights ?? []);
  return (
    <div
      dir="ltr"
      className="text-base sm:text-lg leading-relaxed tracking-tight break-words text-foreground"
    >
      {segments.map((seg, idx) => {
        const isActive = activeWordIdx >= seg.wordStart && activeWordIdx <= seg.wordEnd;
        return (
          <span
            key={idx}
            className={cn(
              "rounded transition-colors",
              isActive && "bg-primary text-primary-foreground",
            )}
          >
            {idx > 0 && " "}
            {seg.highlight ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="underline decoration-dotted decoration-2 underline-offset-4 hover:opacity-75 rounded transition"
                  >
                    {seg.text}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
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
                          ? seg.highlight.meaning_ku_sorani ||
                            seg.highlight.meaning_ku_badini ||
                            "—"
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
        );
      })}
    </div>
  );
}

function BookView() {
  const { id } = Route.useParams();
  const { t, dialect } = useDialect();
  const fn = useServerFn(getBook);

  const { data, isLoading } = useQuery({
    queryKey: ["book", id],
    queryFn: () => fn({ data: { id } }),
  });

  // Playback of admin-uploaded narration audio: one <audio> element shared across the
  // whole page, pointed at whichever paragraph is currently playing. Word timings for that
  // paragraph live in currentTimingsRef so the (frequent) timeupdate handler can look them
  // up without triggering a re-render on every tick. Only paragraphs with their own
  // audio_path (a real recording, transcribed by the admin) are playable — nothing is
  // generated here.
  const [playingParagraph, setPlayingParagraph] = useState<number | null>(null);
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const paragraphRefs = useRef<Array<HTMLDivElement | null>>([]);
  const currentTimingsRef = useRef<{ start: number; end: number }[]>([]);

  useEffect(() => {
    if (playingParagraph != null) {
      paragraphRefs.current[playingParagraph]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [playingParagraph]);

  useEffect(() => {
    // Deliberately read audioRef.current fresh in the cleanup (not a captured local): the
    // <audio> element only mounts once the book has finished loading, so capturing it here
    // at effect-setup time would just capture null.
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      audioRef.current?.pause();
    };
  }, []);

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const b = data.book;
  const content: BookParagraph[] = Array.isArray(b.content_json)
    ? (b.content_json as unknown as BookParagraph[])
    : [];
  const coverUrl = b.cover_path
    ? supabase.storage.from("book-covers").getPublicUrl(b.cover_path).data.publicUrl
    : null;

  const stopReading = () => {
    audioRef.current?.pause();
    currentTimingsRef.current = [];
    setPlayingParagraph(null);
    setActiveWordIdx(-1);
  };

  // Only paragraphs with their own uploaded, speech-recognized narration are playable —
  // "readable" here means "has audio", not just "has text".
  const findNextReadable = (fromIdx: number): number => {
    for (let k = fromIdx; k < content.length; k++) {
      const para = content[k];
      if (para.type !== "image" && para.audio_path) return k;
    }
    return -1;
  };

  const playParagraphAt = (idx: number) => {
    const para = content[idx];
    if (!para || para.type === "image" || !para.audio_path) {
      stopReading();
      return;
    }
    // Highlighting relies on wordTimings lining up 1:1 with the current text; if an admin
    // edited the paragraph after the audio was transcribed, skip highlighting rather than
    // show it drifting out of sync, but still play the audio itself.
    const stillMatches = para.audio_text_hash === hashText(para.text ?? "");
    currentTimingsRef.current = stillMatches ? (para.audio_word_timings ?? []) : [];
    setPlayingParagraph(idx);
    setActiveWordIdx(-1);
    if (audioRef.current) {
      audioRef.current.src = supabase.storage
        .from("book-audio")
        .getPublicUrl(para.audio_path).data.publicUrl;
      void audioRef.current.play().catch(() => {
        toast.error(t("book_audio_error"));
        stopReading();
      });
    }
  };

  const handleTimeUpdate = () => {
    const ct = audioRef.current?.currentTime ?? 0;
    const timings = currentTimingsRef.current;
    let idx = -1;
    for (let k = 0; k < timings.length; k++) {
      if (timings[k].start <= ct) idx = k;
      else break;
    }
    setActiveWordIdx(idx);
  };

  const handleEnded = () => {
    const next = findNextReadable((playingParagraph ?? -1) + 1);
    if (next === -1) stopReading();
    else playParagraphAt(next);
  };

  const handleAudioError = () => {
    toast.error(t("book_audio_error"));
    stopReading();
  };

  return (
    <AppShell activeLang={b.language_code}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <audio
          ref={audioRef}
          className="hidden"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={handleAudioError}
        />

        {/* Header */}
        <div className="flex items-start gap-4 pb-2">
          {coverUrl && (
            <img
              src={coverUrl}
              alt={b.title}
              className="h-28 w-20 sm:h-32 sm:w-24 rounded-lg object-cover shadow-md shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1
              className="font-display text-lg sm:text-2xl font-bold text-foreground break-words"
              dir="ltr"
            >
              {b.title}
            </h1>
            {b.author && (
              <p className="text-muted-foreground mt-1 text-sm break-words" dir="ltr">
                {b.author}
              </p>
            )}
            {b.description && (
              <p className="text-muted-foreground mt-1 text-sm break-words">{b.description}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground border-t pt-4">{t("tap_word_hint")}</p>

        {/* Content: paragraphs and any inline images, in the order the admin placed them */}
        <div>
          {content.length === 0 ? (
            <p className="text-muted-foreground py-4">{t("no_words")}</p>
          ) : (
            content.map((p, i) => {
              if (p.type === "image") {
                const url = p.image_path
                  ? supabase.storage.from("book-images").getPublicUrl(p.image_path).data.publicUrl
                  : null;
                if (!url) return null;
                return (
                  <div key={i} className="py-4 border-b border-border/60 last:border-b-0">
                    <img
                      src={url}
                      alt={p.caption || b.title}
                      className="w-full rounded-lg object-contain"
                    />
                    {p.caption && (
                      <p className="mt-2 text-xs text-muted-foreground text-center break-words">
                        {p.caption}
                      </p>
                    )}
                  </div>
                );
              }
              const isPlayingThis = playingParagraph === i;
              return (
                <div
                  key={i}
                  ref={(el) => {
                    paragraphRefs.current[i] = el;
                  }}
                  className="py-4 border-b border-border/60 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    {p.audio_path && (
                      <button
                        type="button"
                        onClick={() => (isPlayingThis ? stopReading() : playParagraphAt(i))}
                        aria-label={isPlayingThis ? t("stop_reading") : t("read_aloud")}
                        className="mt-0.5 shrink-0 h-8 w-8 rounded-full bg-primary/15 hover:bg-primary/25 text-primary-ink flex items-center justify-center transition-colors"
                      >
                        {isPlayingThis ? (
                          <Pause className="h-3.5 w-3.5 fill-current" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <ParagraphText
                        paragraph={p}
                        dialect={dialect}
                        t={t}
                        activeWordIdx={isPlayingThis ? activeWordIdx : -1}
                      />
                      {(p.ku_sorani || p.ku_badini) && (
                        <div className="mt-2 text-sm font-kurdish text-muted-foreground break-words">
                          {dialect === "sorani"
                            ? p.ku_sorani
                            : dialect === "badini"
                              ? p.ku_badini
                              : (p.ku_sorani ?? p.ku_badini)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
