import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  Bot,
  GraduationCap,
  Play,
  Presentation,
  Search,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { getPublicCopy } from "@/lib/public-i18n";
import { normalizePublicLanguage } from "@/lib/public/languages";

type CatalogLaunchHeroProps = {
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  statusLabel?: string;
  language?: string;
};

export default async function CatalogLaunchHero({
  title = "Teach. Practice. Prove.",
  description = "Turn lessons into practice and proof.",
  primaryLabel = "See it",
  secondaryLabel = "Start",
  language,
}: CatalogLaunchHeroProps) {
  const cookieStore = await cookies();
  const role = cookieStore.get(ROLE_COOKIE)?.value;
  const signedIn = Boolean(cookieStore.get(SESSION_COOKIE)?.value);
  const publicLanguage = normalizePublicLanguage(language ?? cookieStore.get("edsync-language")?.value);
  const copy = getPublicCopy(publicLanguage);
  const [, studioLabel = "Studio", aiLabel = "AI", practiceLabel = "Practice", proofLabel = "Grades"] = copy.heroTags;
  const readyLabels = {
    English: "Ready",
    Korean: "준비됨",
    Khmer: "រួចរាល់",
    Chinese: "就绪",
    Japanese: "準備完了",
    Spanish: "Listo",
    French: "Prêt",
    Vietnamese: "Sẵn sàng",
    Thai: "พร้อม",
  };
  const lessonStudioLabels = {
    English: "Lesson Studio",
    Korean: "수업 스튜디오",
    Khmer: "ស្ទូឌីយោមេរៀន",
    Chinese: "课程工作室",
    Japanese: "レッスンスタジオ",
    Spanish: "Estudio de lecciones",
    French: "Studio de leçon",
    Vietnamese: "Studio bài học",
    Thai: "สตูดิโอบทเรียน",
  };
  const slideLabels = {
    English: "Slide 03",
    Korean: "슬라이드 03",
    Khmer: "ស្លាយ 03",
    Chinese: "幻灯片 03",
    Japanese: "スライド 03",
    Spanish: "Diapositiva 03",
    French: "Diapo 03",
    Vietnamese: "Trang 03",
    Thai: "สไลด์ 03",
  };
  const mediaLineLabels = {
    English: "Media check, quiz block, and notes stay linked.",
    Korean: "미디어, 퀴즈, 노트가 함께 연결됩니다.",
    Khmer: "មេឌៀ សំណួរ និងកំណត់ត្រាត្រូវបានភ្ជាប់។",
    Chinese: "媒体、测验和笔记保持关联。",
    Japanese: "メディア、クイズ、ノートを連携します。",
    Spanish: "Medios, quiz y notas quedan conectados.",
    French: "Médias, quiz et notes restent liés.",
    Vietnamese: "Media, câu hỏi và ghi chú luôn liên kết.",
    Thai: "สื่อ แบบฝึก และโน้ตเชื่อมกัน",
  };
  const metricLabels = {
    English: ["slides", "questions", "learners"],
    Korean: ["슬라이드", "문항", "학습자"],
    Khmer: ["ស្លាយ", "សំណួរ", "អ្នករៀន"],
    Chinese: ["幻灯片", "问题", "学习者"],
    Japanese: ["スライド", "問題", "学習者"],
    Spanish: ["diapositivas", "preguntas", "estudiantes"],
    French: ["diapos", "questions", "apprenants"],
    Vietnamese: ["trang", "câu hỏi", "người học"],
    Thai: ["สไลด์", "คำถาม", "ผู้เรียน"],
  };
  const workspaceHref =
    role === "admin"
      ? "/admin/dashboard"
      : role === "teacher"
        ? "/teacher/dashboard"
        : role === "student"
          ? "/student/dashboard"
          : "/auth/login";

  return (
    <section className="edsync-launch-hero-v2" aria-labelledby="edsync-public-title">
      <div className="edsync-launch-topline" role="navigation" aria-label="EdSync public navigation">
        <Link href="/" className="edsync-launch-brand-inline" aria-label="EdSync home">
          <span className="edsync-launch-brand-mark">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span>
            <strong>EdSync</strong>
            <small>{copy.brandSubhead}</small>
          </span>
        </Link>
        <div className="edsync-launch-actions-inline">
          <a href="#showcase" className="edsync-launch-mini-link">
            {copy.workflowLabel}
          </a>
          <a href="#catalog-search-panel" className="edsync-launch-mini-link">
            {copy.catalogLabel}
          </a>
          <ThemeToggle compact className="edsync-launch-icon" />
          <LanguageMenu compact syncCatalogFilter className="edsync-launch-icon" />
          <Link href={signedIn ? workspaceHref : "/auth/login"} className="edsync-launch-signin">
            <span>{signedIn ? "Workspace" : copy.signIn}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="edsync-launch-hero-inner">
        <div className="edsync-launch-copy" data-public-language={publicLanguage}>
          <h1 id="edsync-public-title">{title}</h1>
          <p>{description}</p>
          <div className="edsync-launch-cta-row">
            <Link href="#showcase" className="edsync-launch-primary">
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/auth/signup" className="edsync-launch-secondary">
              {secondaryLabel}
            </Link>
            <Link href="#catalog-search-panel" className="edsync-launch-tertiary">
              {copy.catalogLabel}
            </Link>
          </div>
          <div className="edsync-launch-mode-row" aria-label="EdSync public paths">
            {copy.heroTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>

        <div className="edsync-launch-preview-wrap" aria-label="EdSync workspace preview">
          <div className="edsync-launch-preview-board">
            <div className="edsync-launch-preview-grid">
              <aside className="edsync-launch-preview-nav">
                {[
                  [copy.catalogLabel, Search],
                  [studioLabel, Presentation],
                  [aiLabel, Bot],
                  [practiceLabel, GraduationCap],
                  [proofLabel, ShieldCheck],
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
                    <small>{lessonStudioLabels[publicLanguage]}</small>
                    <h2>Energy Transfer</h2>
                  </div>
                  <span>{readyLabels[publicLanguage]}</span>
                </div>

                <div className="edsync-launch-focus-card">
                  <div className="edsync-launch-focus-media">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="edsync-launch-focus-copy">
                    <small>{slideLabels[publicLanguage]}</small>
                    <strong>Conduction vs convection</strong>
                    <p>{mediaLineLabels[publicLanguage]}</p>
                  </div>
                </div>

                <div className="edsync-launch-loop-strip" aria-label="EdSync learning loop preview">
                  {[
                    [studioLabel, Presentation],
                    [aiLabel, Bot],
                    [practiceLabel, Play],
                    [proofLabel, Trophy],
                  ].map(([label, Icon]) => (
                    <span key={label as string}>
                      <Icon className="h-4 w-4" />
                      {label as string}
                    </span>
                  ))}
                </div>

                <div className="edsync-launch-proof-row" aria-label="Lesson progress preview">
                  {[
                    ["5", metricLabels[publicLanguage][0]],
                    ["12", metricLabels[publicLanguage][1]],
                    ["8", metricLabels[publicLanguage][2]],
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
