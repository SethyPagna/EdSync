"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import { generateInitials } from "@/lib/utils";
import {
  BarChart3,
  BookOpenCheck,
  Brain,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
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
    accent: "text-atlas-amber",
    badge: "bg-atlas-amber/10 border-atlas-amber/25 text-atlas-amber",
    gradient: "from-atlas-amber to-atlas-blue",
  },
  student: {
    label: "Student Learning OS",
    accent: "text-atlas-emerald",
    badge: "bg-atlas-emerald/10 border-atlas-emerald/25 text-atlas-emerald",
    gradient: "from-atlas-emerald to-atlas-cyan",
  },
};

export const teacherNavItems: ShellNavItem[] = [
  { href: "/teacher/dashboard", label: "Command Center", icon: LayoutDashboard },
  { href: "/teacher/lessons", label: "Lessons", icon: BookOpenCheck },
  { href: "/teacher/students", label: "Students", icon: UsersRound },
  { href: "/teacher/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/teacher/reports", label: "Reports", icon: ClipboardList },
];

export const studentNavItems: ShellNavItem[] = [
  { href: "/student/dashboard", label: "Learning Cockpit", icon: LayoutDashboard },
  { href: "/student/profile", label: "Profile", icon: UserRound },
];

export default function AppShell({ role, children, navItems }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const copy = roleCopy[role];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setProfile(data));
    });
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const sidebar = (
    <aside
      className={`${collapsed ? "lg:w-[76px]" : "lg:w-72"} flex h-screen w-72 flex-col border-r border-atlas-border bg-[#0b1018]/95 shadow-2xl shadow-black/20 backdrop-blur transition-all duration-300`}
    >
      <div className="flex items-center gap-3 border-b border-atlas-border px-4 py-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${copy.gradient}`}
          >
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-atlas-text">
                EdSync
              </p>
              <p className="text-xs text-atlas-subtle">{copy.label}</p>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-2 text-atlas-subtle hover:bg-atlas-card hover:text-atlas-text lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {!collapsed && (
        <div className="mx-4 mt-4 rounded-xl border border-atlas-border bg-atlas-card/70 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-atlas-surface text-sm font-bold text-atlas-text">
              {generateInitials(profile?.full_name || profile?.email || role)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-atlas-text">
                {profile?.full_name || "Getting ready"}
              </p>
              <p className="truncate text-xs text-atlas-subtle">
                {profile?.email || "Connect Supabase to personalize"}
              </p>
            </div>
          </div>
          {role === "student" && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-atlas-subtle">
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
                  ? "bg-atlas-blue/12 text-atlas-blue ring-1 ring-atlas-blue/25"
                  : "text-atlas-subtle hover:bg-atlas-card hover:text-atlas-text"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-atlas-border p-3">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-atlas-subtle hover:bg-atlas-card hover:text-atlas-text lg:flex"
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
          className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-atlas-red hover:bg-atlas-red/10 ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-atlas-bg text-atlas-text">
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-atlas-border bg-atlas-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-atlas-border bg-atlas-card p-2 text-atlas-text"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="flex items-center gap-2 font-display font-bold">
          <Brain className={`h-5 w-5 ${copy.accent}`} />
          EdSync
        </Link>
        <div className="h-10 w-10" />
      </div>

      <div className="flex">
        <div className="sticky top-0 hidden h-screen flex-shrink-0 lg:block">
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
        <main className="min-h-screen flex-1 overflow-x-hidden pt-16 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
