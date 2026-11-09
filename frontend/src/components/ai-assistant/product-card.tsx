"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";
import { Badge } from "@/components/ui/badge";
import { addToCart, type QuantityUnit } from "@/lib/cart";
import type { ProductCardInfo } from "@/contexts/ai-assistant-context";

export function AssistantProductCard({
  product,
  onAdded,
}: {
  product: ProductCardInfo;
  onAdded?: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<QuantityUnit>("PIECE");
  const [isAdded, setIsAdded] = useState(false);

  const pricePerPiece = product.price || 0;
  const pricePerCase = pricePerPiece * (product.units_per_case || 1);
  const currentPrice = unit === "CASE" ? pricePerCase : pricePerPiece;

  function handleAddToCart() {
    if (!product.is_in_stock) return;

    try {
      addToCart({
        product_id: product.product_id,
        sku: product.sku,
        name: product.name,
        brand_name: product.brand_name,
        pack_size: product.pack_size,
        pack_unit: product.pack_unit,
        units_per_case: product.units_per_case,
        price: pricePerPiece,
        gst_included: true,
        quantity_available: product.quantity_available,
        quantity,
        quantity_unit: unit,
        image_url: product.image_url,
      });

      setIsAdded(true);
      onAdded?.();
      setTimeout(() => setIsAdded(false), 1600);
    } catch {
      // Ignored
    }
  }

  return (
    <div className="flex w-64 shrink-0 flex-col rounded-xl border border-[#E7E6E0] bg-white p-3 shadow-2xs transition-all hover:border-[#79565D]/30 hover:shadow-xs">
      {/* Product Image & Stock Badge */}
      <div className="relative flex h-28 w-full items-center justify-center rounded-lg bg-[#F6F5F1] p-2">
        <ProductThumbnail
          name={product.name}
          brandName={product.brand_name}
          category={product.category}
          imageUrl={product.image_url}
          className="size-full object-contain"
        />
        <div className="absolute top-2 right-2">
          {product.is_in_stock ? (
            <Badge className="bg-[#4E8962]/10 text-[10px] text-[#4E8962] border-[#4E8962]/20">
              In Stock
            </Badge>
          ) : (
            <Badge className="bg-[#8C2828]/10 text-[10px] text-[#8C2828] border-[#8C2828]/20">
              Out of Stock
            </Badge>
          )}
        </div>
      </div>

      {/* Brand & Name */}
      <div className="mt-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#79565D]">
          {product.brand_name}
        </p>
        <h4 className="line-clamp-2 text-xs font-medium text-[#242724] leading-tight" title={product.name}>
          {product.name}
        </h4>
        <p className="mt-1 text-[11px] text-[#666864]">
          {product.pack_size} {product.pack_unit} · {product.units_per_case} pcs/case
        </p>
      </div>

      {/* Price Display */}
      <div className="mt-2 flex items-baseline justify-between">
        <div>
          <span className="text-sm font-semibold text-[#242724]">
            ₹{currentPrice.toFixed(2)}
          </span>
          <span className="text-[10px] text-[#969892]">/{unit.toLowerCase()}</span>
        </div>

        {/* Unit Selector (Pcs vs Case) */}
        <div className="flex rounded-md border border-[#E7E6E0] bg-[#F6F5F1] p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setUnit("PIECE")}
            className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
              unit === "PIECE"
                ? "bg-white text-[#242724] shadow-2xs"
                : "text-[#666864] hover:text-[#242724]"
            }`}
          >
            Pcs
          </button>
          <button
            type="button"
            onClick={() => setUnit("CASE")}
            className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
              unit === "CASE"
                ? "bg-white text-[#242724] shadow-2xs"
                : "text-[#666864] hover:text-[#242724]"
            }`}
          >
            Case
          </button>
        </div>
      </div>

      {/* Quantity & Add Action */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-[#E7E6E0] bg-white">
          <button
            type="button"
            disabled={quantity <= 1 || !product.is_in_stock}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex size-7 items-center justify-center text-[#666864] hover:text-[#242724] disabled:opacity-30"
          >
            <Minus size={12} />
          </button>
          <span className="w-6 text-center text-xs font-semibold text-[#242724]">
            {quantity}
          </span>
          <button
            type="button"
            disabled={!product.is_in_stock}
            onClick={() => setQuantity((q) => q + 1)}
            className="flex size-7 items-center justify-center text-[#666864] hover:text-[#242724] disabled:opacity-30"
          >
            <Plus size={12} />
          </button>
        </div>

        <button
          type="button"
          disabled={!product.is_in_stock}
          onClick={handleAddToCart}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
            isAdded
              ? "bg-[#4E8962] text-white"
              : "bg-[#242724] text-white hover:bg-[#343734] disabled:bg-[#E7E6E0] disabled:text-[#969892]"
          }`}
        >
          {isAdded ? (
            <>
              <Check size={13} />
              <span>Added</span>
            </>
          ) : (
            <>
              <ShoppingCart size={13} />
              <span>Add</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
