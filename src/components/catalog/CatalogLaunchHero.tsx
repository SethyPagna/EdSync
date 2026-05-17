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

export default function CatalogLaunchHero() {
  return (
    <section className="edsync-launch-hero-v2" aria-labelledby="edsync-public-title">
      <div className="edsync-launch-hero-inner">
        <div className="edsync-launch-copy">
          <div className="edsync-launch-status">
            <Sparkles className="h-4 w-4" />
            Catalog to classroom evidence
          </div>
          <h1 id="edsync-public-title">Teach. Practice. Prove.</h1>
          <p>
            Turn one lesson into slides, practice, feedback, and proof.
          </p>
          <div className="edsync-launch-cta-row">
            <Link href="#workflow-transition" className="edsync-launch-primary">
              View workflow
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/auth/signup" className="edsync-launch-secondary">
              Start
            </Link>
          </div>
          <div className="edsync-launch-mode-row" aria-label="EdSync workspace modes">
            <span>Catalog</span>
            <span>Studio</span>
            <span>AI</span>
            <span>Practice</span>
            <span>Gradebook</span>
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
