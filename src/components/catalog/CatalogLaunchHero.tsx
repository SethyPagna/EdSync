import Link from "next/link";
import {
  ArrowRight,
  Bot,
  GraduationCap,
  Play,
  Presentation,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

type CatalogLaunchHeroProps = {
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  statusLabel?: string;
};

export default function CatalogLaunchHero({
  title = "Teach. Practice. Prove.",
  description = "Turn lessons into practice and proof.",
  primaryLabel = "See it",
  secondaryLabel = "Start",
  statusLabel = "Catalog to classroom evidence",
}: CatalogLaunchHeroProps) {
  return (
    <section className="edsync-launch-hero-v2" aria-labelledby="edsync-public-title">
      <div className="edsync-launch-hero-inner">
        <div className="edsync-launch-copy">
          <div className="edsync-launch-status">
            <Sparkles className="h-4 w-4" />
            {statusLabel}
          </div>
          <h1 id="edsync-public-title">{title}</h1>
          <p>{description}</p>
          <div className="edsync-launch-cta-row">
            <Link href="#workflow-transition" className="edsync-launch-primary">
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/auth/signup" className="edsync-launch-secondary">
              {secondaryLabel}
            </Link>
          </div>
        </div>

        <div className="edsync-launch-preview-wrap" aria-label="EdSync workspace preview">
          <div className="edsync-launch-preview-frame">
            <div className="edsync-launch-preview-bar">
              <div aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <strong>/studio/energy-transfer</strong>
              <em>Live preview</em>
            </div>

            <div className="edsync-launch-preview-grid">
              <aside className="edsync-launch-preview-nav">
                {[
                  ["Catalog", Search],
                  ["Studio", Presentation],
                  ["AI", Bot],
                  ["Practice", GraduationCap],
                  ["Progress", ShieldCheck],
                ].map(([label, Icon], index) => (
                  <span key={label as string} className={index === 1 ? "is-active" : ""}>
                    <Icon className="h-4 w-4" />
                    <span>
                      <strong>{label as string}</strong>
                    </span>
                  </span>
                ))}
              </aside>

              <section className="edsync-launch-workspace">
                <div className="edsync-launch-workspace-head">
                  <div>
                    <small>Lesson Studio</small>
                    <h2>Energy Transfer</h2>
                  </div>
                  <span>Ready</span>
                </div>

                <div className="edsync-launch-focus-card">
                  <div className="edsync-launch-focus-media">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="edsync-launch-focus-copy">
                    <small>Slide 03</small>
                    <strong>Conduction</strong>
                    <p>Visual lesson + quick check</p>
                  </div>
                </div>

                <div className="edsync-launch-loop-strip" aria-label="EdSync learning loop preview">
                  {[
                    ["Studio", Presentation],
                    ["AI quiz", Bot],
                    ["Practice", Play],
                    ["Proof", Trophy],
                  ].map(([label, Icon]) => (
                    <span key={label as string}>
                      <Icon className="h-4 w-4" />
                      {label as string}
                    </span>
                  ))}
                </div>

                <div className="edsync-launch-proof-row" aria-label="Lesson progress preview">
                  {[
                    ["5", "slides"],
                    ["12", "questions"],
                    ["8", "learners"],
                  ].map(([value, label]) => (
                    <span key={value}>
                      <strong>{value}</strong>
                      <small>{label}</small>
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
