export const NOTIFICATION_TITLE_MAX_LENGTH = 120;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 600;
export const NOTIFICATION_TYPE_MAX_LENGTH = 80;
export const NOTIFICATION_ID_MAX_LENGTH = 160;
export const NOTIFICATION_ACTION_URL_MAX_LENGTH = 500;
export const NOTIFICATION_METADATA_MAX_LENGTH = 4_000;

const NOTIFICATION_TYPE_PATTERN = /^[a-z0-9_.:-]+$/i;
const NOTIFICATION_ID_PATTERN = /^[a-z0-9_.:-]+$/i;
const SAFE_CHANNELS = new Set(["in_app", "email"]);

export type NotificationPriority = "low" | "normal" | "high";

export type NormalizedNotificationInput = {
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  priority: NotificationPriority;
  channels: string[];
  metadata: Record<string, unknown>;
};

export function validateNotificationTitle(value: unknown) {
  const title = String(value ?? "").trim();
  if (!title) throw new Error("Notification title is required.");
  if (title.length > NOTIFICATION_TITLE_MAX_LENGTH) {
    throw new Error(`Notification title must be ${NOTIFICATION_TITLE_MAX_LENGTH} characters or fewer.`);
  }
  return title;
}

export function validateNotificationMessage(value: unknown) {
  const message = String(value ?? "").trim();
  if (!message) throw new Error("Notification message is required.");
  if (message.length > NOTIFICATION_MESSAGE_MAX_LENGTH) {
    throw new Error(`Notification message must be ${NOTIFICATION_MESSAGE_MAX_LENGTH} characters or fewer.`);
  }
  return message;
}

export function validateNotificationType(value: unknown) {
  const type = String(value ?? "manual").trim() || "manual";
  if (type.length > NOTIFICATION_TYPE_MAX_LENGTH || !NOTIFICATION_TYPE_PATTERN.test(type)) {
    throw new Error("Notification type must be a short identifier.");
  }
  return type;
}

export function validateNotificationRecordId(value: unknown, label = "Record") {
  const id = String(value ?? "").trim();
  if (!id) throw new Error(`${label} is required.`);
  if (id.length > NOTIFICATION_ID_MAX_LENGTH || !NOTIFICATION_ID_PATTERN.test(id)) {
    throw new Error(`${label} must be a short identifier.`);
  }
  return id;
}

export function normalizeOptionalNotificationRecordId(value: unknown, label = "Record") {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return validateNotificationRecordId(value, label);
}

export function validateNotificationPriority(value: unknown): NotificationPriority {
  if (value === "low" || value === "normal" || value === "high") return value;
  return "normal";
}

export function validateNotificationActionUrl(value: unknown) {
  const url = String(value ?? "").trim();
  if (!url) return null;
  if (url.length > NOTIFICATION_ACTION_URL_MAX_LENGTH) {
    throw new Error(`Notification action must be ${NOTIFICATION_ACTION_URL_MAX_LENGTH} characters or fewer.`);
  }
  if (!url.startsWith("/") || url.startsWith("//") || /[\r\n]/.test(url)) {
    throw new Error("Notification action must be an internal EdSync path.");
  }
  return url;
}

export function normalizeNotificationChannels(value: unknown) {
  if (!Array.isArray(value)) return ["in_app"];
  const channels = value.filter((channel): channel is string => typeof channel === "string" && SAFE_CHANNELS.has(channel));
  return channels.length > 0 ? Array.from(new Set(channels)) : ["in_app"];
}

export function normalizeNotificationMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const metadata = value as Record<string, unknown>;
  if (JSON.stringify(metadata).length > NOTIFICATION_METADATA_MAX_LENGTH) {
    throw new Error(`Notification metadata must be ${NOTIFICATION_METADATA_MAX_LENGTH} characters or fewer.`);
  }
  return metadata;
}

export function normalizeNotificationInput(input: {
  type?: unknown;
  title?: unknown;
  message?: unknown;
  actionUrl?: unknown;
  priority?: unknown;
  channels?: unknown;
  metadata?: unknown;
}): NormalizedNotificationInput {
  return {
    type: validateNotificationType(input.type),
    title: validateNotificationTitle(input.title),
    message: validateNotificationMessage(input.message),
    actionUrl: validateNotificationActionUrl(input.actionUrl),
    priority: validateNotificationPriority(input.priority),
    channels: normalizeNotificationChannels(input.channels),
    metadata: normalizeNotificationMetadata(input.metadata),
  };
}
