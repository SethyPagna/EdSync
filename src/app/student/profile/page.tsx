"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { validateDisplayName } from "@/lib/auth/display-name";
import { createClient } from "@/lib/edsync/client";
import { GRADE_LEVELS } from "@/lib/grades";
import type { Profile, UserPreferences } from "@/types";
import toast from "react-hot-toast";
import { generateInitials } from "@/lib/utils";

type SkillMetric = {
  key: string;
  label: string;
  value: number;
  tip: string;
};

type ProgressRow = {
  status: string;
  score: number | null;
  final_quiz_score: number | null;
  knowledge_gaps: string[] | null;
  metadata: Record<string, unknown> | null;
};

const DEFAULT_SKILL_METRICS: SkillMetric[] = [
  {
    key: "completion",
    label: "Completion",
    value: 0,
    tip: "Finish more lessons to build consistency.",
  },
  {
    key: "mastery",
    label: "Quiz Mastery",
    value: 0,
    tip: "Review missed quiz concepts and retry.",
  },
  {
    key: "clarity",
    label: "Concept Clarity",
    value: 0,
    tip: "Focus on the concepts that appear in your knowledge gaps.",
  },
  {
    key: "reflection",
    label: "Reflection Habit",
    value: 0,
    tip: "Write short notes after each lesson section.",
  },
  {
    key: "confidence",
    label: "Confidence",
    value: 0,
    tip: "Use Socratic hints on the part you still find unclear.",
  },
  {
    key: "socratic",
    label: "Socratic Use",
    value: 0,
    tip: "Ask follow-up questions while learning to deepen understanding.",
  },
];

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function reflectionSignals(rows: ProgressRow[]) {
  let count = 0;
  const confidences: number[] = [];

  rows.forEach((row) => {
    const reflections = row.metadata?.reflections;
    if (!Array.isArray(reflections)) return;

    count += reflections.length;
    reflections.forEach((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
      const confidence = Number((entry as { confidence?: unknown }).confidence);
      if (!Number.isFinite(confidence)) return;
      confidences.push(Math.max(1, Math.min(5, confidence)));
    });
  });

  return { count, confidences };
}

function buildSkillMetrics(
  rows: ProgressRow[],
  socraticCount: number,
): SkillMetric[] {
  const started = rows.filter((row) => row.status !== "not_started").length;
  const completed = rows.filter((row) => row.status === "completed").length;

  const quizScores = rows
    .map((row) => row.final_quiz_score ?? row.score)
    .filter((score): score is number => typeof score === "number");

  const avgKnowledgeGaps = rows.length
    ? average(
        rows.map((row) =>
          Array.isArray(row.knowledge_gaps) ? row.knowledge_gaps.length : 0,
        ),
      )
    : 0;

  const { count: reflectionCount, confidences } = reflectionSignals(rows);

  const completion =
    started > 0 ? clampPercent((completed / started) * 100) : 0;
  const mastery = quizScores.length > 0 ? clampPercent(average(quizScores)) : 0;
  const clarity =
    rows.length > 0 ? clampPercent(100 - avgKnowledgeGaps * 18) : 0;
  const reflectionHabit =
    started > 0 ? clampPercent((reflectionCount / started) * 100) : 0;
  const confidence =
    confidences.length > 0 ? clampPercent(average(confidences) * 20) : 0;
  const socraticUse = clampPercent(Math.min(100, socraticCount * 12));

  return [
    {
      key: "completion",
      label: "Completion",
      value: completion,
      tip: "Finish assigned lessons to raise this quickly.",
    },
    {
      key: "mastery",
      label: "Quiz Mastery",
      value: mastery,
      tip: "Review final quiz explanations and retry weak topics.",
    },
    {
      key: "clarity",
      label: "Concept Clarity",
      value: clarity,
      tip: "Target recurring knowledge gaps with short revision blocks.",
    },
    {
      key: "reflection",
      label: "Reflection Habit",
      value: reflectionHabit,
      tip: "Add 3-5 lines of notes after each lecture section.",
    },
    {
      key: "confidence",
      label: "Confidence",
      value: confidence,
      tip: "Raise confidence by explaining concepts in your own words.",
    },
    {
      key: "socratic",
      label: "Socratic Use",
      value: socraticUse,
      tip: "Use Ask Socratic when stuck instead of guessing.",
    },
  ];
}

function polarPoint(
  centerX: number,
  centerY: number,
  radius: number,
  angleDeg: number,
) {
  const radians = (Math.PI / 180) * angleDeg;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
}

const INTEREST_OPTIONS = [
  "Space & Astronomy",
  "Sports",
  "Music",
  "Gaming",
  "Art & Design",
  "Technology",
  "Nature & Environment",
  "Cooking & Food",
  "Travel",
  "Movies & TV",
  "History",
  "Health & Fitness",
  "Animals",
  "Fashion",
  "Business",
];

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "light",
  text_size: "medium",
  email_notifications: true,
  assignment_notifications: true,
  weekly_digest: true,
};

export default function StudentProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skillMetrics, setSkillMetrics] = useState<SkillMetric[]>(
    DEFAULT_SKILL_METRICS,
  );
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const edsync = useMemo(() => createClient(), []);

  const loadProfileAndStats = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await edsync.auth.getUser();

      if (!user) return;

      const [profileRes, progressRes, socraticRes] = await Promise.all([
        edsync.from("profiles").select("*").eq("id", user.id).single(),
        edsync
          .from("student_progress")
          .select("status, score, final_quiz_score, knowledge_gaps, metadata")
          .eq("student_id", user.id),
        edsync
          .from("socratic_interactions")
          .select("id", { count: "exact", head: true })
          .eq("student_id", user.id),
      ]);

      if (profileRes.data) {
        const data = profileRes.data;
        setProfile(data);
        setFullName(data.full_name || "");
        setGradeLevel(data.grade_level || "");
        setInterests(data.interests || []);
        setPreferences({ ...DEFAULT_PREFERENCES, ...(data.preferences || {}) });
      }

      const progressRows = (progressRes.data || []) as ProgressRow[];
      const socraticCount = socraticRes.count || 0;
      setSkillMetrics(buildSkillMetrics(progressRows, socraticCount));
    } catch {
      toast.error("Could not load profile.");
    }
  }, [edsync]);

  useEffect(() => {
    loadProfileAndStats();
  }, [loadProfileAndStats]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  };

  const save = async () => {
    let normalizedFullName: string | null;
    try {
      normalizedFullName = validateDisplayName(fullName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Full name is invalid.");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await edsync
      .from("profiles")
      .update({
        full_name: normalizedFullName,
        grade_level: gradeLevel,
        interests,
        preferences,
      })
      .eq("id", user.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile saved!");
      setProfile((prev) =>
        prev
          ? { ...prev, full_name: normalizedFullName, grade_level: gradeLevel, interests, preferences }
          : null,
      );
      setFullName(normalizedFullName || "");
      setEditing(false);
    }
    setSaving(false);
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file || !profile) return;
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() || "jpg";
    const { data, error } = await edsync.storage
      .from("avatars")
      .upload(`avatar-${Date.now()}.${ext}`, file, { upsert: true });
    if (error || !data) {
      toast.error(error?.message || "Avatar upload failed");
      setUploadingAvatar(false);
      return;
    }
    await edsync.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", profile.id);
    setProfile({ ...profile, avatar_url: data.publicUrl });
    setUploadingAvatar(false);
    toast.success("Avatar updated");
  };

  const chartCenterX = 200;
  const chartCenterY = 165;
  const chartRadius = 108;
  const chartAngles = skillMetrics.map(
    (_, index) => -90 + index * (360 / skillMetrics.length),
  );
  const ringLevels = [25, 50, 75, 100];

  const weakAreas = [...skillMetrics]
    .sort((a, b) => a.value - b.value)
    .slice(0, 2);

  return (
    <div className="p-6 max-w-3xl mx-auto animate-fade-in">
      <h1 className="font-display font-bold text-3xl text-edsync-text mb-6">
        My Profile
      </h1>

      {/* Avatar & basic info */}
      <div className="edsync-card mb-6">
        <div className="flex items-start gap-6">
          <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-edsync-emerald to-edsync-cyan font-display text-3xl font-bold text-white">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt="" fill sizes="80px" className="object-cover" />
            ) : profile ? (
              generateInitials(profile.full_name || profile.email)
            ) : (
              "?"
            )}
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="edsync-input font-display font-bold text-xl"
                  placeholder="Full Name"
                />
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="edsync-input"
                >
                  <option value="">Select Grade Level</option>
                  {GRADE_LEVELS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <h2 className="font-display font-bold text-2xl text-edsync-text">
                  {profile?.full_name || "Set your name"}
                </h2>
                <p className="text-edsync-subtle">{profile?.email}</p>
                <p className="text-sm text-edsync-subtle mt-1">
                  {profile?.grade_level || "Grade level not set"}
                </p>
              </>
            )}
          </div>
          <button
            onClick={editing ? save : () => setEditing(true)}
            className={editing ? "btn-primary py-2" : "btn-secondary py-2"}
            disabled={saving}
          >
            {saving ? "..." : editing ? "Save" : "Edit"}
          </button>
        </div>
        <label className="btn-secondary mt-4 inline-flex cursor-pointer py-2 text-sm">
          {uploadingAvatar ? "Uploading..." : "Upload avatar"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => uploadAvatar(event.target.files?.[0])}
          />
        </label>
      </div>

      <div className="edsync-card mb-6">
        <h3 className="font-display font-semibold text-lg text-edsync-text mb-4">
          Preferences
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-edsync-subtle">Theme</span>
            <select
              value={preferences.theme}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  theme: event.target.value as UserPreferences["theme"],
                })
              }
              className="edsync-input"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-edsync-subtle">Text size</span>
            <select
              value={preferences.text_size}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  text_size: event.target.value as UserPreferences["text_size"],
                })
              }
              className="edsync-input"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["email_notifications", "Email updates"],
            ["assignment_notifications", "Assignment notices"],
            ["weekly_digest", "Weekly digest"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-lg border border-edsync-border p-3">
              <span className="text-sm font-semibold text-edsync-text">{label}</span>
              <input
                type="checkbox"
                checked={Boolean(preferences[key as keyof UserPreferences])}
                onChange={(event) =>
                  setPreferences({ ...preferences, [key]: event.target.checked })
                }
              />
            </label>
          ))}
        </div>
        <button onClick={save} disabled={saving} className="btn-primary mt-4 text-sm py-2">
          Save Preferences
        </button>
      </div>

      {/* Interests */}
      <div className="edsync-card mb-6">
        <h3 className="font-display font-semibold text-lg text-edsync-text mb-2">
          My Interests
        </h3>
        <p className="text-edsync-subtle text-sm mb-4">
          We use these to personalize "Why This Matters" connections in your
          lessons
        </p>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => {
            const selected = interests.includes(interest);
            return (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selected
                    ? "bg-edsync-blue text-white shadow-glow-blue"
                    : "bg-edsync-card text-edsync-subtle border border-edsync-border hover:border-edsync-muted hover:text-edsync-text"
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>
        {editing && interests.length > 0 && (
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary mt-4 text-sm py-2"
          >
            Save Interests
          </button>
        )}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="btn-ghost mt-4 text-sm"
          >
            Update interests →
          </button>
        )}
      </div>

      {/* Learning Stats Hexagon */}
      <div className="edsync-card">
        <h3 className="font-display font-semibold text-lg text-edsync-text mb-4">
          Learning Stats Hexagon
        </h3>
        <p className="text-edsync-subtle text-sm mb-4">
          This chart shows your strengths and weak points across 6 learning
          dimensions.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="bg-edsync-surface border border-edsync-border rounded-2xl p-4">
            <svg viewBox="0 0 400 330" className="w-full max-w-[440px] mx-auto">
              {ringLevels.map((level) => {
                const points = chartAngles
                  .map((angle) => {
                    const point = polarPoint(
                      chartCenterX,
                      chartCenterY,
                      (chartRadius * level) / 100,
                      angle,
                    );
                    return `${point.x},${point.y}`;
                  })
                  .join(" ");

                return (
                  <polygon
                    key={`ring-${level}`}
                    points={points}
                    fill="none"
                    stroke="rgba(139,149,167,0.22)"
                    strokeWidth={1}
                  />
                );
              })}

              {chartAngles.map((angle, index) => {
                const end = polarPoint(
                  chartCenterX,
                  chartCenterY,
                  chartRadius,
                  angle,
                );
                return (
                  <line
                    key={`axis-${skillMetrics[index].key}`}
                    x1={chartCenterX}
                    y1={chartCenterY}
                    x2={end.x}
                    y2={end.y}
                    stroke="rgba(139,149,167,0.25)"
                    strokeWidth={1}
                  />
                );
              })}

              <polygon
                points={chartAngles
                  .map((angle, index) => {
                    const point = polarPoint(
                      chartCenterX,
                      chartCenterY,
                      (chartRadius * skillMetrics[index].value) / 100,
                      angle,
                    );
                    return `${point.x},${point.y}`;
                  })
                  .join(" ")}
                fill="rgba(79,134,247,0.28)"
                stroke="rgba(79,134,247,0.9)"
                strokeWidth={2}
              />

              {chartAngles.map((angle, index) => {
                const metric = skillMetrics[index];
                const point = polarPoint(
                  chartCenterX,
                  chartCenterY,
                  (chartRadius * metric.value) / 100,
                  angle,
                );

                return (
                  <circle
                    key={`point-${metric.key}`}
                    cx={point.x}
                    cy={point.y}
                    r={4}
                    fill="#4F86F7"
                  />
                );
              })}

              {chartAngles.map((angle, index) => {
                const metric = skillMetrics[index];
                const point = polarPoint(
                  chartCenterX,
                  chartCenterY,
                  chartRadius + 24,
                  angle,
                );

                const deltaX = point.x - chartCenterX;
                const anchor =
                  Math.abs(deltaX) < 8
                    ? "middle"
                    : deltaX > 0
                      ? "start"
                      : "end";

                return (
                  <g key={`label-${metric.key}`}>
                    <text
                      x={point.x}
                      y={point.y}
                      textAnchor={anchor}
                      className="fill-edsync-text"
                      style={{ fontSize: "11px", fontWeight: 600 }}
                    >
                      {metric.label}
                    </text>
                    <text
                      x={point.x}
                      y={point.y + 14}
                      textAnchor={anchor}
                      className="fill-edsync-subtle"
                      style={{ fontSize: "11px" }}
                    >
                      {metric.value}%
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-edsync-text">
              Where To Focus Next
            </p>
            {weakAreas.map((area) => (
              <div
                key={area.key}
                className="p-4 rounded-xl border border-edsync-border bg-edsync-surface"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-edsync-text text-sm">
                    {area.label}
                  </p>
                  <span className="text-sm font-bold text-edsync-amber">
                    {area.value}%
                  </span>
                </div>
                <p className="text-xs text-edsync-subtle">{area.tip}</p>
              </div>
            ))}

            <div className="pt-2 border-t border-edsync-border">
              <div className="grid grid-cols-2 gap-2">
                {skillMetrics.map((metric) => (
                  <div
                    key={metric.key}
                    className="px-3 py-2 rounded-lg border border-edsync-border bg-edsync-card"
                  >
                    <p className="text-xs text-edsync-subtle">{metric.label}</p>
                    <p className="text-sm font-semibold text-edsync-text">
                      {metric.value}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
