import { redirect } from "next/navigation";

export default function AdminIndividualViewPage() {
  redirect("/student/dashboard?adminView=individual");
}
