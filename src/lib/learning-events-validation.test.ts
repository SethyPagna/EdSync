import { describe, expect, it } from "vitest";
import {
  LEARNING_EVENT_IDENTIFIER_MAX_LENGTH,
  LEARNING_EVENT_PAYLOAD_MAX_BYTES,
  normalizeLearningEventInput,
  validateLearningEventIdentifier,
  validateLearningEventPayload,
  validateLearningEventSourceId,
} from "@/lib/learning-events-validation";

describe("learning event validation", () => {
  it("normalizes a safe learning event", () => {
    expect(
      normalizeLearningEventInput({
        sourceType: " lesson ",
        sourceId: "lesson-1",
        eventType: "lesson.viewed",
        payload: { seconds: 42 },
      }),
    ).toEqual({
      sourceType: "lesson",
      sourceId: "lesson-1",
      eventType: "lesson.viewed",
      payload: { seconds: 42 },
    });
  });

  it("requires short event identifiers", () => {
    expect(() => validateLearningEventIdentifier("", "Event type")).toThrow("required");
    expect(() => validateLearningEventIdentifier("bad event", "Event type")).toThrow("short identifier");
    expect(() => validateLearningEventIdentifier("x".repeat(LEARNING_EVENT_IDENTIFIER_MAX_LENGTH + 1), "Event type")).toThrow(
      "short identifier",
    );
  });

  it("normalizes optional source ids", () => {
    expect(validateLearningEventSourceId("")).toBeNull();
    expect(validateLearningEventSourceId(null)).toBeNull();
    expect(validateLearningEventSourceId("source:1")).toBe("source:1");
    expect(() => validateLearningEventSourceId("bad source")).toThrow("short identifier");
  });

  it("validates payload shape and size", () => {
    expect(validateLearningEventPayload(undefined)).toEqual({});
    expect(validateLearningEventPayload({ action: "view" })).toEqual({ action: "view" });
    expect(() => validateLearningEventPayload(["action"])).toThrow("must be an object");
    expect(() => validateLearningEventPayload({ text: "x".repeat(LEARNING_EVENT_PAYLOAD_MAX_BYTES) })).toThrow("too large");
  });
});
