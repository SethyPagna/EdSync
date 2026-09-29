"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Bell, BookOpen, CircleAlert, Palette, UserRound } from "lucide-react";
import { AppearancePicker } from "@/components/ui/AppearancePicker";
import { Button, PageHeader, Skeleton } from "@/components/ui";
import { validateDisplayName } from "@/lib/auth/display-name";
import { createClient } from "@/lib/edsync/client";
import { GRADE_LEVELS, SUBJECT_AREAS } from "@/lib/grades";
import { validateGradeLevel, validateOptionalProfileLine, validateSubjectAreas } from "@/lib/validation/profile-fields";
import { generateInitials } from "@/lib/utils";
import type { Profile, UserPreferences } from "@/types";

const defaults: UserPreferences = {
  theme: "system",
  text_size: "medium",
  email_notifications: true,
  assignment_notifications: true,
  weekly_digest: true,
};

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : "Could not save changes.";
}

export default function TeacherProfile() {
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(defaults);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data: { user }, error: authError } = await edsync.auth.getUser();
      if (authError || !user) throw new Error(authError?.message || "Sign in to see your profile.");
      const { data, error } = await edsync.from<Profile>("profiles").select("*").eq("id", user.id).single();
      if (error || !data) throw new Error(error?.message || "Profile could not load.");
      setProfile(data);
      setFullName(data.full_name || "");
      setSchool(data.school || "");
      setGradeLevel(data.grade_level || "");
      setSubjects(data.subjects || []);
      setPreferences({ ...defaults, ...(data.preferences || {}) });
    } catch (cause) {
      setLoadError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async () => {
    if (!profile || saving) return;
    setSaveMessage("");
    let name: string | null;
    let organization: string | null;
    let level: string | null;
    let topics: string[];
    try {
      name = validateDisplayName(fullName);
      organization = validateOptionalProfileLine(school, "Organization or brand");
      level = validateGradeLevel(gradeLevel);
      topics = validateSubjectAreas(subjects);
    } catch (cause) {
      setSaveMessage(errorText(cause));
      return;
    }
    setSaving(true);
    try {
      const { error } = await edsync.from("profiles").update({
        full_name: name,
        school: organization,
        grade_level: level,
        subjects: topics,
        preferences,
      }).eq("id", profile.id);
      if (error) throw error;
      setProfile({ ...profile, full_name: name, school: organization, grade_level: level, subjects: topics, preferences });
      setFullName(name || "");
      setSchool(organization || "");
      setGradeLevel(level || "");
      setSubjects(topics);
      setSaveMessage("Changes saved.");
    } catch (cause) {
      setSaveMessage(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file || !profile || uploading) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setSaveMessage("Choose a JPG, PNG or WebP image under 5 MB.");
      return;
    }
    setUploading(true);
    setSaveMessage("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const { data, error } = await edsync.storage.from("avatars").upload("avatar-" + crypto.randomUUID() + "." + extension, file, { upsert: true });
      if (error || !data) throw error || new Error("Avatar upload failed.");
      const { error: updateError } = await edsync.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", profile.id);
      if (updateError) throw updateError;
      setProfile({ ...profile, avatar_url: data.publicUrl });
      setSaveMessage("Photo updated.");
    } catch (cause) {
      setSaveMessage(errorText(cause));
    } finally {
      setUploading(false);
    }
  };

  const toggleSubject = (subject: string) => {
    setSubjects((current) => current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject]);
    setSaveMessage("");
  };
  const changePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaveMessage("");
  };

  return (
    <main className="page max-w-5xl">
      <PageHeader title="Profile" icon={UserRound} actions={<Button variant="primary" size="sm" loading={saving} disabled={loading || !profile} onClick={() => void save()}>Save changes</Button>} />
      {saveMessage ? <p role="status" className={"mb-4 rounded-xl p-3 text-sm " + (saveMessage.endsWith("saved.") || saveMessage.endsWith("updated.") ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>{saveMessage}</p> : null}
      {loading ? <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-48" />)}</div> :
        loadError ? <div role="alert" className="rounded-xl border border-line bg-surface p-6"><CircleAlert className="mb-3 text-danger" /><h2 className="font-semibold text-fg">Profile unavailable</h2><p className="my-2 text-sm text-fg-muted">{loadError}</p><Button onClick={() => void load()}>Retry</Button></div> :
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg"><UserRound size={17} className="text-accent" />Account</h2>
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent-soft text-lg font-semibold text-accent">{profile?.avatar_url ? <Image src={profile.avatar_url} alt="" fill sizes="64px" className="object-cover" /> : generateInitials(profile?.full_name || profile?.email || "Teacher")}</div>
              <div className="min-w-0"><p className="truncate text-sm font-medium text-fg">{profile?.email}</p><label className="mt-1 inline-block cursor-pointer text-xs font-semibold text-accent hover:underline">{uploading ? "Uploading…" : "Change photo"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(event) => void uploadAvatar(event.target.files?.[0])} /></label></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-fg">Full name<input className="input mt-1 w-full" value={fullName} maxLength={80} autoComplete="name" onChange={(event) => { setFullName(event.target.value); setSaveMessage(""); }} /></label>
              <label className="block text-sm font-medium text-fg">Organization or brand<input className="input mt-1 w-full" value={school} onChange={(event) => { setSchool(event.target.value); setSaveMessage(""); }} /></label>
            </div>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg"><Palette size={17} className="text-accent" />Appearance</h2>
            <AppearancePicker onChange={(appearance) => changePreference("theme", appearance.theme)} />
            <label className="mt-4 block text-sm font-medium text-fg">Text size<select className="input mt-1 w-full" value={preferences.text_size} onChange={(event) => changePreference("text_size", event.target.value as UserPreferences["text_size"])}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg"><BookOpen size={17} className="text-accent" />Teaching defaults</h2>
            <label className="block text-sm font-medium text-fg">Audience level<select className="input mt-1 w-full" value={gradeLevel} onChange={(event) => { setGradeLevel(event.target.value); setSaveMessage(""); }}><option value="">Choose a level</option>{GRADE_LEVELS.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></label>
            <fieldset className="mt-4"><legend className="text-sm font-medium text-fg">Course topics</legend><div className="mt-2 flex flex-wrap gap-2">{SUBJECT_AREAS.map((subject) => <button key={subject} type="button" aria-pressed={subjects.includes(subject)} onClick={() => toggleSubject(subject)} className={"rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " + (subjects.includes(subject) ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-muted hover:text-fg")}>{subject}</button>)}</div></fieldset>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg"><Bell size={17} className="text-accent" />Notifications</h2>
            <div className="space-y-3">{([
              ["email_notifications", "Email updates"],
              ["assignment_notifications", "Assignment updates"],
              ["weekly_digest", "Weekly digest"],
            ] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 text-sm text-fg"><span>{label}</span><input type="checkbox" checked={preferences[key] !== false} onChange={(event) => changePreference(key, event.target.checked)} /></label>)}</div>
          </section>
        </div>}
    </main>
  );
}
