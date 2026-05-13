"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import { GRADE_LEVELS, SUBJECT_AREAS } from "@/lib/grades";
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
    setSaving(true);
    const { error } = await edsync
      .from("profiles")
      .update({
        full_name: fullName,
        school,
        grade_level: gradeLevel,
        subjects,
        preferences,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProfile({ ...profile, full_name: fullName, school, grade_level: gradeLevel, subjects, preferences });
    toast.success("Profile saved");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-edsync-text">Teacher Profile</h1>
        <p className="text-sm text-edsync-subtle">Manage identity, teaching context, and notifications.</p>
      </div>

      <div className="edsync-card">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-edsync-amber to-edsync-blue text-3xl font-bold text-white">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                generateInitials(fullName || profile?.email || "Teacher")
              )}
            </div>
            <label className="btn-secondary cursor-pointer py-2 text-xs">
              {uploading ? "Uploading..." : "Upload photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => uploadAvatar(event.target.files?.[0])}
              />
            </label>
          </div>

          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-edsync-subtle">Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="edsync-input" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-edsync-subtle">School</span>
              <input value={school} onChange={(event) => setSchool(event.target.value)} className="edsync-input" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-edsync-subtle">Primary grade</span>
              <select value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)} className="edsync-input">
                <option value="">Select grade</option>
                {GRADE_LEVELS.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-edsync-subtle">Theme</span>
              <select
                value={preferences.theme}
                onChange={(event) => setPreferences({ ...preferences, theme: event.target.value as UserPreferences["theme"] })}
                className="edsync-input"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="edsync-card">
        <h2 className="font-display text-lg font-bold text-edsync-text">Teaching subjects</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {SUBJECT_AREAS.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => toggleSubject(subject)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
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

      <div className="edsync-card">
        <h2 className="font-display text-lg font-bold text-edsync-text">Notifications</h2>
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
                onChange={(event) => setPreferences({ ...preferences, [key]: event.target.checked })}
              />
            </label>
          ))}
        </div>
      </div>

      <button type="button" onClick={save} disabled={saving} className="btn-primary">
        {saving ? "Saving..." : "Save profile"}
      </button>
    </div>
  );
}
