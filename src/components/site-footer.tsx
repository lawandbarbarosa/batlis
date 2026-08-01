import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useDialect } from "@/hooks/use-dialect";

export const CONTACT_EMAIL = "lawandata14@gmail.com";

export function SiteFooter() {
  const { t } = useDialect();

  return (
    <footer className="border-t border-border/60 mt-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Link to="/" className="flex items-center gap-2 w-fit">
            <img
              src="/logo.png"
              alt={t("app_name")}
              className="h-8 w-8 rounded-lg squircle object-cover"
            />
            <span className="font-display text-lg font-semibold">{t("app_name")}</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-sm">
            {t("footer_blurb")}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {t("footer_product_heading")}
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/" className="hover:text-foreground transition-colors">
                {t("nav_home")}
              </Link>
            </li>
            <li>
              <Link to="/grade-12" className="hover:text-foreground transition-colors">
                {t("nav_grade12")}
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="hover:text-foreground transition-colors">
                {t("nav_pricing")}
              </Link>
            </li>
            <li>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="hover:text-foreground transition-colors"
              >
                {t("sign_up")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {t("footer_company_heading")}
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/about" className="hover:text-foreground transition-colors">
                {t("nav_about")}
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-foreground transition-colors">
                {t("nav_contact")}
              </Link>
            </li>
            <li>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                dir="ltr"
              >
                <Mail className="h-3.5 w-3.5" />
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {t("app_name")}
          </span>
          <span>{t("footer_made_for")}</span>
        </div>
      </div>
    </footer>
  );
}
