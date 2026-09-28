import { createHash } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { hashPassword } from "../../../src/lib/auth/password";
import { validateSignupPassword } from "../../../src/lib/auth/password-validation";
import type { Background, SceneDeck, SceneElement, ScenePage } from "../../../src/lib/studio/scene";
import { loadEnvFile } from "../shared/ops";
import { listMigrationFiles, openLocalD1, readAppliedMigrations } from "./local-d1";

type SqlValue = string | number | null;
type RowValue = SqlValue | boolean | object | undefined;
type Row = Record<string, RowValue>;
type Statement = { sql: string; params: SqlValue[] };

const TENANT_ID = "tenant_edsync_default";
const PORTAL_ID = "portal_edsync_default";
const DAY_MS = 86_400_000;
const NOW = Date.now();
const BATCH_SIZE = 100;

const statements: Statement[] = [];
// learning_submission_attempts arrives with migration 0010; older schemas simply skip attempt history.
let hasAttemptHistory = false;

function seedId(key: string) {
  const hex = createHash("sha256").update(`edsync-local:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function seedNumber(key: string, min: number, max: number) {
  const value = Number.parseInt(createHash("sha256").update(key).digest("hex").slice(0, 8), 16);
  return min + (value % (max - min + 1));
}

function isoAt(days: number, hour = 15, minute = 0) {
  const date = new Date(NOW + days * DAY_MS);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

function sqlAt(days: number, hour = 15, minute = 0) {
  return isoAt(days, hour, minute).slice(0, 19).replace("T", " ");
}

function toSql(value: RowValue): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function put(table: string, row: Row, conflict: string[] = ["id"]) {
  const columns = Object.keys(row);
  const updates = columns
    .filter((column) => column !== "id" && !conflict.includes(column))
    .map((column) => `${column} = excluded.${column}`);
  statements.push({
    sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})
          ON CONFLICT(${conflict.join(", ")}) DO ${updates.length ? `UPDATE SET ${updates.join(", ")}` : "NOTHING"}`,
    params: columns.map((column) => toSql(row[column])),
  });
}

function linkToTenant(table: string, objectId: string) {
  put(
    "tenant_object_links",
    { id: seedId(`link:${table}:${objectId}`), tenant_id: TENANT_ID, portal_id: PORTAL_ID, object_table: table, object_id: objectId },
    ["object_table", "object_id"],
  );
}

// ---------------------------------------------------------------------------
// People

type Account = {
  key: string;
  email: string;
  name: string;
  role: "teacher" | "student";
  admin?: boolean;
  gradeLevel?: string;
  subjects: string[];
  interests: string[];
  xp: number;
  streak: number;
};

const ACCOUNTS: Account[] = [
  { key: "admin", email: "admin@edsync.test", name: "Morgan Lee", role: "teacher", admin: true, subjects: ["Operations"], interests: ["analytics"], xp: 0, streak: 0 },
  { key: "teacher", email: "teacher@edsync.test", name: "Maya Chen", role: "teacher", subjects: ["Science", "Mathematics", "English"], interests: ["project-based learning", "formative assessment"], xp: 0, streak: 0 },
  { key: "student", email: "student@edsync.test", name: "Jordan Rivera", role: "student", gradeLevel: "Grade 8", subjects: ["Science", "Mathematics"], interests: ["space", "climate", "drawing"], xp: 1240, streak: 6 },
];

const ROSTER = ["Amara Okafor", "Liam Novak", "Sofia Martinez", "Noah Kim", "Priya Shah", "Ethan Brooks", "Zoe Laurent"];

const userIds = new Map<string, string>();
const userId = (key: string) => {
  const id = userIds.get(key);
  if (!id) throw new Error(`Unknown seed user ${key}`);
  return id;
};

function rosterKey(name: string) {
  return `roster:${name.toLowerCase().replace(/\s+/g, ".")}`;
}

function rosterEmail(name: string) {
  return `${name.toLowerCase().replace(/\s+/g, ".")}@students.edsync.test`;
}

async function resolveUserIds(db: D1Database) {
  const emails = [...ACCOUNTS.map((account) => account.email), ...ROSTER.map(rosterEmail)];
  const { results } = await db
    .prepare(`SELECT id, lower(email) AS email FROM auth_users WHERE lower(email) IN (${emails.map(() => "?").join(", ")})`)
    .bind(...emails)
    .all<{ id: string; email: string }>();
  const existing = new Map(results.map((row) => [row.email, row.id]));
  for (const account of ACCOUNTS) userIds.set(account.key, existing.get(account.email) ?? seedId(`user:${account.key}`));
  for (const name of ROSTER) userIds.set(rosterKey(name), existing.get(rosterEmail(name)) ?? seedId(`user:${rosterKey(name)}`));
}

function seedPeople(passwordHash: string) {
  const people = [
    ...ACCOUNTS.map((account) => ({ ...account, id: userId(account.key), passwordHash })),
    ...ROSTER.map((name, index) => ({
      key: rosterKey(name),
      id: userId(rosterKey(name)),
      email: rosterEmail(name),
      name,
      role: "student" as const,
      admin: false,
      gradeLevel: "Grade 8",
      subjects: ["Science"],
      interests: [],
      xp: 300 + index * 170,
      streak: index % 4,
      passwordHash: "disabled",
    })),
  ];

  for (const person of people) {
    put("auth_users", {
      id: person.id,
      email: person.email,
      password_hash: person.passwordHash,
      email_verified_at: sqlAt(-60),
      created_at: sqlAt(-60),
      updated_at: sqlAt(0),
    });
    put("profiles", {
      id: person.id,
      email: person.email,
      full_name: person.name,
      role: person.role,
      school: "Riverside Middle School",
      grade_level: person.gradeLevel ?? null,
      subjects: person.subjects,
      interests: person.interests,
      preferences: { theme: "light", text_size: "medium" },
      achievements: [],
      total_xp: person.xp,
      streak_days: person.streak,
      last_active_at: sqlAt(0, 8),
      created_at: sqlAt(-60),
      updated_at: sqlAt(0),
    });
    const roleProfile = person.admin ? "role_master_admin" : person.role === "teacher" ? "role_solo_teacher" : "role_learner";
    put(
      "tenant_memberships",
      { id: seedId(`membership:${person.key}`), tenant_id: TENANT_ID, user_id: person.id, role_profile_id: roleProfile, status: "active", permissions: [] },
      ["tenant_id", "user_id"],
    );
  }

  put("admin_users", { user_id: userId("admin"), created_at: sqlAt(-60) }, ["user_id"]);
  put("admin_audit_logs", {
    id: seedId("audit:bootstrap"),
    admin_id: userId("admin"),
    action: "bootstrap",
    entity_type: "admin_user",
    entity_id: userId("admin"),
    metadata: { source: "seed-local" },
    created_at: sqlAt(-60),
  });
  put("admin_audit_logs", {
    id: seedId("audit:catalog"),
    admin_id: userId("admin"),
    action: "publish",
    entity_type: "billing_product",
    entity_id: seedId("product:cells"),
    metadata: { title: "Cells & Life Starter" },
    created_at: sqlAt(-3, 10),
  });
}

// ---------------------------------------------------------------------------
// Classes

const CLASSES = [
  { key: "biology", name: "Biology 8", subject: "Science", grade: "Grade 8", code: "BIOLOGY8", room: "Lab 204", description: "Cells, energy and living systems.", members: ["Amara Okafor", "Liam Novak", "Sofia Martinez", "Noah Kim", "Priya Shah"] },
  { key: "algebra", name: "Algebra I", subject: "Mathematics", grade: "Grade 9", code: "ALGEBRA9", room: "Room 112", description: "Equations, graphs and functions.", members: ["Liam Novak", "Noah Kim", "Ethan Brooks", "Zoe Laurent"] },
  { key: "writing", name: "Creative Writing", subject: "English", grade: "Grade 7", code: "WRITING7", room: "Library", description: "Stories, voice and revision.", members: ["Amara Okafor", "Sofia Martinez", "Priya Shah", "Ethan Brooks", "Zoe Laurent"] },
] as const;

type ClassKey = (typeof CLASSES)[number]["key"];
const classId = (key: ClassKey) => seedId(`class:${key}`);
const className = (key: ClassKey) => CLASSES.find((item) => item.key === key)?.name ?? key;

function classMembers(key: ClassKey) {
  const item = CLASSES.find((entry) => entry.key === key);
  return ["student", ...(item?.members ?? []).map(rosterKey)];
}

function seedClasses() {
  for (const item of CLASSES) {
    put("classes", {
      id: classId(item.key),
      teacher_id: userId("teacher"),
      name: item.name,
      description: item.description,
      subject: item.subject,
      grade_level: item.grade,
      join_code: item.code,
      is_active: true,
      settings: { room: item.room },
      created_at: sqlAt(-45),
      updated_at: sqlAt(-2),
    });
    linkToTenant("classes", classId(item.key));
    for (const member of classMembers(item.key)) {
      put(
        "class_enrollments",
        { id: seedId(`enrollment:${item.key}:${member}`), class_id: classId(item.key), student_id: userId(member), enrolled_at: sqlAt(-44), is_active: true },
        ["class_id", "student_id"],
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Lessons

type QuizSeed = { prompt: string; options: string[]; answer: number; explanation: string; kind: "diagnostic" | "micro" | "final" };

type LessonSeed = {
  key: string;
  classKey: ClassKey;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  minutes: number;
  status: "published" | "draft";
  objectives: string[];
  tags: string[];
  sections: [title: string, html: string][];
  quiz: QuizSeed[];
  glossary: [term: string, definition: string, example: string][];
  dueInDays: number;
};

const LESSONS: LessonSeed[] = [
  {
    key: "cells",
    classKey: "biology",
    title: "Cells: the building blocks of life",
    description: "Meet the cell, its organelles, and how plant and animal cells differ.",
    difficulty: "beginner",
    minutes: 40,
    status: "published",
    objectives: ["Name the main parts of a cell", "Compare plant and animal cells", "Explain what the nucleus does"],
    tags: ["cells", "organelles", "microscopes"],
    sections: [
      ["What is a cell?", "<p>Every living thing is made of <strong>cells</strong>, the smallest units that can carry out life processes. Some organisms are a single cell; you are made of roughly 37 trillion.</p>"],
      ["Inside the cell", "<p>Cells contain specialised parts called <strong>organelles</strong>.</p><ul><li><strong>Nucleus</strong> stores DNA and controls the cell.</li><li><strong>Mitochondria</strong> release energy from food.</li><li><strong>Cell membrane</strong> controls what enters and leaves.</li></ul>"],
      ["Plant vs. animal cells", "<p>Plant cells add a rigid <strong>cell wall</strong>, <strong>chloroplasts</strong> for photosynthesis and a large <strong>vacuole</strong>. Animal cells are more flexible and often rounder.</p>"],
    ],
    quiz: [
      { prompt: "Which of these is made of cells?", options: ["A rock", "A mushroom", "Glass", "Water"], answer: 1, explanation: "Fungi are living things, so they are made of cells.", kind: "diagnostic" },
      { prompt: "Which organelle controls the cell's activities?", options: ["Nucleus", "Cell wall", "Vacuole", "Ribosome"], answer: 0, explanation: "The nucleus holds DNA, the cell's instructions.", kind: "micro" },
      { prompt: "Which structure do plant cells have that animal cells do not?", options: ["Cell membrane", "Cytoplasm", "Cell wall", "Nucleus"], answer: 2, explanation: "The cell wall gives plant cells their rigid shape.", kind: "final" },
      { prompt: "Which organelle releases energy from food?", options: ["Chloroplast", "Mitochondrion", "Golgi body", "Vacuole"], answer: 1, explanation: "Mitochondria carry out respiration.", kind: "final" },
    ],
    glossary: [
      ["Organelle", "A specialised structure inside a cell with a specific job.", "Mitochondria are organelles that release energy."],
      ["Cell membrane", "A thin layer that controls what enters and leaves the cell.", "Oxygen passes through the cell membrane."],
      ["Nucleus", "The control centre of the cell that holds DNA.", "Red blood cells lose their nucleus as they mature."],
    ],
    dueInDays: -6,
  },
  {
    key: "photosynthesis",
    classKey: "biology",
    title: "Photosynthesis in action",
    description: "How plants turn light, water and carbon dioxide into food and oxygen.",
    difficulty: "intermediate",
    minutes: 45,
    status: "published",
    objectives: ["Write the word equation for photosynthesis", "Identify where photosynthesis happens", "Explain why it matters for food chains"],
    tags: ["plants", "energy", "ecosystems"],
    sections: [
      ["Light becomes food", "<p>Plants capture light energy with the green pigment <strong>chlorophyll</strong> and store it as chemical energy in sugar.</p>"],
      ["The equation", "<p><strong>carbon dioxide + water → glucose + oxygen</strong>, powered by light. The oxygen we breathe is a by-product.</p>"],
      ["Why it matters", "<p>Almost every food chain starts with a producer. Without photosynthesis there would be no energy flowing through ecosystems.</p>"],
    ],
    quiz: [
      { prompt: "What do plants need to make food?", options: ["Soil only", "Light, water and carbon dioxide", "Oxygen and sugar", "Darkness and heat"], answer: 1, explanation: "Those are the inputs of photosynthesis.", kind: "diagnostic" },
      { prompt: "Which gas do plants release during photosynthesis?", options: ["Carbon dioxide", "Nitrogen", "Oxygen", "Helium"], answer: 2, explanation: "Oxygen is released as a by-product.", kind: "micro" },
      { prompt: "Where in the leaf does photosynthesis happen?", options: ["Chloroplasts", "Roots", "Mitochondria", "Xylem"], answer: 0, explanation: "Chloroplasts contain chlorophyll.", kind: "final" },
      { prompt: "Which sugar do plants make?", options: ["Sucrose only", "Lactose", "Glucose", "Salt"], answer: 2, explanation: "Glucose is the direct product.", kind: "final" },
    ],
    glossary: [
      ["Chlorophyll", "The green pigment that absorbs light energy.", "Leaves look green because chlorophyll reflects green light."],
      ["Glucose", "A simple sugar that stores energy.", "Plants turn glucose into starch for storage."],
      ["Stomata", "Tiny pores on leaves that let gases in and out.", "Stomata close on hot days to save water."],
    ],
    dueInDays: 2,
  },
  {
    key: "linear",
    classKey: "algebra",
    title: "Solving linear equations",
    description: "Keep equations balanced and isolate the variable in one and two steps.",
    difficulty: "beginner",
    minutes: 35,
    status: "published",
    objectives: ["Use inverse operations", "Solve two-step equations", "Check a solution by substitution"],
    tags: ["equations", "inverse operations"],
    sections: [
      ["Balancing both sides", "<p>An equation is a balance. Whatever you do to one side, do to the other.</p>"],
      ["Two-step equations", "<p>To solve <code>2x − 3 = 11</code>: add 3 to both sides, then divide by 2. So <code>x = 7</code>.</p>"],
      ["Check your answer", "<p>Substitute your answer back in: <code>2(7) − 3 = 11</code>. It works.</p>"],
    ],
    quiz: [
      { prompt: "What is 3 × 4 + 2?", options: ["14", "18", "12", "20"], answer: 0, explanation: "Multiply first, then add.", kind: "diagnostic" },
      { prompt: "Solve: x + 7 = 12", options: ["19", "5", "7", "12"], answer: 1, explanation: "Subtract 7 from both sides.", kind: "micro" },
      { prompt: "Solve: 2x − 3 = 11", options: ["4", "7", "8", "14"], answer: 1, explanation: "Add 3, then divide by 2.", kind: "final" },
      { prompt: "Solve: 5x = 35", options: ["5", "6", "7", "30"], answer: 2, explanation: "Divide both sides by 5.", kind: "final" },
    ],
    glossary: [
      ["Variable", "A letter that stands for an unknown number.", "In x + 2 = 5, x is the variable."],
      ["Inverse operation", "An operation that undoes another.", "Subtraction undoes addition."],
      ["Coefficient", "The number multiplied by a variable.", "In 4y, the coefficient is 4."],
    ],
    dueInDays: -3,
  },
  {
    key: "slope",
    classKey: "algebra",
    title: "Graphing lines and slope",
    description: "Plot points, read rise over run and use slope-intercept form.",
    difficulty: "intermediate",
    minutes: 45,
    status: "published",
    objectives: ["Plot ordered pairs", "Calculate slope from two points", "Read y = mx + b"],
    tags: ["graphs", "slope", "functions"],
    sections: [
      ["Plotting points", "<p>An ordered pair <code>(x, y)</code> tells you how far to move across, then up.</p>"],
      ["Rise over run", "<p>Slope measures steepness: <strong>change in y ÷ change in x</strong>.</p>"],
      ["Slope-intercept form", "<p>In <code>y = mx + b</code>, <code>m</code> is the slope and <code>b</code> is where the line crosses the y-axis.</p>"],
    ],
    quiz: [
      { prompt: "Which point is on the x-axis?", options: ["(0, 3)", "(4, 0)", "(2, 2)", "(−1, 5)"], answer: 1, explanation: "Points on the x-axis have y = 0.", kind: "diagnostic" },
      { prompt: "What is the slope between (0, 0) and (2, 6)?", options: ["2", "3", "6", "1/3"], answer: 1, explanation: "Rise 6 over run 2 is 3.", kind: "micro" },
      { prompt: "In y = 2x + 5, what is the y-intercept?", options: ["2", "5", "7", "x"], answer: 1, explanation: "b is the y-intercept.", kind: "final" },
      { prompt: "A horizontal line has a slope of…", options: ["0", "1", "Undefined", "−1"], answer: 0, explanation: "There is no rise, so the slope is 0.", kind: "final" },
    ],
    glossary: [
      ["Slope", "How steep a line is: rise divided by run.", "A slope of 2 rises 2 units for every 1 across."],
      ["Y-intercept", "Where a line crosses the y-axis.", "y = 3x + 1 crosses at (0, 1)."],
      ["Coordinate plane", "A grid formed by the x-axis and y-axis.", "Maps often use a coordinate grid."],
    ],
    dueInDays: 5,
  },
  {
    key: "show-dont-tell",
    classKey: "writing",
    title: "Show, don't tell",
    description: "Turn flat statements into vivid scenes with sensory detail.",
    difficulty: "beginner",
    minutes: 30,
    status: "published",
    objectives: ["Spot telling sentences", "Use the five senses", "Revise a paragraph for imagery"],
    tags: ["description", "imagery", "revision"],
    sections: [
      ["Telling vs. showing", "<p><em>She was nervous</em> tells. <em>Her pencil tapped a frantic rhythm on the desk</em> shows.</p>"],
      ["Use the five senses", "<p>What can your character see, hear, smell, taste and touch? Pick the one detail that matters most.</p>"],
      ["Revise a sentence", "<p>Take one telling sentence from your draft and rewrite it three different ways.</p>"],
    ],
    quiz: [
      { prompt: "Which sentence shows rather than tells?", options: ["He was tired.", "His eyelids drooped over his cereal.", "It was a nice day.", "She felt happy."], answer: 1, explanation: "It lets the reader infer tiredness.", kind: "diagnostic" },
      { prompt: "Which sense does 'the smell of burnt toast' use?", options: ["Sight", "Smell", "Touch", "Hearing"], answer: 1, explanation: "It appeals to smell.", kind: "micro" },
      { prompt: "What is the main goal of showing?", options: ["Use longer words", "Let readers experience the moment", "Add more characters", "Summarise faster"], answer: 1, explanation: "Showing immerses the reader.", kind: "final" },
    ],
    glossary: [
      ["Sensory detail", "Description that appeals to one of the five senses.", "The crunch of gravel underfoot."],
      ["Imagery", "Language that creates a picture in the reader's mind.", "A sky the colour of bruised plums."],
      ["Revision", "Rethinking and improving a draft.", "Cutting a paragraph that slows the story."],
    ],
    dueInDays: -1,
  },
  {
    key: "character",
    classKey: "writing",
    title: "Building a character",
    description: "Give characters wants, flaws and a voice readers remember.",
    difficulty: "intermediate",
    minutes: 40,
    status: "published",
    objectives: ["Define a character's motivation", "Write natural dialogue", "Plan a simple character arc"],
    tags: ["characters", "dialogue", "voice"],
    sections: [
      ["What do they want?", "<p>Every memorable character wants something and faces something in the way.</p>"],
      ["Voice and dialogue", "<p>Read dialogue aloud. Real people interrupt, trail off and avoid saying exactly what they mean.</p>"],
      ["Flaws make them real", "<p>A flaw creates conflict and room to change. Perfect characters are hard to care about.</p>"],
    ],
    quiz: [
      { prompt: "What drives a character's actions?", options: ["Their motivation", "The font", "The title", "The setting only"], answer: 0, explanation: "Motivation explains choices.", kind: "diagnostic" },
      { prompt: "Why give a character a flaw?", options: ["To fill space", "To create conflict and growth", "To confuse readers", "To end the story"], answer: 1, explanation: "Flaws create stakes.", kind: "micro" },
      { prompt: "A character arc describes…", options: ["The book cover", "How a character changes", "The setting's history", "Chapter length"], answer: 1, explanation: "An arc is change over the story.", kind: "final" },
    ],
    glossary: [
      ["Motivation", "The reason behind a character's actions.", "She enters the contest to prove her sister wrong."],
      ["Dialogue", "The words characters speak.", "\"You're late,\" she said, not looking up."],
      ["Character arc", "The change a character goes through.", "A coward who learns courage."],
    ],
    dueInDays: 8,
  },
  {
    key: "ecosystems",
    classKey: "biology",
    title: "Ecosystems and food webs",
    description: "Producers, consumers and decomposers, and how energy moves between them.",
    difficulty: "intermediate",
    minutes: 40,
    status: "draft",
    objectives: ["Build a food web", "Explain energy transfer"],
    tags: ["ecosystems", "food webs"],
    sections: [["Who eats whom?", "<p>Draft: start with a local pond ecosystem.</p>"]],
    quiz: [],
    glossary: [],
    dueInDays: 12,
  },
];

const lessonId = (key: string) => seedId(`lesson:${key}`);
const sectionId = (lesson: string, index: number) => seedId(`section:${lesson}:${index}`);

function seedLessons() {
  for (const lesson of LESSONS) {
    const id = lessonId(lesson.key);
    put("lessons", {
      id,
      teacher_id: userId("teacher"),
      class_id: classId(lesson.classKey),
      title: lesson.title,
      description: lesson.description,
      objectives: lesson.objectives,
      subject: CLASSES.find((item) => item.key === lesson.classKey)?.subject ?? null,
      grade_level: CLASSES.find((item) => item.key === lesson.classKey)?.grade ?? null,
      status: lesson.status,
      difficulty: lesson.difficulty,
      estimated_duration: lesson.minutes,
      tags: lesson.tags,
      ai_generated: false,
      prerequisites: [],
      personalization: {},
      created_at: sqlAt(-30),
      updated_at: sqlAt(lesson.status === "draft" ? 0 : -4),
    });
    lesson.sections.forEach(([title, content], index) => {
      put("lesson_sections", {
        id: sectionId(lesson.key, index),
        lesson_id: id,
        title,
        content,
        content_type: "text",
        order_index: index,
        duration_minutes: Math.round(lesson.minutes / lesson.sections.length),
        is_required: true,
        metadata: {},
        created_at: sqlAt(-30),
      });
    });
    lesson.quiz.forEach((question, index) => {
      const options = question.options.map((text, optionIndex) => ({
        id: String.fromCharCode(97 + optionIndex),
        text,
        is_correct: optionIndex === question.answer,
      }));
      put("quiz_questions", {
        id: seedId(`quiz:${lesson.key}:${index}`),
        lesson_id: id,
        section_id: question.kind === "micro" ? sectionId(lesson.key, 1) : null,
        question_text: question.prompt,
        question_type: "multiple_choice",
        options,
        correct_answer: question.options[question.answer],
        explanation: question.explanation,
        difficulty: lesson.difficulty,
        points: question.kind === "final" ? 2 : 1,
        is_diagnostic: question.kind === "diagnostic",
        is_micro_check: question.kind === "micro",
        is_final_quiz: question.kind === "final",
        order_index: index,
        created_at: sqlAt(-30),
      });
    });
    lesson.glossary.forEach(([term, definition, example], index) => {
      put("glossary_terms", { id: seedId(`glossary:${lesson.key}:${index}`), lesson_id: id, term, definition, example, created_at: sqlAt(-30) });
    });
    if (lesson.status !== "published") continue;
    put("lesson_assignments", {
      id: seedId(`assignment:${lesson.key}`),
      lesson_id: id,
      class_id: classId(lesson.classKey),
      assigned_by: userId("teacher"),
      due_date: isoAt(lesson.dueInDays, 23, 59),
      is_active: true,
      created_at: sqlAt(-20),
    });
  }
}

type ProgressState = { status: "completed" | "in_progress"; score: number | null; sections: number };

const STUDENT_PROGRESS: Record<string, ProgressState | null> = {
  cells: { status: "completed", score: 92, sections: 3 },
  photosynthesis: { status: "in_progress", score: null, sections: 1 },
  linear: { status: "completed", score: 78, sections: 3 },
  slope: null,
  "show-dont-tell": { status: "in_progress", score: null, sections: 2 },
  character: null,
};

function rosterProgress(member: string, lesson: LessonSeed): ProgressState | null {
  const roll = seedNumber(`${member}:${lesson.key}`, 0, 9);
  if (roll >= 8) return null;
  if (roll >= 5) return { status: "in_progress", score: null, sections: 1 + (roll % 2) };
  return { status: "completed", score: seedNumber(`score:${member}:${lesson.key}`, 55, 98), sections: lesson.sections.length };
}

function seedProgress() {
  for (const lesson of LESSONS.filter((item) => item.status === "published")) {
    for (const member of classMembers(lesson.classKey)) {
      const state = member === "student" ? STUDENT_PROGRESS[lesson.key] : rosterProgress(member, lesson);
      if (!state) continue;
      const startedDaysAgo = seedNumber(`start:${member}:${lesson.key}`, 3, 14);
      const completed = state.status === "completed";
      put(
        "student_progress",
        {
          id: seedId(`progress:${member}:${lesson.key}`),
          student_id: userId(member),
          lesson_id: lessonId(lesson.key),
          status: state.status,
          current_section_id: sectionId(lesson.key, Math.min(state.sections, lesson.sections.length - 1)),
          sections_completed: Array.from({ length: state.sections }, (_, index) => sectionId(lesson.key, index)),
          score: state.score,
          time_spent: state.sections * 11 + seedNumber(`time:${member}:${lesson.key}`, 0, 9),
          diagnostic_completed: true,
          diagnostic_score: seedNumber(`diag:${member}:${lesson.key}`, 40, 100),
          final_quiz_score: state.score,
          knowledge_gaps: state.score !== null && state.score < 70 ? [lesson.glossary[0]?.[0] ?? lesson.title] : [],
          metadata: {},
          started_at: sqlAt(-startedDaysAgo, 16),
          completed_at: completed ? sqlAt(-startedDaysAgo + 2, 17) : null,
          last_active: sqlAt(completed ? -startedDaysAgo + 2 : -1, 17),
        },
        ["student_id", "lesson_id"],
      );
      if (completed && state.score !== null) {
        put(
          "gradebook_scores",
          {
            id: seedId(`score:lesson:${member}:${lesson.key}`),
            class_id: classId(lesson.classKey),
            student_id: userId(member),
            teacher_id: userId("teacher"),
            category_id: seedId(`category:${lesson.classKey}:quizzes`),
            source_type: "lesson_quiz",
            source_id: lessonId(lesson.key),
            title: lesson.title,
            points_earned: state.score / 10,
            points_possible: 10,
            percent: state.score,
            status: "graded",
            graded_at: sqlAt(-startedDaysAgo + 2, 17),
            metadata: { gradedByRole: "system", gradedBy: null },
            created_at: sqlAt(-startedDaysAgo + 2, 17),
            updated_at: sqlAt(-startedDaysAgo + 2, 17),
          },
          ["student_id", "source_type", "source_id"],
        );
        linkToTenant("gradebook_scores", seedId(`score:lesson:${member}:${lesson.key}`));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Assessments, submissions and grades

type SubmissionSeed = { status: "draft" | "submitted" | "returned" | "graded" | "missing"; percent?: number; text?: string; feedback?: string };

type WorkSeed = {
  key: string;
  classKey: ClassKey;
  lessonKey?: string;
  title: string;
  type: "quiz" | "test" | "task" | "discussion" | "activity";
  category: "quizzes" | "projects" | "participation";
  points: number;
  dueInDays: number;
  status: "draft" | "published";
  instructions: string;
  questions?: { prompt: string; options?: string[]; answer?: string }[];
  student?: SubmissionSeed;
};

const WORK: WorkSeed[] = [
  {
    key: "cell-lab",
    classKey: "biology",
    lessonKey: "cells",
    title: "Cell diagram lab",
    type: "task",
    category: "projects",
    points: 20,
    dueInDays: 3,
    status: "published",
    instructions: "Sketch and label one plant cell and one animal cell. Upload a photo of your page.",
    student: { status: "submitted", text: "Labelled both cells. The plant cell has a wall, chloroplasts and a big vacuole." },
  },
  {
    key: "photo-check",
    classKey: "biology",
    lessonKey: "photosynthesis",
    title: "Photosynthesis check",
    type: "quiz",
    category: "quizzes",
    points: 10,
    dueInDays: -2,
    status: "published",
    instructions: "Five quick questions. One attempt.",
    questions: [
      { prompt: "Name the pigment that absorbs light.", answer: "Chlorophyll" },
      { prompt: "Which gas is released?", options: ["Oxygen", "Carbon dioxide", "Nitrogen"], answer: "Oxygen" },
      { prompt: "Write the word equation for photosynthesis." },
    ],
    student: { status: "graded", percent: 85, text: "Chlorophyll; oxygen; carbon dioxide + water → glucose + oxygen", feedback: "Solid work. Remember light is the energy source, not an ingredient." },
  },
  {
    key: "ecosystem-talk",
    classKey: "biology",
    title: "Would a pond survive without sunlight?",
    type: "discussion",
    category: "participation",
    points: 5,
    dueInDays: 6,
    status: "published",
    instructions: "Post your prediction, then reply to two classmates.",
  },
  {
    key: "cells-test",
    classKey: "biology",
    title: "Unit test: cells",
    type: "test",
    category: "quizzes",
    points: 50,
    dueInDays: 14,
    status: "draft",
    instructions: "Covers organelles, microscopes and cell types.",
  },
  {
    key: "equations-practice",
    classKey: "algebra",
    lessonKey: "linear",
    title: "Linear equations practice",
    type: "quiz",
    category: "quizzes",
    points: 10,
    dueInDays: 1,
    status: "published",
    instructions: "Solve each equation and show one check.",
    questions: [
      { prompt: "Solve: x − 4 = 9", answer: "13" },
      { prompt: "Solve: 3x + 2 = 20", answer: "6" },
      { prompt: "Solve: x / 5 = 4", answer: "20" },
    ],
  },
  {
    key: "slope-project",
    classKey: "algebra",
    lessonKey: "slope",
    title: "Slope in the real world",
    type: "task",
    category: "projects",
    points: 25,
    dueInDays: -5,
    status: "published",
    instructions: "Find a ramp, roof or hill. Measure rise and run and calculate its slope.",
    student: { status: "graded", percent: 72, text: "The school ramp rises 0.5 m over 6 m, so the slope is about 0.08.", feedback: "Good measurements. Add a labelled sketch next time." },
  },
  {
    key: "character-sketch",
    classKey: "writing",
    lessonKey: "character",
    title: "Character sketch",
    type: "task",
    category: "projects",
    points: 20,
    dueInDays: 4,
    status: "published",
    instructions: "Write 300 words introducing a character through action and dialogue.",
    student: { status: "draft", text: "Nell kept her compass in her sock, just in case." },
  },
  {
    key: "peer-review",
    classKey: "writing",
    lessonKey: "show-dont-tell",
    title: "Peer review circle",
    type: "discussion",
    category: "participation",
    points: 5,
    dueInDays: -1,
    status: "published",
    instructions: "Share one revised paragraph and give two specific compliments.",
    student: { status: "returned", percent: 60, text: "Shared my rewrite of the storm scene.", feedback: "Please add your two replies to classmates." },
  },
];

const workId = (key: string) => seedId(`work:${key}`);
const CATEGORIES = [
  { key: "quizzes", name: "Quizzes", weight: 40, color: "#4F46E5" },
  { key: "projects", name: "Projects", weight: 40, color: "#0F766E" },
  { key: "participation", name: "Participation", weight: 20, color: "#B45309" },
] as const;

function rosterSubmission(member: string, work: WorkSeed): SubmissionSeed | null {
  const roll = seedNumber(`${member}:${work.key}`, 0, 9);
  if (work.dueInDays < 0) {
    if (roll >= 8) return { status: "missing" };
    return { status: "graded", percent: seedNumber(`pct:${member}:${work.key}`, 58, 100), text: "Submitted on time.", feedback: roll % 2 ? "Nice reasoning." : "Check your units." };
  }
  if (roll >= 6) return null;
  return { status: "submitted", text: "Ready for review." };
}

function seedWork() {
  for (const item of CLASSES) {
    for (const category of CATEGORIES) {
      const id = seedId(`category:${item.key}:${category.key}`);
      put("gradebook_categories", {
        id,
        class_id: classId(item.key),
        teacher_id: userId("teacher"),
        name: category.name,
        weight: category.weight,
        drop_lowest: 0,
        color: category.color,
        created_at: sqlAt(-40),
        updated_at: sqlAt(-40),
      });
      linkToTenant("gradebook_categories", id);
    }
  }

  for (const work of WORK) {
    const id = workId(work.key);
    put("learning_work_items", {
      id,
      teacher_id: userId("teacher"),
      class_id: classId(work.classKey),
      lesson_id: work.lessonKey ? lessonId(work.lessonKey) : null,
      category_id: seedId(`category:${work.classKey}:${work.category}`),
      title: work.title,
      description: work.instructions,
      work_type: work.type,
      instructions: work.instructions,
      points_possible: work.points,
      due_at: isoAt(work.dueInDays, 23, 59),
      status: work.status,
      allow_late: true,
      rubric: work.type === "task" ? [{ criterion: "Accuracy", points: Math.round(work.points * 0.5) }, { criterion: "Clarity", points: Math.round(work.points * 0.3) }, { criterion: "Effort", points: Math.round(work.points * 0.2) }] : [],
      settings: { mode: "points", gradeWeightPercent: null, countsTowardGrade: true, participationCriteria: "" },
      created_at: sqlAt(-12),
      updated_at: sqlAt(work.status === "draft" ? 0 : -3),
    });
    linkToTenant("learning_work_items", id);

    (work.questions ?? []).forEach((question, index) => {
      put("learning_work_questions", {
        id: seedId(`work-question:${work.key}:${index}`),
        work_item_id: id,
        prompt: question.prompt,
        question_type: question.options ? "multiple_choice" : "short_answer",
        options: question.options ?? [],
        correct_answer: question.answer ?? null,
        points: Math.round(work.points / (work.questions?.length ?? 1)),
        order_index: index,
        metadata: {},
        created_at: sqlAt(-12),
      });
    });

    if (work.type === "discussion") seedDiscussion(work);
    if (work.status !== "published") continue;

    put("schedule_events", {
      id: seedId(`event:deadline:${work.key}`),
      owner_id: userId("teacher"),
      class_id: classId(work.classKey),
      lesson_id: work.lessonKey ? lessonId(work.lessonKey) : null,
      title: work.title,
      description: work.instructions,
      event_type: "deadline",
      due_at: isoAt(work.dueInDays, 23, 59),
      visibility: "class",
      metadata: { type: "work_deadline", workItemId: id },
      created_at: sqlAt(-12),
      updated_at: sqlAt(-12),
    });

    for (const member of classMembers(work.classKey)) {
      const submission = member === "student" ? work.student : rosterSubmission(member, work);
      if (submission) seedSubmission(work, member, submission);
    }
  }
}

function seedSubmission(work: WorkSeed, member: string, submission: SubmissionSeed) {
  const graded = submission.status === "graded" || submission.status === "returned";
  const earned = graded && submission.percent !== undefined ? Math.round((work.points * submission.percent) / 10) / 10 : null;
  const submittedAt = submission.status === "draft" || submission.status === "missing" ? null : sqlAt(Math.min(work.dueInDays, 0) - 1, 20);
  put(
    "learning_submissions",
    {
      id: seedId(`submission:${work.key}:${member}`),
      work_item_id: workId(work.key),
      student_id: userId(member),
      class_id: classId(work.classKey),
      response: submission.text ? { text: submission.text } : {},
      status: submission.status,
      points_earned: earned,
      points_possible: work.points,
      percent: graded ? submission.percent ?? null : null,
      feedback: submission.feedback ?? null,
      submitted_at: submittedAt,
      graded_at: graded ? sqlAt(Math.min(work.dueInDays, 0), 18) : null,
      created_at: sqlAt(-4),
      updated_at: sqlAt(graded ? Math.min(work.dueInDays, 0) : -1, 18),
    },
    ["work_item_id", "student_id"],
  );

  if (hasAttemptHistory && submittedAt) {
    put(
      "learning_submission_attempts",
      {
        id: seedId(`attempt:${work.key}:${member}:1`),
        submission_id: seedId(`submission:${work.key}:${member}`),
        work_item_id: workId(work.key),
        student_id: userId(member),
        attempt_number: 1,
        response: submission.text ? { text: submission.text } : {},
        is_late: 0,
        submitted_at: submittedAt,
        created_at: submittedAt,
      },
      ["submission_id", "attempt_number"],
    );
  }

  if (submission.status !== "graded" && submission.status !== "missing") return;
  const scoreId = seedId(`score:work:${work.key}:${member}`);
  put(
    "gradebook_scores",
    {
      id: scoreId,
      class_id: classId(work.classKey),
      student_id: userId(member),
      teacher_id: userId("teacher"),
      category_id: seedId(`category:${work.classKey}:${work.category}`),
      source_type: work.type,
      source_id: workId(work.key),
      title: work.title,
      points_earned: earned ?? 0,
      points_possible: work.points,
      percent: submission.status === "missing" ? 0 : submission.percent ?? null,
      feedback: submission.feedback ?? null,
      status: submission.status,
      graded_at: sqlAt(Math.min(work.dueInDays, 0), 18),
      metadata: { gradedByRole: "teacher", gradedBy: userId("teacher") },
      created_at: sqlAt(Math.min(work.dueInDays, 0), 18),
      updated_at: sqlAt(Math.min(work.dueInDays, 0), 18),
    },
    ["student_id", "source_type", "source_id"],
  );
  linkToTenant("gradebook_scores", scoreId);
}

function seedDiscussion(work: WorkSeed) {
  const threadId = seedId(`thread:${work.key}`);
  put("discussion_threads", {
    id: threadId,
    work_item_id: workId(work.key),
    class_id: classId(work.classKey),
    teacher_id: userId("teacher"),
    title: work.title,
    prompt: work.instructions,
    is_locked: false,
    created_at: sqlAt(-6),
    updated_at: sqlAt(-1),
  });
  linkToTenant("discussion_threads", threadId);
  const posts = [
    ["student", "I think the pond would slowly die. Plants and algae would stop making food and oxygen."],
    [rosterKey("Amara Okafor"), "Decomposers could keep going for a while, but they'd run out of material too."],
    ["teacher", "Great start. What happens to the fish first, and why?"],
  ] as const;
  posts.forEach(([author, body], index) => {
    if (!classMembers(work.classKey).includes(author) && author !== "teacher") return;
    put("discussion_posts", {
      id: seedId(`post:${work.key}:${index}`),
      thread_id: threadId,
      author_id: userId(author),
      parent_id: index === 2 ? seedId(`post:${work.key}:0`) : null,
      body,
      visibility: "class",
      metadata: {},
      created_at: sqlAt(-3 + index, 14),
      updated_at: sqlAt(-3 + index, 14),
    });
  });
}

// ---------------------------------------------------------------------------
// Planner, announcements, notes, notifications, alerts, goals

function seedPlanner() {
  CLASSES.forEach((item, index) => {
    for (const offset of [1, 3]) {
      put("schedule_events", {
        id: seedId(`event:class:${item.key}:${offset}`),
        owner_id: userId("teacher"),
        class_id: classId(item.key),
        title: `${item.name} session`,
        description: null,
        event_type: "class",
        starts_at: isoAt(offset, 13 + index),
        ends_at: isoAt(offset, 13 + index, 50),
        location: item.room,
        visibility: "class",
        metadata: {},
        created_at: sqlAt(-10),
        updated_at: sqlAt(-10),
      });
    }
  });
  put("schedule_events", {
    id: seedId("event:office-hours"),
    owner_id: userId("teacher"),
    class_id: null,
    title: "Office hours",
    description: "Drop in for help with labs and equations.",
    event_type: "office_hours",
    starts_at: isoAt(2, 20),
    ends_at: isoAt(2, 21),
    location: "Room 112",
    visibility: "teacher",
    metadata: {},
    created_at: sqlAt(-7),
    updated_at: sqlAt(-7),
  });
  put("schedule_events", {
    id: seedId("event:study"),
    owner_id: userId("student"),
    class_id: null,
    title: "Study block: slope",
    description: "Rework the rise-over-run examples.",
    event_type: "study",
    starts_at: isoAt(1, 22),
    ends_at: isoAt(1, 23),
    visibility: "student",
    metadata: {},
    created_at: sqlAt(-1),
    updated_at: sqlAt(-1),
  });

  const announcements = [
    { key: "goggles", classKey: "biology" as ClassKey, title: "Bring goggles Thursday", body: "We are dissecting onion cells. Goggles and a pencil, please.", priority: "high", days: -1 },
    { key: "quiz-friday", classKey: "algebra" as ClassKey, title: "Quiz on Friday", body: "Two-step equations and checking answers. Practice set is open.", priority: "normal", days: -2 },
    { key: "drafts", classKey: "writing" as ClassKey, title: "Share your drafts", body: "Upload your character sketch draft before the peer review circle.", priority: "normal", days: 0 },
  ];
  for (const announcement of announcements) {
    put("announcements", {
      id: seedId(`announcement:${announcement.key}`),
      teacher_id: userId("teacher"),
      class_id: classId(announcement.classKey),
      title: announcement.title,
      body: announcement.body,
      priority: announcement.priority,
      audience: "class",
      publish_at: sqlAt(announcement.days, 7),
      expires_at: isoAt(10),
      metadata: {},
      created_at: sqlAt(announcement.days, 7),
      updated_at: sqlAt(announcement.days, 7),
    });
  }
}

function seedNotes() {
  const notes = [
    { key: "lab", student: "student", classKey: "biology" as ClassKey, title: "Great lab work", body: "Your cell diagrams were clear and carefully labelled. Keep using colour to separate organelles.", visibility: "student", priority: "normal", days: -4 },
    { key: "algebra", student: "student", classKey: "algebra" as ClassKey, title: "Algebra check-in", body: "Let's review slope together at office hours this week.", visibility: "student", priority: "high", days: -1 },
    { key: "writing", student: "student", classKey: "writing" as ClassKey, title: "Strong opening line", body: "The compass-in-the-sock detail is exactly what showing looks like.", visibility: "student", priority: "low", days: -2 },
    { key: "liam", student: rosterKey("Liam Novak"), classKey: "algebra" as ClassKey, title: "Needs support", body: "Struggles with negative numbers. Pair with Noah next session.", visibility: "teacher", priority: "high", days: -3 },
  ];
  for (const note of notes) {
    const id = seedId(`note:${note.key}`);
    put("student_notes", {
      id,
      teacher_id: userId("teacher"),
      student_id: userId(note.student),
      class_id: classId(note.classKey),
      title: note.title,
      body: note.body,
      visibility: note.visibility,
      priority: note.priority,
      metadata: {},
      created_at: sqlAt(note.days, 16),
      updated_at: sqlAt(note.days, 16),
    });
    linkToTenant("student_notes", id);
  }
}

function seedNotifications() {
  const notifications = [
    { key: "s-graded", user: "student", type: "work_graded", title: "Photosynthesis check graded", message: "You scored 85%. Feedback is ready.", url: "/student/work", priority: "normal", days: -1, read: false },
    { key: "s-assigned", user: "student", type: "lesson_assigned", title: "New lesson: Building a character", message: "Due next week in Creative Writing.", url: `/student/lessons/${lessonId("character")}`, priority: "normal", days: -2, read: false },
    { key: "s-deadline", user: "student", type: "work_deadline", title: "Due tomorrow", message: "Linear equations practice is due tomorrow.", url: "/student/work", priority: "high", days: 0, read: false },
    { key: "s-note", user: "student", type: "student_note", title: "New note from Maya Chen", message: "Algebra check-in", url: "/student/notes", priority: "normal", days: -1, read: true },
    { key: "s-announcement", user: "student", type: "announcement", title: "Bring goggles Thursday", message: "Biology 8", url: "/student/planner", priority: "normal", days: -1, read: true },
    { key: "t-submission", user: "teacher", type: "work_submitted", title: "3 new submissions", message: "Cell diagram lab is ready to review.", url: "/teacher/work", priority: "normal", days: 0, read: false },
    { key: "t-alert", user: "teacher", type: "student_alert", title: "Liam may need support", message: "Scored below 60% on Solving linear equations.", url: "/teacher/students", priority: "high", days: -1, read: false },
    { key: "t-review", user: "teacher", type: "announcement", title: "Peer review closes today", message: "Creative Writing", url: "/teacher/work", priority: "low", days: -1, read: true },
    { key: "a-catalog", user: "admin", type: "system", title: "Catalog item published", message: "Cells & Life Starter is live.", url: "/admin/billing", priority: "normal", days: -3, read: false },
    { key: "a-security", user: "admin", type: "system", title: "Weekly security digest", message: "No critical events this week.", url: "/admin/security", priority: "low", days: -2, read: true },
  ];
  for (const notification of notifications) {
    put("notifications", {
      id: seedId(`notification:${notification.key}`),
      user_id: userId(notification.user),
      actor_id: notification.user === "student" ? userId("teacher") : null,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      action_url: notification.url,
      priority: notification.priority,
      channels: ["in_app"],
      metadata: {},
      read_at: notification.read ? sqlAt(notification.days, 18) : null,
      created_at: sqlAt(notification.days, 9),
    });
  }
}

function seedInsights() {
  const alerts = [
    { key: "liam", student: rosterKey("Liam Novak"), lesson: "linear", type: "struggling", title: "Liam is struggling with equations", message: "Two attempts below 60% on Solving linear equations.", action: "Schedule a 10-minute check-in." },
    { key: "jordan", student: "student", lesson: "cells", type: "achievement", title: "Jordan aced Cells", message: "Scored 92% on the final quiz.", action: "Invite Jordan to mentor the lab group." },
    { key: "noah", student: rosterKey("Noah Kim"), lesson: "slope", type: "intervention", title: "Noah hasn't started Graphing lines", message: "Due in 5 days with no activity yet.", action: "Send a reminder." },
  ];
  alerts.forEach((alert, index) => {
    put("teacher_alerts", {
      id: seedId(`alert:${alert.key}`),
      teacher_id: userId("teacher"),
      student_id: userId(alert.student),
      lesson_id: lessonId(alert.lesson),
      alert_type: alert.type,
      title: alert.title,
      message: alert.message,
      action_suggestion: alert.action,
      is_read: index === 1,
      is_dismissed: false,
      metadata: {},
      created_at: sqlAt(-index - 1, 12),
    });
  });

  const goals = [
    { key: "xp", title: "Earn 400 XP this week", type: "weekly_xp", target: 400, current: 260, complete: false, due: 4 },
    { key: "lessons", title: "Finish 3 lessons", type: "lessons_completed", target: 3, current: 2, complete: false, due: 7 },
    { key: "streak", title: "Study 5 days in a row", type: "streak", target: 5, current: 6, complete: true, due: -1 },
  ];
  for (const goal of goals) {
    put("learning_goals", {
      id: seedId(`goal:${goal.key}`),
      student_id: userId("student"),
      title: goal.title,
      target_type: goal.type,
      target_value: goal.target,
      current_value: goal.current,
      is_complete: goal.complete,
      due_date: isoAt(goal.due, 23, 59),
      created_at: sqlAt(-8),
      updated_at: sqlAt(-1),
    });
  }

  put("learning_reflections", {
    id: seedId("reflection:cells"),
    student_id: userId("student"),
    lesson_id: lessonId("cells"),
    confidence: 4,
    reflection: "I finally get why plant cells need a wall. Mitochondria still feel abstract.",
    ai_feedback: "Try comparing mitochondria to a power station for the cell.",
    next_step: "Review the energy section before the unit test.",
    created_at: sqlAt(-5, 18),
  });
}

// ---------------------------------------------------------------------------
// Catalog

function seedCatalog() {
  const products = [
    { key: "cells", lesson: "cells", title: "Cells & Life Starter", description: "A short, visual introduction to cells for curious learners.", amount: 0, interval: "one_time", enrollment: "free", category: "Science", difficulty: "Beginner", featured: true },
    { key: "algebra", lesson: "linear", title: "Algebra Foundations", description: "Master equations step by step with instant feedback.", amount: 2900, interval: "one_time", enrollment: "paid", category: "Mathematics", difficulty: "Beginner", featured: false },
  ];
  for (const product of products) {
    const id = seedId(`product:${product.key}`);
    put("billing_products", {
      id,
      tenant_id: TENANT_ID,
      title: product.title,
      description: product.description,
      product_type: "course",
      course_id: lessonId(product.lesson),
      status: "active",
      metadata: {
        visibility: "public",
        enrollmentMode: product.enrollment,
        featured: product.featured,
        category: product.category,
        difficulty: product.difficulty,
        language: "English",
        previewSummary: product.description,
      },
      created_at: sqlAt(-20),
      updated_at: sqlAt(-3),
    });
    put("billing_prices", {
      id: seedId(`price:${product.key}`),
      tenant_id: TENANT_ID,
      product_id: id,
      provider: "manual",
      currency: "usd",
      amount_cents: product.amount,
      billing_interval: product.interval,
      active: true,
      created_at: sqlAt(-20),
      updated_at: sqlAt(-20),
    });
  }
  put("entitlements", {
    id: seedId("entitlement:student:cells"),
    tenant_id: TENANT_ID,
    user_id: userId("student"),
    product_id: seedId("product:cells"),
    source_type: "free_enrollment",
    status: "active",
    starts_at: sqlAt(-10),
    ends_at: null,
    metadata: {},
    created_at: sqlAt(-10),
    updated_at: sqlAt(-10),
  });
}

// ---------------------------------------------------------------------------
// Studio designs (SceneDeck content, theme-token colors)

let elementCounter = 0;
type ElementDraft = SceneElement extends infer E ? (E extends SceneElement ? Omit<E, "id"> : never) : never;
const el = (element: ElementDraft) => ({ ...element, id: `el-${++elementCounter}` }) as SceneElement;

function page(key: string, background: Background, elements: SceneElement[], notes?: string): ScenePage {
  return { id: seedId(`page:${key}`), background, elements, notes };
}

function deck(key: string, title: string, kind: SceneDeck["kind"], formatId: string, width: number, height: number, themeId: string, pages: ScenePage[]): SceneDeck {
  return { v: 2, id: seedId(`deck:${key}`), title, kind, formatId, width, height, themeId, pages, seed: seedNumber(key, 1, 9999) };
}

function studioDecks(): { key: string; itemKind: "slide" | "design" | "doc"; status: "draft" | "published"; classKey: ClassKey; deck: SceneDeck }[] {
  const cells = deck("cells", "Cells: the building blocks of life", "slides", "slides-16x9", 1280, 720, "porcelain", [
    page("cells:title", { kind: "gradient", from: "bg", to: "accentSoft", angle: 135 }, [
      el({ kind: "shape", role: "deco", shape: "circle", x: 0.68, y: -0.12, w: 0.42, h: 0.75, fill: "accentSoft", opacity: 0.8 }),
      el({ kind: "text", role: "kicker", slot: "kicker", x: 0.08, y: 0.3, w: 0.5, h: 0.06, text: "Biology 8", style: "label", color: "accent" }),
      el({ kind: "text", role: "title", slot: "title", x: 0.08, y: 0.38, w: 0.6, h: 0.22, text: "Cells: the building blocks of life", style: "display", color: "text" }),
      el({ kind: "text", role: "subtitle", slot: "subtitle", x: 0.08, y: 0.64, w: 0.5, h: 0.08, text: "Organelles, energy and two kinds of cells", style: "subheading", color: "muted" }),
    ], "Welcome everyone. Ask: what do a mushroom and a human have in common?"),
    page("cells:inside", { kind: "solid", color: "bg" }, [
      el({ kind: "text", role: "title", slot: "title", x: 0.08, y: 0.1, w: 0.84, h: 0.12, text: "Inside the cell", style: "title", color: "text" }),
      el({ kind: "shape", role: "card", x: 0.08, y: 0.3, w: 0.26, h: 0.52, shape: "rounded", fill: "surface", stroke: "border", strokeWidth: 1, radius: 16 }),
      el({ kind: "text", role: "item-title", slot: "item-1-title", x: 0.1, y: 0.34, w: 0.22, h: 0.08, text: "Nucleus", style: "heading", color: "accent" }),
      el({ kind: "text", role: "item-body", slot: "item-1-body", x: 0.1, y: 0.44, w: 0.22, h: 0.3, text: "Stores DNA and directs the cell.", style: "body", color: "text" }),
      el({ kind: "shape", role: "card", x: 0.37, y: 0.3, w: 0.26, h: 0.52, shape: "rounded", fill: "surface", stroke: "border", strokeWidth: 1, radius: 16 }),
      el({ kind: "text", role: "item-title", slot: "item-2-title", x: 0.39, y: 0.34, w: 0.22, h: 0.08, text: "Mitochondria", style: "heading", color: "accent" }),
      el({ kind: "text", role: "item-body", slot: "item-2-body", x: 0.39, y: 0.44, w: 0.22, h: 0.3, text: "Release energy from food.", style: "body", color: "text" }),
      el({ kind: "shape", role: "card", x: 0.66, y: 0.3, w: 0.26, h: 0.52, shape: "rounded", fill: "surface", stroke: "border", strokeWidth: 1, radius: 16 }),
      el({ kind: "text", role: "item-title", slot: "item-3-title", x: 0.68, y: 0.34, w: 0.22, h: 0.08, text: "Membrane", style: "heading", color: "accent" }),
      el({ kind: "text", role: "item-body", slot: "item-3-body", x: 0.68, y: 0.44, w: 0.22, h: 0.3, text: "Controls what enters and leaves.", style: "body", color: "text" }),
    ]),
    page("cells:quiz", { kind: "solid", color: "surface" }, [
      el({ kind: "text", role: "kicker", x: 0.08, y: 0.1, w: 0.4, h: 0.06, text: "Quick check", style: "label", color: "accent" }),
      el({ kind: "text", role: "title", slot: "title", x: 0.08, y: 0.18, w: 0.84, h: 0.14, text: "Which structure do only plant cells have?", style: "title", color: "text" }),
      ...["Cell membrane", "Cell wall", "Nucleus", "Cytoplasm"].map((choice, index) =>
        el({ kind: "text", role: "answer", slot: `answer-${index + 1}`, x: 0.08 + (index % 2) * 0.43, y: 0.44 + Math.floor(index / 2) * 0.2, w: 0.41, h: 0.15, text: `${String.fromCharCode(65 + index)}  ${choice}`, style: "heading", color: "text", fill: "bg", radius: 14, padding: 20, verticalAlign: "middle" }),
      ),
    ], "Answer: B, the cell wall."),
  ]);

  const poster = deck("photosynthesis-poster", "Photosynthesis poster", "design", "poster", 1200, 1800, "ocean", [
    page("poster:main", { kind: "gradient", from: "accentSoft", to: "bg", angle: 180 }, [
      el({ kind: "text", role: "kicker", x: 0.1, y: 0.08, w: 0.8, h: 0.04, text: "Biology 8 · Unit 2", style: "label", color: "accent" }),
      el({ kind: "text", role: "title", slot: "title", x: 0.1, y: 0.13, w: 0.8, h: 0.16, text: "How plants make food", style: "display", color: "text" }),
      el({ kind: "text", role: "body", slot: "body", x: 0.1, y: 0.32, w: 0.8, h: 0.1, text: "carbon dioxide + water → glucose + oxygen", style: "subheading", color: "text", fill: "surface", radius: 18, padding: 28, align: "center", verticalAlign: "middle" }),
      el({ kind: "chart", role: "chart", x: 0.1, y: 0.48, w: 0.8, h: 0.3, chart: "column", color: "accent", showLabels: true, data: [{ label: "Dawn", value: 12 }, { label: "Noon", value: 48 }, { label: "Dusk", value: 18 }, { label: "Night", value: 2 }] }),
      el({ kind: "text", role: "caption", x: 0.1, y: 0.8, w: 0.8, h: 0.05, text: "Oxygen released by a pond plant over one day (bubbles per minute)", style: "caption", color: "muted", align: "center" }),
    ]),
  ]);

  const worksheet = deck("equations-worksheet", "Two-step equations worksheet", "worksheet", "doc-a4", 794, 1123, "paper-ink", [
    page("worksheet:1", { kind: "solid", color: "bg" }, [
      el({ kind: "text", role: "title", slot: "title", x: 0.1, y: 0.06, w: 0.8, h: 0.06, text: "Two-step equations", style: "title", color: "text" }),
      el({ kind: "text", role: "subtitle", x: 0.1, y: 0.13, w: 0.8, h: 0.04, text: "Name: ____________    Date: ________", style: "small", color: "muted" }),
      el({ kind: "table", role: "table", x: 0.1, y: 0.2, w: 0.8, h: 0.4, header: true, stroke: "border", color: "text", rows: [["#", "Equation", "Answer"], ["1", "2x + 3 = 11", ""], ["2", "5x − 4 = 21", ""], ["3", "x / 3 + 2 = 6", ""], ["4", "7 − x = 2", ""], ["5", "4(x + 1) = 20", ""]] }),
      el({ kind: "text", role: "body", x: 0.1, y: 0.64, w: 0.8, h: 0.12, text: "Check each answer by substituting it back into the equation.", style: "body", color: "text", list: "bullet" }),
    ]),
  ]);

  return [
    { key: "cells", itemKind: "slide", status: "published", classKey: "biology", deck: cells },
    { key: "poster", itemKind: "design", status: "draft", classKey: "biology", deck: poster },
    { key: "worksheet", itemKind: "doc", status: "draft", classKey: "algebra", deck: worksheet },
  ];
}

function plainText(value: SceneDeck) {
  return value.pages
    .flatMap((scenePage) => scenePage.elements)
    .map((element) => (element.kind === "text" ? element.text : ""))
    .filter(Boolean)
    .join("\n");
}

function seedStudio() {
  studioDecks().forEach((entry, index) => {
    const id = seedId(`studio:${entry.key}`);
    put("studio_documents", {
      id,
      tenant_id: TENANT_ID,
      owner_id: userId("teacher"),
      item_kind: entry.itemKind,
      title: entry.deck.title,
      content: entry.deck,
      plain_text: plainText(entry.deck),
      status: entry.status,
      source_type: null,
      source_id: null,
      metadata: {
        editor: "scene",
        formatId: entry.deck.formatId,
        themeId: entry.deck.themeId,
        canvasWidth: entry.deck.width,
        canvasHeight: entry.deck.height,
        pageCount: entry.deck.pages.length,
        classId: classId(entry.classKey),
        className: className(entry.classKey),
      },
      created_at: sqlAt(-9 + index),
      updated_at: sqlAt(-index, 11),
    });
    linkToTenant("studio_documents", id);
  });
}

// ---------------------------------------------------------------------------

async function assertMigrated(db: D1Database) {
  const applied = await readAppliedMigrations(db);
  const pending = listMigrationFiles().filter((file) => !applied.has(file));
  if (pending.length > 0) {
    throw new Error(`Local D1 has pending migrations (${pending.join(", ")}). Run npm run db:migrate:local first.`);
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  const rawPassword = process.env.LOCAL_SEED_PASSWORD;
  if (!rawPassword) {
    throw new Error("LOCAL_SEED_PASSWORD is required (set it in .env.local). It becomes the password of every local seed account.");
  }
  const passwordHash = await hashPassword(validateSignupPassword(rawPassword));

  const { db, dispose } = await openLocalD1();
  try {
    await assertMigrated(db);
    hasAttemptHistory = Boolean(
      await db.prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'learning_submission_attempts'").first(),
    );
    await resolveUserIds(db);
    seedPeople(passwordHash);
    seedClasses();
    seedLessons();
    seedWork();
    seedProgress();
    seedPlanner();
    seedNotes();
    seedNotifications();
    seedInsights();
    seedCatalog();
    seedStudio();

    for (let index = 0; index < statements.length; index += BATCH_SIZE) {
      const chunk = statements.slice(index, index + BATCH_SIZE);
      await db.batch(chunk.map(({ sql, params }) => db.prepare(sql).bind(...params)));
    }
    console.log(`Seeded local D1 with ${statements.length} rows.`);
    console.log(`Accounts (password = LOCAL_SEED_PASSWORD): ${ACCOUNTS.map((account) => account.email).join(", ")}`);
  } finally {
    await dispose();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
