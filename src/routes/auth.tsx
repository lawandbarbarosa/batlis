import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useDialect } from "@/hooks/use-dialect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DialectToggle } from "@/components/dialect-toggle";
import { FlagIcon } from "@/components/flag-icon";
import { BackArrow } from "@/components/dir-arrow";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

const credSchema = z.object({
  email: z.string().trim().email({ message: "ئیمەیل نادروستە" }).max(255),
  password: z.string().min(6, { message: "لانیکەم ٦ پیت" }).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const { t, dialect } = useDialect();
  const dir = dialect === "english" ? "ltr" : "rtl";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsed = credSchema.safeParse({ email, password, displayName: isSignup ? displayName : undefined });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? t("invalid_data"));
        return;
      }
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { display_name: parsed.data.displayName },
          },
        });
        if (error) throw error;
        toast.success(t("account_created"));
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success(t("welcome"));
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? t("signin_error"));
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir={dir} className="min-h-screen grid md:grid-cols-2">
      {/* Left visual */}
      <div className="hidden md:flex flex-col justify-between p-10 gradient-brand text-primary-foreground relative overflow-hidden">
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <img src="/logo.png" alt={t("app_name")} className="h-9 w-9 rounded-xl squircle object-cover" />
          <span className="font-display text-xl font-semibold">{t("app_name")}</span>
        </Link>
        <div className="relative z-10">
          <h2 className="font-display text-4xl font-bold leading-tight">{t("auth_welcome")}</h2>
          <p className="mt-3 text-primary-foreground/80 text-lg">{t("auth_welcome_sub")}</p>
        </div>
        <div className="relative z-10 flex items-center gap-1.5 text-sm opacity-50">
          <FlagIcon code="en" />
          <FlagIcon code="de" />
          <FlagIcon code="ar" />
          <FlagIcon code="ko" />
        </div>
        <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -top-20 -right-20 h-96 w-96 rounded-full bg-primary-glow/40 blur-3xl" />
      </div>

      {/* Right form */}
      <div className="flex flex-col p-6 md:p-10">
        <div className="flex justify-between items-center">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <BackArrow dialect={dialect} className="h-3.5 w-3.5" />
            {t("back")}
          </Link>
          <DialectToggle />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <h1 className="font-display text-3xl font-semibold">
              {isSignup ? t("sign_up") : t("sign_in")}
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">{t("auth_welcome_sub")}</p>

            <Button
              onClick={onGoogle}
              disabled={loading}
              variant="outline"
              className="mt-6 w-full"
              type="button"
            >
              <svg className="h-4 w-4 ml-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t("continue_with_google")}
            </Button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{t("or")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {isSignup && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t("display_name")}</Label>
                  <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" required maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" required minLength={6} maxLength={128} />
              </div>
              <Button type="submit" disabled={loading} className="w-full gradient-brand">
                {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {isSignup ? t("sign_up") : t("sign_in")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignup ? t("have_account") : t("no_account")}{" "}
              <Link
                to="/auth"
                search={{ mode: isSignup ? "signin" : "signup" }}
                className="text-primary-ink font-medium hover:underline"
              >
                {isSignup ? t("sign_in") : t("sign_up")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
