"use client";

import { useSearchParams } from "next/navigation";

export function FlashMessage() {
  const params = useSearchParams();
  const success = params.get("success");
  const error = params.get("error");

  if (!success && !error) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-soft">
      {success ? (
        <p className="font-medium text-emerald-700">{success}</p>
      ) : (
        <p className="font-medium text-red-700">{error}</p>
      )}
    </div>
  );
}
