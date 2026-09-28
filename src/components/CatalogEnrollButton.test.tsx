import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";
import CatalogEnrollButton from "./CatalogEnrollButton";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CatalogEnrollButton", () => {
  it("does not offer enrollment for a paid course without a price", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<CatalogEnrollButton productId="course-1" isFree={false} available={false} />);

    const button = screen.getByRole("button", { name: "Unavailable" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the server error for a failed enrollment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "This course is not open for enrollment." }),
    }));
    render(<CatalogEnrollButton productId="course-2" isFree={false} />);

    fireEvent.click(screen.getByRole("button", { name: /start checkout/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("This course is not open for enrollment.");
    });
    expect(screen.getByRole("button", { name: /start checkout/i })).not.toBeDisabled();
  });
});
