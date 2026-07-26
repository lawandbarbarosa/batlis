import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout route. Every step under /onboarding/* (including the index
// step defined in onboarding.index.tsx) is a file-based child of this route
// because they all share the "onboarding" filename prefix — TanStack Router
// treats that as a parent/child relationship regardless of whether the
// child renders as a full page. This file's ONLY job is to render the
// <Outlet /> that lets those children actually appear; without it, every
// navigation between onboarding steps changes the URL but leaves the
// previous screen frozen on screen. Do not add page content or layout
// chrome here — that belongs in the individual step files, each of which
// already wraps itself in <OnboardingShell>.
export const Route = createFileRoute("/_authenticated/onboarding")({
  component: () => <Outlet />,
});
