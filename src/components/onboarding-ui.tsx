import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useDialect } from "@/hooks/use-dialect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Shared building blocks for the multi-step signup wizard
// (/onboarding → /onboarding/target → /onboarding/purpose →
// /onboarding/level [→ /placement/$lang] → /onboarding/commitment →
// /dashboard). Deliberately minimal chrome — no dashboard nav, no way to
// wander off to another part of the app — so the five steps read as one
// linear flow instead of the regular app shell.

const TOTAL_STEPS = 5;

/**
 * Wraps every onboarding step. `step` is 0-indexed (0 = UI language, 4 =
 * commitment) and drives the progress dots in the header.
 */
export function OnboardingShell({
  step,
  backTo,
  children,
}: {
  step: number;
  backTo?: string;
  children: React.ReactNode;
}) {
  const { dialect } = useDialect();
  const dir = dialect === "english" ? "ltr" : "rtl";
  return (
    <div dir={dir} className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg squircle object-cover shadow-soft" />
          </Link>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i < step ? "w-6 bg-primary-ink" : i === step ? "w-8 bg-primary-ink/60" : "w-3 bg-border",
                )}
              />
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 pb-10">
        <div className="w-full max-w-2xl py-6">
          {backTo && (
            <Link to={backTo} className="inline-block mb-4 text-sm text-muted-foreground hover:text-foreground">
              ←
            </Link>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

export function OnboardingHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="text-center mb-8">
      <h1 className="font-display text-2xl sm:text-3xl font-bold">{title}</h1>
      {sub && <p className="mt-2 text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** One selectable card in an options grid (target language, purpose, level, etc). */
export function OptionCard({
  title,
  subtitle,
  badge,
  icon,
  selected,
  disabled,
  onClick,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: string;
  icon?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={cn(
        "bento-card p-4 sm:p-5 text-left w-full transition-all hover:scale-[1.01]",
        "disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed",
        selected && "ring-2 ring-primary-ink",
      )}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="shrink-0">{icon}</div>}
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold flex items-center gap-2 flex-wrap">
            {title}
            {badge && <Badge variant="secondary" className="text-[10px] font-normal">{badge}</Badge>}
          </div>
          {subtitle && <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
        {selected && <CheckCircle2 className="h-5 w-5 text-primary-ink shrink-0" />}
      </div>
    </button>
  );
}

/** The "show him a page on what he chose" confirmation screen between steps. */
export function ConfirmationPanel({
  title,
  body,
  ctaLabel,
  onContinue,
  pending,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  onContinue: () => void;
  pending?: boolean;
}) {
  return (
    <div className="text-center py-4 sm:py-8">
      <div className="h-16 w-16 mx-auto rounded-full gradient-brand grid place-items-center shadow-elegant mb-6">
        <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
      </div>
      <h2 className="font-display text-2xl sm:text-3xl font-bold">{title}</h2>
      <p className="mt-3 text-muted-foreground max-w-md mx-auto">{body}</p>
      <Button size="lg" className="mt-8 gradient-brand" onClick={onContinue} disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
        {ctaLabel}
      </Button>
    </div>
  );
}
