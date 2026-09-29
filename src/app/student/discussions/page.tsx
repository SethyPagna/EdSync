import StudentDiscussionWorkspace from "@/components/discussions/StudentDiscussionWorkspace";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export default async function StudentDiscussionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <StudentDiscussionWorkspace
    classId={one(params.classId)}
    threadId={one(params.threadId)}
    workItemId={one(params.workItemId)}
  />;
}
