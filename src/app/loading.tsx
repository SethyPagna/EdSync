export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="mx-auto max-w-6xl space-y-5 p-6"
    >
      <span className="sr-only">Loading your workspace…</span>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-edsync-muted" />
      <div className="h-36 animate-pulse rounded-2xl bg-edsync-muted" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl bg-edsync-muted"
          />
        ))}
      </div>
    </div>
  );
}
