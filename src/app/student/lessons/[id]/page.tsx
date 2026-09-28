"use client";

import { useParams } from "next/navigation";
import LessonPlayer from "@/components/lesson/player/LessonPlayer";

export default function StudentLessonPage() {
  const params = useParams<{ id: string }>();
  return <LessonPlayer lessonId={params.id} />;
}
