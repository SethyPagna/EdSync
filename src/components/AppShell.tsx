"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/edsync/client";
import CommandMenu from "@/components/CommandMenu";
import NotificationMenu from "@/components/NotificationMenu";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle, { type ThemePreference } from "@/components/ThemeToggle";
import {
  SECTION_ORDER_EVENT,
  type SectionOrderEventDetail,
} from "@/components/SectionOrderSettings";
import type { Profile } from "@/types";
import { generateInitials } from "@/lib/utils";
import {
  adminViewModeForWorkspaceRole,
  adminViewModeLabel,
  normalizeAdminViewMode,
  type AdminViewMode,
} from "@/lib/admin-view";
import {
  ArrowUpRight,
  ChevronDown,
  Compass,
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
  if (isAdminViewMode && adminViewMode)
    return adminViewModeLabel(adminViewMode);
  if (workspaceContext?.type === "organization") {
    return role === "teacher" ? "Org Creator" : "Org Learner";
  }
  return role === "teacher" ? roleCopy.teacher.label : roleCopy.student.label;
}

export function shellNavDisplayLabel({
  label,
  role,
  workspaceContext,
}: ShellNavDisplayInput) {
  const concise: Record<string, string> = {
    Dashboard: "Home",
    "Courses Studio": "Studio",
    "Profile & Settings": "Settings",
    "Course Access": "Classes",
    "Individual Account": "Personal",
    "AI Providers": "AI",
    Certifications: "Certificates",
  };
  if (concise[label]) return concise[label];
  if (workspaceContext?.type === "organization" || role === "admin")
    return label;

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

export function shellNavGroupDisplayLabel({
  label,
  role,
  workspaceContext,
}: ShellNavDisplayInput) {
  if (workspaceContext?.type === "organization" || role === "admin")
    return label;
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
  const role = match
    ? decodeURIComponent(match.split("=").slice(1).join("="))
    : null;
  return role === "admin" || role === "teacher" || role === "student"
    ? role
    : null;
}

function pathWithoutQuery(href: string) {
  return href.split("?")[0];
}

function appendAdminViewMode(href: string, mode: AdminViewMode | null) {
  if (!mode || href.includes("adminView=")) return href;
  if (
    href.startsWith("/teacher") ||
    href.startsWith("/student") ||
    href === "/ai" ||
    href === "/practice" ||
    href === "/studio"
  ) {
    return `${href}${href.includes("?") ? "&" : "?"}adminView=${mode}`;
  }
  return href;
}

function workspaceContextFromStorage(): WorkspaceContext | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem("edsync-auth-workspace") || "null",
    ) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    return {
      type: record.type === "organization" ? "organization" : "individual",
      organizationCode:
        typeof record.organizationCode === "string"
          ? record.organizationCode
          : null,
      organizationName:
        typeof record.organizationName === "string"
          ? record.organizationName
          : null,
    };
  } catch {
    return null;
  }
}

function adminViewModeFromLocation() {
  if (typeof window === "undefined") return null;
  return normalizeAdminViewMode(
    new URLSearchParams(window.location.search).get("adminView"),
  );
}

function adminViewModeFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("edsync-admin-view-mode="));
  return normalizeAdminViewMode(
    match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null,
  );
}

function sidebarCollapsedFromStorage() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("edsync-sidebar-collapsed") === "true";
}

function sidebarWidthClass(isCollapsed: boolean) {
  return isCollapsed ? "lg:w-20" : "lg:w-60";
}

function sidebarMarginClass(isCollapsed: boolean) {
  return isCollapsed ? "lg:ml-20" : "lg:ml-60";
}

function sectionOrderStorageKey(role: AppShellProps["role"]) {
  if (role === "admin") return "edsync-admin-settings-section-order";
  if (role === "teacher") return "edsync-teacher-profile-section-order";
  return "edsync-student-profile-section-order";
}

function readSectionOrder(storageKey: string) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey) || "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
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

  return navItems.find(
    (item) => item.href === reference.href && item.label === reference.label,
  );
}

function reorderGroupsByPreference(
  groups: ShellNavGroup[],
  preferredOrder: string[],
) {
  if (preferredOrder.length === 0) return groups;
  const orderIndex = new Map(
    preferredOrder.map((label, index) => [label, index]),
  );
  const groupRank = (group: ShellNavGroup) =>
    Math.min(
      ...group.items.map(
        (item) =>
          orderIndex.get(navOrderLabel(item)) ?? Number.MAX_SAFE_INTEGER,
      ),
    );

  return groups
    .map((group, originalIndex) => ({
      ...group,
      originalIndex,
      rank: groupRank(group),
      items: [...group.items].sort((left, right) => {
        const leftRank =
          orderIndex.get(navOrderLabel(left)) ?? Number.MAX_SAFE_INTEGER;
        const rightRank =
          orderIndex.get(navOrderLabel(right)) ?? Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank;
      }),
    }))
    .sort(
      (left, right) =>
        left.rank - right.rank || left.originalIndex - right.originalIndex,
    )
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
  {
    href: "/admin/portals",
    label: "Portals",
    icon: GraduationCap,
    permission: "portals.manage",
    plan: "team",
  },
  {
    href: "/admin/permissions",
    label: "Permissions",
    icon: ShieldCheck,
    permission: "users.manage",
    plan: "enterprise",
  },
  { href: "/admin/governance", label: "Governance", icon: ShieldCheck },
  { href: "/admin/ai", label: "AI Providers", icon: Brain },
  {
    href: "/admin/standards",
    label: "Standards",
    icon: FileCheck2,
    permission: "courses.author",
    plan: "team",
  },
  {
    href: "/admin/certifications",
    label: "Certifications",
    icon: ClipboardList,
    permission: "courses.publish",
    plan: "team",
  },
  {
    href: "/admin/automation",
    label: "Automation",
    icon: Sparkles,
    permission: "courses.publish",
    plan: "team",
  },
  {
    href: "/admin/billing",
    label: "Billing",
    icon: CalendarClock,
    permission: "billing.manage",
    plan: "team",
  },
  { href: "/admin/email", label: "Email", icon: MessageSquareText },
  { href: "/admin/security", label: "Security", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: ClipboardList },
  {
    href: "/student/dashboard?adminView=individual",
    label: "Individual Account",
    icon: UserRound,
  },
  { href: "/admin/portals", label: "Organizations", icon: Building2 },
  {
    href: "/teacher/dashboard?adminView=organization-teacher",
    label: "Org Creator",
    icon: GraduationCap,
  },
  {
    href: "/student/dashboard?adminView=organization-student",
    label: "Org Learner",
    icon: BookOpenCheck,
  },
];

export function navGroupsForRole(
  role: AppShellProps["role"],
  navItems: ShellNavItem[],
): ShellNavGroup[] {
  const pick = (items: NavItemReference[]) =>
    items.map((item) => findNavItem(navItems, item)).filter(isShellNavItem);

  if (role === "admin") {
    return [
      { label: "Home", items: pick(["/admin/dashboard"]) },
      {
        label: "Platform",
        items: pick(["/admin/users", "/admin/portals", "/admin/permissions"]),
      },
      { label: "Learning Ops", items: pick(["/admin/email"]) },
      { label: "Intelligence", items: pick(["/admin/ai"]) },
      {
        label: "Governance",
        items: pick([
          "/admin/governance",
          "/admin/standards",
          "/admin/certifications",
          "/admin/automation",
          "/admin/security",
        ]),
      },
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
      {
        label: "Course Ops",
        items: pick([
          "/teacher/work",
          "/teacher/notes",
          "/teacher/planner",
          "/teacher/students",
        ]),
      },
      { label: "Support", items: pick(["/practice"]) },
      { label: "Insights", items: pick(["/teacher/analytics"]) },
      { label: "Account", items: pick(["/teacher/profile"]) },
    ];
  }

  return [
    { label: "Home", items: pick(["/student/dashboard"]) },
    {
      label: "Learning",
      items: pick([
        "/student/lessons",
        "/student/classes",
        "/student/work",
        "/student/planner",
        "/student/notes",
      ]),
    },
    { label: "Support", items: pick(["/practice", "/student/grades"]) },
    {
      label: "Account",
      items: pick(["/student/notifications", "/student/profile"]),
    },
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
  const [planTier, setPlanTier] = useState<"solo" | "team" | "enterprise">(
    "solo",
  );
  const [sessionRole, setSessionRole] = useState<
    "admin" | "teacher" | "student" | null
  >(null);
  const [workspaceContext, setWorkspaceContext] =
    useState<WorkspaceContext | null>(null);
  const [requestedAdminViewMode, setRequestedAdminViewMode] =
    useState<AdminViewMode | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const [storageReady, setStorageReady] = useState(false);
  const displayCollapsed = !mobileOpen && collapsed;
  const isAdminViewMode =
    role !== "admin" &&
    (sessionRole === "admin" || requestedAdminViewMode !== null);
  const adminViewMode = isAdminViewMode
    ? (requestedAdminViewMode ??
      adminViewModeForWorkspaceRole(role === "teacher" ? "teacher" : "student"))
    : null;
  const shellLabel = shellWorkspaceLabel({
    role,
    workspaceContext,
    adminViewMode,
    isAdminViewMode,
  });
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
      setStorageReady(true);
      setSessionRole(sessionRoleFromCookie());
      setWorkspaceContext(workspaceContextFromStorage());
      setRequestedAdminViewMode(
        adminViewModeFromLocation() ?? adminViewModeFromCookie(),
      );
      setSectionOrder(readSectionOrder(sectionOrderStorageKey(role)));
    });
  }, [pathname, role]);

  useEffect(() => {
    if (storageReady)
      window.localStorage.setItem(
        "edsync-sidebar-collapsed",
        String(collapsed),
      );
  }, [collapsed, storageReady]);

  useEffect(() => {
    const dialog = mobileDialog.current;
    if (mobileOpen) dialog?.showModal();
    else dialog?.close();
    const previous = document.body.style.overflow;
    if (mobileOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    const storageKey = sectionOrderStorageKey(role);

    const handleOrderChange = (event: Event) => {
      const detail = (event as CustomEvent<SectionOrderEventDetail>).detail;
      if (detail?.storageKey === storageKey) setSectionOrder(detail.order);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey)
        setSectionOrder(readSectionOrder(storageKey));
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
      if (
        actualRole === "admin" ||
        actualRole === "teacher" ||
        actualRole === "student"
      ) {
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

    const mode =
      adminViewMode ??
      adminViewModeForWorkspaceRole(role === "teacher" ? "teacher" : "student");
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
    document.cookie =
      "edsync-admin-view-mode=; path=/; max-age=0; SameSite=Lax";
  }, [role]);

  const handleLogout = async () => {
    try {
      await edsync.auth.signOut();
    } finally {
      window.localStorage.removeItem("edsync-auth-workspace");
      document.cookie =
        "edsync-admin-view-mode=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "edsync_role=; path=/; max-age=0; SameSite=Lax";
      router.replace("/auth/login");
      router.refresh();
    }
  };

  const handleThemeChange = (theme: ThemePreference) => {
    if (profile) {
      const preferences = {
        ...(profile.preferences ?? { text_size: "medium" }),
        theme,
      };
      setProfile({ ...profile, preferences });
      edsync.from("profiles").update({ preferences }).eq("id", profile.id);
    }
  };

  const visibleNavGroups = useMemo(() => {
    const grantedPermissions = new Set(permissions);
    const hiddenLegacyNavLabels = new Set(["AI Tutor"]);

    const groups = navGroupsForRole(role, navItems)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.href === "/ai" || hiddenLegacyNavLabels.has(item.label)) {
            return false;
          }
          if (role === "admin") return true;
          if (item.permission && !grantedPermissions.has(item.permission))
            return false;
          if (item.plan === "team" && planTier === "solo") return false;
          if (item.plan === "enterprise" && planTier !== "enterprise")
            return false;
          return true;
        }),
      }))
      .filter((group) => group.items.length > 0);
    return reorderGroupsByPreference(groups, sectionOrder);
  }, [navItems, permissions, planTier, role, sectionOrder]);

  const commands = visibleNavGroups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      href: appendAdminViewMode(item.href, adminViewMode),
      label: shellNavDisplayLabel({
        label: item.label,
        role,
        workspaceContext,
      }),
      group: group.label,
    })),
  );
  const currentPage =
    commands.find((item) => pathname === pathWithoutQuery(item.href))?.label ??
    "Workspace";
  const primaryGroups = visibleNavGroups.filter(
    (group) =>
      !["Governance", "System", "Owner Views", "Account"].includes(group.label),
  );
  const primaryLinks = new Set(primaryGroups.flatMap((group) => group.items.map((item) => item.href)));
  const secondaryGroups = visibleNavGroups.filter((group) =>
    ["Governance", "System", "Owner Views", "Account"].includes(group.label),
  ).map((group) => ({ ...group, items: group.items.filter((item) => !primaryLinks.has(item.href)) }))
    .filter((group) => group.items.length > 0);

  const renderNavItem = (item: ShellNavItem) => {
    const Icon = item.icon;
    const label = shellNavDisplayLabel({
      label: item.label,
      role,
      workspaceContext,
    });
    const itemPath = pathWithoutQuery(item.href);
    const active = pathname === itemPath || pathname.startsWith(itemPath + "/");
    return (
      <Link
        key={item.href + item.label}
        href={appendAdminViewMode(item.href, adminViewMode)}
        onClick={() => setMobileOpen(false)}
        title={label}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={
          "workspace-nav-item " +
          (active ? "is-active " : "") +
          (displayCollapsed ? "is-collapsed" : "")
        }
      >
        <Icon size={18} aria-hidden="true" />
        {!displayCollapsed && <span>{label}</span>}
      </Link>
    );
  };

  const sidebar = (
    <aside
      className={
        "workspace-sidebar " + (displayCollapsed ? "is-collapsed" : "")
      }
      aria-label="Workspace navigation"
    >
      <div className="workspace-brand-row">
        <Link
          href={"/" + role + "/dashboard"}
          className="workspace-brand"
          aria-label="EdSync home"
        >
          <span className="workspace-mark">
            <GraduationCap size={23} />
          </span>
          {!displayCollapsed && (
            <strong>
              EdSync<span className="workspace-brand-dot">.</span>
            </strong>
          )}
        </Link>
        {!displayCollapsed && (
          <button
            className="workspace-icon lg:hidden"
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>
      {!displayCollapsed && (
        <div className="workspace-context">
          <ShellIcon size={16} />
          <span>{workspaceContext?.organizationName || shellLabel}</span>
        </div>
      )}
      <nav
        className="workspace-nav edsync-scrollbar-none"
        aria-label="Main navigation"
      >
        {isAdminViewMode && (
          <Link
            href="/admin/dashboard"
            className="workspace-nav-item"
            title="Back to admin"
            onClick={() => setMobileOpen(false)}
          >
            <ShieldCheck size={18} />
            {!displayCollapsed && <span>Back to admin</span>}
          </Link>
        )}
        {primaryGroups.map((group) => (
          <div key={group.label} className="workspace-nav-group">
            {group.items.map(renderNavItem)}
          </div>
        ))}
        {secondaryGroups.map((group) =>
          displayCollapsed ? (
            <div key={group.label} className="workspace-nav-group">
              {group.items.map(renderNavItem)}
            </div>
          ) : (
            <details
              key={group.label}
              className="workspace-nav-more"
              open={
                group.items.some(
                  (item) => pathname === pathWithoutQuery(item.href),
                ) || undefined
              }
            >
              <summary>
                {group.label === "Account"
                  ? "Account"
                  : group.label === "Owner Views"
                    ? "Switch view"
                    : group.label}
                <ChevronDown size={14} />
              </summary>
              <div>{group.items.map(renderNavItem)}</div>
            </details>
          ),
        )}
      </nav>
      {!displayCollapsed && (
        <Link href="/catalog" className="workspace-discover">
          <Compass size={20} />
          <span>
            Find your next course<small>Explore the catalog</small>
          </span>
          <ArrowUpRight size={16} />
        </Link>
      )}
      <div className="workspace-sidebar-footer">
        <Link
          href={role === "admin" ? "/admin/settings" : "/" + role + "/profile"}
          className="workspace-profile"
          title="Your profile"
        >
          <span className="workspace-avatar">
            {generateInitials(profile?.full_name || role)}
          </span>
          {!displayCollapsed && (
            <span>
              {profile?.full_name ||
                (role === "teacher"
                  ? "Creator"
                  : role === "student"
                    ? "Learner"
                    : "Administrator")}
              <small>{shellLabel}</small>
            </span>
          )}
        </Link>
        <div className="workspace-footer-actions">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="workspace-icon hidden lg:inline-flex"
            aria-label={
              displayCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={displayCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {displayCollapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="workspace-icon"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className="premium-shell workspace-shell min-h-screen text-edsync-text"
      data-shell-role={role}
    >
      <a href="#workspace-content" className="workspace-skip">
        Skip to content
      </a>
      <div
        className={
          sidebarWidthClass(displayCollapsed) +
          " fixed inset-y-0 left-0 z-40 hidden transition-all duration-200 lg:block"
        }
      >
        {sidebar}
      </div>
      <dialog
        ref={mobileDialog}
        className="workspace-mobile-dialog"
        aria-label="Navigation"
        onCancel={() => setMobileOpen(false)}
        onClose={() => setMobileOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMobileOpen(false);
        }}
      >
        {sidebar}
      </dialog>
      <div
        className={
          sidebarMarginClass(displayCollapsed) +
          " workspace-body transition-[margin] duration-200"
        }
      >
        <header className="workspace-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="workspace-icon lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <span className="workspace-breadcrumb">
              <span className="hidden sm:inline">
                {role === "admin" ? "Platform" : "My workspace"}
                <span className="mx-3 opacity-40">/</span>
              </span>
              <strong>{currentPage}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CommandMenu
              items={[
                ...commands,
                {
                  href: "/catalog",
                  label: "Explore courses",
                  icon: Compass,
                  group: "Discover",
                },
              ]}
            />
            <div className="hidden sm:block">
              <LanguageMenu compact />
            </div>
            <ThemeToggle compact onThemeChange={handleThemeChange} />
            <NotificationMenu />
          </div>
        </header>
        {isAdminViewMode && (
          <div className="workspace-preview-banner">
            <ShieldCheck size={16} />
            <span>
              Previewing{" "}
              {adminViewMode ? adminViewModeLabel(adminViewMode) : "workspace"}
            </span>
            <Link href="/admin/dashboard">Exit preview</Link>
          </div>
        )}
        <main
          id="workspace-content"
          tabIndex={-1}
          className="workspace-content"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
