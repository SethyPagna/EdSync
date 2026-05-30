"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { BookOpenCheck, Clock3, Copy, Plus, Search, Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/WorkspacePrimitives";
import { createClient } from "@/lib/edsync/client";
import type { Lesson } from "@/types";
import {
  formatRelativeTime,
  getDifficultyColor,
  getStatusBadge,
} from "@/lib/utils";

type LessonStatusFilter = "all" | "draft" | "published" | "archived";
type DurationFilter = "all" | "short" | "medium" | "long";

const STATUS_FILTERS: LessonStatusFilter[] = ["all", "published", "draft", "archived"];

function matchesDuration(lesson: Lesson, durationFilter: DurationFilter) {
  if (durationFilter === "short") return lesson.estimated_duration <= 20;
  if (durationFilter === "medium") return lesson.estimated_duration >= 21 && lesson.estimated_duration <= 60;
  if (durationFilter === "long") return lesson.estimated_duration >= 61;
  return true;
}

export default function TeacherLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LessonStatusFilter>("all");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [search, setSearch] = useState("");
  const edsync = useMemo(() => createClient(), []);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setLessons([]);
      setLoading(false);
      return;
    }
    const { data } = await edsync
      .from("lessons")
      .select("*")
      .eq("teacher_id", user.id)
      .order("updated_at", { ascending: false });
    setLessons(data || []);
    setLoading(false);
  }, [edsync]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadLessons();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadLessons]);

  const deleteLesson = async (id: string) => {
    if (!confirm("Delete this course? This cannot be undone.")) return;
    const { error } = await edsync.from("lessons").delete().eq("id", id);
    if (error) {
      toast.error(`Could not delete course: ${error.message}`);
      return;
    }
    setLessons((current) => current.filter((lesson) => lesson.id !== id));
    toast.success("Course deleted");
  };

  const duplicateLesson = async (lesson: Lesson) => {
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) return;
    const { data } = await edsync
      .from("lessons")
      .insert({
        ...lesson,
        id: undefined,
        title: `${lesson.title} (Copy)`,
        status: "draft",
        teacher_id: user.id,
        created_at: undefined,
        updated_at: undefined,
      })
      .select()
      .single();
    if (data) {
      setLessons((current) => [data, ...current]);
      toast.success("Course duplicated");
    }
  };

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return lessons.filter((lesson) => {
      if (filter !== "all" && lesson.status !== filter) return false;
      if (!matchesDuration(lesson, durationFilter)) return false;
      if (normalizedSearch && !lesson.title.toLowerCase().includes(normalizedSearch)) return false;
      return true;
    });
  }, [durationFilter, filter, lessons, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <section className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">
              Course library
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold text-edsync-text">
              Courses
            </h1>
            <p className="mt-1 text-sm text-edsync-subtle">
              {lessons.length} course{lessons.length !== 1 ? "s" : ""} total
            </p>
          </div>
          <Link href="/teacher/lessons/create" className="btn-primary justify-center">
            <Plus className="h-4 w-4" />
            New course
          </Link>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-edsync-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search courses..."
              className="edsync-input py-2 pl-10"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${
                  filter === status
                    ? "bg-edsync-blue text-white"
                    : "border border-edsync-border bg-edsync-card text-edsync-subtle hover:text-edsync-text"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <select
            value={durationFilter}
            onChange={(event) => setDurationFilter(event.target.value as DurationFilter)}
            className="edsync-input w-full py-2 text-sm sm:w-48"
            aria-label="Filter by expected duration"
          >
            <option value="all">Any duration</option>
            <option value="short">Short, 1-20 min</option>
            <option value="medium">Medium, 21-60 min</option>
            <option value="long">Long, 61+ min</option>
          </select>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-24 rounded-xl bg-edsync-card shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edsync-border bg-edsync-card py-16 text-center">
          <BookOpenCheck className="mx-auto mb-4 h-10 w-10 text-edsync-subtle" />
          <h3 className="mb-2 font-display text-xl font-bold text-edsync-text">
            {search ? "No lessons match your search" : "No lessons yet"}
          </h3>
          <p className="mb-6 text-sm text-edsync-subtle">
            {search ? "Try another search." : "Create your first lesson."}
          </p>
          {!search && (
            <Link href="/teacher/lessons/create" className="btn-primary inline-flex">
              Create first lesson
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              onDelete={() => deleteLesson(lesson.id)}
              onDuplicate={() => duplicateLesson(lesson)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonRow({
  lesson,
  onDelete,
  onDuplicate,
}: {
  lesson: Lesson;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const badge = getStatusBadge(lesson.status);

  return (
    <article className="rounded-xl border border-edsync-border bg-edsync-card p-4 transition hover:border-edsync-blue/40 hover:shadow-card-hover">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-blue/10 text-edsync-blue">
            <BookOpenCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${badge.className}`}>{badge.label}</span>
              {lesson.ai_generated && (
                <span className="badge border border-edsync-purple/20 bg-edsync-purple/10 text-edsync-purple">
                  AI
                </span>
              )}
            </div>
            <h3 className="mt-2 truncate font-display text-lg font-bold text-edsync-text">
              {lesson.title}
            </h3>
            <p className="mt-1 line-clamp-1 text-sm text-edsync-subtle">
              {lesson.description || "No description."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-edsync-subtle">
              {lesson.subject && <span className="badge bg-edsync-muted/30">{lesson.subject}</span>}
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {lesson.estimated_duration} min
              </span>
              <span className={getDifficultyColor(lesson.difficulty)}>{lesson.difficulty}</span>
              <span>Updated {formatRelativeTime(lesson.updated_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/teacher/lessons/${lesson.id}`}
            className="btn-primary min-w-0 flex-1 justify-center py-2 text-sm"
          >
            Edit
          </Link>
          <ActionMenu label={`Actions for ${lesson.title}`}>
            <button
              type="button"
              onClick={onDuplicate}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-edsync-text hover:bg-edsync-card"
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-edsync-red hover:bg-edsync-red/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </ActionMenu>
        </div>
      </div>
    </article>
  );
}
