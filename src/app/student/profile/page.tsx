"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Bell, BookOpen, CircleAlert, Flame, LockKeyhole, Palette, UserRound } from "lucide-react";
import { createClient } from "@/lib/edsync/client";
import { validateDisplayName } from "@/lib/auth/display-name";
import { GRADE_LEVELS } from "@/lib/grades";
import { INTEREST_AREAS, validateGradeLevel, validateInterestAreas } from "@/lib/validation/profile-fields";
import { generateInitials } from "@/lib/utils";
import type { Profile, UserPreferences } from "@/types";
import { Button, PageHeader, Skeleton } from "@/components/ui";
import { AppearancePicker } from "@/components/ui/AppearancePicker";

type ProgressRow = { status: string; score: number | null; final_quiz_score: number | null };
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system", text_size: "medium", email_notifications: true,
  assignment_notifications: true, weekly_digest: true,
};
function percentage(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function learningStats(rows: ProgressRow[]) {
  const started = rows.filter((row) => row.status !== "not_started");
  const completed = started.filter((row) => row.status === "completed");
  const scores = rows.map((row) => row.final_quiz_score ?? row.score).filter((score): score is number => typeof score === "number");
  return { started: started.length, completed: completed.length,
    completion: started.length ? percentage(completed.length / started.length * 100) : 0,
    mastery: scores.length ? percentage(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null };
}

export default function StudentProfile() {
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof learningStats>>({ started: 0, completed: 0, completion: 0, mastery: null });
  const [fullName, setFullName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const { data: { user }, error: authError } = await edsync.auth.getUser();
      if (authError || !user) throw new Error(authError?.message || "Sign in to view your profile.");
      const [profileResult, progressResult] = await Promise.all([
        edsync.from("profiles").select("*").eq("id", user.id).single(),
        edsync.from("student_progress").select("status, score, final_quiz_score").eq("student_id", user.id),
      ]);
      if (profileResult.error || !profileResult.data) throw new Error(profileResult.error?.message || "Profile could not load.");
      const data = profileResult.data as Profile;
      setProfile(data); setFullName(data.full_name || ""); setGradeLevel(data.grade_level || "");
      setInterests(data.interests || []);
      setPreferences({ ...DEFAULT_PREFERENCES, ...(data.preferences || {}) });
      setStats(learningStats((progressResult.data || []) as ProgressRow[]));
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Profile could not load."); }
    finally { setLoading(false); }
  }, [edsync]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const save = async () => {
    let name: string | null;
    let level: string | null;
    let selectedInterests: string[];
    try {
      name = validateDisplayName(fullName);
      level = validateGradeLevel(gradeLevel);
      selectedInterests = validateInterestAreas(interests);
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Check your profile details."); return; }
    if (!profile) return;
    setSaving(true); setSaveMessage("");
    try {
      const { error } = await edsync.from("profiles").update({
        full_name: name, grade_level: level, interests: selectedInterests, preferences,
      }).eq("id", profile.id);
      if (error) throw new Error(error.message);
      setProfile({ ...profile, full_name: name, grade_level: level, interests: selectedInterests, preferences });
      setFullName(name || ""); setGradeLevel(level || ""); setInterests(selectedInterests);
      setSaveMessage("Changes saved.");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Could not save changes."); }
    finally { setSaving(false); }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file || !profile) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setSaveMessage("Choose a JPG, PNG, or WebP image under 5 MB."); return;
    }
    setUploadingAvatar(true); setSaveMessage("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const { data, error } = await edsync.storage.from("avatars").upload(`avatar-${crypto.randomUUID()}.${extension}`, file, { upsert: true });
      if (error || !data) throw new Error(error?.message || "Avatar upload failed.");
      const { error: updateError } = await edsync.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", profile.id);
      if (updateError) throw new Error(updateError.message);
      setProfile({ ...profile, avatar_url: data.publicUrl });
      setSaveMessage("Photo updated.");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Avatar upload failed."); }
    finally { setUploadingAvatar(false); }
  };

  const toggleInterest = (interest: string) => { setInterests((value) => value.includes(interest) ? value.filter((item) => item !== interest) : [...value, interest]); setSaveMessage(""); };
  const changePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => { setPreferences((current) => ({ ...current, [key]: value })); setSaveMessage(""); };

  return <div className="page-shell max-w-5xl">
    <PageHeader title="Profile & settings" icon={UserRound} actions={<Button variant="primary" loading={saving} disabled={loading || !profile} onClick={() => void save()}>Save changes</Button>} />
    {saveMessage && <p role="status" className={`mb-4 rounded-lg p-3 text-sm ${saveMessage.endsWith("saved.") || saveMessage.endsWith("updated.") ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{saveMessage}</p>}
    {loading ? <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-48" />)}</div> :
      loadError ? <div role="alert" className="rounded-xl border border-line bg-surface p-6"><CircleAlert className="mb-3 text-danger" /><h2 className="font-semibold">Profile unavailable</h2><p className="my-2 text-sm text-fg-muted">{loadError}</p><Button onClick={() => void load()}>Try again</Button></div> :
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg"><UserRound size={17} className="text-accent" />Account</h2>
          <div className="mb-5 flex items-center gap-4">
            <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent-soft text-lg font-semibold text-accent">{profile?.avatar_url ? <Image src={profile.avatar_url} alt="" fill sizes="64px" className="object-cover" /> : generateInitials(profile?.full_name || profile?.email || "Student")}</div>
            <div className="min-w-0"><p className="truncate text-sm font-medium text-fg">{profile?.email}</p><label className="mt-1 inline-block cursor-pointer text-xs font-semibold text-accent hover:underline">{uploadingAvatar ? "Uploading…" : "Change photo"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploadingAvatar} onChange={(event) => void uploadAvatar(event.target.files?.[0])} /></label></div>
          </div>
          <label className="block text-sm font-medium text-fg">Full name<input className="input mt-1 w-full" value={fullName} onChange={(event) => { setFullName(event.target.value); setSaveMessage(""); }} autoComplete="name" maxLength={80} /></label>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg"><Palette size={17} className="text-accent" />Appearance</h2>
          <AppearancePicker onChange={(appearance) => changePreference("theme", appearance.theme)} />
          <label className="mt-4 block text-sm font-medium text-fg">Reading text size<select className="select mt-1 w-full" value={preferences.text_size} onChange={(event) => changePreference("text_size", event.target.value as UserPreferences["text_size"])}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg"><BookOpen size={17} className="text-accent" />Learning preferences</h2>
          <label className="block text-sm font-medium text-fg">Level<select className="select mt-1 w-full" value={gradeLevel} onChange={(event) => { setGradeLevel(event.target.value); setSaveMessage(""); }}><option value="">Select a level</option>{GRADE_LEVELS.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></label>
          <fieldset className="mt-4"><legend className="text-sm font-medium text-fg">Interests</legend><div className="mt-2 flex flex-wrap gap-2">{INTEREST_AREAS.map((interest) => <button type="button" aria-pressed={interests.includes(interest)} key={interest} onClick={() => toggleInterest(interest)} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${interests.includes(interest) ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-muted hover:text-fg"}`}>{interest}</button>)}</div></fieldset>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center"><div><p className="text-lg font-semibold text-fg">{stats.completed}</p><p className="text-xs text-fg-muted">Completed</p></div><div><p className="text-lg font-semibold text-fg">{stats.mastery === null ? "—" : `${stats.mastery}%`}</p><p className="text-xs text-fg-muted">Quiz average</p></div><div><p className="flex items-center justify-center gap-1 text-lg font-semibold text-fg"><Flame size={16} className="text-warning" />{profile?.streak_days ?? 0}</p><p className="text-xs text-fg-muted">Day streak</p></div></div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-line bg-surface p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg"><Bell size={17} className="text-accent" />Notifications</h2><div className="space-y-3">{([
            ["email_notifications", "Email updates"], ["assignment_notifications", "Assessment reminders"], ["weekly_digest", "Weekly digest"],
          ] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 text-sm text-fg"><span>{label}</span><input type="checkbox" className="accent-accent" checked={preferences[key] !== false} onChange={(event) => changePreference(key, event.target.checked)} /></label>)}</div></section>
          <section className="rounded-xl border border-line bg-surface p-5"><h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg"><LockKeyhole size={17} className="text-accent" />Privacy</h2><p className="text-sm leading-6 text-fg-muted">Your learning records are tied to your account and class membership. Your school or workspace administrator manages access to those records.</p></section>
        </div>
      </div>}
  </div>;
}
