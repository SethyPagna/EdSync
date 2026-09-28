import { describe, expect, it } from "vitest";
import { BookOpen } from "lucide-react";
import { commandScore, rankCommands, type ShellCommand } from "./commands";

const command = (id: string, label: string, keywords: string[] = []): ShellCommand => ({ id, label, keywords, icon: BookOpen, group: "Pages", href: `/${id}` });

describe("command ranking", () => {
  it("ranks exact, prefix, label, then keyword matches", () => {
    const commands = [
      command("keyword", "Lesson library", ["course"]),
      command("contains", "My courses"),
      command("prefix", "Courses library"),
      command("exact", "Course"),
    ];
    expect(commands.map((item) => commandScore(item, "course"))).toEqual([20, 30, 50, 100]);
    expect(rankCommands(commands, "course").map((item) => item.id)).toEqual(["exact", "prefix", "contains", "keyword"]);
  });

  it("shows recent commands first until a query is entered", () => {
    const commands = [command("home", "Home"), command("courses", "Courses"), command("notes", "Notes")];
    expect(rankCommands(commands, "", ["notes", "home"]).map((item) => item.id)).toEqual(["notes", "home", "courses"]);
    expect(rankCommands(commands, "cours").map((item) => item.id)).toEqual(["courses"]);
  });
});
