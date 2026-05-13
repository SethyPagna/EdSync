export type UserRole = "admin" | "teacher" | "student";
export type LessonStatus = "draft" | "published" | "archived";
export type ContentType =
  | "text"
  | "video"
  | "image"
  | "quiz"
  | "activity"
  | "discussion";
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";
export type ProgressStatus = "not_started" | "in_progress" | "completed";
export type AlertType =
  | "struggling"
  | "intervention"
  | "achievement"
  | "completion";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  school: string | null;
  grade_level: string | null;
  subjects: string[] | null;
  interests: string[] | null;
  preferences: UserPreferences;
  achievements: Achievement[];
  total_xp: number;
  streak_days?: number;
  last_active_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  text_size: "small" | "medium" | "large";
  email_notifications?: boolean;
  assignment_notifications?: boolean;
  weekly_digest?: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned_at: string;
}

export interface Class {
  id: string;
  teacher_id: string;
  name: string;
  description: string | null;
  subject: string | null;
  grade_level: string | null;
  join_code: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  enrollment_count?: number;
}

export interface Lesson {
  id: string;
  teacher_id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  objectives: string[];
  subject: string | null;
  grade_level: string | null;
  status: LessonStatus;
  difficulty: DifficultyLevel;
  estimated_duration: number;
  tags: string[];
  thumbnail_url: string | null;
  source_url: string | null;
  source_content: string | null;
  ai_generated: boolean;
  complexity_slider: number;
  pacing_slider: number;
  scaffolding_slider: number;
  prerequisites: string[];
  created_at: string;
  updated_at: string;
  sections?: LessonSection[];
  progress?: StudentProgress;
}

export interface LessonSection {
  id: string;
  lesson_id: string;
  title: string;
  content: string | null;
  content_type: ContentType;
  order_index: number;
  duration_minutes: number;
  is_required: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  lesson_id: string;
  section_id: string | null;
  question_text: string;
  question_type:
    | "multiple_choice"
    | "true_false"
    | "short_answer"
    | "long_answer"
    | "fill_blank"
    | "matching";
  options: { id: string; text: string; is_correct: boolean }[] | null;
  correct_answer: string | null;
  explanation: string | null;
  difficulty: DifficultyLevel;
  points: number;
  is_diagnostic: boolean;
  is_micro_check: boolean;
  is_final_quiz: boolean;
  order_index: number;
  created_at: string;
}

export interface StudentProgress {
  id: string;
  student_id: string;
  lesson_id: string;
  status: ProgressStatus;
  current_section_id: string | null;
  sections_completed: string[];
  score: number | null;
  time_spent: number;
  diagnostic_completed: boolean;
  diagnostic_score: number | null;
  final_quiz_score: number | null;
  knowledge_gaps: string[];
  started_at: string | null;
  completed_at: string | null;
  last_active: string;
  metadata?: Record<string, unknown>;
}

export interface SocraticInteraction {
  id: string;
  student_id: string;
  lesson_id: string;
  section_id: string | null;
  student_question: string;
  hint_response: string;
  hint_type: "guiding_question" | "concept_reminder" | "step_breakdown";
  conversation_history: ChatMessage[];
  helpful_rating: number | null;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface TeacherAlert {
  id: string;
  teacher_id: string;
  student_id: string | null;
  lesson_id: string | null;
  alert_type: AlertType;
  title: string;
  message: string;
  action_suggestion: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  student?: Profile;
  lesson?: Lesson;
}

export interface KnowledgeNode {
  id: string;
  student_id: string;
  lesson_id: string | null;
  concept: string;
  mastery_level: number;
  evidence: unknown[];
  created_at: string;
  updated_at: string;
}

export interface LearningGoal {
  id: string;
  student_id: string;
  title: string;
  target_type: string;
  target_value: number;
  current_value: number;
  is_complete: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LearningReflection {
  id: string;
  student_id: string;
  lesson_id: string | null;
  confidence: number | null;
  reflection: string;
  ai_feedback: string | null;
  next_step: string | null;
  created_at: string;
}

export interface LessonAnalytics {
  id: string;
  lesson_id: string;
  teacher_id: string;
  total_students: number;
  students_started: number;
  students_completed: number;
  avg_score: number | null;
  avg_time_spent: number | null;
  concept_mastery: Record<string, number>;
  common_mistakes: { question: string; count: number }[];
  struggling_students: string[];
  advanced_students: string[];
  computed_at: string;
}

export interface GlossaryTerm {
  id: string;
  lesson_id: string;
  term: string;
  definition: string;
  example: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  message: string;
  action_url: string | null;
  priority: "low" | "normal" | "high";
  channels: string[];
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface EmailMessage {
  id: string;
  recipient_user_id: string | null;
  recipient_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  status: "queued" | "sent" | "failed" | "skipped";
  provider: string;
  provider_message_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  sent_at: string | null;
}

export interface MediaAsset {
  id: string;
  owner_id: string | null;
  storage_object_id: string | null;
  asset_type: "image" | "video" | "audio" | "document" | "other";
  title: string | null;
  description: string | null;
  public_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Announcement {
  id: string;
  teacher_id: string;
  class_id: string | null;
  title: string;
  body: string;
  priority: "low" | "normal" | "high";
  audience: "class" | "all";
  publish_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ScheduleEvent {
  id: string;
  owner_id: string;
  class_id: string | null;
  lesson_id: string | null;
  title: string;
  description: string | null;
  event_type:
    | "deadline"
    | "class"
    | "office_hours"
    | "study"
    | "announcement"
    | "other";
  starts_at: string | null;
  ends_at: string | null;
  due_at: string | null;
  location: string | null;
  visibility: "teacher" | "student" | "class";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type WorkType = "quiz" | "test" | "task" | "discussion" | "activity";
export type WorkStatus = "draft" | "published" | "archived";
export type SubmissionStatus = "draft" | "submitted" | "returned" | "graded" | "missing";

export interface AdminAuditLog {
  id: string;
  admin_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  flag_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  audience: "all" | "admin" | "teacher" | "student";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  provider: "openrouter" | "groq" | "mistral" | "cerebras" | "google" | "cohere" | "cloudflare";
  provider_type: "chat" | "embed";
  account_email: string | null;
  project_name: string | null;
  default_model: string | null;
  supported_models: string[];
  endpoint_override: string | null;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
  has_key?: boolean;
  key_masked?: string;
}

export interface GradebookCategory {
  id: string;
  class_id: string;
  teacher_id: string;
  name: string;
  weight: number;
  drop_lowest: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface GradebookScore {
  id: string;
  class_id: string | null;
  student_id: string;
  teacher_id: string;
  category_id: string | null;
  source_type: "lesson_quiz" | WorkType | "manual";
  source_id: string | null;
  title: string;
  points_earned: number;
  points_possible: number;
  percent: number | null;
  feedback: string | null;
  status: "draft" | "submitted" | "graded" | "excused" | "missing";
  graded_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LearningWorkItem {
  id: string;
  teacher_id: string;
  class_id: string | null;
  lesson_id: string | null;
  category_id: string | null;
  title: string;
  description: string | null;
  work_type: WorkType;
  instructions: string | null;
  points_possible: number;
  due_at: string | null;
  status: WorkStatus;
  allow_late: boolean;
  rubric: unknown[];
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LearningWorkQuestion {
  id: string;
  work_item_id: string;
  prompt: string;
  question_type: string;
  options: { id: string; text: string; is_correct?: boolean }[];
  correct_answer: string | null;
  points: number;
  order_index: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LearningSubmission {
  id: string;
  work_item_id: string;
  student_id: string;
  class_id: string | null;
  response: Record<string, unknown>;
  attachment_storage_id: string | null;
  status: SubmissionStatus;
  points_earned: number | null;
  points_possible: number | null;
  percent: number | null;
  feedback: string | null;
  ai_feedback: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscussionThread {
  id: string;
  work_item_id: string | null;
  class_id: string | null;
  teacher_id: string;
  title: string;
  prompt: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscussionPost {
  id: string;
  thread_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  visibility: "class" | "teacher" | "private";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StudentNote {
  id: string;
  teacher_id: string;
  student_id: string;
  class_id: string | null;
  title: string;
  body: string;
  visibility: "teacher" | "student" | "guardian";
  priority: "low" | "normal" | "high";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EmailOutboxEvent {
  id: string;
  teacher_id: string | null;
  class_id: string | null;
  subject: string;
  body_text: string;
  recipient_count: number;
  recipients: string[];
  sender_display: string | null;
  reply_to: string | null;
  compose_url: string | null;
  provider: string;
  status: "queued" | "composed" | "sent" | "failed" | "skipped";
  metadata: Record<string, unknown>;
  created_at: string;
}

// AI Generation Types
export interface AILessonDraft {
  title: string;
  description: string;
  objectives: string[];
  sections: {
    title: string;
    content: string;
    content_type: ContentType;
    duration_minutes: number;
  }[];
  quiz_questions: {
    question_text: string;
    question_type: string;
    options: { id: string; text: string; is_correct: boolean }[];
    explanation: string;
    difficulty: DifficultyLevel;
    is_diagnostic: boolean;
    is_micro_check: boolean;
    is_final_quiz: boolean;
  }[];
  glossary_terms: {
    term: string;
    definition: string;
    example: string;
  }[];
  prerequisites: string[];
  tags: string[];
  estimated_duration: number;
}
