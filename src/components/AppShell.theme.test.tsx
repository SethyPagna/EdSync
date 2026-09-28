import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppShell, { studentNavItems } from "./AppShell";

type Preferences = Record<string, unknown>;

const db = vi.hoisted(() => ({
  stored: {} as Record<string, unknown> | null,
  selects: [] as string[],
  updates: [] as Array<{ preferences: Record<string, unknown> }>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/student/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/CommandMenu", () => ({ default: () => null }));
vi.mock("@/components/NotificationMenu", () => ({ default: () => null }));
vi.mock("@/components/LanguageMenu", () => ({ default: () => null }));
vi.mock("@/lib/edsync/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1", user_metadata: { role: "student" } } } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: (columns: string) => ({
        eq: () => ({
          maybeSingle: async () => {
            db.selects.push(columns);
            if (!db.stored) return { data: null, error: null };
            const preferences = { ...db.stored };
            return { data: columns === "*" ? { id: "user-1", full_name: "Ada Learner", preferences } : { preferences }, error: null };
          },
        }),
      }),
      update: (values: { preferences: Preferences }) => ({
        eq: async () => {
          db.updates.push(values);
          db.stored = values.preferences;
          return { data: null, error: null };
        },
      }),
    }),
  }),
}));

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  delete document.documentElement.dataset.theme;
  db.stored = { text_size: "medium", theme: "system" };
  db.selects = [];
  db.updates = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => null })));
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderShell() {
  render(
    <AppShell role="student" navItems={studentNavItems}>
      <p>Dashboard</p>
    </AppShell>,
  );
  await screen.findAllByText("Ada Learner");
}

describe("AppShell theme sync", () => {
  it("merges the theme into the latest saved preferences instead of the mount-time snapshot", async () => {
    await renderShell();

    // The profile page saves other preferences after AppShell has mounted.
    db.stored = { text_size: "large", theme: "system", email_notifications: false };

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));
    });

    await waitFor(() => expect(db.updates).toHaveLength(1));
    expect(db.selects).toEqual(["*", "preferences"]);
    expect(db.updates[0].preferences).toEqual({ text_size: "large", email_notifications: false, theme: "graphite" });
    expect(document.documentElement.dataset.theme).toBe("graphite");
  });

  it("falls back to the loaded profile when the fresh read returns nothing", async () => {
    await renderShell();
    db.stored = null;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));
    });

    await waitFor(() => expect(db.updates).toHaveLength(1));
    expect(db.updates[0].preferences).toEqual({ text_size: "medium", theme: "graphite" });
  });
});
