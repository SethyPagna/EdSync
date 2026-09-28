import {
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Cpu,
  House,
  ListChecks,
  NotebookPen,
  Palette,
  Scale,
  Store,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavRole = "admin" | "teacher" | "student";
export type PlanTier = "solo" | "team" | "enterprise";

export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra route prefixes that light up this item. */
  aliases?: string[];
  /** Key into SUBNAV_GROUPS rendered as tabs by the shell on matching routes. */
  group?: string;
  permission?: string;
  plan?: PlanTier;
};

export type SubNavItem = {
  href: string;
  label: string;
  permission?: string;
  plan?: PlanTier;
};

export type NavAccess = {
  role: NavRole;
  permissions: readonly string[];
  planTier: PlanTier;
};

export const studentNav: NavItem[] = [
  { id: "home", href: "/student/dashboard", label: "Home", icon: House },
  {
    id: "courses",
    href: "/student/lessons",
    label: "Courses",
    icon: BookOpen,
    aliases: ["/student/classes"],
    group: "courses",
  },
  {
    id: "tasks",
    href: "/student/work",
    label: "Tasks",
    icon: ListChecks,
    aliases: ["/student/planner"],
    group: "tasks",
  },
  { id: "practice", href: "/practice", label: "Practice", icon: Brain },
  { id: "notes", href: "/student/notes", label: "Notes", icon: NotebookPen },
  { id: "progress", href: "/student/grades", label: "Progress", icon: TrendingUp },
];

export const teacherNav: NavItem[] = [
  { id: "home", href: "/teacher/dashboard", label: "Home", icon: House },
  {
    id: "studio",
    href: "/studio",
    label: "Studio",
    icon: Palette,
    aliases: ["/teacher/lessons"],
    group: "studio",
  },
  { id: "classes", href: "/teacher/students", label: "Classes", icon: UsersRound },
  { id: "review", href: "/teacher/work", label: "Review", icon: ClipboardCheck },
  {
    id: "planner",
    href: "/teacher/planner",
    label: "Planner",
    icon: CalendarClock,
    aliases: ["/teacher/notes"],
    group: "planner",
  },
  {
    id: "insights",
    href: "/teacher/analytics",
    label: "Insights",
    icon: BarChart3,
    aliases: ["/teacher/reports"],
    group: "insights",
  },
];

export const adminNav: NavItem[] = [
  {
    id: "overview",
    href: "/admin/dashboard",
    label: "Overview",
    icon: House,
    aliases: ["/admin/governance"],
  },
  {
    id: "people",
    href: "/admin/users",
    label: "People",
    icon: UsersRound,
    aliases: ["/admin/permissions"],
    group: "people",
  },
  {
    id: "organizations",
    href: "/admin/portals",
    label: "Organizations",
    icon: Building2,
    permission: "portals.manage",
    plan: "team",
  },
  {
    id: "catalog",
    href: "/admin/billing",
    label: "Catalog",
    icon: Store,
    permission: "billing.manage",
    plan: "team",
  },
  {
    id: "rules",
    href: "/admin/standards",
    label: "Rules",
    icon: Scale,
    aliases: ["/admin/certifications", "/admin/automation", "/admin/settings"],
    group: "rules",
  },
  {
    id: "system",
    href: "/admin/ai",
    label: "System",
    icon: Cpu,
    aliases: ["/admin/email", "/admin/security"],
    group: "system",
  },
];

export const SUBNAV_GROUPS: Record<string, SubNavItem[]> = {
  courses: [
    { href: "/student/lessons", label: "Library" },
    { href: "/student/classes", label: "Access" },
  ],
  tasks: [
    { href: "/student/work", label: "Assessments" },
    { href: "/student/planner", label: "Planner" },
  ],
  studio: [
    { href: "/studio", label: "Designs" },
    { href: "/teacher/lessons", label: "Courses" },
  ],
  planner: [
    { href: "/teacher/planner", label: "Planner" },
    { href: "/teacher/notes", label: "Notes" },
  ],
  insights: [
    { href: "/teacher/analytics", label: "Analytics" },
    { href: "/teacher/reports", label: "Reports" },
  ],
  people: [
    { href: "/admin/users", label: "Users" },
    {
      href: "/admin/permissions",
      label: "Roles",
      permission: "users.manage",
      plan: "enterprise",
    },
  ],
  rules: [
    {
      href: "/admin/standards",
      label: "Standards",
      permission: "courses.author",
      plan: "team",
    },
    {
      href: "/admin/certifications",
      label: "Certifications",
      permission: "courses.publish",
      plan: "team",
    },
    {
      href: "/admin/automation",
      label: "Automation",
      permission: "courses.publish",
      plan: "team",
    },
    { href: "/admin/settings", label: "Flags" },
  ],
  system: [
    { href: "/admin/ai", label: "AI" },
    { href: "/admin/email", label: "Email" },
    { href: "/admin/security", label: "Security" },
  ],
};

/** Routes rendered without the rail and topbar. */
export const IMMERSIVE_ROUTES: RegExp[] = [/^\/student\/lessons\/[^/]+$/];

const PLAN_RANK: Record<PlanTier, number> = { solo: 0, team: 1, enterprise: 2 };

export function navForRole(role: NavRole): NavItem[] {
  if (role === "admin") return adminNav;
  if (role === "teacher") return teacherNav;
  return studentNav;
}

/** Platform admins see everything; others need the permission and plan tier. */
export function canAccess(
  item: { permission?: string; plan?: PlanTier },
  access: NavAccess,
): boolean {
  if (access.role === "admin") return true;
  if (item.permission && !access.permissions.includes(item.permission)) return false;
  if (item.plan && PLAN_RANK[access.planTier] < PLAN_RANK[item.plan]) return false;
  return true;
}

export function pathWithoutQuery(href: string): string {
  return href.split(/[?#]/)[0];
}

export function isPathActive(pathname: string, href: string): boolean {
  const path = pathWithoutQuery(href);
  return pathname === path || pathname.startsWith(`${path}/`);
}

export type NavMatch = {
  item: NavItem | null;
  groupKey: string | null;
  group: SubNavItem[] | null;
  /** Active tab inside the group, if any. */
  subItem: SubNavItem | null;
};

/** Finds the nav item (own href or alias) and route group for a pathname. */
export function matchNav(pathname: string, role: NavRole): NavMatch {
  const items = navForRole(role);
  const candidates = items.flatMap((item) =>
    [item.href, ...(item.aliases ?? [])].map((href) => ({ item, href })),
  );
  const best = candidates
    .filter(({ href }) => isPathActive(pathname, href))
    .sort((left, right) => pathWithoutQuery(right.href).length - pathWithoutQuery(left.href).length)[0];
  const item = best?.item ?? null;
  const groupKey = item?.group ?? null;
  const group = groupKey ? SUBNAV_GROUPS[groupKey] ?? null : null;
  const subItem =
    group
      ?.filter((entry) => isPathActive(pathname, entry.href))
      .sort((left, right) => right.href.length - left.href.length)[0] ?? null;
  return { item, groupKey, group, subItem };
}

export function isImmersiveRoute(pathname: string): boolean {
  return IMMERSIVE_ROUTES.some((pattern) => pattern.test(pathname));
}
