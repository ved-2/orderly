export default function RetailerCreditLoading() {
  return (
    <div
      className="space-y-8 p-6 sm:p-8"
      aria-busy="true"
      aria-label="Loading credit account"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Retailer Workspace / Credit Passbook
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-950">
          Credit Account &amp; Statement
        </h1>
        <p className="mt-1 text-xs text-neutral-500" role="status">
          Loading your credit account...
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="space-y-4 border border-neutral-200 bg-white p-5"
          >
            <div className="h-3 w-2/3 animate-pulse bg-neutral-200" />
            <div className="h-7 w-1/2 animate-pulse bg-neutral-200" />
            <div className="h-3 w-3/4 animate-pulse bg-neutral-100" />
          </div>
        ))}
      </div>

      <div className="space-y-3 border border-neutral-200 bg-white p-5">
        <div className="h-3 w-1/3 animate-pulse bg-neutral-200" />
        <div className="h-3 w-full animate-pulse bg-neutral-100" />
        <div className="h-3 w-2/3 animate-pulse bg-neutral-100" />
      </div>

      <div className="space-y-5 border border-neutral-200 bg-white p-6">
        <div className="h-4 w-1/3 animate-pulse bg-neutral-200" />
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="h-8 animate-pulse border-b border-neutral-100 bg-neutral-50"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
