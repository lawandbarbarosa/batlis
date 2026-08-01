import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDialect } from "@/hooks/use-dialect";
import { DialectToggle } from "@/components/dialect-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";

/**
 * Shared header for the public marketing site (Home / About / Pricing / Contact).
 * Distinct from `AppShell`, which is the header for the authenticated product
 * (dashboard, lessons, etc). Keeping these separate means the marketing nav
 * (About/Pricing/Contact) never leaks into the logged-in product experience,
 * and the authenticated nav never leaks into the public site.
 */
export function SiteHeader() {
  const { t, dialect } = useDialect();
  const dir = dialect === "english" ? "ltr" : "rtl";
  const [authed, setAuthed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const navLinks = [
    { to: "/" as const, label: t("nav_home") },
    { to: "/grade-12" as const, label: t("nav_grade12") },
    { to: "/about" as const, label: t("nav_about") },
    { to: "/pricing" as const, label: t("nav_pricing") },
    { to: "/contact" as const, label: t("nav_contact") },
  ];

  return (
    <header className="border-b border-border/60 backdrop-blur-sm bg-background/70 sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <img
            src="/logo.png"
            alt={t("app_name")}
            className="h-9 w-9 rounded-xl squircle object-cover shadow-soft"
          />
          <span className="font-display text-lg sm:text-xl font-semibold tracking-tight">
            {t("app_name")}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: true }}
              className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              activeProps={{ className: "!text-primary-ink font-semibold bg-accent/40" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2 sm:gap-3 shrink-0">
          <DialectToggle />
          {authed ? (
            <Button asChild size="sm">
              <Link to="/dashboard">{t("dashboard")}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth" search={{ mode: "signin" }}>
                  {t("sign_in")}
                </Link>
              </Button>
              <Button asChild size="sm" className="gradient-brand">
                <Link to="/auth" search={{ mode: "signup" }}>
                  {t("sign_up")}
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile: collapse nav + toggle + auth CTAs into a hamburger sheet. */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          title={t("menu")}
          aria-label={t("menu")}
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side={dir === "rtl" ? "left" : "right"}
            className="w-[85vw] max-w-sm flex flex-col"
          >
            <SheetHeader>
              <SheetTitle className="text-left rtl:text-right font-display">
                {t("app_name")}
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-2 flex flex-col gap-1">
              {navLinks.map((n) => (
                <SheetClose asChild key={n.to}>
                  <Link
                    to={n.to}
                    activeOptions={{ exact: true }}
                    className="px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors"
                    activeProps={{ className: "!bg-accent font-semibold" }}
                  >
                    {n.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-4">
              <DialectToggle />
            </div>
            <div className="mt-auto pt-4 border-t border-border/60 space-y-2">
              {authed ? (
                <SheetClose asChild>
                  <Button asChild className="w-full">
                    <Link to="/dashboard">{t("dashboard")}</Link>
                  </Button>
                </SheetClose>
              ) : (
                <>
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/auth" search={{ mode: "signin" }}>
                        {t("sign_in")}
                      </Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild className="w-full gradient-brand">
                      <Link to="/auth" search={{ mode: "signup" }}>
                        {t("sign_up")}
                      </Link>
                    </Button>
                  </SheetClose>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
