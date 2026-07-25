import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { z } from "zod";
import { getVideo } from "@/lib/learn.functions";
import { supabase } from "@/integrations/supabase/client";
import { useDialect } from "@/hooks/use-dialect";
import type { TranslationKey } from "@/i18n/sorani";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({ id: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/video/$id")({
  parseParams: (p) => paramsSchema.parse(p),
  component: VideoView,
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

interface TranscriptLine { 
  t?: number; 
  en: string; 
  ku_sorani?: string; 
  ku_badini?: string; 
  highlights?: WordHighlight[] 
}

function tokenizeWords(text: string): string[] {
  return (text || "").split(/\s+/).filter(Boolean);
}

const POS_KEYS = ["noun", "verb", "adjective", "adverb", "phrase", "other"] as const;

interface TextSegment { text: string; highlight?: WordHighlight }

function buildSegments(words: string[], highlights: WordHighlight[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let i = 0;
  while (i < words.length) {
    const hl = highlights.find((h) => h.start_index === i && h.end_index >= i && h.end_index < words.length);
    if (hl) {
      segments.push({ text: words.slice(hl.start_index, hl.end_index + 1).join(" "), highlight: hl });
      i = hl.end_index + 1;
    } else {
      segments.push({ text: words[i] });
      i += 1;
    }
  }
  return segments;
}

function TranscriptLineText({ 
  line, 
  active, 
  dialect, 
  t,
  onHighlightClick,
  onHighlightClose
}: { 
  line: TranscriptLine; 
  active: boolean; 
  dialect: string; 
  t: (key: TranslationKey) => string;
  onHighlightClick: () => void;
  onHighlightClose: () => void;
}) {
  const words = tokenizeWords(line.en);
  const segments = buildSegments(words, line.highlights ?? []);
  return (
    <div
      dir="ltr"
      className={cn(
        "text-lg sm:text-2xl lg:text-3xl leading-snug tracking-tight break-words transition-colors",
        active ? "text-foreground font-bold" : "text-muted-foreground font-semibold",
      )}
    >
      {segments.map((seg, idx) => (
        <span key={idx}>
          {idx > 0 && " "}
          {seg.highlight ? (
            <Popover onOpenChange={(open) => {
              if (!open) onHighlightClose();
            }}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onHighlightClick();
                  }}
                  className="underline decoration-dotted decoration-2 underline-offset-4 hover:opacity-75 rounded transition"
                >
                  {seg.text}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)]" onClick={(e) => e.stopPropagation()}>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-semibold text-base" dir="ltr">{seg.text}</span>
                    <Badge variant="secondary">
                      {(POS_KEYS as readonly string[]).includes(seg.highlight.part_of_speech)
                        ? t(`pos_${seg.highlight.part_of_speech}` as never)
                        : seg.highlight.part_of_speech}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("meaning_english")}</div>
                    <div dir="ltr" className="text-sm">{seg.highlight.meaning_en || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("meaning_kurdish")}</div>
                    <div className="text-sm font-kurdish">
                      {dialect === "sorani"
                        ? (seg.highlight.meaning_ku_sorani || seg.highlight.meaning_ku_badini || "—")
                        : dialect === "badini"
                        ? (seg.highlight.meaning_ku_badini || seg.highlight.meaning_ku_sorani || "—")
                        : (seg.highlight.meaning_ku_sorani || seg.highlight.meaning_ku_badini || "—")}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            seg.text
          )}
        </span>
      ))}
    </div>
  );
}

function VideoView() {
  const { id } = Route.useParams();
  const { t, dialect } = useDialect();
  const fn = useServerFn(getVideo);
  
  const { data, isLoading } = useQuery({
    queryKey: ["video", id],
    queryFn: () => fn({ data: { id } }),
  });

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const viewportRef = useRef<HTMLDivElement>(null);

  const videoPath = data?.video.video_path as string | null | undefined;
  const v = data?.video;
  const transcript: TranscriptLine[] = v && Array.isArray(v.transcript_json) ? (v.transcript_json as unknown as TranscriptLine[]) : [];

  // Fetch Signed Storage URL safely
  useEffect(() => {
    if (!videoPath) { setSignedUrl(null); return; }
    let isCurrent = true;

    supabase.storage.from("videos").createSignedUrl(videoPath, 3600).then(({ data: d }) => {
      if (isCurrent && d?.signedUrl) setSignedUrl(d.signedUrl);
    });

    return () => { isCurrent = false; };
  }, [videoPath]);

  // Duration safety net calculation
  useEffect(() => {
    if (transcript.length > 0 && duration === 0) {
      const calculatedEnd = (transcript[transcript.length - 1].t ?? 0) + 5;
      setDuration(calculatedEnd);
    }
  }, [transcript, duration]);

  const activeIdx = transcript.reduce((acc, l, i) => ((l.t ?? 0) <= currentTime + 0.05 ? i : acc), -1);

  // Auto-Follow scrolling tracker execution
  useLayoutEffect(() => {
    const idx = activeIdx >= 0 ? activeIdx : 0;
    const viewport = viewportRef.current;
    const activeEl = lineRefs.current[idx];
    if (!viewport || !activeEl) return;

    const recalc = () => {
      const offset = activeEl.offsetTop;
      setScrollOffset(Math.max(0, offset));
    };

    recalc();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(recalc);
    ro.observe(viewport);
    ro.observe(activeEl);

    return () => ro.disconnect();
  }, [activeIdx]);

  if (isLoading || !data || !v) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const seekTo = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(sec, duration));
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPercent = clickX / rect.width;
    seekTo(newPercent * duration);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const pauseVideo = () => {
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
    }
  };

  const playVideo = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const overallProgressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <AppShell activeLang={v.language_code}>
      {/* Container for the stacked video + transcript layout */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Header Title Context Layout */}
        <div className="flex items-start justify-between gap-4 flex-wrap pb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-lg sm:text-2xl font-bold text-foreground break-words" dir="ltr">
                {v.title}
              </h1>
              {v.category && <Badge variant="secondary">{t(`video_category_${v.category}` as never)}</Badge>}
            </div>
            {v.description && <p className="text-muted-foreground mt-1 text-sm break-words">{v.description}</p>}
          </div>
        </div>

        {/* Video always on top, transcript always below, at every screen size */}
        <div className="grid grid-cols-1 gap-6 items-start">
          
          {/* Safe, self-contained player frame column canvas */}
          <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-xl flex flex-col justify-between group">
            <div className="w-full flex items-center justify-center grow bg-neutral-950 pb-12 aspect-video">
              {videoPath ? (
                signedUrl ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain cursor-pointer block"
                    src={signedUrl}
                    playsInline
                    onClick={togglePlay}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-white/70" />
                )
              ) : (
                <div className="text-white/70">No video canvas source configured</div>
              )}
            </div>

            {/* Combined Actions & Timeline Controls Footer */}
            {videoPath && signedUrl && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-6 z-20 flex items-center gap-4 text-white">
                
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={togglePlay} className="hover:text-neutral-300 transition p-1">
                    {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
                  </button>
                  <button onClick={toggleMute} className="hover:text-neutral-300 transition p-1">
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <span className="text-xs text-neutral-300 font-mono tracking-tighter select-none min-w-[70px]">
                    {formatTime(currentTime)}
                  </span>
                </div>

                <div 
                  ref={timelineRef}
                  onClick={handleTimelineClick}
                  className="relative flex-1 h-1.5 bg-white/20 hover:h-2.5 transition-all cursor-pointer rounded-full overflow-visible group/timeline"
                >
                  <div 
                    className="absolute top-0 left-0 h-full bg-white rounded-full pointer-events-none"
                    style={{ width: `${overallProgressPercent}%` }}
                  />

                  {transcript.map((line, idx) => {
                    const startTime = line.t ?? 0;
                    const nextLine = transcript[idx + 1];
                    const endTime = nextLine ? (nextLine.t ?? startTime) : duration;
                    
                    const leftPercent = duration > 0 ? (startTime / duration) * 100 : 0;
                    const rightPercent = duration > 0 ? (endTime / duration) * 100 : 100;
                    const segmentWidth = rightPercent - leftPercent;

                    return (
                      <div
                        key={`hover-${idx}`}
                        className="absolute top-0 h-full group/seg cursor-pointer"
                        style={{ left: `${leftPercent}%`, width: `${segmentWidth}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          seekTo(startTime);
                        }}
                      >
                        <div className="absolute hidden group-hover/seg:block bottom-6 left-1/2 -translate-x-1/2 bg-neutral-950/95 text-white text-[11px] font-sans px-3 py-1.5 rounded border border-white/10 shadow-2xl whitespace-nowrap z-50 pointer-events-none">
                          <span className="text-neutral-400 font-bold mr-1.5">{formatTime(startTime)}</span> 
                          {line.en.substring(0, 30)}{line.en.length > 30 ? "..." : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </div>

          {/* Transcript Body Section Column */}
          <div className="w-full">
            <div
              ref={viewportRef}
              className="relative h-[420px] sm:h-[480px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden animate-in fade-in duration-300 border-t pt-8 pb-12"
              style={{
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 85%, transparent 100%)",
                maskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 85%, transparent 100%)",
              }}
            >
              {transcript.length === 0 ? (
                <p className="text-muted-foreground py-4">{t("no_words")}</p>
              ) : (
                <div
                  className="transition-transform duration-500 ease-out"
                  style={{ transform: `translateY(${-scrollOffset}px)` }}
                >
                  {transcript.map((line, i) => {
                    const active = i === activeIdx;
                    return (
                      <div
                        key={i}
                        ref={(el) => { lineRefs.current[i] = el; }}
                        onClick={() => seekTo(line.t ?? 0)}
                        className="py-3 cursor-pointer"
                      >
                        <TranscriptLineText 
                          line={line} 
                          active={active} 
                          dialect={dialect} 
                          t={t} 
                          onHighlightClick={pauseVideo}
                          onHighlightClose={playVideo}
                        />
                        {(line.ku_sorani || line.ku_badini) && (
                          <div className={cn("mt-1 text-sm font-kurdish break-words transition-colors", active ? "text-foreground/70" : "text-muted-foreground")}>
                            {dialect === "sorani" ? line.ku_sorani : dialect === "badini" ? line.ku_badini : (line.ku_sorani ?? line.ku_badini)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </AppShell>
  );
}
