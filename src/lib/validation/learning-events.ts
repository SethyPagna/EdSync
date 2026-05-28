export const LEARNING_EVENT_IDENTIFIER_MAX_LENGTH = 100;
export const LEARNING_EVENT_SOURCE_ID_MAX_LENGTH = 160;
export const LEARNING_EVENT_PAYLOAD_MAX_BYTES = 100_000;

const LEARNING_EVENT_IDENTIFIER_PATTERN = /^[a-z0-9_.:-]+$/i;

export type NormalizedLearningEventInput = {
  sourceType: string;
  sourceId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
};

export function validateLearningEventIdentifier(value: unknown, label: string) {
  const identifier = String(value ?? "").trim();
  if (!identifier) throw new Error(`${label} is required.`);
  if (identifier.length > LEARNING_EVENT_IDENTIFIER_MAX_LENGTH || !LEARNING_EVENT_IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`${label} must be a short identifier.`);
  }
  return identifier;
}

export function validateLearningEventSourceId(value: unknown) {
  const sourceId = String(value ?? "").trim();
  if (!sourceId) return null;
  if (sourceId.length > LEARNING_EVENT_SOURCE_ID_MAX_LENGTH || !LEARNING_EVENT_IDENTIFIER_PATTERN.test(sourceId)) {
    throw new Error("Source id must be a short identifier.");
  }
  return sourceId;
}

export function validateLearningEventPayload(value: unknown) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Learning event payload must be an object.");
  }

  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).length > LEARNING_EVENT_PAYLOAD_MAX_BYTES) {
    throw new Error("Learning event payload is too large.");
  }
  return value as Record<string, unknown>;
}

export function normalizeLearningEventInput(input: {
  sourceType?: unknown;
  sourceId?: unknown;
  eventType?: unknown;
  payload?: unknown;
}): NormalizedLearningEventInput {
  return {
    sourceType: validateLearningEventIdentifier(input.sourceType, "Source type"),
    sourceId: validateLearningEventSourceId(input.sourceId),
    eventType: validateLearningEventIdentifier(input.eventType, "Event type"),
    payload: validateLearningEventPayload(input.payload),
  };
}
