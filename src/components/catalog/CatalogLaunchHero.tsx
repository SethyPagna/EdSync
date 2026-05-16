import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Play,
  Presentation,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from "lucide-react";

export default function CatalogLaunchHero() {
  return (
    <section className="edsync-launch-hero-v2" aria-labelledby="edsync-public-title">
      <div className="edsync-launch-hero-inner">
        <div className="edsync-launch-copy">
          <div className="edsync-launch-status">
            <Sparkles className="h-4 w-4" />
            One path: catalog to classroom evidence
          </div>
          <h1 id="edsync-public-title">Teach. Practice. Prove progress.</h1>
          <p>
            Build lessons, generate practice, assign work, and keep the grade evidence in one clean loop.
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
            <span>Practice</span>
            <span>Progress</span>
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
              <strong>/catalog → /studio → /practice → /teacher/gradebook</strong>
              <em>Live workspace preview</em>
            </div>

            <div className="edsync-launch-preview-grid">
              <aside className="edsync-launch-preview-nav">
                {[
                  ["Catalog", Search, "Find public courses"],
                  ["Studio", Presentation, "Slides, docs, media"],
                  ["AI Tutor", Bot, "Generate quiz draft"],
                  ["Practice", GraduationCap, "Retry missed"],
                  ["Admin", ShieldCheck, "Providers, portals"],
                ].map(([label, Icon, detail], index) => (
                  <span key={label as string} className={index === 1 ? "is-active" : ""}>
                    <Icon className="h-4 w-4" />
                    <span>
                      <strong>{label as string}</strong>
                      <small>{detail as string}</small>
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
                  <span>
                    <CheckCircle2 className="h-4 w-4" />
                    Draft saved
                  </span>
                </div>

                <div className="edsync-launch-toolbar" aria-label="Studio tools preview">
                  {[
                    ["Outline", FileText],
                    ["Slides", Presentation],
                    ["Media", ImageIcon],
                    ["AI", Sparkles],
                    ["Assign", CalendarCheck],
                  ].map(([label, Icon]) => (
                    <span key={label as string}>
                      <Icon className="h-4 w-4" />
                      {label as string}
                    </span>
                  ))}
                </div>

                <div className="edsync-launch-content-grid">
                  <article className="edsync-launch-slide-preview">
                    <small>Slide 03</small>
                    <h3>Conduction vs convection</h3>
                    <div className="edsync-launch-slide-canvas">
                      <span>Heat moves through touch</span>
                      <span>
                        <Play className="h-4 w-4" />
                        Video check
                      </span>
                      <span>Quick question</span>
                    </div>
                    <p>Image, video, and links are checked before publish.</p>
                  </article>

                  <aside className="edsync-launch-side-stack">
                    <span>
                      <ClipboardCheck className="h-4 w-4" />
                      Assign to Grade 8 Science
                    </span>
                    <span>
                      <TimerReset className="h-4 w-4" />
                      35 min expected
                    </span>
                    <span>
                      <Bot className="h-4 w-4" />
                      AI quiz needs review
                    </span>
                  </aside>
                </div>

                <div className="edsync-launch-proof-row">
                  {[
                    ["5 slides", "Studio draft"],
                    ["12 questions", "Practice ready"],
                    ["Grade event", "Progress saved"],
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
