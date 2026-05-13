import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  GraduationCap,
  LineChart,
  Sparkles,
  UsersRound,
} from "lucide-react";

const teacherSignals = [
  "AI lesson studio",
  "Class readiness",
  "Intervention queue",
  "Progress evidence",
];

const workflowCards = [
  {
    icon: BookOpenCheck,
    title: "Plan",
    copy: "Generate and refine lesson sequences from objectives, source text, or class needs.",
  },
  {
    icon: Brain,
    title: "Personalize",
    copy: "Adapt pacing, support, checks, and next steps around each learner profile.",
  },
  {
    icon: BarChart3,
    title: "Respond",
    copy: "Turn progress, confidence, and quiz evidence into practical teacher actions.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-edsync-bg text-edsync-text">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-edsync-blue to-edsync-emerald">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-display text-xl font-bold">EdSync</p>
            <p className="text-xs text-edsync-subtle">AI Learning OS</p>
          </div>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/auth/login" className="btn-ghost text-sm">
            Sign in
          </Link>
          <Link href="/auth/signup" className="btn-primary py-2.5 text-sm">
            Start workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:pt-16">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-edsync-border bg-edsync-card px-3 py-2 text-sm text-edsync-subtle">
            <Sparkles className="h-4 w-4 text-edsync-amber" />
            Built for teachers, students, and evidence-based learning
          </div>
          <h1 className="max-w-4xl font-display text-5xl font-extrabold leading-[1.03] tracking-normal text-edsync-text md:text-7xl">
            A mature education workspace that keeps learning personal.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-edsync-subtle">
            EdSync helps teachers create stronger lessons, monitor class health,
            and guide students through adaptive learning paths with AI support
            that stays practical and classroom-ready.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/signup?role=teacher"
              className="btn-primary justify-center py-3.5"
            >
              Continue as teacher
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/signup?role=student"
              className="btn-secondary justify-center py-3.5"
            >
              Continue as student
            </Link>
          </div>
          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {teacherSignals.map((signal) => (
              <div
                key={signal}
                className="rounded-lg border border-edsync-border bg-edsync-card/70 px-3 py-3 text-sm text-edsync-subtle"
              >
                <CheckCircle2 className="mb-2 h-4 w-4 text-edsync-emerald" />
                {signal}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-edsync-border bg-edsync-card p-4 shadow-2xl shadow-black/30">
          <div className="rounded-lg border border-edsync-border bg-edsync-surface p-4">
            <div className="flex items-center justify-between border-b border-edsync-border pb-4">
              <div>
                <p className="text-sm font-semibold text-edsync-text">
                  Grade 8 Science Studio
                </p>
                <p className="text-xs text-edsync-subtle">
                  Live class pulse and next actions
                </p>
              </div>
              <span className="rounded-lg bg-edsync-emerald/10 px-3 py-1 text-xs font-semibold text-edsync-emerald">
                On track
              </span>
            </div>

            <div className="grid gap-3 py-4 sm:grid-cols-3">
              {[
                ["23", "students active"],
                ["81%", "avg mastery"],
                ["4", "needs attention"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-lg border border-edsync-border bg-edsync-card p-3"
                >
                  <p className="font-display text-2xl font-bold text-edsync-text">
                    {value}
                  </p>
                  <p className="text-xs text-edsync-subtle">{label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: LineChart,
                  title: "Intervention suggested",
                  copy: "Review energy transfer with 4 students before the final quiz.",
                  color: "text-edsync-amber",
                },
                {
                  icon: UsersRound,
                  title: "Group ready",
                  copy: "7 students can move into the extension activity.",
                  color: "text-edsync-emerald",
                },
                {
                  icon: Brain,
                  title: "AI draft waiting",
                  copy: "Ecosystem balance lesson generated from your objectives.",
                  color: "text-edsync-blue",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex gap-3 rounded-lg border border-edsync-border bg-edsync-bg/50 p-3"
                  >
                    <Icon className={`mt-0.5 h-5 w-5 ${item.color}`} />
                    <div>
                      <p className="text-sm font-semibold text-edsync-text">
                        {item.title}
                      </p>
                      <p className="text-xs leading-5 text-edsync-subtle">
                        {item.copy}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-edsync-border bg-edsync-surface/45">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-12 md:grid-cols-3">
          {workflowCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="edsync-card">
                <Icon className="mb-5 h-6 w-6 text-edsync-blue" />
                <h2 className="font-display text-xl font-bold text-edsync-text">
                  {card.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-edsync-subtle">
                  {card.copy}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-sm text-edsync-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>EdSync education platform.</p>
        <p>AI, edsync, and Vercel-ready deployment.</p>
      </footer>
    </main>
  );
}
