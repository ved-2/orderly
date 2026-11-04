export function CatalogueLoading() {
  return (
    <div className="min-h-screen bg-[#f7f7f5] px-4 py-5 text-neutral-900 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
          Orderly / Retailer
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Product catalogue
        </h1>
        <p className="mt-2 text-sm text-neutral-600" role="status">
          Loading products and your prices...
        </p>
      </header>

      <div className="mb-6 h-[58px] animate-pulse border border-neutral-200 bg-white" />

      <div className="space-y-3">
        {[...Array(6)].map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 border border-neutral-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-4 w-2/5 animate-pulse bg-neutral-200" />
              <div className="h-3 w-1/4 animate-pulse bg-neutral-100" />
              <div className="h-3 w-1/3 animate-pulse bg-neutral-100" />
            </div>
            <div className="h-9 w-28 shrink-0 animate-pulse bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
