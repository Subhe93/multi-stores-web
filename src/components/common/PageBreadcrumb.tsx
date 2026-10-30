import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PageBreadcrumbProps {
  /** Link target of the first crumb (the store home in the active locale). */
  homeHref: string;
  homeLabel: string;
  /** Name of the current page (last crumb, not a link). */
  current: string;
  locale: string;
  className?: string;
}

/**
 * Home › current page, shown on landing and static pages. Mirrors the
 * BreadcrumbList these pages already emit in their JSON-LD, so the visible
 * trail and the structured data agree.
 */
export function PageBreadcrumb({ homeHref, homeLabel, current, locale, className }: PageBreadcrumbProps) {
  // Separator points along the reading direction (RTL for Arabic).
  const Crumb = locale === 'ar' ? ChevronLeft : ChevronRight;
  return (
    <nav
      className={`flex items-center flex-wrap gap-1 text-sm ${className ?? ''}`}
      aria-label="Breadcrumb"
    >
      <Link href={homeHref} className="text-gray-400 hover:text-gray-700 transition-colors">
        {homeLabel}
      </Link>
      <Crumb className="w-3.5 h-3.5 text-gray-300 shrink-0" aria-hidden="true" />
      <span aria-current="page" className="text-gray-700 font-medium truncate max-w-full">
        {current}
      </span>
    </nav>
  );
}
