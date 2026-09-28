import Link from "next/link";
import { ArrowUpRight, BookOpen, Check } from "lucide-react";
import { ProgressBar } from "@/components/ui";
import { courseProgress, type StudentCourse } from "./data";

const COVERS = [
  "bg-accent-soft text-accent", "bg-info-soft text-info", "bg-success-soft text-success", "bg-warning-soft text-warning",
];

function coverFor(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return COVERS[Math.abs(hash) % COVERS.length];
}

export default function CourseCard({ course, compact = false }: { course: StudentCourse; compact?: boolean }) {
  const pct = courseProgress(course);
  const done = course.progress?.status === "completed";
  return (
    <Link href={`/student/lessons/${course.id}`} className={`group flex min-w-0 gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-line-strong hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus ${compact ? "items-center" : "flex-col"}`}>
      <div aria-hidden className={`flex shrink-0 items-center justify-center rounded-lg ${coverFor(course.id)} ${compact ? "size-11" : "h-24 w-full"}`}>
        <BookOpen className={compact ? "size-5" : "size-8"} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2"><h3 className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{course.title}</h3>{done ? <Check aria-label="Completed" className="size-4 shrink-0 text-success" /> : <ArrowUpRight aria-hidden className="size-4 shrink-0 text-fg-faint transition-colors group-hover:text-accent" />}</div>
        <p className="mt-0.5 truncate text-xs text-fg-muted">{course.className ?? course.subject ?? "Personal course"}{course.estimated_duration ? ` · ${course.estimated_duration} min` : ""}</p>
        <div className="mt-2 flex items-center gap-2"><ProgressBar value={pct} label={`${course.title} progress`} className="flex-1" /><span className="text-[11px] tabular-nums text-fg-faint">{pct}%</span></div>
      </div>
    </Link>
  );
}
