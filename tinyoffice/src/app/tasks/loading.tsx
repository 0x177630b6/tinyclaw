export default function TasksLoading() {
  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-1 gap-4 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-w-[260px] flex-1 flex-col rounded-lg border bg-card p-3">
            <div className="mb-3 h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              {[1, 2].map((j) => (
                <div key={j} className="h-20 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
