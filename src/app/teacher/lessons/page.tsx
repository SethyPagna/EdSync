"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/edsync/client";
import type { Lesson } from "@/types";
import {
  getStatusBadge,
  getDifficultyColor,
  formatRelativeTime,
} from "@/lib/utils";
import toast from "react-hot-toast";

export default function TeacherLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "draft" | "published" | "archived"
  >("all");
  const [durationFilter, setDurationFilter] = useState<"all" | "short" | "medium" | "long">("all");
  const [search, setSearch] = useState("");
  const edsync = createClient();

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) return;
    const { data } = await edsync
      .from("lessons")
      .select("*")
      .eq("teacher_id", user.id)
      .order("updated_at", { ascending: false });
    setLessons(data || []);
    setLoading(false);
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    await edsync.from("lessons").delete().eq("id", id);
    setLessons(lessons.filter((l) => l.id !== id));
    toast.success("Lesson deleted");
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
      setLessons([data, ...lessons]);
      toast.success("Lesson duplicated!");
    }
  };

  const filtered = lessons.filter((l) => {
    if (filter !== "all" && l.status !== filter) return false;
    if (durationFilter === "short" && l.estimated_duration > 20) return false;
    if (durationFilter === "medium" && (l.estimated_duration < 21 || l.estimated_duration > 60)) return false;
    if (durationFilter === "long" && l.estimated_duration < 61) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl text-edsync-text">
            Lessons
          </h1>
          <p className="text-edsync-subtle mt-1">
            {lessons.length} lesson{lessons.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link href="/teacher/lessons/create" className="btn-primary">
          Create Lesson
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-64">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lessons..."
            className="edsync-input py-2"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "published", "draft", "archived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                filter === f
                  ? "bg-edsync-blue text-white"
                  : "bg-edsync-card text-edsync-subtle hover:text-edsync-text border border-edsync-border"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={durationFilter}
          onChange={(event) => setDurationFilter(event.target.value as typeof durationFilter)}
          className="edsync-input w-full py-2 text-sm sm:w-48"
          aria-label="Filter by expected duration"
        >
          <option value="all">Any duration</option>
          <option value="short">Short · 1-20 min</option>
          <option value="medium">Medium · 21-60 min</option>
          <option value="long">Long · 61+ min</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-edsync-card rounded-2xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <h3 className="font-display font-bold text-xl text-edsync-text mb-2">
            {search ? "No lessons match your search" : "No lessons yet"}
          </h3>
          <p className="text-edsync-subtle mb-6">
            {search
              ? "Try a different search term"
              : "Create your first lesson to get started"}
          </p>
          {!search && (
            <Link
              href="/teacher/lessons/create"
              className="btn-primary inline-flex"
            >
              Create First Lesson
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((lesson) => {
            const badge = getStatusBadge(lesson.status);
            return (
              <div
                key={lesson.id}
                className="edsync-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 flex flex-col"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge ${badge.className}`}>
                        {badge.label}
                      </span>
                      {lesson.ai_generated && (
                        <span className="badge bg-edsync-purple/10 text-edsync-purple border border-edsync-purple/20">
                          Generated
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-lg text-edsync-text mt-2 line-clamp-2">
                      {lesson.title}
                    </h3>
                  </div>
                </div>

                <p className="text-edsync-subtle text-sm line-clamp-2 mb-4 flex-1">
                  {lesson.description}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-edsync-subtle mb-4 flex-wrap">
                  {lesson.subject && (
                    <span className="badge bg-edsync-muted/30">
                      {lesson.subject}
                    </span>
                  )}
                  <span>{lesson.estimated_duration}min</span>
                  <span className={getDifficultyColor(lesson.difficulty)}>
                    ● {lesson.difficulty}
                  </span>
                </div>

                {/* Progress bar placeholder */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-edsync-subtle mb-1">
                    <span>Student Progress</span>
                    <span>—</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: "0%" }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-edsync-border">
                  <Link
                    href={`/teacher/lessons/${lesson.id}`}
                    className="btn-primary flex-1 justify-center text-sm py-2"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => duplicateLesson(lesson)}
                    className="btn-secondary px-3 py-2 text-sm"
                    title="Duplicate"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => deleteLesson(lesson.id)}
                    className="btn-danger px-3 py-2 text-sm border-0 bg-edsync-red/5 hover:bg-edsync-red/15"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>

                <p className="text-xs text-edsync-subtle/50 mt-2">
                  Updated {formatRelativeTime(lesson.updated_at)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
