import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDialect } from "@/hooks/use-dialect";
import { DialectToggle } from "@/components/dialect-toggle";
import { Button } from "@/components/ui/button";
import { Sparkles, LayoutDashboard, BookOpen, PlayCircle, Library, Settings, LogOut, GraduationCap, Shield, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";


interface Props {
  children: React.ReactNode;
  activeLang?: string | null;
  showEmail?: boolean;
}

export function AppShell({ children, activeLang, showEmail = false }: Props) {
  const { t, dialect } = useDialect();
  const dir = dialect === "english" ? "ltr" : "rtl";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      if (data.user) {
        const { data: r } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
        setIsAdmin(Boolean(r));
      }
    });
  }, []);

  async function onSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success(t("signed_out"));
    router.navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  const nav = [
    { to: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    ...(activeLang
      ? [
          { to: `/learn/${activeLang}`, label: t("lessons"), icon: BookOpen },
          { to: `/vocab/${activeLang}`, label: t("vocabulary"), icon: Sparkles },
          { to: `/videos/${activeLang}`, label: t("videos"), icon: PlayCircle },
          { to: `/books/${activeLang}`, label: t("books"), icon: Library },
        ]
      : []),
    { to: "/grade-12", label: t("nav_grade12"), icon: GraduationCap },
    ...(isAdmin ? [{ to: "/admin", label: t("admin"), icon: Shield }] : []),
  ];

  return (
    <div dir={dir} className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt={t("app_name")} className="h-9 w-9 rounded-xl squircle object-cover shadow-soft" />
            <span className="font-display text-lg font-semibold">{t("app_name")}</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((n) => (
              <a
                key={n.to}
                href={n.to}
                className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1.5"
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </a>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-2">
            <DialectToggle />
            <Button asChild variant="ghost" size="icon" title={t("settings")}>
              <Link to="/settings"><Settings className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={onSignOut} title={t("sign_out")}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile & tablet: everything above collapses into a hamburger menu so the
              header row never has to fit nav links + dialect toggle + icons
              in one line on a narrow-to-medium screen. Full nav only shows at
              lg: (1024px+) since tablet widths (768-1023px) don't have room
              for 6 links + toggle + 2 icons in a max-w-7xl header. */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            title={t("menu")}
            aria-label={t("menu")}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-[85vw] max-w-sm flex flex-col">
              <SheetHeader>
                <SheetTitle className="text-left rtl:text-right font-display">{t("app_name")}</SheetTitle>
              </SheetHeader>
              <nav className="mt-2 flex flex-col gap-1">
                {nav.map((n) => (
                  <SheetClose asChild key={n.to}>
                    <a
                      href={n.to}
                      className="px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      <n.icon className="h-4 w-4" />
                      {n.label}
                    </a>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link
                    to="/settings"
                    className="px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    {t("settings")}
                  </Link>
                </SheetClose>
              </nav>
              <div className="mt-4">
                <DialectToggle />
              </div>
              <div className="mt-auto pt-4 border-t border-border/60 space-y-3">
                {showEmail && email && <div className="text-xs text-muted-foreground truncate">{email}</div>}
                <Button variant="outline" className="w-full" onClick={onSignOut}>
                  <LogOut className="h-4 w-4 ml-2" />
                  {t("sign_out")}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {showEmail && email && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-2 text-xs text-muted-foreground truncate hidden lg:block">
            {email}
          </div>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
