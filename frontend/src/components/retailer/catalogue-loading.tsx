export function CatalogueLoading() {
  return (
    <div className="min-h-screen bg-[#F6F5F1] px-4 py-6 text-[#242724] sm:px-6">
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#969892]">
          Kirana Ordering &bull; Master Catalogue
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#242724]">
          Product Catalogue
        </h1>
        <p className="mt-1 text-xs text-[#666864]" role="status">
          Loading depot products, stock availability, and trade schemes...
        </p>
      </header>

      <div className="mb-6 h-12 animate-pulse rounded-[4px] border border-[#E7E6E0] bg-[#FFFFFF]" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, index) => (
          <div
            key={index}
            className="flex flex-col justify-between gap-3 rounded-[6px] border border-[#E7E6E0] bg-[#FFFFFF] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 shrink-0 animate-pulse rounded-[4px] bg-[#F0EFEA]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-[#EAE8E0]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[#F0EFEA]" />
              </div>
            </div>
            <div className="mt-2 h-8 w-full animate-pulse rounded bg-[#F0EFEA]" />
          </div>
        ))}
      </div>
    </div>
  );
}
