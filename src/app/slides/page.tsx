import { redirect } from "next/navigation";

export const metadata = {
  title: "Course Studio",
  description: "Compatibility route for the unified EdSync course studio.",
};

export default function SlidesPage() {
  redirect("/studio");
}
