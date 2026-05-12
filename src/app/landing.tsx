import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-atlas-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-atlas-blue/10 rounded-full blur-[100px]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="bg-shape bg-shape-drift left-[-4rem] top-20 h-52 w-52 bg-atlas-blue/25 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="bg-shape bg-shape-drift-alt right-[10%] top-[18%] h-40 w-40 bg-atlas-cyan/20 blur-2xl"
          style={{ animationDelay: "-3s" }}
        />
        <div
          className="bg-shape bg-shape-sway left-[8%] top-[58%] h-36 w-36 border border-atlas-cyan/35 bg-atlas-cyan/10 blur-xl"
          style={{ animationDelay: "-8s" }}
        />
        <div
          className="bg-shape bg-shape-drift hidden md:block right-[-5rem] top-[52%] h-60 w-60 bg-atlas-emerald/20 blur-3xl"
          style={{ animationDelay: "-11s" }}
        />
        <div
          className="bg-shape bg-shape-drift-alt hidden md:block left-[32%] top-[74%] h-24 w-24 bg-atlas-blue/20 blur-2xl"
          style={{ animationDelay: "-14s" }}
        />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-atlas-blue to-atlas-cyan flex items-center justify-center">
            <span className="text-white font-display font-bold text-lg">A</span>
          </div>
          <span className="font-display font-bold text-xl text-atlas-text">
            Atlas
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="text-atlas-subtle hover:text-atlas-text text-sm font-medium transition-colors"
          >
            Sign In
          </Link>
          <Link href="/auth/signup" className="btn-primary text-sm py-2">
            Get Started
          </Link>
        </div>
      </nav>

      <section className="relative z-10 px-6 pt-16 pb-20 max-w-7xl mx-auto text-center">
        <h1 className="font-display text-5xl md:text-6xl font-extrabold text-atlas-text leading-tight mb-6">
          Lesson Creation and Learning,
          <span className="block bg-gradient-to-r from-atlas-blue to-atlas-cyan bg-clip-text text-transparent">
            kept clear and practical
          </span>
        </h1>

        <p className="text-atlas-subtle text-lg max-w-3xl mx-auto mb-10 leading-relaxed">
          Atlas helps teachers create structured lessons quickly and gives
          students a focused path through each topic. The interface stays simple
          so users can focus on teaching and learning.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          <Link
            href="/auth/signup?role=teacher"
            className="w-full min-h-[260px] md:min-h-[320px] rounded-3xl bg-gradient-to-br from-atlas-blue to-atlas-blue-dim text-white p-8 md:p-10 flex flex-col justify-center text-left transition-transform duration-200 shadow-card hover:scale-[1.02] hover:brightness-110"
          >
            <span className="font-display font-bold text-3xl md:text-4xl">
              Continue as Teacher
            </span>
            <span className="text-white/90 text-base md:text-lg mt-4 leading-relaxed">
              Build lessons, monitor class progress, and support students from
              one clear dashboard.
            </span>
          </Link>

          <Link
            href="/auth/signup?role=student"
            className="w-full min-h-[260px] md:min-h-[320px] rounded-3xl bg-gradient-to-br from-atlas-emerald to-atlas-emerald-dim text-white p-8 md:p-10 flex flex-col justify-center text-left transition-transform duration-200 shadow-card hover:scale-[1.02] hover:brightness-110"
          >
            <span className="font-display font-bold text-3xl md:text-4xl">
              Continue as Student
            </span>
            <span className="text-white/90 text-base md:text-lg mt-4 leading-relaxed">
              Follow guided lessons, answer checkpoints, and learn each topic at
              your own pace.
            </span>
          </Link>
        </div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "Structured Lesson Builder",
              description:
                "Create lessons from objectives, source text, links, or uploaded files with editable sections and question sets.",
            },
            {
              title: "Adaptive Student Flow",
              description:
                "Use pre-checks and checkpoints so students can move at an appropriate pace with less confusion.",
            },
            {
              title: "Teacher Visibility",
              description:
                "Track progress, identify students who need support, and review key class signals from one dashboard.",
            },
          ].map((feature, i) => (
            <div key={i} className="atlas-card">
              <h3 className="font-display font-bold text-xl text-atlas-text mb-2">
                {feature.title}
              </h3>
              <p className="text-atlas-subtle leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-atlas-border/70">
        <div className="max-w-7xl mx-auto px-6 py-5 text-xs sm:text-sm text-atlas-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p>ATLAS built by Group 13 for COMP3122.</p>
          <p>
            Contributors: UNG SETHYPAGNA, KEDIA PRANAV, KIM REEWON, SHORE
            MATTHEW
          </p>
        </div>
      </footer>
    </main>
  );
}
