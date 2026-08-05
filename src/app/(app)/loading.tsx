export default function Loading() {
  return (
    <div className="grid gap-4">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg bg-slate-200" />
    </div>
  );
}
