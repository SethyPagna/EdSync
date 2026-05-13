"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Bot, TestTube2 } from "lucide-react";

type Provider = {
  id: string;
  name: string;
  provider: string;
  default_model: string;
  enabled: boolean;
  priority: number;
  last_status: string;
  last_error: string | null;
  key_masked?: string;
};

const providerOptions = ["groq", "google", "mistral", "cerebras", "cohere"];

export default function AdminAIPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState({
    name: "Groq",
    provider: "groq",
    api_key: "",
    default_model: "groq/compound",
    priority: 10,
  });

  const loadProviders = () => {
    fetch("/api/ai/providers", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setProviders(payload.data?.providers ?? []));
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const saveProvider = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/ai/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error || "Provider was not saved. Check APP_ENCRYPTION_KEY.");
      return;
    }
    toast.success("Provider saved.");
    setForm((current) => ({ ...current, api_key: "" }));
    loadProviders();
  };

  const testProvider = async (id: string) => {
    const response = await fetch(`/api/ai/providers/${id}/test`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) toast.error(payload.error || "Provider test failed.");
    else toast.success(payload.data?.message || "Provider responded.");
    loadProviders();
  };

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">AI providers</h1>
        <p className="mt-2 text-sm text-edsync-subtle">
          Add providers once, test them, and EdSync will automatically choose healthy providers by priority.
        </p>
      </div>

      <form onSubmit={saveProvider} className="edsync-card grid gap-3 p-4 md:grid-cols-5">
        <input className="edsync-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Name" />
        <select className="edsync-input" value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}>
          {providerOptions.map((provider) => <option key={provider}>{provider}</option>)}
        </select>
        <input className="edsync-input" value={form.default_model} onChange={(event) => setForm({ ...form, default_model: event.target.value })} placeholder="Default model" />
        <input className="edsync-input" type="password" value={form.api_key} onChange={(event) => setForm({ ...form, api_key: event.target.value })} placeholder="API key" />
        <button className="btn-primary justify-center" type="submit">
          <Bot className="h-4 w-4" />
          Add
        </button>
      </form>

      <div className="grid gap-3">
        {providers.map((provider) => (
          <div key={provider.id} className="edsync-card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold">{provider.name}</h2>
                <span className="rounded-md border border-edsync-border px-2 py-1 text-xs text-edsync-subtle">{provider.provider}</span>
                <span className={provider.last_status === "ok" ? "text-xs font-semibold text-edsync-emerald" : "text-xs font-semibold text-edsync-amber"}>
                  {provider.last_status}
                </span>
              </div>
              <p className="mt-1 text-sm text-edsync-subtle">
                {provider.default_model} · priority {provider.priority} · key {provider.key_masked || "not visible"}
              </p>
              {provider.last_error && <p className="mt-1 text-xs text-edsync-red">{provider.last_error}</p>}
            </div>
            <button type="button" onClick={() => testProvider(provider.id)} className="btn-secondary">
              <TestTube2 className="h-4 w-4" />
              Test
            </button>
          </div>
        ))}
        {providers.length === 0 && <p className="edsync-card p-4 text-sm text-edsync-subtle">No stored providers yet. Add Groq, Google, Mistral, Cerebras, or Cohere to enable smart fallback.</p>}
      </div>
    </div>
  );
}
