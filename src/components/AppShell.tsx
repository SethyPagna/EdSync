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
  adminViewModeForWorkspaceRole,
  adminViewModeLabel,
  normalizeAdminViewMode,
  type AdminViewMode,
} from "@/lib/admin-view";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarClock,
  Brain,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ShieldCheck,
  StickyNote,
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

type ShellWorkspaceLabelInput = {
  role: AppShellProps["role"];
  workspaceContext: WorkspaceContext | null;
  adminViewMode: AdminViewMode | null;
  isAdminViewMode: boolean;
};

type ShellNavDisplayInput = {
  label: string;
  role: AppShellProps["role"];
  workspaceContext: WorkspaceContext | null;
};

type NavItemReference = string | Pick<ShellNavItem, "href" | "label">;

const roleCopy = {
  teacher: {
    label: "Creator Workspace",
    accent: "text-edsync-blue",
    gradient: "from-edsync-blue to-edsync-emerald",
  },
  admin: {
    label: "Platform Owner",
    accent: "text-edsync-blue",
    gradient: "from-edsync-blue to-edsync-emerald",
  },
  student: {
    label: "Learner Workspace",
    accent: "text-edsync-blue",
    gradient: "from-edsync-blue to-edsync-emerald",
  },
};

export function shellWorkspaceLabel({
  role,
  workspaceContext,
  adminViewMode,
  isAdminViewMode,
}: ShellWorkspaceLabelInput) {
  if (role === "admin") return roleCopy.admin.label;
  if (isAdminViewMode && adminViewMode) return adminViewModeLabel(adminViewMode);
  if (workspaceContext?.type === "organization") {
    return role === "teacher" ? "Org Creator" : "Org Learner";
  }
  return role === "teacher" ? roleCopy.teacher.label : roleCopy.student.label;
}

export function shellNavDisplayLabel({ label, role, workspaceContext }: ShellNavDisplayInput) {
  if (workspaceContext?.type === "organization" || role === "admin") return label;

  if (role === "teacher") {
    const creatorLabels: Record<string, string> = {
      "Create Lesson": "Create Course",
      Work: "Assessments",
      Assignments: "Assessments",
      "Gradebook & Feedback": "Feedback",
      Students: "Learners",
      "Analytics & Reports": "Insights",
    };
    return creatorLabels[label] ?? label;
  }

  const learnerLabels: Record<string, string> = {
    Lessons: "Courses",
    "Teachers & Classes": "Course Access",
    Grades: "Progress",
    Work: "Assessments",
    "My Work": "Assessments",
  };
  return learnerLabels[label] ?? label;
}

export function shellNavGroupDisplayLabel({ label, role, workspaceContext }: ShellNavDisplayInput) {
  if (workspaceContext?.type === "organization" || role === "admin") return label;
  if (role === "teacher" && label === "Classroom") return "Course Ops";
  if (role === "student" && label === "Support") return "Progress";
  return label;
}

function sessionRoleFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("edsync_role="));
  const role = match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
  return role === "admin" || role === "teacher" || role === "student" ? role : null;
}

function pathWithoutQuery(href: string) {
  return href.split("?")[0];
}

function appendAdminViewMode(href: string, mode: AdminViewMode | null) {
  if (!mode || href.includes("adminView=")) return href;
  if (href.startsWith("/teacher") || href.startsWith("/student") || href === "/ai" || href === "/practice" || href === "/studio") {
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

function adminViewModeFromLocation() {
  if (typeof window === "undefined") return null;
  return normalizeAdminViewMode(new URLSearchParams(window.location.search).get("adminView"));
}

function adminViewModeFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("edsync-admin-view-mode="));
  return normalizeAdminViewMode(match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null);
}

function sidebarCollapsedFromStorage() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("edsync-sidebar-collapsed") === "true";
}

function shouldStartWithCompactSidebar(pathname: string | null) {
  return pathname === "/studio" || pathname?.startsWith("/studio/");
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

function isShellNavItem(item: ShellNavItem | undefined): item is ShellNavItem {
  return item !== undefined;
}

function findNavItem(navItems: ShellNavItem[], reference: NavItemReference) {
  if (typeof reference === "string") {
    return navItems.find((item) => item.href === reference);
  }

  return navItems.find((item) => item.href === reference.href && item.label === reference.label);
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
  { href: "/studio", label: "Courses Studio", icon: Sparkles },
  { href: "/teacher/work", label: "Assessments", icon: FileCheck2 },
  { href: "/teacher/notes", label: "Notes", icon: StickyNote },
  { href: "/teacher/planner", label: "Planner", icon: CalendarClock },
  { href: "/practice", label: "Practice", icon: Brain },
  { href: "/teacher/students", label: "Learners", icon: UsersRound },
  { href: "/teacher/analytics", label: "Insights", icon: BarChart3 },
  { href: "/teacher/profile", label: "Profile & Settings", icon: UserRound },
];

export const studentNavItems: ShellNavItem[] = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/lessons", label: "Courses", icon: BookOpenCheck },
  { href: "/student/classes", label: "Course Access", icon: UsersRound },
  { href: "/student/work", label: "Assessments", icon: FileCheck2 },
  { href: "/student/planner", label: "Planner", icon: CalendarClock },
  { href: "/student/notes", label: "Notes", icon: StickyNote },
  { href: "/practice", label: "Practice", icon: Brain },
  { href: "/student/grades", label: "Progress", icon: ClipboardList },
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
  { href: "/student/dashboard?adminView=individual", label: "Individual Account", icon: UserRound },
  { href: "/admin/portals", label: "Organizations", icon: Building2 },
  { href: "/teacher/dashboard?adminView=organization-teacher", label: "Org Creator", icon: GraduationCap },
  { href: "/student/dashboard?adminView=organization-student", label: "Org Learner", icon: BookOpenCheck },
];

export function navGroupsForRole(role: AppShellProps["role"], navItems: ShellNavItem[]): ShellNavGroup[] {
  const pick = (items: NavItemReference[]) => items.map((item) => findNavItem(navItems, item)).filter(isShellNavItem);

  if (role === "admin") {
    return [
      { label: "Home", items: pick(["/admin/dashboard"]) },
      { label: "Platform", items: pick(["/admin/users", "/admin/portals", "/admin/permissions"]) },
      { label: "Learning Ops", items: pick(["/admin/email"]) },
      { label: "Intelligence", items: pick(["/admin/ai"]) },
      { label: "Governance", items: pick(["/admin/governance", "/admin/standards", "/admin/certifications", "/admin/automation", "/admin/security"]) },
      { label: "System", items: pick(["/admin/billing", "/admin/settings"]) },
      {
        label: "Owner Views",
        items: pick([
          "/student/dashboard?adminView=individual",
          { href: "/admin/portals", label: "Organizations" },
          "/teacher/dashboard?adminView=organization-teacher",
          "/student/dashboard?adminView=organization-student",
        ]),
      },
    ];
  }

  if (role === "teacher") {
    return [
      { label: "Home", items: pick(["/teacher/dashboard"]) },
      { label: "Create", items: pick(["/studio"]) },
      { label: "Course Ops", items: pick(["/teacher/work", "/teacher/notes", "/teacher/planner", "/teacher/students"]) },
      { label: "Support", items: pick(["/practice"]) },
      { label: "Insights", items: pick(["/teacher/analytics"]) },
      { label: "Account", items: pick(["/teacher/profile"]) },
    ];
  }

  return [
    { label: "Home", items: pick(["/student/dashboard"]) },
    { label: "Learning", items: pick(["/student/lessons", "/student/classes", "/student/work", "/student/planner", "/student/notes"]) },
    { label: "Support", items: pick(["/practice", "/student/grades"]) },
    { label: "Account", items: pick(["/student/notifications", "/student/profile"]) },
  ];
}

export default function AppShell({ role, children, navItems }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [planTier, setPlanTier] = useState<"solo" | "team" | "enterprise">("solo");
  const [sessionRole, setSessionRole] = useState<"admin" | "teacher" | "student" | null>(null);
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null);
  const requestedAdminViewMode = adminViewModeFromLocation() ?? adminViewModeFromCookie();
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const copy = roleCopy[role];
  const studioCompactSidebar = shouldStartWithCompactSidebar(pathname);
  const displayCollapsed = studioCompactSidebar || collapsed;
  const isAdminViewMode = role !== "admin" && (sessionRole === "admin" || requestedAdminViewMode !== null);
  const adminViewMode = isAdminViewMode
    ? requestedAdminViewMode ?? adminViewModeForWorkspaceRole(role === "teacher" ? "teacher" : "student")
    : null;
  const shellLabel = shellWorkspaceLabel({ role, workspaceContext, adminViewMode, isAdminViewMode });
  const ShellIcon =
    role === "admin"
      ? ShieldCheck
      : workspaceContext?.type === "organization"
        ? Building2
        : role === "teacher"
          ? Layers3
          : BookOpenCheck;

  useEffect(() => {
    const stored = window.localStorage.getItem("edsync-theme");
    const useDark = stored === "dark";
    document.documentElement.classList.toggle("dark", useDark);
    queueMicrotask(() => {
      setCollapsed(sidebarCollapsedFromStorage());
      setSessionRole(sessionRoleFromCookie());
      setWorkspaceContext(workspaceContextFromStorage());
      setSectionOrder(readSectionOrder(sectionOrderStorageKey(role)));
    });
  }, [pathname, role]);

  useEffect(() => {
    window.localStorage.setItem("edsync-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const storageKey = sectionOrderStorageKey(role);

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

    const mode = adminViewMode ?? adminViewModeForWorkspaceRole(role === "teacher" ? "teacher" : "student");
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
  }, [adminViewMode, isAdminViewMode, pathname, role]);

  useEffect(() => {
    if (role !== "admin") return;
    document.cookie = "edsync-admin-view-mode=; path=/; max-age=0; SameSite=Lax";
  }, [role]);

  const handleLogout = async () => {
    try {
      await edsync.auth.signOut();
    } finally {
      window.localStorage.removeItem("edsync-auth-workspace");
      document.cookie = "edsync-admin-view-mode=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "edsync_role=; path=/; max-age=0; SameSite=Lax";
      router.replace("/auth/login");
      router.refresh();
    }
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
          if (item.href === "/ai" || hiddenLegacyNavLabels.has(item.label)) {
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
    const displayLabel = shellNavDisplayLabel({ label: item.label, role, workspaceContext });
    const itemPath = pathWithoutQuery(item.href);
    const isActive = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
    const href = appendAdminViewMode(item.href, adminViewMode);
    return (
      <Link
        key={item.href}
        href={href}
        onClick={() => setMobileOpen(false)}
        title={displayCollapsed ? displayLabel : undefined}
        className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
          isActive
            ? "premium-active"
            : "border-transparent text-edsync-subtle hover:border-edsync-border hover:bg-edsync-card hover:text-edsync-text"
        } ${displayCollapsed ? "justify-center" : ""}`}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!displayCollapsed && (
          <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        )}
      </Link>
    );
  };

  const sidebar = (
    <aside
      className={`${displayCollapsed ? "lg:w-28" : "lg:w-72"} flex h-dvh w-[min(18rem,calc(100vw-1rem))] flex-col overflow-visible border-r border-edsync-border bg-edsync-surface shadow-xl shadow-slate-200/70 transition-all duration-300 dark:shadow-black/35`}
    >
      <div className="flex items-center gap-3 border-b border-edsync-border bg-edsync-card/40 px-4 py-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-edsync-blue to-edsync-emerald shadow-sm">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          {!displayCollapsed && (
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-edsync-text">
                EdSync
              </p>
              <p className="text-xs text-edsync-subtle">{shellLabel}</p>
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

      {!displayCollapsed && (
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
            <div className="group mt-3 rounded-xl border border-edsync-blue/20 bg-edsync-blue/10 px-3 py-2 text-xs font-semibold text-edsync-blue">
              Owner preview
              <span className="edsync-hover-detail text-edsync-blue">Read-only view mode is audited.</span>
            </div>
          )}
          {workspaceContext && (
            <div className="group mt-3 rounded-xl border border-edsync-border bg-edsync-surface px-3 py-2 text-xs text-edsync-subtle">
              <p className="font-semibold text-edsync-text">
                {workspaceContext.type === "organization" ? "Organization" : "Individual"}
              </p>
              {workspaceContext.type === "organization" && (
                <p className="mt-0.5 truncate" title={workspaceContext.organizationName || workspaceContext.organizationCode || "Organization"}>
                  {workspaceContext.organizationName || workspaceContext.organizationCode || "Organization context"}
                </p>
              )}
              <span className="edsync-hover-detail">
                {workspaceContext.type === "organization" ? "Owner-managed workspace" : "Create and learn independently"}
              </span>
            </div>
          )}
          {role === "student" && (
            <div className="group mt-3 rounded-xl border border-edsync-emerald/20 bg-edsync-emerald/10 px-3 py-2 text-xs font-semibold text-edsync-emerald">
              {workspaceContext?.type === "organization" ? "Org learner tools" : "Learner tools"}
              <span className="edsync-hover-detail text-edsync-emerald">Courses, practice, progress, and notes.</span>
            </div>
          )}
        </div>
      )}

      <nav className="edsync-scrollbar-none flex-1 space-y-3 overflow-y-auto p-3">
        {isAdminViewMode && (
          <Link
            href="/admin/dashboard"
            onClick={() => {
              document.cookie = "edsync-admin-view-mode=; path=/; max-age=0; SameSite=Lax";
              setMobileOpen(false);
            }}
            title={displayCollapsed ? "Back to Admin" : undefined}
            className={`mb-2 flex items-center gap-3 rounded-xl border border-edsync-blue/25 bg-edsync-blue/10 px-3 py-3 text-sm font-bold text-edsync-blue shadow-sm transition-all hover:bg-edsync-blue/15 ${
              displayCollapsed ? "justify-center" : ""
            }`}
          >
            <ShieldCheck className="h-5 w-5 flex-shrink-0" />
            {!displayCollapsed && <span>Back to Admin</span>}
          </Link>
        )}
        {visibleNavGroups.map((group) => {
          const groupLabel = shellNavGroupDisplayLabel({ label: group.label, role, workspaceContext });
          const groupActive = group.items.some((item) => {
            const itemPath = pathWithoutQuery(item.href);
            return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
          });
          return (
            <div key={group.label} className={displayCollapsed ? "space-y-1" : "space-y-1.5"}>
              {!displayCollapsed && (
                <div
                  className={`px-3 pt-2 text-xs font-bold uppercase tracking-wide ${
                    groupActive ? "text-edsync-blue" : "text-edsync-subtle"
                  }`}
                >
                  <span>{groupLabel}</span>
                </div>
              )}
              <div className="space-y-1">{group.items.map(renderNavItem)}</div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-edsync-border p-3">
        <div className={`mb-2 flex gap-2 ${displayCollapsed ? "flex-col items-center" : "items-center justify-between px-2 py-1"}`}>
          {!displayCollapsed && <span className="min-w-0 text-sm font-semibold text-edsync-subtle">Workspace</span>}
          <div className={`min-w-0 gap-1.5 ${displayCollapsed ? "grid grid-cols-1 [&_.premium-icon-button]:h-9 [&_.premium-icon-button]:w-9 [&_.premium-icon-button_svg]:h-4 [&_.premium-icon-button_svg]:w-4" : "flex items-center"}`}>
            <NotificationMenu align="left" placement="top" />
            <ThemeToggle compact onThemeChange={handleThemeChange} />
            <LanguageMenu compact align="left" placement="top" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className={`hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-edsync-subtle hover:bg-edsync-card hover:text-edsync-text lg:flex ${displayCollapsed ? "justify-center" : ""}`}
          aria-label={displayCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {displayCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
          {!displayCollapsed && "Collapse sidebar"}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-edsync-red hover:bg-edsync-red/10 ${displayCollapsed ? "justify-center" : ""}`}
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
          {!displayCollapsed && "Sign out"}
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
          <ShellIcon className={`h-5 w-5 ${copy.accent}`} />
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
          className={`${displayCollapsed ? "lg:w-28" : "lg:w-72"} fixed inset-y-0 left-0 z-40 hidden transition-all duration-300 lg:block`}
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
          className={`${displayCollapsed ? "lg:ml-28" : "lg:ml-72"} min-h-screen overflow-x-hidden pt-16 transition-[margin] duration-300 lg:p-3 lg:pt-3`}
        >
          {isAdminViewMode && (
            <div className="sticky top-14 z-20 border-b border-edsync-blue/20 bg-edsync-blue/10 px-4 py-3 backdrop-blur lg:top-0 lg:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3 text-sm text-edsync-blue">
                  <ShieldCheck className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Admin view mode</p>
                    <p className="text-xs text-edsync-subtle">
                      You are previewing the {adminViewMode ? adminViewModeLabel(adminViewMode) : "workspace"} with admin access.
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
