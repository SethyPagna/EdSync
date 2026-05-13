"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowRight, CheckCircle2 } from "lucide-react";

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

  const enroll = async () => {
    setLoading(true);
    const response = await fetch(`/api/catalog/${productId}/enroll`, {
      method: "POST",
      credentials: "include",
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);

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

    setDone(true);
    toast.success(isFree ? "You are enrolled." : "Enrollment is active.");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={enroll}
      disabled={loading || done}
      className="btn-primary w-full justify-center py-3.5"
    >
      {done ? (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Enrolled
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

