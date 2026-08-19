// Directional arrows that flip with the active dialect instead of being
// hardcoded to one direction. Kurdish (Sorani/Badini) reads right-to-left,
// English reads left-to-right, so "forward" and "back" point opposite ways
// depending on which is active — a plain lucide <ArrowLeft /> only looks
// correct in one of the two directions. Use <ForwardArrow /> for CTAs like
// "Get started"/"Continue" (arrow trails the label) and <BackArrow /> for
// "Back"/"return" links (arrow leads the label), and pass whichever
// `dialect` the call site already has from useDialect().
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Dialect } from "@/hooks/use-dialect";

interface DirArrowProps {
  dialect: Dialect;
  className?: string;
}

/** Points the way reading naturally continues: right for English, left for Kurdish. */
export function ForwardArrow({ dialect, className }: DirArrowProps) {
  const Icon = dialect === "english" ? ArrowRight : ArrowLeft;
  return <Icon className={className} />;
}

/** Points "back"/"return" — the mirror of ForwardArrow. */
export function BackArrow({ dialect, className }: DirArrowProps) {
  const Icon = dialect === "english" ? ArrowLeft : ArrowRight;
  return <Icon className={className} />;
}
