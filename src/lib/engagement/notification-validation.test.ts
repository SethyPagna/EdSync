import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_ACTION_URL_MAX_LENGTH,
  NOTIFICATION_ID_MAX_LENGTH,
  NOTIFICATION_METADATA_MAX_LENGTH,
  NOTIFICATION_MESSAGE_MAX_LENGTH,
  NOTIFICATION_TITLE_MAX_LENGTH,
  normalizeNotificationChannels,
  normalizeNotificationInput,
  normalizeOptionalNotificationRecordId,
  validateNotificationActionUrl,
  validateNotificationPriority,
  validateNotificationRecordId,
} from "@/lib/engagement/notification-validation";

describe("notification validation", () => {
  it("normalizes safe notification payloads", () => {
    expect(
      normalizeNotificationInput({
        type: "deadline.reminder",
        title: " Assignment due ",
        message: " Open the lesson ",
        actionUrl: "/student/work",
        priority: "high",
        channels: ["in_app", "email", "bad"],
        metadata: { classId: "class-1" },
      }),
    ).toMatchObject({
      type: "deadline.reminder",
      title: "Assignment due",
      message: "Open the lesson",
      actionUrl: "/student/work",
      priority: "high",
      channels: ["in_app", "email"],
      metadata: { classId: "class-1" },
    });
  });

  it("blocks unsafe or oversized notification values", () => {
    expect(() => normalizeNotificationInput({ title: "", message: "Body" })).toThrow("title");
    expect(() => normalizeNotificationInput({ title: "Title", message: "" })).toThrow("message");
    expect(() => normalizeNotificationInput({ title: "x".repeat(NOTIFICATION_TITLE_MAX_LENGTH + 1), message: "Body" })).toThrow("title");
    expect(() => normalizeNotificationInput({ title: "Title", message: "x".repeat(NOTIFICATION_MESSAGE_MAX_LENGTH + 1) })).toThrow("message");
    expect(() => validateNotificationActionUrl("javascript:alert(1)")).toThrow("internal");
    expect(() => validateNotificationActionUrl("//evil.example")).toThrow("internal");
    expect(() => validateNotificationActionUrl(`/${"x".repeat(NOTIFICATION_ACTION_URL_MAX_LENGTH + 1)}`)).toThrow("characters");
    expect(() => normalizeNotificationInput({ title: "Title", message: "Body", metadata: { value: "x".repeat(NOTIFICATION_METADATA_MAX_LENGTH + 1) } })).toThrow("metadata");
  });

  it("defaults priorities and channels safely", () => {
    expect(validateNotificationPriority("urgent")).toBe("normal");
    expect(normalizeNotificationChannels(["email", "email"])).toEqual(["email"]);
    expect(normalizeNotificationChannels(["unknown"])).toEqual(["in_app"]);
  });

  it("validates notification record ids", () => {
    expect(validateNotificationRecordId("notification-1", "Notification")).toBe("notification-1");
    expect(normalizeOptionalNotificationRecordId("", "Notification")).toBeNull();
    expect(() => validateNotificationRecordId("bad id", "Notification")).toThrow("short identifier");
    expect(() => validateNotificationRecordId("x".repeat(NOTIFICATION_ID_MAX_LENGTH + 1), "Notification")).toThrow("short identifier");
  });
});
