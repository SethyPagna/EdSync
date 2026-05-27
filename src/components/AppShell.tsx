"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/edsync/client";
import NotificationMenu from "@/components/NotificationMenu";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle, { type ThemePreference } from "@/components/ThemeToggle";
import { SECTION_ORDER_EVENT, type SectionOrderEventDetail } from "@/components/SectionOrderSettings";
import type { Profile } from "@/types";
import { generateInitials } from "@/lib/utils";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarClock,
  Brain,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
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

type WorkspaceContext = {
  type: "organization" | "individual";
  organizationCode?: string | null;
  organizationName?: string | null;
};

const roleCopy = {
  teacher: {
    label: "Teaching Workspace",
    accent: "text-edsync-blue",
    gradient: "from-edsync-blue to-edsync-emerald",
  },
  admin: {
    label: "Platform Admin",
    accent: "text-edsync-blue",
    gradient: "from-edsync-blue to-edsync-emerald",
  },
  student: {
    label: "Student Workspace",
    accent: "text-edsync-blue",
    gradient: "from-edsync-blue to-edsync-emerald",
  },
};

function sessionRoleFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("edsync-role="));
  const role = match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
  return role === "admin" || role === "teacher" || role === "student" ? role : null;
}

function pathWithoutQuery(href: string) {
  return href.split("?")[0];
}

function appendAdminViewMode(href: string, mode: "teacher" | "student" | null) {
  if (!mode || href.includes("adminView=")) return href;
  if (href.startsWith("/teacher") || href.startsWith("/student") || href === "/ai" || href === "/practice") {
    return `${href}${href.includes("?") ? "&" : "?"}adminView=${mode}`;
  }
  return href;
}

function workspaceContextFromStorage(): WorkspaceContext | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem("edsync-auth-workspace") || "null") as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    return {
      type: record.type === "organization" ? "organization" : "individual",
      organizationCode: typeof record.organizationCode === "string" ? record.organizationCode : null,
      organizationName: typeof record.organizationName === "string" ? record.organizationName : null,
    };
  } catch {
    return null;
  }
}

function sidebarCollapsedFromStorage() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("edsync-sidebar-collapsed") === "true";
}

function sectionOrderStorageKey(role: AppShellProps["role"]) {
  if (role === "admin") return "edsync-admin-settings-section-order";
  if (role === "teacher") return "edsync-teacher-profile-section-order";
  return "edsync-student-profile-section-order";
}

function readSectionOrder(storageKey: string) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function navOrderLabel(item: ShellNavItem) {
  if (item.label === "Portals") return "Organizations";
  if (item.label === "AI Providers") return "AI providers";
  return item.label;
}

function reorderGroupsByPreference(groups: ShellNavGroup[], preferredOrder: string[]) {
  if (preferredOrder.length === 0) return groups;
  const orderIndex = new Map(preferredOrder.map((label, index) => [label, index]));
  const groupRank = (group: ShellNavGroup) =>
    Math.min(...group.items.map((item) => orderIndex.get(navOrderLabel(item)) ?? Number.MAX_SAFE_INTEGER));

  return groups
    .map((group, originalIndex) => ({
      ...group,
      originalIndex,
      rank: groupRank(group),
      items: [...group.items].sort((left, right) => {
        const leftRank = orderIndex.get(navOrderLabel(left)) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = orderIndex.get(navOrderLabel(right)) ?? Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank;
      }),
    }))
    .sort((left, right) => left.rank - right.rank || left.originalIndex - right.originalIndex)
    .map((group) => ({ label: group.label, items: group.items }));
}

export const teacherNavItems: ShellNavItem[] = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher/lessons", label: "My Courses", icon: BookOpenCheck },
  { href: "/teacher/lessons/create", label: "Create Lesson", icon: Plus },
  { href: "/teacher/work", label: "Assignments", icon: FileCheck2 },
  { href: "/teacher/gradebook", label: "Gradebook & Feedback", icon: ClipboardList },
  { href: "/teacher/notes", label: "Notes", icon: StickyNote },
  { href: "/teacher/discussions", label: "Discussions", icon: MessageSquareText },
  { href: "/teacher/planner", label: "Planner", icon: CalendarClock },
  { href: "/practice", label: "Practice & AI Tutor", icon: Brain },
  { href: "/teacher/students", label: "Students", icon: UsersRound },
  { href: "/teacher/analytics", label: "Analytics & Reports", icon: BarChart3 },
  { href: "/teacher/profile", label: "Profile & Settings", icon: UserRound },
];

export const studentNavItems: ShellNavItem[] = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/lessons", label: "Lessons", icon: BookOpenCheck },
  { href: "/student/classes", label: "Teachers & Classes", icon: UsersRound },
  { href: "/student/work", label: "My Work", icon: FileCheck2 },
  { href: "/student/planner", label: "Planner", icon: CalendarClock },
  { href: "/student/notes", label: "Notes", icon: StickyNote },
  { href: "/student/discussions", label: "Discussions", icon: MessageSquareText },
  { href: "/practice", label: "Practice & AI Tutor", icon: Brain },
  { href: "/student/grades", label: "Grades", icon: ClipboardList },
  { href: "/student/notifications", label: "Notifications", icon: Bell },
  { href: "/student/profile", label: "Profile & Settings", icon: UserRound },
];

export const adminNavItems: ShellNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: UsersRound },
  { href: "/admin/portals", label: "Portals", icon: GraduationCap, permission: "portals.manage", plan: "team" },
  { href: "/admin/permissions", label: "Permissions", icon: ShieldCheck, permission: "users.manage", plan: "enterprise" },
  { href: "/admin/governance", label: "Governance", icon: ShieldCheck },
  { href: "/admin/ai", label: "AI Providers", icon: Brain },
  { href: "/admin/standards", label: "Standards", icon: FileCheck2, permission: "courses.author", plan: "team" },
  { href: "/admin/certifications", label: "Certifications", icon: ClipboardList, permission: "courses.publish", plan: "team" },
  { href: "/admin/automation", label: "Automation", icon: Sparkles, permission: "courses.publish", plan: "team" },
  { href: "/admin/billing", label: "Billing", icon: CalendarClock, permission: "billing.manage", plan: "team" },
  { href: "/admin/email", label: "Email", icon: MessageSquareText },
  { href: "/admin/security", label: "Security", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: ClipboardList },
  { href: "/teacher/dashboard?adminView=teacher", label: "View Teacher", icon: GraduationCap },
  { href: "/student/dashboard?adminView=student", label: "View Student", icon: BookOpenCheck },
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
      { label: "Governance", items: pick(["/admin/governance", "/admin/standards", "/admin/certifications", "/admin/automation", "/admin/security"]) },
      { label: "System", items: pick(["/admin/billing", "/admin/settings"]) },
      { label: "View As", items: pick(["/teacher/dashboard?adminView=teacher", "/student/dashboard?adminView=student"]) },
    ];
  }

  if (role === "teacher") {
    return [
      { label: "Home", items: pick(["/teacher/dashboard"]) },
      { label: "Create", items: pick(["/teacher/lessons", "/teacher/lessons/create"]) },
      { label: "Classroom", items: pick(["/teacher/work", "/teacher/gradebook", "/teacher/notes", "/teacher/discussions", "/teacher/planner", "/teacher/students"]) },
      { label: "Support", items: pick(["/practice"]) },
      { label: "Insights", items: pick(["/teacher/analytics"]) },
      { label: "Account", items: pick(["/teacher/profile"]) },
    ];
  }

  return [
    { label: "Home", items: pick(["/student/dashboard"]) },
    { label: "Learning", items: pick(["/student/lessons", "/student/classes", "/student/work", "/student/planner", "/student/notes", "/student/discussions"]) },
    { label: "Support", items: pick(["/practice", "/student/grades"]) },
    { label: "Account", items: pick(["/student/notifications", "/student/profile"]) },
  ];
}

export default function AppShell({ role, children, navItems }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [collapsed, setCollapsed] = useState(() => sidebarCollapsedFromStorage());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [planTier, setPlanTier] = useState<"solo" | "team" | "enterprise">("solo");
  const [sessionRole, setSessionRole] = useState<"admin" | "teacher" | "student" | null>(() => sessionRoleFromCookie());
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(() => workspaceContextFromStorage());
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => readSectionOrder(sectionOrderStorageKey(role)));
  const copy = roleCopy[role];
  const isAdminViewMode = sessionRole === "admin" && role !== "admin";

  useEffect(() => {
    const stored = window.localStorage.getItem("edsync-theme");
    const useDark = stored === "dark";
    document.documentElement.classList.toggle("dark", useDark);
    setWorkspaceContext(workspaceContextFromStorage());
  }, []);

  useEffect(() => {
    window.localStorage.setItem("edsync-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const storageKey = sectionOrderStorageKey(role);
    setSectionOrder(readSectionOrder(storageKey));

    const handleOrderChange = (event: Event) => {
      const detail = (event as CustomEvent<SectionOrderEventDetail>).detail;
      if (detail?.storageKey === storageKey) setSectionOrder(detail.order);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setSectionOrder(readSectionOrder(storageKey));
    };

    window.addEventListener(SECTION_ORDER_EVENT, handleOrderChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(SECTION_ORDER_EVENT, handleOrderChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [role]);

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

  useEffect(() => {
    if (!isAdminViewMode) return;

    const mode = role === "teacher" ? "teacher" : "student";
    document.cookie = `edsync-admin-view-mode=${mode}; path=/; max-age=3600; SameSite=Lax`;
    const path = `${window.location.pathname}${window.location.search}`;
    const auditKey = `edsync-admin-view-audit:${mode}:${path}`;
    if (window.sessionStorage.getItem(auditKey)) return;

    window.sessionStorage.setItem(auditKey, "1");
    fetch("/api/admin/view-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, path }),
      keepalive: true,
    }).catch(() => {
      window.sessionStorage.removeItem(auditKey);
    });
  }, [isAdminViewMode, pathname, role]);

  useEffect(() => {
    if (role !== "admin") return;
    document.cookie = "edsync-admin-view-mode=; path=/; max-age=0; SameSite=Lax";
  }, [role]);

  const handleLogout = async () => {
    await edsync.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const handleThemeChange = (theme: ThemePreference) => {
    if (profile) {
      const preferences = { ...(profile.preferences ?? { text_size: "medium" }), theme };
      setProfile({ ...profile, preferences });
      edsync.from("profiles").update({ preferences }).eq("id", profile.id);
    }
  };

  const visibleNavGroups = useMemo(() => {
    const grantedPermissions = new Set(permissions);
    const hiddenLegacyNavLabels = new Set(["Studio", "Practice", "AI Tutor"]);

    const groups = navGroupsForRole(role, navItems)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.href === "/studio" || item.href === "/ai" || hiddenLegacyNavLabels.has(item.label)) {
            return false;
          }
          if (role === "admin") return true;
          if (item.permission && !grantedPermissions.has(item.permission)) return false;
          if (item.plan === "team" && planTier === "solo") return false;
          if (item.plan === "enterprise" && planTier !== "enterprise") return false;
          return true;
        }),
      }))
      .filter((group) => group.items.length > 0);
    return reorderGroupsByPreference(groups, sectionOrder);
  }, [navItems, permissions, planTier, role, sectionOrder]);

  const renderNavItem = (item: ShellNavItem) => {
    const Icon = item.icon;
    const itemPath = pathWithoutQuery(item.href);
    const isActive = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
    const viewMode = isAdminViewMode ? (role === "teacher" ? "teacher" : "student") : null;
    const href = appendAdminViewMode(item.href, viewMode);
    return (
      <Link
        key={item.href}
        href={href}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? item.label : undefined}
        className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
          isActive
            ? "premium-active"
            : "border-transparent text-edsync-subtle hover:border-edsync-border hover:bg-edsync-card hover:text-edsync-text"
        } ${collapsed ? "justify-center" : ""}`}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        )}
      </Link>
    );
  };

  const sidebar = (
    <aside
      className={`${collapsed ? "lg:w-28" : "lg:w-72"} flex h-dvh w-[min(18rem,calc(100vw-1rem))] flex-col border-r border-edsync-border bg-edsync-surface shadow-xl shadow-slate-200/70 transition-all duration-300 dark:shadow-black/35`}
    >
      <div className="flex items-center gap-3 border-b border-edsync-border bg-edsync-card/40 px-4 py-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${copy.gradient} shadow-sm`}
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
        <div className="premium-surface mx-4 mt-4 rounded-2xl p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-edsync-surface text-sm font-bold text-edsync-text shadow-sm">
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
            <div className="mt-3 rounded-xl border border-edsync-blue/20 bg-edsync-blue/10 px-3 py-2 text-xs font-semibold text-edsync-blue">
              Read-only view mode is audited.
            </div>
          )}
          {workspaceContext && (
            <div className="mt-3 rounded-xl border border-edsync-border bg-edsync-surface px-3 py-2 text-xs text-edsync-subtle">
              <p className="font-semibold text-edsync-text">
                {workspaceContext.type === "organization" ? "Organization" : "Individual workspace"}
              </p>
              {workspaceContext.type === "organization" && (
                <p className="mt-0.5 truncate">
                  {workspaceContext.organizationName || workspaceContext.organizationCode || "Organization context"}
                </p>
              )}
            </div>
          )}
          {role === "student" && (
            <div className="mt-3 rounded-xl border border-edsync-emerald/20 bg-edsync-emerald/10 px-3 py-2 text-xs font-semibold text-edsync-emerald">
              Lessons, support, grades, and personal notes.
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-3 overflow-y-auto p-3">
        {isAdminViewMode && (
          <Link
            href="/admin/dashboard"
            onClick={() => {
              document.cookie = "edsync-admin-view-mode=; path=/; max-age=0; SameSite=Lax";
              setMobileOpen(false);
            }}
            title={collapsed ? "Back to Admin" : undefined}
            className={`mb-2 flex items-center gap-3 rounded-xl border border-edsync-blue/25 bg-edsync-blue/10 px-3 py-3 text-sm font-bold text-edsync-blue shadow-sm transition-all hover:bg-edsync-blue/15 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <ShieldCheck className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Back to Admin</span>}
          </Link>
        )}
        {visibleNavGroups.map((group) => {
          const groupActive = group.items.some((item) => {
            const itemPath = pathWithoutQuery(item.href);
            return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
          });
          return (
            <div key={group.label} className={collapsed ? "space-y-1" : "space-y-1.5"}>
              {!collapsed && (
                <div
                  className={`px-3 pt-2 text-xs font-bold uppercase tracking-wide ${
                    groupActive ? "text-edsync-blue" : "text-edsync-subtle"
                  }`}
                >
                  <span>{group.label}</span>
                </div>
              )}
              <div className="space-y-1">{group.items.map(renderNavItem)}</div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-edsync-border p-3">
        <div className={`mb-2 flex items-center gap-2 ${collapsed ? "justify-center" : "justify-between px-2 py-1"}`}>
          {!collapsed && <span className="min-w-0 text-sm font-semibold text-edsync-subtle">Workspace</span>}
          <div className={`flex min-w-0 items-center gap-1.5 ${collapsed ? "[&_.premium-icon-button]:h-6 [&_.premium-icon-button]:w-6 [&_.premium-icon-button_svg]:h-3.5 [&_.premium-icon-button_svg]:w-3.5" : ""}`}>
            <NotificationMenu />
            <ThemeToggle compact onThemeChange={handleThemeChange} />
            <LanguageMenu compact align="left" />
          </div>
        </div>
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
    <div className="premium-shell min-h-screen text-edsync-text" data-shell-role={role}>
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-edsync-border bg-edsync-bg/95 px-4 py-3 shadow-sm backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl border border-edsync-border bg-edsync-card p-2 text-edsync-text shadow-sm"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="flex items-center gap-2 font-display font-bold" aria-label="EdSync home">
          <Brain className={`h-5 w-5 ${copy.accent}`} />
          <span className="hidden sm:inline">EdSync</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle compact onThemeChange={handleThemeChange} />
          <LanguageMenu compact />
          <NotificationMenu />
        </div>
      </div>

      <div>
        <div
          className={`${collapsed ? "lg:w-28" : "lg:w-72"} fixed inset-y-0 left-0 z-40 hidden transition-all duration-300 lg:block`}
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
            <div className="relative h-full w-[min(18rem,calc(100vw-1rem))]">{sidebar}</div>
          </div>
        )}
        <main
          className={`${collapsed ? "lg:ml-28" : "lg:ml-72"} min-h-screen overflow-x-hidden pt-16 transition-[margin] duration-300 lg:p-3 lg:pt-3`}
        >
          {isAdminViewMode && (
            <div className="sticky top-14 z-20 border-b border-edsync-blue/20 bg-edsync-blue/10 px-4 py-3 backdrop-blur lg:top-0 lg:px-6">
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
                  Back to Platform Admin
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
