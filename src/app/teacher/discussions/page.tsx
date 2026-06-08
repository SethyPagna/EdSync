import { redirect } from "next/navigation";

type RedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function appendSearchParams(target: string, params: Record<string, string | string[] | undefined>) {
  const nextParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (key === "section" || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => nextParams.append(key, item));
      return;
    }
    nextParams.set(key, value);
  });
  nextParams.set("section", "discussions");
  return `${target}?${nextParams.toString()}`;
}

export default async function TeacherDiscussionsRedirectPage({ searchParams }: RedirectPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  redirect(appendSearchParams("/teacher/work", resolvedSearchParams));
}
