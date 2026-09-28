import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

vi.mock("next/font/google", () => {
  const font = (variable: string) => () => ({ variable, className: variable, style: {} });
  return { Geist: font("font-geist"), Geist_Mono: font("font-geist-mono"), Instrument_Serif: font("font-instrument-serif") };
});
vi.mock("@/components/PwaRegister", () => ({ default: () => null }));
vi.mock("react-hot-toast", () => ({ Toaster: () => <div data-toaster="" /> }));
vi.mock("@/components/ui/Confirm", () => ({
  ConfirmProvider: ({ children }: { children: ReactNode }) => <div data-confirm-provider="">{children}</div>,
}));

describe("RootLayout", () => {
  it("mounts ConfirmProvider around every route, so pages outside AppShell get the in-app dialog", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main id="route" />
      </RootLayout>,
    );

    const provided = '<div data-confirm-provider=""><main id="route"></main></div>';
    expect(markup).toContain(provided);
    expect(markup.indexOf("data-toaster")).toBeGreaterThan(markup.indexOf(provided));
  });
});
