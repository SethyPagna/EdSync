"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CornerDownRight, Link2, LockKeyhole, MessageCircle, MessageSquareText, RefreshCw, Send } from "lucide-react";
import { Button, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { DISCUSSION_POST_MAX_LENGTH } from "@/lib/discussions/validation";
import {
  listDiscussions,
  loadDiscussionPosts,
  sendDiscussionPost,
  type DiscussionPost,
  type DiscussionThread,
} from "./api";

type Props = {
  classId?: string;
  threadId?: string;
  workItemId?: string;
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function discussionUrl(classId: string | undefined, threadId?: string) {
  const params = new URLSearchParams();
  if (classId) params.set("classId", classId);
  if (threadId) params.set("threadId", threadId);
  return `/student/discussions${params.size ? `?${params.toString()}` : ""}`;
}

export default function StudentDiscussionWorkspace({ classId, threadId, workItemId }: Props) {
  const [threads, setThreads] = useState<DiscussionThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<DiscussionPost | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [sending, setSending] = useState(false);
  const [listError, setListError] = useState("");
  const [postError, setPostError] = useState("");
  const [sendError, setSendError] = useState("");
  const [missingTarget, setMissingTarget] = useState(false);
  const [copied, setCopied] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const selected = threads.find((thread) => thread.id === selectedId) ?? null;
  const visibleThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? threads.filter((thread) => `${thread.title} ${thread.class_name ?? ""}`.toLowerCase().includes(query)) : threads;
  }, [search, threads]);
  const postsById = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);

  const refreshThreads = useCallback(async () => {
    const items = await listDiscussions(classId);
    setThreads(items);
    return items;
  }, [classId]);

  useEffect(() => {
    let current = true;
    void listDiscussions(classId).then((items) => {
      if (!current) return;
      setThreads(items);
      const target = threadId
        ? items.find((thread) => thread.id === threadId)
        : workItemId ? items.find((thread) => thread.work_item_id === workItemId) : null;
      setSelectedId(target?.id ?? null);
      setMissingTarget(Boolean((threadId || workItemId) && !target));
      setLoadingPosts(Boolean(target));
      setListError("");
    }).catch((error: unknown) => {
      if (current) setListError(error instanceof Error ? error.message : "Discussions could not load.");
    }).finally(() => {
      if (current) setLoadingThreads(false);
    });
    return () => { current = false; };
  }, [classId, threadId, workItemId]);

  useEffect(() => {
    if (!selectedId) return;
    let current = true;
    void loadDiscussionPosts(selectedId).then((items) => {
      if (!current) return;
      setPosts(items);
      setPostError("");
    }).catch((error: unknown) => {
      if (current) setPostError(error instanceof Error ? error.message : "Posts could not load.");
    }).finally(() => {
      if (current) setLoadingPosts(false);
    });
    return () => { current = false; };
  }, [selectedId]);

  const selectThread = (thread: DiscussionThread) => {
    setSelectedId(thread.id);
    setMissingTarget(false);
    setPosts([]);
    setLoadingPosts(true);
    setPostError("");
    setSendError("");
    setReplyTo(null);
    setBody("");
    setCopied(false);
    window.history.replaceState(null, "", discussionUrl(classId, thread.id));
  };

  const showList = () => {
    setSelectedId(null);
    setMissingTarget(false);
    setPosts([]);
    setReplyTo(null);
    setBody("");
    window.history.replaceState(null, "", discussionUrl(classId));
  };

  const refresh = async () => {
    setListError("");
    setPostError("");
    try {
      await refreshThreads();
      if (selectedId) setPosts(await loadDiscussionPosts(selectedId));
    } catch (error) {
      if (selectedId) setPostError(error instanceof Error ? error.message : "Discussion could not refresh.");
      else setListError(error instanceof Error ? error.message : "Discussions could not refresh.");
    }
  };

  const send = async () => {
    if (!selected || selected.is_locked || !body.trim() || sending) return;
    setSending(true);
    setSendError("");
    try {
      await sendDiscussionPost(selected.id, body.trim(), replyTo?.id);
      setBody("");
      setReplyTo(null);
      setPosts(await loadDiscussionPosts(selected.id));
      await refreshThreads();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Post could not be saved.");
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(new URL(discussionUrl(classId, selected.id), window.location.origin).href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return <div className="page-shell max-w-6xl">
    <PageHeader title="Discussions" icon={MessageSquareText} count={threads.length} actions={<Button size="sm" icon={RefreshCw} onClick={() => void refresh()}>Refresh</Button>} />
    <div className="grid overflow-hidden rounded-xl border border-line bg-surface md:min-h-[34rem] md:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
      <aside className={`${selected || missingTarget ? "hidden md:flex" : "flex"} min-w-0 flex-col border-line md:border-r`} aria-label="Discussion threads">
        <div className="border-b border-line p-3"><input aria-label="Search discussions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a discussion" className="input w-full" /></div>
        {classId && <div className="border-b border-line px-3 py-2"><Link href="/student/discussions" className="text-xs font-medium text-accent hover:underline">All classes</Link></div>}
        <div className="flex-1 space-y-1 p-2">
          {loadingThreads ? <div className="space-y-2 p-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
            : listError ? <EmptyState icon={MessageCircle} title="Discussions unavailable" hint={listError} compact action={<Button size="sm" onClick={() => void refresh()}>Retry</Button>} />
              : visibleThreads.length ? visibleThreads.map((thread) => <button key={thread.id} type="button" onClick={() => selectThread(thread)} aria-current={selectedId === thread.id ? "true" : undefined} className="w-full rounded-lg px-3 py-3 text-left hover:bg-surface-2 aria-current:bg-accent-soft">
                <span className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{thread.title}</span>{thread.is_locked ? <LockKeyhole size={14} className="shrink-0 text-fg-muted" aria-label="Locked" /> : null}</span>
                <span className="mt-1 flex items-center gap-2 text-xs text-fg-muted"><span className="min-w-0 truncate">{thread.class_name || "Discussion"}</span><span aria-hidden>·</span><span className="shrink-0">{thread.post_count} {thread.post_count === 1 ? "post" : "posts"}</span></span>
              </button>)
                : <EmptyState icon={MessageCircle} title={search ? "No matching discussions" : "No discussions yet"} hint={search ? "Try another search." : "Your class conversations will appear here."} compact />}
        </div>
      </aside>

      <section className={`${selected || missingTarget ? "flex" : "hidden md:flex"} min-w-0 flex-col`} aria-label="Discussion conversation">
        {selected ? <>
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <div className="flex items-start gap-2"><Button size="sm" variant="ghost" icon={ArrowLeft} onClick={showList} className="-ml-2 md:hidden" aria-label="Back to discussions" /><div className="min-w-0 flex-1"><p className="text-base font-semibold text-fg">{selected.title}</p><p className="mt-0.5 text-xs text-fg-muted">{selected.class_name || "Discussion"}{selected.is_locked ? " · Locked" : ""}</p></div><Button size="sm" variant="ghost" icon={Link2} onClick={() => void copyLink()} aria-label="Copy discussion link">{copied ? "Copied" : "Copy link"}</Button></div>
            {selected.prompt && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-fg-muted">{selected.prompt}</p>}
          </div>
          <div className="flex-1 space-y-3 p-4 sm:p-5 md:max-h-[55dvh] md:overflow-y-auto" aria-live="polite">
            {loadingPosts ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
              : postError ? <EmptyState icon={MessageCircle} title="Posts unavailable" hint={postError} compact action={<Button size="sm" onClick={() => void refresh()}>Retry</Button>} />
                : posts.length ? posts.map((post) => {
                  const parent = post.parent_id ? postsById.get(post.parent_id) : null;
                  return <article key={post.id} className={`rounded-lg border border-line bg-bg p-3.5 ${parent ? "ml-4 sm:ml-8" : ""}`}>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5"><span className="text-sm font-semibold text-fg">{post.full_name || "Member"}</span>{post.role === "teacher" && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">Teacher</span>}<time dateTime={post.created_at} className="text-xs text-fg-muted">{dateLabel(post.created_at)}</time></div>
                    {parent && <p className="mt-1 inline-flex items-center gap-1 text-xs text-fg-muted"><CornerDownRight size={12} />Reply to {parent.full_name || "member"}</p>}
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-fg">{post.body}</p>
                    {!selected.is_locked && <button type="button" onClick={() => { setReplyTo(post); setSendError(""); composerRef.current?.focus(); }} className="mt-2 text-xs font-medium text-accent hover:underline">Reply</button>}
                  </article>;
                }) : <EmptyState icon={MessageCircle} title="Start the conversation" hint="Share the first thought or question." compact />}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t border-line p-4 sm:p-5">
            {selected.is_locked ? <p className="inline-flex items-center gap-2 text-sm text-fg-muted"><LockKeyhole size={15} />This discussion is locked.</p> : <>
              {replyTo && <div className="mb-2 flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent"><span>Replying to {replyTo.full_name || "member"}</span><button type="button" onClick={() => setReplyTo(null)} className="font-semibold hover:underline">Cancel</button></div>}
              <label htmlFor="discussion-response" className="sr-only">Your post</label>
              <textarea id="discussion-response" ref={composerRef} value={body} onChange={(event) => setBody(event.target.value)} maxLength={DISCUSSION_POST_MAX_LENGTH} rows={3} placeholder={replyTo ? "Write a reply…" : "Add to the discussion…"} className="textarea w-full" />
              <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-fg-muted">{body.length}/{DISCUSSION_POST_MAX_LENGTH}</span><Button variant="primary" size="sm" icon={Send} type="submit" loading={sending} disabled={!body.trim()}>Post</Button></div>
              {sendError && <p role="alert" className="mt-2 text-sm text-danger">{sendError}</p>}
            </>}
          </form>
        </> : missingTarget ? <EmptyState icon={MessageCircle} title="Discussion unavailable" hint="This thread may have been removed or is outside your class." action={<Button onClick={showList}>Browse discussions</Button>} />
          : <EmptyState icon={MessageCircle} title="Choose a discussion" hint="Open a class conversation to read and reply." />}
      </section>
    </div>
  </div>;
}
