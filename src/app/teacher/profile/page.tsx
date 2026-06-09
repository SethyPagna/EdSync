"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import SectionOrderSettings from "@/components/SectionOrderSettings";
import { validateDisplayName } from "@/lib/auth/display-name";
import { createClient } from "@/lib/edsync/client";
import { GRADE_LEVELS, SUBJECT_AREAS } from "@/lib/grades";
import { validateGradeLevel, validateOptionalProfileLine, validateSubjectAreas } from "@/lib/validation/profile-fields";
import { generateInitials } from "@/lib/utils";
import type { Profile, UserPreferences } from "@/types";

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "light",
  text_size: "medium",
  email_notifications: true,
  assignment_notifications: true,
  weekly_digest: true,
};

export default function TeacherProfile() {
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    edsync.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      edsync
        .from<Profile>("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setProfile(data);
          setFullName(data.full_name || "");
          setSchool(data.school || "");
          setGradeLevel(data.grade_level || "");
          setSubjects(data.subjects || []);
          setPreferences({ ...DEFAULT_PREFERENCES, ...(data.preferences || {}) });
        });
    });
  }, [edsync]);

  const toggleSubject = (subject: string) => {
    setSubjects((current) =>
      current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject],
    );
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file || !profile) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const { data, error } = await edsync.storage
      .from("avatars")
      .upload(`avatar-${Date.now()}.${ext}`, file, { upsert: true });
    if (error || !data) {
      toast.error(error?.message || "Avatar upload failed");
      setUploading(false);
      return;
    }
    await edsync.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", profile.id);
    setProfile({ ...profile, avatar_url: data.publicUrl });
    setUploading(false);
    toast.success("Avatar updated");
  };

  const save = async () => {
    if (!profile) return;
    let normalizedFullName: string | null;
    try {
      normalizedFullName = validateDisplayName(fullName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Full name is invalid.");
      return;
    }
    let normalizedSchool: string | null;
    let normalizedGradeLevel: string | null;
    let normalizedSubjects: string[];
    try {
      normalizedSchool = validateOptionalProfileLine(school, "Organization or brand");
      normalizedGradeLevel = validateGradeLevel(gradeLevel);
      normalizedSubjects = validateSubjectAreas(subjects);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile details are invalid.");
      return;
    }
    setSaving(true);
    const { error } = await edsync
      .from("profiles")
      .update({
        full_name: normalizedFullName,
        school: normalizedSchool,
        grade_level: normalizedGradeLevel,
        subjects: normalizedSubjects,
        preferences,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFullName(normalizedFullName || "");
    setSchool(normalizedSchool || "");
    setGradeLevel(normalizedGradeLevel || "");
    setSubjects(normalizedSubjects);
    setProfile({
      ...profile,
      full_name: normalizedFullName,
      school: normalizedSchool,
      grade_level: normalizedGradeLevel,
      subjects: normalizedSubjects,
      preferences,
    });
    toast.success("Profile saved");
  };

  return (
    <div className="page-shell max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-edsync-amber">
            Account
          </p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">
            Profile & Settings
          </h1>
        </div>
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      <div className="edsync-card">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-edsync-amber to-edsync-blue text-3xl font-bold text-white">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                generateInitials(fullName || profile?.email || "Creator")
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-edsync-text">
                {profile?.email || "Creator account"}
              </p>
              <label className="btn-secondary mt-3 inline-flex cursor-pointer py-2 text-xs">
                {uploading ? "Uploading..." : "Upload photo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => uploadAvatar(event.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-edsync-subtle">
                  Full name
                </span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="edsync-input"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-edsync-subtle">
                  Organization or brand
                </span>
                <input
                  value={school}
                  onChange={(event) => setSchool(event.target.value)}
                  className="edsync-input"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-edsync-subtle">
                  Audience level
                </span>
                <select
                  value={gradeLevel}
                  onChange={(event) => setGradeLevel(event.target.value)}
                  className="edsync-input"
                >
                  <option value="">Select audience</option>
                  {GRADE_LEVELS.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-edsync-subtle">
                  Theme
                </span>
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
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-edsync-text">
                Course topics
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUBJECT_AREAS.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      subjects.includes(subject)
                        ? "border-edsync-blue bg-edsync-blue text-white"
                        : "border-edsync-border text-edsync-subtle hover:text-edsync-text"
                    }`}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-edsync-text">
                Notifications
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  ["email_notifications", "Email"],
                  ["assignment_notifications", "Work"],
                  ["weekly_digest", "Digest"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded-xl border border-edsync-border bg-edsync-surface px-3 py-2.5"
                  >
                    <span className="text-sm font-semibold text-edsync-text">
                      {label}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences[key as keyof UserPreferences])}
                      onChange={(event) =>
                        setPreferences({
                          ...preferences,
                          [key]: event.target.checked,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SectionOrderSettings
        storageKey="edsync-teacher-profile-section-order"
        sections={[
          "Dashboard",
          "Create Course",
          "Courses",
          "Work",
          "Feedback",
          "Notes",
          "Planner",
          "Learners",
          "Insights",
        ]}
      />

    </div>
  );
}
