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
  language,
  labels = {
    enrolled: "Enrolled",
    requestSent: "Request sent",
    alreadyEnrolled: "Already enrolled",
    enrollFree: "Enroll free",
    startCheckout: "Start checkout",
    working: "Working...",
    error: "Could not start enrollment.",
    connectionError: "Enrollment could not connect. Please try again.",
    manualSuccess: "Checkout request created.",
    activeSuccess: "You already have access.",
    enrolledSuccess: "Enrollment is active.",
  },
}: {
  productId: string;
  isFree: boolean;
  language?: string | null;
  labels?: {
    enrolled: string;
    requestSent: string;
    alreadyEnrolled: string;
    enrollFree: string;
    startCheckout: string;
    working: string;
    error: string;
    connectionError: string;
    manualSuccess: string;
    activeSuccess: string;
    enrolledSuccess: string;
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [doneLabel, setDoneLabel] = useState(labels.enrolled);

  const enroll = async () => {
    setLoading(true);
    try {
      const query = language ? `?language=${encodeURIComponent(language)}` : "";
      const response = await fetch(`/api/catalog/${productId}/enroll${query}`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await readEnrollPayload(response);

      if (response.status === 401 && payload.data?.loginUrl) {
        router.push(payload.data.loginUrl);
        return;
      }

      if (!response.ok) {
        toast.error(payload.error || labels.error);
        return;
      }

      if (payload.data?.url) {
        window.location.href = payload.data.url;
        return;
      }

      if (payload.data?.mode === "manual") {
        setDoneLabel(labels.requestSent);
        setDone(true);
        toast.success(labels.manualSuccess);
        router.refresh();
        return;
      }

      if (payload.data?.mode === "active") {
        setDoneLabel(labels.alreadyEnrolled);
        setDone(true);
        toast.success(labels.activeSuccess);
        router.refresh();
        return;
      }

      setDoneLabel(labels.enrolled);
      setDone(true);
      toast.success(labels.enrolledSuccess);
      router.refresh();
    } catch {
      toast.error(labels.connectionError);
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
        labels.working
      ) : (
        <>
          {isFree ? labels.enrollFree : labels.startCheckout}
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
