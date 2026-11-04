export default function RetailerCreditLoading() {
  return (
    <div
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6"
      aria-busy="true"
      aria-label="Loading credit account"
    >
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E6E0] pb-5">
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-lg bg-[#E7E6E0] animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-48 bg-[#E7E6E0] animate-pulse rounded" />
            <div className="h-4 w-60 bg-[#E7E6E0] animate-pulse rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-24 bg-[#E7E6E0] animate-pulse rounded-md" />
          <div className="h-10 w-28 bg-[#E7E6E0] animate-pulse rounded-md" />
        </div>
      </div>

      {/* Available Credit Hero Skeleton */}
      <div className="border border-[#E7E6E0] bg-white rounded-xl p-6 sm:p-8 space-y-6">
        <div className="h-4 w-36 bg-[#E7E6E0] animate-pulse rounded" />
        <div className="h-12 w-64 bg-[#E7E6E0] animate-pulse rounded" />
        <div className="h-3.5 w-full bg-[#E7E6E0] animate-pulse rounded-full" />
        <div className="flex justify-between">
          <div className="h-4 w-40 bg-[#E7E6E0] animate-pulse rounded" />
          <div className="h-4 w-40 bg-[#E7E6E0] animate-pulse rounded" />
        </div>
      </div>

      {/* 2 Summary Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-[#E7E6E0] bg-white rounded-xl p-6 space-y-3">
          <div className="h-4 w-32 bg-[#E7E6E0] animate-pulse rounded" />
          <div className="h-8 w-40 bg-[#E7E6E0] animate-pulse rounded" />
          <div className="h-3 w-52 bg-[#E7E6E0] animate-pulse rounded" />
        </div>
        <div className="border border-[#E7E6E0] bg-white rounded-xl p-6 space-y-3">
          <div className="h-4 w-32 bg-[#E7E6E0] animate-pulse rounded" />
          <div className="h-8 w-40 bg-[#E7E6E0] animate-pulse rounded" />
          <div className="h-3 w-52 bg-[#E7E6E0] animate-pulse rounded" />
        </div>
      </div>

      {/* Transactions Skeleton */}
      <div className="border border-[#E7E6E0] bg-white rounded-xl p-6 space-y-4">
        <div className="h-6 w-48 bg-[#E7E6E0] animate-pulse rounded" />
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded bg-[#F6F5F1]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
