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
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Sun,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type AppShellProps = {
  role: "teacher" | "student";
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
  { href: "/teacher/planner", label: "Planner", icon: CalendarClock },
  { href: "/teacher/students", label: "Students", icon: UsersRound },
  { href: "/teacher/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/teacher/reports", label: "Reports", icon: ClipboardList },
  { href: "/teacher/profile", label: "Profile", icon: UserRound },
];

export const studentNavItems: ShellNavItem[] = [
  { href: "/student/dashboard", label: "Learning Cockpit", icon: LayoutDashboard },
  { href: "/student/profile", label: "Profile", icon: UserRound },
];

export default function AppShell({ role, children, navItems }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const copy = roleCopy[role];

  useEffect(() => {
    const stored = window.localStorage.getItem("edsync-theme");
    const useDark = stored === "dark";
    document.documentElement.classList.toggle("dark", useDark);
    setDarkMode(useDark);
  }, []);

  useEffect(() => {
    edsync.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
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

  const sidebar = (
    <aside
      className={`${collapsed ? "lg:w-[76px]" : "lg:w-72"} flex h-dvh w-72 flex-col border-r border-edsync-border bg-edsync-surface/95 shadow-xl shadow-slate-200/60 backdrop-blur transition-all duration-300 dark:shadow-black/20`}
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

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-edsync-blue/12 text-edsync-blue ring-1 ring-edsync-blue/25"
                  : "text-edsync-subtle hover:bg-edsync-card hover:text-edsync-text"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
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
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-edsync-border bg-edsync-bg/90 px-4 py-3 backdrop-blur lg:hidden">
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
          <div className="sticky top-0 z-20 hidden justify-end border-b border-edsync-border bg-edsync-bg/80 px-6 py-3 backdrop-blur lg:flex">
            <NotificationMenu />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
