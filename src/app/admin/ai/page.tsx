"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  TestTube2,
  Trash2,
  X,
} from "lucide-react";
import { ActionMenu, InfoPopover } from "@/components/WorkspacePrimitives";

type ProviderMetaEntry = {
  label: string;
  providerType: "chat" | "embed";
  defaultEndpoint: string;
  defaultModel: string;
  defaultPriority: number;
  safeRequestsPerMinute: number;
  safeMaxInputChars: number;
  safeMaxCompletionTokens: number;
  safeTimeoutMs: number;
  safeCooldownSeconds: number;
};

type Provider = {
  id: string;
  name: string;
  label: string;
  provider: string;
  provider_type: "chat" | "embed";
  account_email: string | null;
  project_name: string | null;
  default_model: string | null;
  supported_models: string[];
  endpoint_override: string | null;
  endpoint_effective: string;
  notes: string | null;
  enabled: boolean;
  priority: number;
  requests_per_minute: number;
  max_input_chars: number;
  max_completion_tokens: number;
  timeout_ms: number;
  cooldown_seconds: number;
  last_status: "untested" | "ok" | "error";
  last_error: string | null;
  last_checked_at: string | null;
  has_key: boolean;
  key_state: "ready" | "missing" | "unreadable" | "encryption_unconfigured";
  key_masked?: string;
};

type ProviderSummary = {
  total: number;
  enabled: number;
  healthy: number;
  errors: number;
  chat: number;
  embed: number;
  recent_runs: number;
  recent_failures: number;
  average_latency_ms: number | null;
};

type AIRun = {
  id: string;
  feature: string;
  provider: string | null;
  model: string | null;
  success: number;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
};

type ProviderForm = {
  name: string;
  provider: string;
  provider_type: "chat" | "embed";
  account_email: string;
  project_name: string;
  api_key: string;
  default_model: string;
  supported_models: string;
  endpoint_override: string;
  notes: string;
  enabled: boolean;
  priority: string;
  requests_per_minute: string;
  max_input_chars: string;
  max_completion_tokens: string;
  timeout_ms: string;
  cooldown_seconds: string;
};

const FALLBACK_META: Record<string, ProviderMetaEntry> = {
  groq: {
    label: "Groq",
    providerType: "chat",
    defaultEndpoint: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "groq/compound",
    defaultPriority: 10,
    safeRequestsPerMinute: 18,
    safeMaxInputChars: 3000,
    safeMaxCompletionTokens: 2200,
    safeTimeoutMs: 18000,
    safeCooldownSeconds: 20,
  },
  google: {
    label: "Google AI",
    providerType: "chat",
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-flash-latest",
    defaultPriority: 20,
    safeRequestsPerMinute: 14,
    safeMaxInputChars: 3200,
    safeMaxCompletionTokens: 2200,
    safeTimeoutMs: 17000,
    safeCooldownSeconds: 20,
  },
  mistral: {
    label: "Mistral AI",
    providerType: "chat",
    defaultEndpoint: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-small-latest",
    defaultPriority: 30,
    safeRequestsPerMinute: 10,
    safeMaxInputChars: 3000,
    safeMaxCompletionTokens: 1800,
    safeTimeoutMs: 18000,
    safeCooldownSeconds: 25,
  },
  cerebras: {
    label: "Cerebras",
    providerType: "chat",
    defaultEndpoint: "https://api.cerebras.ai/v1/chat/completions",
    defaultModel: "llama3.1-8b",
    defaultPriority: 40,
    safeRequestsPerMinute: 12,
    safeMaxInputChars: 2500,
    safeMaxCompletionTokens: 1600,
    safeTimeoutMs: 14000,
    safeCooldownSeconds: 25,
  },
  cohere: {
    label: "Cohere",
    providerType: "embed",
    defaultEndpoint: "https://api.cohere.com/v2/embed",
    defaultModel: "embed-english-v3.0",
    defaultPriority: 90,
    safeRequestsPerMinute: 20,
    safeMaxInputChars: 2000,
    safeMaxCompletionTokens: 0,
    safeTimeoutMs: 12000,
    safeCooldownSeconds: 20,
  },
};

const EMPTY_SUMMARY: ProviderSummary = {
  total: 0,
  enabled: 0,
  healthy: 0,
  errors: 0,
  chat: 0,
  embed: 0,
  recent_runs: 0,
  recent_failures: 0,
  average_latency_ms: null,
};

function blankForm(provider = "groq", meta: Record<string, ProviderMetaEntry> = FALLBACK_META): ProviderForm {
  const selected = meta[provider] ?? FALLBACK_META.groq;
  return {
    name: selected.label,
    provider,
    provider_type: selected.providerType,
    account_email: "",
    project_name: "",
    api_key: "",
    default_model: selected.defaultModel,
    supported_models: selected.defaultModel,
    endpoint_override: "",
    notes: "",
    enabled: true,
    priority: String(selected.defaultPriority),
    requests_per_minute: String(selected.safeRequestsPerMinute),
    max_input_chars: String(selected.safeMaxInputChars),
    max_completion_tokens: String(selected.safeMaxCompletionTokens),
    timeout_ms: String(selected.safeTimeoutMs),
    cooldown_seconds: String(selected.safeCooldownSeconds),
  };
}

function formFromProvider(provider: Provider): ProviderForm {
  return {
    name: provider.name,
    provider: provider.provider,
    provider_type: provider.provider_type,
    account_email: provider.account_email ?? "",
    project_name: provider.project_name ?? "",
    api_key: "",
    default_model: provider.default_model ?? "",
    supported_models: provider.supported_models.join("\n"),
    endpoint_override: provider.endpoint_override ?? "",
    notes: provider.notes ?? "",
    enabled: provider.enabled,
    priority: String(provider.priority),
    requests_per_minute: String(provider.requests_per_minute),
    max_input_chars: String(provider.max_input_chars),
    max_completion_tokens: String(provider.max_completion_tokens),
    timeout_ms: String(provider.timeout_ms),
    cooldown_seconds: String(provider.cooldown_seconds),
  };
}

function statusClasses(status: Provider["last_status"]) {
  if (status === "ok") return "bg-edsync-emerald/10 text-edsync-emerald";
  if (status === "error") return "bg-edsync-red/10 text-edsync-red";
  return "bg-edsync-amber/10 text-edsync-amber";
}

function keyStateLabel(provider: Provider) {
  if (provider.key_masked) return provider.key_masked;
  if (provider.key_state === "unreadable") return "re-save key";
  if (provider.key_state === "encryption_unconfigured") return "encryption off";
  if (provider.key_state === "missing") return "missing";
  return provider.has_key ? "stored" : "missing";
}

function keyStateClasses(provider: Provider) {
  if (provider.key_state === "ready") return "bg-edsync-emerald/10 text-edsync-emerald";
  if (provider.key_state === "missing") return "bg-edsync-amber/10 text-edsync-amber";
  return "bg-edsync-red/10 text-edsync-red";
}

function keyStateAction(provider: Provider) {
  if (provider.key_state === "missing") return "Paste an API key before testing this provider.";
  if (provider.key_state === "unreadable") return "Re-save this provider key in the current deployment environment.";
  if (provider.key_state === "encryption_unconfigured") return "Configure APP_ENCRYPTION_KEY before testing stored provider keys.";
  return "";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-semibold uppercase tracking-wide text-edsync-subtle">{children}</label>;
}

function ProviderActionMenu({
  provider,
  testing,
  busy,
  onEdit,
  onTest,
  onToggle,
  onReset,
  onDelete,
}: {
  provider: Provider;
  testing: boolean;
  busy: boolean;
  onEdit: () => void;
  onTest: () => void;
  onToggle: () => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const keyIssue = keyStateAction(provider);
  return (
    <ActionMenu label={`Provider actions for ${provider.name}`}>
      <button type="button" onClick={onEdit} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-edsync-subtle hover:bg-edsync-muted hover:text-edsync-text">
        <Pencil className="h-4 w-4" />
        Edit provider
      </button>
      <button
        type="button"
        onClick={onTest}
        disabled={testing || Boolean(keyIssue)}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-edsync-subtle hover:bg-edsync-muted hover:text-edsync-text disabled:cursor-not-allowed disabled:opacity-50"
        title={keyIssue || "Run provider health check"}
      >
        <TestTube2 className="h-4 w-4" />
        {testing ? "Testing..." : "Test health"}
      </button>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-edsync-subtle hover:bg-edsync-muted hover:text-edsync-text disabled:opacity-50"
      >
        <ShieldCheck className="h-4 w-4" />
        {provider.enabled ? "Pause fallback" : "Enable fallback"}
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={busy}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-edsync-subtle hover:bg-edsync-muted hover:text-edsync-text disabled:opacity-50"
      >
        <RefreshCw className="h-4 w-4" />
        Reset health
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-edsync-red hover:bg-edsync-red/10 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        Delete provider
      </button>
    </ActionMenu>
  );
}

export default function AdminAIPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerMeta, setProviderMeta] = useState<Record<string, ProviderMetaEntry>>(FALLBACK_META);
  const [summary, setSummary] = useState<ProviderSummary>(EMPTY_SUMMARY);
  const [recentRuns, setRecentRuns] = useState<AIRun[]>([]);
  const [form, setForm] = useState<ProviderForm>(() => blankForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const providerOptions = useMemo(() => Object.keys(providerMeta), [providerMeta]);
  const setupIssues = useMemo(
    () => providers.filter((provider) => provider.key_state !== "ready" || !provider.endpoint_effective).length,
    [providers],
  );

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ai/providers", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Provider settings could not be loaded.");
      setProviders(payload.data?.providers ?? []);
      setProviderMeta(payload.data?.providerMeta ?? FALLBACK_META);
      setSummary(payload.data?.summary ?? EMPTY_SUMMARY);
      setRecentRuns(payload.data?.recentRuns ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadProviders();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadProviders]);

  const applyProviderPreset = (provider: string) => {
    const selected = providerMeta[provider] ?? FALLBACK_META[provider] ?? FALLBACK_META.groq;
    setForm((current) => ({
      ...current,
      name: current.name === providerMeta[current.provider]?.label || current.name === FALLBACK_META[current.provider]?.label ? selected.label : current.name,
      provider,
      provider_type: selected.providerType,
      default_model: selected.defaultModel,
      supported_models: selected.defaultModel,
      priority: String(selected.defaultPriority),
      requests_per_minute: String(selected.safeRequestsPerMinute),
      max_input_chars: String(selected.safeMaxInputChars),
      max_completion_tokens: String(selected.safeMaxCompletionTokens),
      timeout_ms: String(selected.safeTimeoutMs),
      cooldown_seconds: String(selected.safeCooldownSeconds),
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(blankForm(providerOptions[0] ?? "groq", providerMeta));
    setFormOpen(false);
  };

  const editProvider = (provider: Provider) => {
    setEditingId(provider.id);
    setForm(formFromProvider(provider));
    setFormOpen(true);
  };

  const providerPayload = () => ({
    ...form,
    priority: Number(form.priority),
    requests_per_minute: Number(form.requests_per_minute),
    max_input_chars: Number(form.max_input_chars),
    max_completion_tokens: Number(form.max_completion_tokens),
    timeout_ms: Number(form.timeout_ms),
    cooldown_seconds: Number(form.cooldown_seconds),
  });

  const saveProvider = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/ai/providers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...providerPayload() } : providerPayload()),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Provider was not saved.");
      toast.success(editingId ? "Provider updated." : "Provider added.");
      resetForm();
      await loadProviders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider was not saved.");
    } finally {
      setSaving(false);
    }
  };

  const patchProviderAction = async (provider: Provider, action: "toggle" | "reset_status", enabled?: boolean) => {
    setBusyId(provider.id);
    try {
      const response = await fetch("/api/ai/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: provider.id, action, enabled }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Provider action failed.");
      toast.success(action === "toggle" ? "Provider availability updated." : "Provider health reset.");
      await loadProviders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteProvider = async (provider: Provider) => {
    if (!window.confirm(`Delete ${provider.name}? The encrypted key will be removed from EdSync.`)) return;
    setBusyId(provider.id);
    try {
      const response = await fetch(`/api/ai/providers?id=${encodeURIComponent(provider.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Provider was not deleted.");
      toast.success("Provider deleted.");
      if (editingId === provider.id) resetForm();
      await loadProviders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider was not deleted.");
    } finally {
      setBusyId(null);
    }
  };

  const testProvider = async (provider: Provider) => {
    const keyIssue = keyStateAction(provider);
    if (keyIssue) {
      toast.error(keyIssue, { duration: 8000 });
      if (provider.key_state !== "encryption_unconfigured") editProvider(provider);
      return;
    }

    setTestingId(provider.id);
    try {
      const response = await fetch(`/api/ai/providers/${provider.id}/test`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Provider test failed.");
      toast.success(payload.data?.message || "Provider responded.");
      await loadProviders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider test failed.");
      await loadProviders();
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <div className="premium-panel rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">AI command center</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">AI Providers</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Configure encrypted provider keys, routing priority, health checks, cooldowns, and automatic fallback from one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InfoPopover label="AI routing help">
            Keys are encrypted. Lower priority numbers run first. Failed providers cool down and fallback automatically.
          </InfoPopover>
          <button type="button" onClick={loadProviders} className="btn-secondary w-fit px-3 py-2" disabled={loading} aria-label="Refresh providers">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="sr-only">Refresh providers</span>
          </button>
        </div>
        </div>
        {setupIssues > 0 && (
          <div className="mt-4 rounded-2xl border border-edsync-amber/25 bg-edsync-amber/10 px-4 py-3 text-sm font-semibold text-edsync-amber">
            {setupIssues} provider{setupIssues === 1 ? "" : "s"} need a saved key, readable encryption, or endpoint before health tests can run.
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="premium-card rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-edsync-subtle">Enabled routes</p>
            <ShieldCheck className="h-4 w-4 text-edsync-blue" />
          </div>
          <p className="mt-2 text-3xl font-bold">{summary.enabled}</p>
          <p className="text-xs text-edsync-subtle">{summary.total} stored</p>
        </div>
        <div className="premium-card rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-edsync-subtle">Healthy</p>
            <CheckCircle2 className="h-4 w-4 text-edsync-emerald" />
          </div>
          <p className="mt-2 text-3xl font-bold">{summary.healthy}</p>
          <p className="text-xs text-edsync-subtle">{summary.errors} errors</p>
        </div>
        <div className="premium-card rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-edsync-subtle">Capabilities</p>
            <Bot className="h-4 w-4 text-edsync-cyan" />
          </div>
          <p className="mt-2 text-3xl font-bold">{summary.chat}</p>
          <p className="text-xs text-edsync-subtle">{summary.embed} embed</p>
        </div>
        <div className="premium-card rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-edsync-subtle">Recent runs</p>
            <Activity className="h-4 w-4 text-edsync-amber" />
          </div>
          <p className="mt-2 text-3xl font-bold">{summary.recent_runs}</p>
          <p className="text-xs text-edsync-subtle">
            {summary.average_latency_ms ? `${summary.average_latency_ms} ms avg` : "No latency sample"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="premium-surface overflow-visible rounded-2xl p-0">
            <div className="border-b border-edsync-border px-4 py-3">
              <h2 className="font-display text-xl font-bold">Routing Stack</h2>
            </div>
            <div className="grid gap-3 p-3 lg:hidden">
              {providers.map((provider) => (
                <div key={provider.id} className="rounded-lg border border-edsync-border bg-edsync-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${provider.enabled ? "bg-edsync-emerald" : "bg-edsync-subtle"}`} />
                        <p className="truncate font-semibold text-edsync-text">{provider.name}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-edsync-subtle">{provider.provider} - {provider.default_model}</p>
                    </div>
                    <span className={`badge flex-shrink-0 ${statusClasses(provider.last_status)}`}>{provider.last_status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-edsync-subtle">
                    <p>Priority <span className="font-semibold text-edsync-text">{provider.priority}</span></p>
                    <p>RPM <span className="font-semibold text-edsync-text">{provider.requests_per_minute}</span></p>
                    <p>Timeout <span className="font-semibold text-edsync-text">{provider.timeout_ms} ms</span></p>
                    <p>Cooldown <span className="font-semibold text-edsync-text">{provider.cooldown_seconds}s</span></p>
                  </div>
                  <p className="mt-2 break-all text-xs text-edsync-subtle">{provider.endpoint_effective}</p>
                  <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold ${keyStateClasses(provider)}`}>
                    <KeyRound className="h-3.5 w-3.5" />
                    {keyStateLabel(provider)}
                  </div>
                  {keyStateAction(provider) && <p className="mt-2 text-xs text-edsync-amber">{keyStateAction(provider)}</p>}
                  {provider.last_error && <p className="mt-2 text-xs text-edsync-red">{provider.last_error}</p>}
                  <div className="mt-3 flex justify-end">
                    <ProviderActionMenu
                      provider={provider}
                      testing={testingId === provider.id}
                      busy={busyId === provider.id}
                      onEdit={() => editProvider(provider)}
                      onTest={() => testProvider(provider)}
                      onToggle={() => patchProviderAction(provider, "toggle", !provider.enabled)}
                      onReset={() => patchProviderAction(provider, "reset_status")}
                      onDelete={() => deleteProvider(provider)}
                    />
                  </div>
                </div>
              ))}
              {!loading && providers.length === 0 && (
                <div className="p-3 text-sm text-edsync-subtle">No providers are configured yet. Add Groq, Google, Mistral, Cerebras, or Cohere to enable smart fallback.</div>
              )}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-edsync-border text-xs uppercase tracking-wide text-edsync-subtle">
                  <tr>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Limits</th>
                    <th className="px-4 py-3">Health</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((provider) => (
                    <tr key={provider.id} className="border-b border-edsync-border align-top last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${provider.enabled ? "bg-edsync-emerald" : "bg-edsync-subtle"}`} />
                          <div>
                            <p className="font-semibold text-edsync-text">{provider.name}</p>
                            <p className="text-xs text-edsync-subtle">{provider.provider} - {provider.default_model}</p>
                            <p className="mt-1 max-w-[260px] truncate text-xs text-edsync-subtle">{provider.endpoint_effective}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge bg-edsync-blue/10 text-edsync-blue">{provider.provider_type}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{provider.priority}</td>
                      <td className="px-4 py-3 text-xs text-edsync-subtle">
                        <p>{provider.requests_per_minute}/min</p>
                        <p>{provider.timeout_ms} ms</p>
                        <p>{provider.cooldown_seconds}s cooldown</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${statusClasses(provider.last_status)}`}>{provider.last_status}</span>
                        {provider.last_checked_at && <p className="mt-1 text-xs text-edsync-subtle">{new Date(provider.last_checked_at).toLocaleString()}</p>}
                        {provider.last_error && <p className="mt-1 max-w-[220px] text-xs text-edsync-red">{provider.last_error}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-edsync-subtle">
                        <div className={`inline-flex items-center gap-2 rounded-full px-2 py-1 font-bold ${keyStateClasses(provider)}`}>
                          <KeyRound className="h-4 w-4" />
                          {keyStateLabel(provider)}
                        </div>
                        {keyStateAction(provider) && <p className="mt-2 max-w-[220px] text-xs text-edsync-amber">{keyStateAction(provider)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <ProviderActionMenu
                          provider={provider}
                          testing={testingId === provider.id}
                          busy={busyId === provider.id}
                          onEdit={() => editProvider(provider)}
                          onTest={() => testProvider(provider)}
                          onToggle={() => patchProviderAction(provider, "toggle", !provider.enabled)}
                          onReset={() => patchProviderAction(provider, "reset_status")}
                          onDelete={() => deleteProvider(provider)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && providers.length === 0 && (
                <div className="p-6 text-sm text-edsync-subtle">No providers are configured yet. Add Groq, Google, Mistral, Cerebras, or Cohere to enable smart fallback.</div>
              )}
            </div>
          </div>

          <div className="premium-surface rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">Recent AI Runs</h2>
              </div>
              {summary.recent_failures > 0 && (
                <span className="badge bg-edsync-red/10 text-edsync-red">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {summary.recent_failures} failed
                </span>
              )}
            </div>
            <div className="grid gap-2">
              {recentRuns.slice(0, 8).map((run) => (
                <div key={run.id} className="grid gap-2 rounded-2xl border border-edsync-border bg-edsync-surface px-3 py-2 text-sm md:grid-cols-[140px_1fr_120px_120px]">
                  <span className={run.success ? "font-semibold text-edsync-emerald" : "font-semibold text-edsync-red"}>
                    {run.success ? "Success" : "Failed"}
                  </span>
                  <span className="text-edsync-text">{run.feature} via {run.provider || "unknown"}</span>
                  <span className="text-edsync-subtle">{run.latency_ms ? `${run.latency_ms} ms` : "n/a"}</span>
                  <span className="text-edsync-subtle">{new Date(run.created_at).toLocaleString()}</span>
                  {run.error_message && <p className="md:col-span-4 text-xs text-edsync-red">{run.error_message}</p>}
                </div>
              ))}
              {recentRuns.length === 0 && <p className="text-sm text-edsync-subtle">No AI run audit rows yet.</p>}
            </div>
          </div>
        </section>

        <aside className="premium-surface h-fit rounded-2xl p-4 2xl:sticky 2xl:top-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">{editingId ? "Edit Provider" : "Add Provider"}</h2>
            </div>
            {editingId ? (
              <button type="button" onClick={resetForm} className="btn-ghost px-2 py-2">
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={() => setFormOpen((value) => !value)} className="btn-secondary px-3 py-2">
                <Plus className="h-4 w-4" />
                {formOpen ? "Collapse" : "Open"}
              </button>
            )}
          </div>

          {formOpen && <form onSubmit={saveProvider} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Name</FieldLabel>
                <input className="edsync-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Provider</FieldLabel>
                <select className="edsync-input" value={form.provider} onChange={(event) => applyProviderPreset(event.target.value)}>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {providerMeta[provider]?.label ?? provider}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Account email</FieldLabel>
                <input className="edsync-input" value={form.account_email} onChange={(event) => setForm({ ...form, account_email: event.target.value })} placeholder="optional" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Project name</FieldLabel>
                <input className="edsync-input" value={form.project_name} onChange={(event) => setForm({ ...form, project_name: event.target.value })} placeholder="optional" />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>API key</FieldLabel>
              <input
                className="edsync-input"
                type="password"
                value={form.api_key}
                onChange={(event) => setForm({ ...form, api_key: event.target.value })}
                placeholder={editingId ? "Leave blank to keep encrypted key" : "Paste provider key"}
                required={!editingId}
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Default model</FieldLabel>
              <input className="edsync-input" value={form.default_model} onChange={(event) => setForm({ ...form, default_model: event.target.value })} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Supported models</FieldLabel>
              <textarea
                className="edsync-textarea min-h-24"
                value={form.supported_models}
                onChange={(event) => setForm({ ...form, supported_models: event.target.value })}
                placeholder="One model per line"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Endpoint override</FieldLabel>
              <input
                className="edsync-input"
                value={form.endpoint_override}
                onChange={(event) => setForm({ ...form, endpoint_override: event.target.value })}
                placeholder={providerMeta[form.provider]?.defaultEndpoint ?? "https://"}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel>Priority</FieldLabel>
                <input className="edsync-input" type="number" min="1" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>RPM</FieldLabel>
                <input className="edsync-input" type="number" min="1" value={form.requests_per_minute} onChange={(event) => setForm({ ...form, requests_per_minute: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Timeout</FieldLabel>
                <input className="edsync-input" type="number" min="3000" value={form.timeout_ms} onChange={(event) => setForm({ ...form, timeout_ms: event.target.value })} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel>Input chars</FieldLabel>
                <input className="edsync-input" type="number" min="200" value={form.max_input_chars} onChange={(event) => setForm({ ...form, max_input_chars: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Max tokens</FieldLabel>
                <input className="edsync-input" type="number" min="0" value={form.max_completion_tokens} onChange={(event) => setForm({ ...form, max_completion_tokens: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Cooldown</FieldLabel>
                <input className="edsync-input" type="number" min="5" value={form.cooldown_seconds} onChange={(event) => setForm({ ...form, cooldown_seconds: event.target.value })} />
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-lg border border-edsync-border px-4 py-3">
              <span>
                <span className="block text-sm font-semibold">Enabled for fallback</span>
                <span className="block text-xs text-edsync-subtle">Disabled providers remain stored but are skipped at runtime.</span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-edsync-blue"
                checked={form.enabled}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
              />
            </label>

            <div className="space-y-1.5">
              <FieldLabel>Admin notes</FieldLabel>
              <textarea className="edsync-textarea min-h-20" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Usage notes, key owner, limits, renewal notes" />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Saving" : editingId ? "Save changes" : "Add provider"}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="btn-secondary justify-center">
                  Cancel
                </button>
              )}
            </div>
          </form>}
        </aside>
      </div>
    </div>
  );
}
