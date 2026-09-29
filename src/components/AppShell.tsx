"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell, ChevronDown, Compass, GraduationCap, LogOut, Menu, PanelLeftClose,
  PanelLeftOpen, Palette, Plus, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { createClient } from "@/lib/edsync/client";
import type { Profile } from "@/types";
import { generateInitials } from "@/lib/utils";
import {
  adminNav, canAccess, isImmersiveRoute, matchNav, navForRole,
  studentNav, teacherNav, type NavItem, type NavRole, type PlanTier,
} from "@/lib/nav/config";
import {
  adminViewModeForWorkspaceRole, adminViewModeLabel, normalizeAdminViewMode,
  type AdminViewMode,
} from "@/lib/admin-view";
import {
  ACCENTS, hasStoredTheme, normalizeThemePreference, setAppearance,
  SIDEBAR_STORAGE_KEY, THEMES, type ThemePreference,
} from "@/lib/ui/theme";
import { AppearancePicker } from "@/components/ui/AppearancePicker";
import { ConfirmProvider, Popover, Sheet, usePersistentState } from "@/components/ui";
import CommandMenu from "@/components/CommandMenu";
import NotificationMenu from "@/components/NotificationMenu";
import LanguageMenu from "@/components/LanguageMenu";
import type { ShellCommand } from "@/components/shell/commands";

export type ShellNavItem = Pick<NavItem, "href" | "label" | "icon" | "permission" | "plan"> & Partial<Pick<NavItem, "id" | "aliases" | "group">>;
export const teacherNavItems: ShellNavItem[] = teacherNav;
export const studentNavItems: ShellNavItem[] = studentNav;
export const adminNavItems: ShellNavItem[] = adminNav;

type AppShellProps = {
  role: NavRole;
  children: React.ReactNode;
  navItems?: ShellNavItem[];
};

type WorkspaceContext = {
  type: "organization" | "individual";
  organizationCode?: string | null;
  organizationName?: string | null;
};

type LabelInput = { role: NavRole; workspaceContext: WorkspaceContext | null };

export function shellWorkspaceLabel({ role, workspaceContext, adminViewMode, isAdminViewMode }: LabelInput & { adminViewMode: AdminViewMode | null; isAdminViewMode: boolean }) {
  if (isAdminViewMode && adminViewMode) return adminViewModeLabel(adminViewMode);
  if (workspaceContext?.organizationName) return workspaceContext.organizationName;
  if (role === "admin") return "Platform owner";
  if (workspaceContext?.type === "organization") return role === "teacher" ? "Org creator" : "Org learner";
  return role === "teacher" ? "Creator workspace" : "Learner workspace";
}

export function shellNavDisplayLabel({ label }: LabelInput & { label: string }) { return label; }
export function shellNavGroupDisplayLabel({ label }: LabelInput & { label: string }) { return label; }

function readWorkspaceContext(): WorkspaceContext | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem("edsync-auth-workspace") ?? "null");
    if (!value || typeof value !== "object") return null;
    const context = value as Record<string, unknown>;
    return {
      type: context.type === "organization" ? "organization" : "individual",
      organizationCode: typeof context.organizationCode === "string" ? context.organizationCode : null,
      organizationName: typeof context.organizationName === "string" ? context.organizationName : null,
    };
  } catch { return null; }
}

function readCookie(name: string): string | null {
  const row = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : null;
}

function writeAdminViewCookie(mode: AdminViewMode) {
  document.cookie = `edsync-admin-view-mode=${mode}; path=/; max-age=3600; SameSite=Lax`;
}

function appendAdminViewMode(href: string, mode: AdminViewMode | null) {
  if (!mode || href.includes("adminView=")) return href;
  if (!href.startsWith("/student") && !href.startsWith("/teacher") && !["/studio", "/practice", "/ai"].includes(href)) return href;
  return `${href}${href.includes("?") ? "&" : "?"}adminView=${mode}`;
}

const CREATE_ACTIONS = [
  { id: "new-design", label: "New design", href: "/studio?new=slides-16x9", icon: Palette },
  { id: "magic-design", label: "Magic design", href: "/studio?magic=1", icon: Sparkles },
  { id: "new-course", label: "New course", href: "/teacher/lessons?new=1", icon: GraduationCap },
] as const;

const OWNER_VIEWS: { mode: AdminViewMode; label: string; href: string }[] = [
  { mode: "individual", label: "Individual", href: "/student/dashboard?adminView=individual" },
  { mode: "organization", label: "Organization", href: "/admin/portals?adminView=organization" },
  { mode: "organization-teacher", label: "Org creator", href: "/teacher/dashboard?adminView=organization-teacher" },
  { mode: "organization-student", label: "Org learner", href: "/student/dashboard?adminView=organization-student" },
];

const isDemoSite = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function ShellContent({ role, children, navItems }: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [planTier, setPlanTier] = useState<PlanTier>("solo");
  const [sessionRole, setSessionRole] = useState<NavRole | null>(null);
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null);
  const [requestedAdminView, setRequestedAdminView] = useState<AdminViewMode | null>(null);
  const [sidebar, setSidebar] = usePersistentState<"rail" | "expanded">(SIDEBAR_STORAGE_KEY, "rail");
  const [moreOpen, setMoreOpen] = useState(false);
  const [avatarTarget, setAvatarTarget] = useState<"rail" | "mobile" | null>(null);

  const roleCookieIsAdmin = sessionRole === "admin";
  const previewing = role !== "admin" && (roleCookieIsAdmin || requestedAdminView !== null);
  const adminViewMode = previewing
    ? requestedAdminView ?? adminViewModeForWorkspaceRole(role === "teacher" ? "teacher" : "student")
    : null;
  const access = useMemo(() => ({ role: roleCookieIsAdmin ? "admin" as const : role, permissions, planTier }), [roleCookieIsAdmin, role, permissions, planTier]);
  const items = useMemo(() => (navItems ?? navForRole(role)).filter((item) => canAccess(item, access)), [navItems, role, access]);
  const match = matchNav(pathname, role);
  const activeItem = items.find((item) => item.href === match.item?.href || item.aliases?.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`)));
  const tabs = (match.group ?? []).filter((item) => canAccess(item, access));
  const activeTab = match.subItem;
  const editorQuery = pathname === "/studio" && ["doc", "new", "template", "magic", "import"].some((key) => searchParams.has(key));
  const immersive = isImmersiveRoute(pathname) || editorQuery;
  const workspaceLabel = shellWorkspaceLabel({ role, workspaceContext, adminViewMode, isAdminViewMode: previewing });

  useEffect(() => {
    queueMicrotask(() => {
      const cookieRole = readCookie("edsync_role");
      if (cookieRole === "admin" || cookieRole === "teacher" || cookieRole === "student") setSessionRole(cookieRole);
      setWorkspaceContext(readWorkspaceContext());
      setRequestedAdminView(normalizeAdminViewMode(searchParams.get("adminView")) ?? normalizeAdminViewMode(readCookie("edsync-admin-view-mode")));
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    document.documentElement.dataset.sidebar = sidebar;
  }, [sidebar]);

  useEffect(() => {
    let active = true;
    void edsync.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return;
      const actualRole = user.user_metadata?.role;
      if (actualRole === "admin" || actualRole === "teacher" || actualRole === "student") setSessionRole(actualRole);
      void edsync.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (!active) return;
        setProfile(data);
        const theme = normalizeThemePreference(data?.preferences?.theme);
        if (theme && !hasStoredTheme()) setAppearance({ theme });
      });
    });
    return () => { active = false; };
  }, [edsync]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/permissions", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!payload?.data) return;
        setPermissions(payload.data.granted ?? []);
        const tier = payload.data.context?.tenant?.plan_tier;
        if (tier === "solo" || tier === "team" || tier === "enterprise") setPlanTier(tier);
      }).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (role === "admin") {
      document.cookie = "edsync-admin-view-mode=; path=/; max-age=0; SameSite=Lax";
      return;
    }
    if (!previewing || !adminViewMode) return;
    document.cookie = `edsync-admin-view-mode=${adminViewMode}; path=/; max-age=3600; SameSite=Lax`;
    const path = `${window.location.pathname}${window.location.search}`;
    const auditKey = `edsync-admin-view-audit:${adminViewMode}:${path}`;
    if (window.sessionStorage.getItem(auditKey)) return;
    window.sessionStorage.setItem(auditKey, "1");
    void fetch("/api/admin/view-audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: adminViewMode, path }), keepalive: true })
      .then((response) => { if (!response.ok) window.sessionStorage.removeItem(auditKey); })
      .catch(() => window.sessionStorage.removeItem(auditKey));
  }, [role, previewing, adminViewMode, pathname, searchParams]);

  const handleThemeChange = async (theme: ThemePreference) => {
    if (!profile) return;
    try {
      const { data } = await edsync.from("profiles").select("preferences").eq("id", profile.id).maybeSingle();
      const preferences = { ...(data?.preferences ?? profile.preferences ?? { text_size: "medium" }), theme };
      setProfile({ ...profile, preferences });
      await edsync.from("profiles").update({ preferences }).eq("id", profile.id);
    } catch { /* The local appearance remains usable if profile sync fails. */ }
  };

  const handleLogout = async () => {
    try { await edsync.auth.signOut(); }
    finally {
      window.localStorage.removeItem("edsync-auth-workspace");
      document.cookie = "edsync-admin-view-mode=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "edsync_role=; path=/; max-age=0; SameSite=Lax";
      router.replace(isDemoSite ? "/catalog" : "/auth/login");
      router.refresh();
    }
  };

  const changeView = (mode: AdminViewMode, href: string) => {
    writeAdminViewCookie(mode);
    if (mode === "organization") {
      void fetch("/api/admin/view-audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, path: href }), keepalive: true }).catch(() => {});
    }
    setAvatarTarget(null);
    setMoreOpen(false);
    router.push(href);
  };

  const createActions = isDemoSite || role === "student" ? [] : CREATE_ACTIONS;
  const commands: ShellCommand[] = [
    ...items.map((item) => ({ id: `nav:${item.href}`, label: item.label, icon: item.icon, group: "Pages", href: appendAdminViewMode(item.href, adminViewMode), keywords: [item.id ?? ""] })),
    ...tabs.filter((tab) => tab.href !== activeItem?.href).map((tab) => ({ id: `tab:${tab.href}`, label: tab.label, icon: activeItem?.icon ?? Compass, group: activeItem?.label ?? "Pages", href: appendAdminViewMode(tab.href, adminViewMode) })),
    ...createActions.map((action) => ({ id: action.id, label: action.label, icon: action.icon, group: "Create", href: appendAdminViewMode(action.href, adminViewMode) })),
    { id: "catalog", label: "Explore courses", icon: Compass, group: "Explore", href: "/catalog", keywords: ["browse"] },
    ...THEMES.map((theme) => ({ id: `theme:${theme.id}`, label: `Theme: ${theme.name}`, icon: Palette, group: "Appearance", onSelect: () => { setAppearance({ theme: theme.id }); void handleThemeChange(theme.id); } })),
    ...ACCENTS.map((accent) => ({ id: `accent:${accent.id}`, label: `Accent: ${accent.name}`, icon: Palette, group: "Appearance", onSelect: () => setAppearance({ accent: accent.id }) })),
    { id: "density:compact", label: "Compact density", icon: Menu, group: "Appearance", onSelect: () => setAppearance({ density: "compact" }) },
    { id: "density:comfortable", label: "Comfortable density", icon: Menu, group: "Appearance", onSelect: () => setAppearance({ density: "comfortable" }) },
    { id: "sidebar", label: sidebar === "rail" ? "Expand sidebar" : "Collapse sidebar", icon: sidebar === "rail" ? PanelLeftOpen : PanelLeftClose, group: "Workspace", onSelect: () => setSidebar(sidebar === "rail" ? "expanded" : "rail") },
    { id: "signout", label: "Sign out", icon: LogOut, group: "Account", onSelect: () => { void handleLogout(); } },
  ];

  const navLink = (item: ShellNavItem, mobile = false) => {
    const active = item.href === activeItem?.href;
    const Icon = item.icon;
    return (
      <Link key={item.href} href={appendAdminViewMode(item.href, adminViewMode)} onClick={() => setMoreOpen(false)} className={mobile ? "workspace-tab" : "workspace-nav-item"} data-active={active} aria-current={active ? "page" : undefined} aria-label={item.label} data-tooltip={mobile ? undefined : item.label} data-tooltip-side="right">
        <Icon size={mobile ? 19 : 20} strokeWidth={1.8} aria-hidden />
        <span>{item.label}</span>
      </Link>
    );
  };

  const avatar = (mobile = false) => (
    <Popover
      open={avatarTarget === (mobile ? "mobile" : "rail")}
      onOpenChange={(open) => setAvatarTarget(open ? (mobile ? "mobile" : "rail") : null)}
      align="end"
      label="Account menu"
      className="workspace-avatar-menu w-[min(328px,calc(100vw-16px))] p-2"
      trigger={<button type="button" className="workspace-avatar-button" aria-label="Account menu" data-tooltip={mobile ? undefined : "Account"} data-tooltip-side="right"><span className="workspace-avatar">{generateInitials(profile?.full_name || role)}</span></button>}
    >
      {(close) => (
        <>
          <div className="workspace-account-heading"><strong>{profile?.full_name || (role === "admin" ? "Administrator" : role === "teacher" ? "Creator" : "Learner")}</strong><span>{profile?.email || workspaceLabel}</span></div>
          <Link className="workspace-menu-link" onClick={close} href={role === "admin" ? "/admin/settings" : `/${role}/profile`}><UserRound size={16} /> Profile</Link>
          {role === "student" && <Link className="workspace-menu-link" onClick={close} href="/student/notifications"><Bell size={16} /> Notifications</Link>}
          <details className="workspace-menu-details"><summary><Palette size={16} /> Appearance <ChevronDown size={14} /></summary><div className="workspace-appearance"><AppearancePicker onChange={(appearance) => { if (normalizeThemePreference(profile?.preferences?.theme) !== appearance.theme) void handleThemeChange(appearance.theme); }} /></div></details>
          <div className="workspace-language-row"><span>Language</span><LanguageMenu compact /></div>
          {roleCookieIsAdmin && <details className="workspace-menu-details"><summary><ShieldCheck size={16} /> View as <ChevronDown size={14} /></summary><div className="workspace-view-list">{OWNER_VIEWS.map((view) => <button key={view.mode} type="button" onClick={() => changeView(view.mode, view.href)}>{view.label}</button>)}{previewing && <Link href="/admin/dashboard" onClick={close}>Exit preview</Link>}</div></details>}
          <button type="button" className="workspace-menu-link" onClick={() => { close(); void handleLogout(); }}><LogOut size={16} /> Sign out</button>
        </>
      )}
    </Popover>
  );

  return (
    <ConfirmProvider>
      <div className="premium-shell workspace-shell min-h-screen text-fg" data-shell-role={role} data-immersive={immersive}>
        <a href="#workspace-content" className="workspace-skip">Skip to content</a>
        {!immersive && <aside className="workspace-sidebar" aria-label="Workspace navigation">
          <div className="workspace-brand-row"><Link href={`/${role}/dashboard`} className="workspace-brand" aria-label="EdSync home"><span className="workspace-mark">E<span>.</span></span><strong>EdSync</strong></Link></div>
          <nav className="workspace-nav edsync-scrollbar-none" aria-label="Main navigation">
            {previewing && <Link href="/admin/dashboard" className="workspace-nav-item" data-tooltip="Back to admin" data-tooltip-side="right"><ShieldCheck size={20} /><span>Back to admin</span></Link>}
            {items.map((item) => navLink(item))}
          </nav>
          <div className="workspace-sidebar-footer">
            {createActions.length > 0 && <Popover align="start" side="top" label="Create" className="w-52 p-1.5" trigger={<button type="button" className="workspace-nav-item" data-tooltip="Create" data-tooltip-side="right"><Plus size={20} /><span>Create</span></button>}>{(close) => createActions.map((action) => <Link key={action.id} href={appendAdminViewMode(action.href, adminViewMode)} className="workspace-menu-link" onClick={close}><action.icon size={16} /> {action.label}</Link>)}</Popover>}
            <div className="workspace-rail-bottom"><NotificationMenu role={role} placement="top" align="left" />{avatar()}<button type="button" className="workspace-pin" onClick={() => setSidebar(sidebar === "rail" ? "expanded" : "rail")} aria-label={sidebar === "rail" ? "Expand sidebar" : "Collapse sidebar"} data-tooltip={sidebar === "rail" ? "Expand sidebar" : "Collapse sidebar"} data-tooltip-side="right">{sidebar === "rail" ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
          </div>
        </aside>}
        <div className="workspace-body">
          {!immersive && <header className="workspace-topbar">
            <div className="workspace-topbar-leading"><Link href={`/${role}/dashboard`} className="workspace-mobile-brand" aria-label="EdSync home"><span className="workspace-mark">E<span>.</span></span></Link><div className="workspace-topbar-title"><span>{activeItem?.label ?? "Workspace"}</span>{tabs.length > 0 && <nav className="workspace-group-tabs" aria-label={`${activeItem?.label ?? "Workspace"} sections`}>{tabs.map((tab) => { const active = tab.href === activeTab?.href; return <Link key={tab.href} href={appendAdminViewMode(tab.href, adminViewMode)} aria-current={active ? "page" : undefined} data-active={active}>{tab.label}</Link>; })}</nav>}</div></div>
            <div className="workspace-topbar-actions">{(previewing || workspaceContext?.type === "organization" || requestedAdminView === "organization") && <span className="workspace-context-chip" title={requestedAdminView === "organization" && role === "admin" ? adminViewModeLabel("organization") : workspaceLabel}>{requestedAdminView === "organization" && role === "admin" ? adminViewModeLabel("organization") : workspaceLabel}</span>}<CommandMenu items={commands} /><div className="workspace-topbar-bell"><NotificationMenu role={role} /></div><div className="workspace-mobile-avatar">{avatar(true)}</div></div>
          </header>}
          {isDemoSite && <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-edsync-blue/20 bg-edsync-blue/5 px-4 py-2 text-xs text-edsync-text sm:px-6">
            <span><strong className="font-semibold">Sample workspace</strong> · Explore the example data. Changes are disabled in this public demo.</span>
            <Link href="/catalog" className="font-semibold text-edsync-blue hover:underline">Switch learner / teacher view</Link>
          </div>}
          <main id="workspace-content" tabIndex={-1} className="workspace-content">{children}</main>
        </div>
        {!immersive && <><nav className="workspace-mobile-tabs" aria-label="Mobile navigation">{items.slice(0, 4).map((item) => navLink(item, true))}<button type="button" className="workspace-tab" data-active={items.slice(4).some((item) => item.href === activeItem?.href)} aria-label="More navigation" onClick={() => setMoreOpen(true)}><Menu size={19} /><span>More</span></button></nav><Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More" side="bottom"><div className="workspace-more-list">{items.slice(4).map((item) => navLink(item))}<Link href="/catalog" onClick={() => setMoreOpen(false)} className="workspace-menu-link"><Compass size={18} /> Explore courses</Link>{createActions.map((action) => <Link key={action.id} href={appendAdminViewMode(action.href, adminViewMode)} onClick={() => setMoreOpen(false)} className="workspace-menu-link"><action.icon size={18} /> {action.label}</Link>)}<Link href={role === "admin" ? "/admin/settings" : `/${role}/profile`} onClick={() => setMoreOpen(false)} className="workspace-menu-link"><UserRound size={18} /> Profile</Link></div></Sheet></>}
      </div>
    </ConfirmProvider>
  );
}

export default function AppShell(props: AppShellProps) {
  return <Suspense fallback={<main>{props.children}</main>}><ShellContent {...props} /></Suspense>;
}
