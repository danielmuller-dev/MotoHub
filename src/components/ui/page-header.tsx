import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="mb-6">
      {breadcrumbs?.length ? (
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-slate-500">
          {breadcrumbs.map((item, index) => (
            <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
              {item.href ? (
                <Link href={item.href} className="hover:text-asphalt">
                  {item.label}
                </Link>
              ) : (
                <span className="text-asphalt">{item.label}</span>
              )}
              {index < breadcrumbs.length - 1 ? (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              ) : null}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-asphalt">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}
