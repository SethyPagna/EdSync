"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type EnrollPayload = {
  data?: {
    entitlementId?: string | null;
    loginUrl?: string;
    mode?: "active" | "enrolled" | "manual" | "redirect";
    provider?: string;
    transactionId?: string;
    url?: string | null;
  };
  error?: string | null;
};

async function readEnrollPayload(response: Response): Promise<EnrollPayload> {
  try {
    return (await response.json()) as EnrollPayload;
  } catch {
    return {};
  }
}

export default function CatalogEnrollButton({
  productId,
  isFree,
}: {
  productId: string;
  isFree: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [doneLabel, setDoneLabel] = useState("Enrolled");

  const enroll = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/catalog/${productId}/enroll`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await readEnrollPayload(response);

      if (response.status === 401 && payload.data?.loginUrl) {
        router.push(payload.data.loginUrl);
        return;
      }

      if (!response.ok) {
        toast.error(payload.error || "Could not start enrollment.");
        return;
      }

      if (payload.data?.url) {
        window.location.href = payload.data.url;
        return;
      }

      if (payload.data?.mode === "manual") {
        setDoneLabel("Request sent");
        setDone(true);
        toast.success("Checkout request created. Your organization can activate access after review.");
        router.refresh();
        return;
      }

      if (payload.data?.mode === "active") {
        setDoneLabel("Already enrolled");
        setDone(true);
        toast.success("You already have access.");
        router.refresh();
        return;
      }

      setDoneLabel("Enrolled");
      setDone(true);
      toast.success(isFree ? "You are enrolled." : "Enrollment is active.");
      router.refresh();
    } catch {
      toast.error("Enrollment could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={enroll}
      disabled={loading || done}
      className="btn-primary w-full justify-center py-3.5"
      aria-busy={loading}
    >
      {done ? (
        <>
          <CheckCircle2 className="h-4 w-4" />
          {doneLabel}
        </>
      ) : loading ? (
        "Working..."
      ) : (
        <>
          {isFree ? "Enroll free" : "Start checkout"}
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
