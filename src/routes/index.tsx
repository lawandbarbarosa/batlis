import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDialect } from "@/hooks/use-dialect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlagIcon } from "@/components/flag-icon";
import {
  BookOpen,
  Target,
  PlayCircle,
  Sparkles,
  ArrowLeft,
  Mic,
  Library,
  Languages,
  Accessibility,
  Heart,
  Route as RouteIcon,
  Gift,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { t, dialect } = useDialect();
  const dir = dialect === "english" ? "ltr" : "rtl";
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const stats = [
    { value: t("stat_languages_value"), label: t("stat_languages_label") },
    { value: t("stat_levels_value"), label: t("stat_levels_label") },
    { value: t("stat_dialects_value"), label: t("stat_dialects_label") },
    { value: t("stat_price_value"), label: t("stat_price_label") },
  ];

  const languages = [
    { code: "en", name: t("lang_english"), desc: t("lang_english_desc") },
    { code: "de", name: t("lang_german"), desc: t("lang_german_desc") },
    { code: "ar", name: t("lang_arabic"), desc: t("lang_arabic_desc") },
    { code: "ko", name: t("lang_korean"), desc: t("lang_korean_desc") },
  ];

  const features = [
    {
      icon: <Target className="h-6 w-6" />,
      title: t("feature_placement_title"),
      desc: t("feature_placement_desc"),
    },
    {
      icon: <BookOpen className="h-6 w-6" />,
      title: t("feature_tree_title"),
      desc: t("feature_tree_desc"),
    },
    {
      icon: <PlayCircle className="h-6 w-6" />,
      title: t("feature_video_title"),
      desc: t("feature_video_desc"),
    },
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: t("feature_vocab_title"),
      desc: t("feature_vocab_desc"),
    },
    {
      icon: <Mic className="h-6 w-6" />,
      title: t("feature_speak_title"),
      desc: t("feature_speak_desc"),
    },
    {
      icon: <Library className="h-6 w-6" />,
      title: t("feature_books_title"),
      desc: t("feature_books_desc"),
    },
    {
      icon: <Languages className="h-6 w-6" />,
      title: t("feature_dialect_title"),
      desc: t("feature_dialect_desc"),
    },
    {
      icon: <Accessibility className="h-6 w-6" />,
      title: t("feature_a11y_title"),
      desc: t("feature_a11y_desc"),
    },
  ];

  const steps = [
    { title: t("how_step1_title"), desc: t("how_step1_desc") },
    { title: t("how_step2_title"), desc: t("how_step2_desc") },
    { title: t("how_step3_title"), desc: t("how_step3_desc") },
    { title: t("how_step4_title"), desc: t("how_step4_desc") },
  ];

  const whyPoints = [
    {
      icon: <Heart className="h-6 w-6" />,
      title: t("why_point1_title"),
      desc: t("why_point1_desc"),
    },
    {
      icon: <Languages className="h-6 w-6" />,
      title: t("why_point2_title"),
      desc: t("why_point2_desc"),
    },
    {
      icon: <RouteIcon className="h-6 w-6" />,
      title: t("why_point3_title"),
      desc: t("why_point3_desc"),
    },
    {
      icon: <Gift className="h-6 w-6" />,
      title: t("why_point4_title"),
      desc: t("why_point4_desc"),
    },
  ];

  const faqs = [
    { q: t("faq_q1"), a: t("faq_a1") },
    { q: t("faq_q2"), a: t("faq_a2") },
    { q: t("faq_q3"), a: t("faq_a3") },
    { q: t("faq_q4"), a: t("faq_a4") },
    { q: t("faq_q5"), a: t("faq_a5") },
  ];

  return (
    <div dir={dir} className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 sm:pt-20 pb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm text-primary-ink mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t("tagline")}</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight text-primary-ink">
            {t("hero_title")}
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("hero_sub")}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gradient-brand shadow-elegant">
              <Link
                to={authed ? "/dashboard" : "/auth"}
                search={authed ? undefined : { mode: "signup" }}
              >
                <ArrowLeft className="ml-2 h-4 w-4" />
                {t("hero_cta")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/pricing">{t("hero_secondary_cta")}</Link>
            </Button>
          </div>

          <div className="mt-14 flex flex-wrap justify-center gap-3 sm:gap-4 text-5xl sm:text-6xl">
            <FlagIcon code="en" />
            <FlagIcon code="de" />
            <FlagIcon code="ar" />
            <FlagIcon code="ko" />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14 sm:pb-20">
        <div className="bento-card grid grid-cols-2 lg:grid-cols-4 divide-y divide-border lg:divide-y-0 lg:divide-x rtl:lg:divide-x-reverse">
          {stats.map((s) => (
            <div key={s.label} className="p-6 text-center">
              <div className="font-display text-3xl sm:text-4xl font-bold text-primary-ink">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Languages */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14 sm:pb-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">{t("languages_title")}</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">{t("languages_sub")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {languages.map((l) => (
            <div key={l.name} className="bento-card p-6 text-center">
              <div className="text-5xl mb-4">
                <FlagIcon code={l.code} />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{l.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{l.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14 sm:pb-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <Feature key={f.title} icon={f.icon} title={f.title} desc={f.desc} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14 sm:pb-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">{t("how_title")}</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">{t("how_sub")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="h-10 w-10 rounded-xl squircle gradient-brand grid place-items-center font-display font-bold mb-4">
                {i + 1}
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Batlis */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14 sm:pb-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">{t("why_title")}</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">{t("why_sub")}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {whyPoints.map((w) => (
            <div key={w.title} className="bento-card p-6 sm:p-8 flex gap-4">
              <div className="h-12 w-12 shrink-0 rounded-xl squircle bg-accent/20 text-accent-ink grid place-items-center">
                {w.icon}
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold mb-1">{w.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{w.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14 sm:pb-20">
        <div className="bento-card p-8 sm:p-12 text-center bg-gradient-to-br from-success/10 to-transparent">
          <Badge variant="success" className="mb-4">
            {t("stat_price_value")}
          </Badge>
          <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("home_pricing_title")}</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {t("home_pricing_sub")}
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/pricing">{t("home_pricing_cta")}</Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-14 sm:pb-20">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-8">
          {t("faq_title")}
        </h2>
        <Accordion type="single" collapsible className="bento-card px-6 sm:px-8">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`}>
              <AccordionTrigger className="font-display text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="gradient-brand rounded-3xl squircle p-10 sm:p-16 text-center shadow-elegant">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">{t("final_cta_title")}</h2>
          <p className="mt-3 max-w-xl mx-auto leading-relaxed text-black/80">
            {t("final_cta_sub")}
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-8 bg-black text-white hover:bg-black/85"
          >
            <Link
              to={authed ? "/dashboard" : "/auth"}
              search={authed ? undefined : { mode: "signup" }}
            >
              {t("final_cta_button")}
            </Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="bento-card p-6 sm:p-8">
      <div className="h-12 w-12 rounded-xl squircle bg-gold/15 text-primary-ink grid place-items-center mb-5">
        {icon}
      </div>
      <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
