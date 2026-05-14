"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/edsync/client";
import NotificationMenu from "@/components/NotificationMenu";
import type { Profile, UserPreferences } from "@/types";
import { generateInitials } from "@/lib/utils";
import {
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  Brain,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Sun,
  ShieldCheck,
  StickyNote,
  MessageSquareText,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  plan?: "solo" | "team" | "enterprise";
};

export type ShellNavGroup = {
  label: string;
  items: ShellNavItem[];
};

type AppShellProps = {
  role: "admin" | "teacher" | "student";
  children: React.ReactNode;
  navItems: ShellNavItem[];
};

const roleCopy = {
  teacher: {
    label: "Teacher Workspace",
    accent: "text-edsync-amber",
    badge: "bg-edsync-amber/10 border-edsync-amber/25 text-edsync-amber",
    gradient: "from-edsync-amber to-edsync-blue",
  },
  admin: {
    label: "Admin Console",
    accent: "text-edsync-blue",
    badge: "bg-edsync-blue/10 border-edsync-blue/25 text-edsync-blue",
    gradient: "from-edsync-blue to-edsync-cyan",
  },
  student: {
    label: "Student Learning OS",
    accent: "text-edsync-emerald",
    badge: "bg-edsync-emerald/10 border-edsync-emerald/25 text-edsync-emerald",
    gradient: "from-edsync-emerald to-edsync-cyan",
  },
};

export const teacherNavItems: ShellNavItem[] = [
  { href: "/teacher/dashboard", label: "Command Center", icon: LayoutDashboard },
  { href: "/teacher/lessons", label: "Lessons", icon: BookOpenCheck },
  { href: "/teacher/lessons/create", label: "New Lesson", icon: Plus },
  { href: "/teacher/work", label: "Work", icon: FileCheck2 },
  { href: "/teacher/gradebook", label: "Gradebook", icon: ClipboardList },
  { href: "/teacher/notes", label: "Notes", icon: StickyNote },
  { href: "/teacher/discussions", label: "Discussions", icon: MessageSquareText },
  { href: "/teacher/planner", label: "Planner", icon: CalendarClock },
  { href: "/teacher/students", label: "Students", icon: UsersRound },
  { href: "/teacher/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/teacher/reports", label: "Reports", icon: ClipboardList },
  { href: "/teacher/profile", label: "Profile", icon: UserRound },
];

export const studentNavItems: ShellNavItem[] = [
  { href: "/student/dashboard", label: "Learning Cockpit", icon: LayoutDashboard },
  { href: "/student/work", label: "My Work", icon: FileCheck2 },
  { href: "/student/grades", label: "Grades", icon: ClipboardList },
  { href: "/student/notes", label: "Notes", icon: StickyNote },
  { href: "/student/discussions", label: "Discussions", icon: MessageSquareText },
  { href: "/student/profile", label: "Profile", icon: UserRound },
];

export const adminNavItems: ShellNavItem[] = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: UsersRound },
  { href: "/admin/portals", label: "Portals", icon: GraduationCap, permission: "portals.manage", plan: "team" },
  { href: "/admin/permissions", label: "Permissions", icon: ShieldCheck, permission: "users.manage", plan: "enterprise" },
  { href: "/admin/governance", label: "Governance Hub", icon: ShieldCheck },
  { href: "/admin/ai", label: "AI Providers", icon: Brain },
  { href: "/admin/standards", label: "Standards", icon: FileCheck2, permission: "courses.author", plan: "team" },
  { href: "/admin/certifications", label: "Certifications", icon: ClipboardList, permission: "courses.publish", plan: "team" },
  { href: "/admin/automation", label: "Automation", icon: Sparkles, permission: "courses.publish", plan: "team" },
  { href: "/admin/billing", label: "Billing", icon: CalendarClock, permission: "billing.manage", plan: "team" },
  { href: "/admin/email", label: "Email Outbox", icon: MessageSquareText },
  { href: "/admin/security", label: "Security", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: ClipboardList },
  { href: "/admin/view/teacher", label: "Teacher View", icon: GraduationCap },
  { href: "/admin/view/student", label: "Student View", icon: BookOpenCheck },
];

function navGroupsForRole(role: AppShellProps["role"], navItems: ShellNavItem[]): ShellNavGroup[] {
  const byHref = new Map(navItems.map((item) => [item.href, item]));
  const pick = (hrefs: string[]) => hrefs.map((href) => byHref.get(href)).filter(Boolean) as ShellNavItem[];

  if (role === "admin") {
    return [
      { label: "Home", items: pick(["/admin/dashboard"]) },
      { label: "Platform", items: pick(["/admin/users", "/admin/portals", "/admin/permissions"]) },
      { label: "Learning Ops", items: pick(["/admin/email"]) },
      { label: "Intelligence", items: pick(["/admin/ai"]) },
      { label: "Governance", items: pick(["/admin/governance", "/admin/security"]) },
      { label: "System", items: pick(["/admin/billing", "/admin/settings"]) },
      { label: "View As", items: pick(["/admin/view/teacher", "/admin/view/student"]) },
    ];
  }

  if (role === "teacher") {
    return [
      { label: "Home", items: pick(["/teacher/dashboard"]) },
      { label: "Create", items: pick(["/teacher/lessons", "/teacher/lessons/create"]) },
      { label: "Classroom", items: pick(["/teacher/work", "/teacher/gradebook", "/teacher/notes", "/teacher/discussions", "/teacher/planner", "/teacher/students"]) },
      { label: "Insights", items: pick(["/teacher/analytics", "/teacher/reports"]) },
      { label: "Account", items: pick(["/teacher/profile"]) },
    ];
  }

  return [
    { label: "Home", items: pick(["/student/dashboard"]) },
    { label: "Learning", items: pick(["/student/work", "/student/grades"]) },
    { label: "Support", items: pick(["/student/notes", "/student/discussions"]) },
    { label: "Account", items: pick(["/student/profile"]) },
  ];
}

export default function AppShell({ role, children, navItems }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [planTier, setPlanTier] = useState<"solo" | "team" | "enterprise">("solo");
  const [sessionRole, setSessionRole] = useState<"admin" | "teacher" | "student" | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const copy = roleCopy[role];
  const isAdminViewMode = sessionRole === "admin" && role !== "admin";

  useEffect(() => {
    const stored = window.localStorage.getItem("edsync-theme");
    const useDark = stored === "dark";
    document.documentElement.classList.toggle("dark", useDark);
    setDarkMode(useDark);
  }, []);

  useEffect(() => {
    edsync.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const actualRole = user.user_metadata?.role;
      if (actualRole === "admin" || actualRole === "teacher" || actualRole === "student") {
        setSessionRole(actualRole);
      }
      edsync
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setProfile(data);
          const theme = data?.preferences?.theme;
          if (theme === "dark" || theme === "light") {
            const useDark = theme === "dark";
            document.documentElement.classList.toggle("dark", useDark);
            window.localStorage.setItem("edsync-theme", theme);
            setDarkMode(useDark);
          }
        });
    });
  }, [edsync]);

  useEffect(() => {
    fetch("/api/permissions")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload?.data) return;
        setPermissions(payload.data.granted ?? []);
        const tier = payload.data.context?.tenant?.plan_tier;
        if (tier === "team" || tier === "enterprise") setPlanTier(tier);
      })
      .catch(() => {
        setPermissions([]);
      });
  }, []);

  const handleLogout = async () => {
    await edsync.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    const theme: UserPreferences["theme"] = next ? "dark" : "light";
    window.localStorage.setItem("edsync-theme", theme);
    if (profile) {
      const preferences = { ...(profile.preferences ?? { text_size: "medium" }), theme };
      setProfile({ ...profile, preferences });
      edsync.from("profiles").update({ preferences }).eq("id", profile.id);
    }
  };

  const visibleNavGroups = navGroupsForRole(role, navItems)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (role === "admin") return true;
        if (item.permission && !permissions.includes(item.permission)) return false;
        if (item.plan === "team" && planTier === "solo") return false;
        if (item.plan === "enterprise" && planTier !== "enterprise") return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  const isGroupOpen = (label: string) => openGroups[label] ?? true;

  const renderNavItem = (item: ShellNavItem) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? item.label : undefined}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
          isActive
            ? "bg-edsync-blue/12 text-edsync-blue ring-1 ring-edsync-blue/25"
            : "text-edsync-subtle hover:bg-edsync-card hover:text-edsync-text"
        } ${collapsed ? "justify-center" : ""}`}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const sidebar = (
    <aside
      className={`${collapsed ? "lg:w-[76px]" : "lg:w-72"} flex h-dvh w-72 flex-col border-r border-edsync-border bg-edsync-surface shadow-xl shadow-slate-200/60 transition-all duration-300 dark:shadow-black/20`}
    >
      <div className="flex items-center gap-3 border-b border-edsync-border px-4 py-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${copy.gradient}`}
          >
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-edsync-text">
                EdSync
              </p>
              <p className="text-xs text-edsync-subtle">{copy.label}</p>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-2 text-edsync-subtle hover:bg-edsync-card hover:text-edsync-text lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {!collapsed && (
        <div className="mx-4 mt-4 rounded-xl border border-edsync-border bg-edsync-card/70 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-edsync-surface text-sm font-bold text-edsync-text">
              {generateInitials(profile?.full_name || profile?.email || role)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-edsync-text">
                {profile?.full_name || "Getting ready"}
              </p>
              <p className="truncate text-xs text-edsync-subtle">
                {profile?.email || "Connect edsync to personalize"}
              </p>
            </div>
          </div>
          {role === "admin" && (
            <div className="mt-3 rounded-lg border border-edsync-blue/20 bg-edsync-blue/10 px-3 py-2 text-xs font-semibold text-edsync-blue">
              Read-only view mode is audited.
            </div>
          )}
          {role === "student" && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-edsync-subtle">
                <span>{profile?.total_xp ?? 0} XP</span>
                <span>{profile?.streak_days ?? 0} day streak</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(profile?.total_xp ?? 0) % 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="px-4 pt-4">
        {!collapsed && (
          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${copy.badge}`}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            AI-assisted workspace
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto p-3">
        {isAdminViewMode && (
          <Link
            href="/admin/dashboard"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? "Back to Admin" : undefined}
            className={`mb-2 flex items-center gap-3 rounded-xl border border-edsync-blue/25 bg-edsync-blue/10 px-3 py-3 text-sm font-bold text-edsync-blue transition-all hover:bg-edsync-blue/15 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <ShieldCheck className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Back to Admin</span>}
          </Link>
        )}
        {visibleNavGroups.map((group) => {
          const groupActive = group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
          const open = isGroupOpen(group.label);
          return (
            <div key={group.label} className={collapsed ? "space-y-1" : "space-y-1.5"}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setOpenGroups((current) => ({ ...current, [group.label]: !open }))}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                    groupActive ? "text-edsync-blue" : "text-edsync-subtle hover:bg-edsync-card hover:text-edsync-text"
                  }`}
                >
                  <span>{group.label}</span>
                  <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
                </button>
              )}
              {(collapsed || open) && <div className="space-y-1">{group.items.map(renderNavItem)}</div>}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-edsync-border p-3">
        <button
          type="button"
          onClick={toggleTheme}
          className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-edsync-subtle hover:bg-edsync-card hover:text-edsync-text ${collapsed ? "justify-center" : ""}`}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {!collapsed && (darkMode ? "Light theme" : "Dark theme")}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-edsync-subtle hover:bg-edsync-card hover:text-edsync-text lg:flex"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
          {!collapsed && "Collapse sidebar"}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-edsync-red hover:bg-edsync-red/10 ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-edsync-bg text-edsync-text">
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-edsync-border bg-edsync-bg px-4 py-3 shadow-sm lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-edsync-border bg-edsync-card p-2 text-edsync-text"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="flex items-center gap-2 font-display font-bold">
          <Brain className={`h-5 w-5 ${copy.accent}`} />
          EdSync
        </Link>
        <NotificationMenu />
      </div>

      <div>
        <div
          className={`${collapsed ? "lg:w-[76px]" : "lg:w-72"} fixed inset-y-0 left-0 z-40 hidden transition-all duration-300 lg:block`}
        >
          {sidebar}
        </div>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation overlay"
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative h-full w-72">{sidebar}</div>
          </div>
        )}
        <main
          className={`${collapsed ? "lg:ml-[76px]" : "lg:ml-72"} min-h-screen overflow-x-hidden pt-16 transition-[margin] duration-300 lg:pt-0`}
        >
          <div className="sticky top-0 z-20 hidden justify-end border-b border-edsync-border bg-edsync-bg px-6 py-3 shadow-sm lg:flex">
            <NotificationMenu />
          </div>
          {isAdminViewMode && (
            <div className="sticky top-14 z-20 border-b border-edsync-blue/20 bg-edsync-blue/10 px-4 py-3 backdrop-blur lg:top-[57px] lg:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3 text-sm text-edsync-blue">
                  <ShieldCheck className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Admin view mode</p>
                    <p className="text-xs text-edsync-subtle">
                      You are previewing the {role === "teacher" ? "teacher" : "student"} workspace with admin access.
                    </p>
                  </div>
                </div>
                <Link href="/admin/dashboard" className="btn-primary w-fit px-4 py-2 text-sm">
                  Back to Admin Console
                </Link>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
