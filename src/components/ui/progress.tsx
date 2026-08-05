export function ProgressBar({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div
        className="h-2 rounded-full bg-petrol"
        style={{ width: `${normalized}%` }}
        aria-label={`${normalized.toFixed(0)}% concluido`}
      />
    </div>
  );
}
