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
          <h1 id="edsync-public-title">Teach. Practice. Prove progress.</h1>
          <p>
            Public courses, organization portals, Studio lessons, AI drafts, student practice, and grade evidence stay in one loop.
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
              <strong>/catalog -&gt; /studio -&gt; /practice -&gt; /teacher/gradebook</strong>
              <em>Live workspace preview</em>
            </div>

            <div className="edsync-launch-preview-grid">
              <aside className="edsync-launch-preview-nav">
                {[
                  ["Catalog", Search, "Course + org entry"],
                  ["Studio", Presentation, "Lesson editor"],
                  ["AI", Bot, "Drafts to review"],
                  ["Practice", GraduationCap, "Timer + retries"],
                  ["Progress", ShieldCheck, "Grade evidence"],
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
                    <small>Studio lesson editor</small>
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
                        Vimeo check
                      </span>
                      <span>Quick question: 4 pts</span>
                    </div>
                    <p>Images, video embeds, links, and quiz blocks are checked before publish.</p>
                  </article>

                  <aside className="edsync-launch-side-stack">
                    <span>
                      <Bot className="h-4 w-4" />
                      AI draft: quiz + rubric
                    </span>
                    <span>
                      <TimerReset className="h-4 w-4" />
                      Due Fri, 35 min target
                    </span>
                    <span>
                      <Trophy className="h-4 w-4" />
                      Retry missed saved
                    </span>
                    <span>
                      <ClipboardCheck className="h-4 w-4" />
                      Grade event ready
                    </span>
                  </aside>
                </div>

                <div className="edsync-launch-proof-row">
                  {[
                    ["5 slides", "Draft saved"],
                    ["12 questions", "Practice ready"],
                    ["8 students", "Evidence queued"],
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
