"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-2xl bg-muted/60 dark:bg-muted/40",
        className
      )}
      {...props}
    />
  );
}

export function TransactionRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="p-4 rounded-3xl bg-card border border-border/40 shadow-soft flex items-center justify-between gap-3 animate-pulse"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Skeleton className="w-10 h-10 rounded-2xl shrink-0" />
        <div className="space-y-1.5 min-w-0">
          <Skeleton className="w-24 h-4 rounded-lg" />
          <Skeleton className="w-36 h-3 rounded-md" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <Skeleton className="w-20 h-5 rounded-lg" />
        <Skeleton className="w-12 h-3 rounded-md" />
      </div>
    </div>
  );
}

export function TransactionSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div
      aria-label="Loading transactions..."
      role="status"
      className="px-6 w-full space-y-3"
    >
      <div className="flex items-center gap-3 pt-2 pb-1">
        <Skeleton className="w-16 h-3 rounded-md" />
        <div className="flex-1 h-px bg-border/40" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <TransactionRowSkeleton key={i} />
      ))}
      <span className="sr-only">Loading transactions...</span>
    </div>
  );
}

export function KPIScorecardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="p-4 rounded-3xl bg-card border border-border/40 shadow-soft space-y-2 animate-pulse"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="w-16 h-3 rounded-md" />
        <Skeleton className="w-7 h-7 rounded-xl" />
      </div>
      <Skeleton className="w-28 h-6 rounded-lg" />
      <Skeleton className="w-20 h-3 rounded-md" />
    </div>
  );
}
