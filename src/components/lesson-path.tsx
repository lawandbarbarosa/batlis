// Duolingo-style winding lesson path: nodes drift left/right down the page
// instead of stacking as a plain list. Drop-in replacement for the old
// LessonNode row inside course.$id.tsx — same data, same click/lock
// behavior, just a different layout + a chunkier "pressable" node shape.
//
// Colors intentionally reuse the app's existing semantics (see the old
// LessonNode in course.$id.tsx): success/green = passed, gold = the one
// lesson that's next up, muted = locked. The trophy icon on every 5th node
// is purely decorative (this app has no "milestone" concept in the data
// yet) — drop the `isMilestone` bit below if you don't want it.
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Lock, Star, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n/sorani";

export interface LessonPathItem {
  id: string;
  title_sorani: string;
  title_badini: string;
  title_en: string | null;
  passed: boolean;
  unlocked: boolean;
  score: number;
}

// Repeating horizontal drift (px) that gives the path its wave. Tweak the
// numbers to make the path wider/narrower or the curve gentler/sharper.
const WAVE = [0, 56, 84, 56, 0, -56, -84, -56];

// Every Nth non-current node gets a trophy instead of a star, purely for
// visual rhythm — set to 0 to disable.
const MILESTONE_EVERY = 5;

export function LessonPath({
  lessons,
  dialect,
  t,
}: {
  lessons: LessonPathItem[];
  dialect: "sorani" | "badini" | "english";
  t: (key: TranslationKey) => string;
}) {
  // Path direction always reads top-to-bottom regardless of dialect, but
  // the left/right lean mirrors for RTL dialects so it drifts toward the
  // side the reader's eye naturally lands on.
  const mirror = dialect !== "english";
  const currentIndex = lessons.findIndex((l) => l.unlocked && !l.passed);

  return (
    <div className="relative mx-auto flex max-w-xs flex-col items-center py-8">
      {lessons.map((lesson, i) => {
        const offset = WAVE[i % WAVE.length] * (mirror ? -1 : 1);
        const isCurrent = i === currentIndex;
        const isMilestone = MILESTONE_EVERY > 0 && !isCurrent && !lesson.passed && (i + 1) % MILESTONE_EVERY === 0;
        return (
          <LessonBubble
            key={lesson.id}
            lesson={lesson}
            dialect={dialect}
            t={t}
            offset={offset}
            isCurrent={isCurrent}
            isMilestone={isMilestone}
            isLast={i === lessons.length - 1}
          />
        );
      })}
    </div>
  );
}

function LessonBubble({
  lesson,
  dialect,
  t,
  offset,
  isCurrent,
  isMilestone,
  isLast,
}: {
  lesson: LessonPathItem;
  dialect: "sorani" | "badini" | "english";
  t: (key: TranslationKey) => string;
  offset: number;
  isCurrent: boolean;
  isMilestone: boolean;
  isLast: boolean;
}) {
  const title = dialect === "badini" ? lesson.title_badini : dialect === "english" ? (lesson.title_en ?? lesson.title_sorani) : lesson.title_sorani;
  const disabled = !lesson.unlocked;
  const Icon = lesson.passed ? CheckCircle2 : disabled ? Lock : isMilestone ? Trophy : Star;

  const bubble = (
    <div className="relative flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
      {isCurrent && (
        <div className="absolute -top-11 flex flex-col items-center">
          <span className="rounded-xl border-2 border-gold-ink/40 bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold-foreground shadow-sm">
            {t("start")}
          </span>
          <span className="-mt-px h-2 w-2 rotate-45 border-b-2 border-r-2 border-gold-ink/40 bg-gold" />
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        aria-label={title}
        title={title}
        className={cn(
          "grid shrink-0 place-items-center rounded-full border-4 transition-all",
          isCurrent ? "h-20 w-20" : "h-16 w-16",
          disabled
            ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground shadow-[0_5px_0_0_rgb(0_0_0_/_10%)]"
            : lesson.passed
              ? "border-success/40 bg-success text-success-foreground shadow-[0_5px_0_0_var(--success-ink)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_2px_0_0_var(--success-ink)]"
              : "border-gold-ink/30 bg-gold text-gold-foreground shadow-[0_5px_0_0_var(--gold-ink)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_2px_0_0_var(--gold-ink)]",
          isCurrent && !disabled && "animate-pulse",
        )}
      >
        <Icon className={isCurrent ? "h-8 w-8" : "h-6 w-6"} strokeWidth={disabled ? 2 : 2.5} />
      </button>

      <span className="mt-2 max-w-[6.5rem] text-center text-xs font-semibold leading-snug text-muted-foreground line-clamp-2">
        {title}
      </span>
      {lesson.passed && lesson.score > 0 && (
        <span className="text-[11px] text-success-ink">{lesson.score}%</span>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-col items-center", !isLast && "mb-8")}>
      {disabled ? bubble : <Link to="/lesson/$id" params={{ id: lesson.id }}>{bubble}</Link>}
    </div>
  );
}
