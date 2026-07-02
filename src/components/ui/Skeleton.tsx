import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx("skeleton rounded-pill", className)} />;
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading trips" className="flex flex-col gap-3.5">
      <Skeleton className="h-3 w-24" />
      <div className="overflow-hidden rounded-[22px] bg-card shadow-card">
        <Skeleton className="h-[170px] w-full rounded-none" />
        <div className="flex flex-col gap-3 p-[18px]">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-3 w-28" />
          <div className="flex gap-1">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
      </div>
      <Skeleton className="mt-1 h-3 w-20" />
      <div className="flex items-center gap-3 rounded-[18px] bg-card p-3 shadow-card">
        <Skeleton className="size-14 rounded-[14px]" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
    </div>
  );
}

export function TripPageSkeleton({ cover = false }: { cover?: boolean }) {
  return (
    <div role="status" aria-label="Loading trip">
      {cover && <Skeleton className="h-[150px] w-full rounded-none" />}
      <div className={clsx("flex flex-col gap-4 py-5", cover && "px-6")}>
        {!cover && <Skeleton className="mx-auto h-5 w-28" />}
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-28" />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-[82px] w-full rounded-[18px]" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-[76px] w-full rounded-[18px]" />
      </div>
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div role="status" aria-label="Loading settings" className="flex flex-col gap-4 pt-4">
      <Skeleton className="mx-auto h-5 w-28" />
      <Skeleton className="mt-2 h-3 w-20" />
      <Skeleton className="h-12 w-full rounded-input" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-12 w-full rounded-input" />
      <Skeleton className="mt-3 h-3 w-24" />
      <Skeleton className="h-[132px] w-full rounded-[18px]" />
    </div>
  );
}
