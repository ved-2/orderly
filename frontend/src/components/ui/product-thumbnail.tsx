import React from "react";
import { Package } from "lucide-react";

interface ProductThumbnailProps {
  name: string;
  category?: string;
  brandName?: string;
  imageUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ProductThumbnail({
  name,
  category = "FMCG",
  brandName,
  imageUrl,
  className = "",
  size = "md",
}: ProductThumbnailProps) {
  const sizeClasses = {
    sm: "w-10 h-10 text-xs",
    md: "w-16 h-16 text-sm",
    lg: "w-24 h-24 text-base",
  };

  // Deterministic subtle tint based on category
  const getCategoryTint = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes("beverage") || lower.includes("drink")) return "bg-[#EFF5FB] text-[#28537A] border-[#DCE8F2]";
    if (lower.includes("snack") || lower.includes("biscuit")) return "bg-[#FCF6EC] text-[#85581A] border-[#F2E5D0]";
    if (lower.includes("staple") || lower.includes("grain") || lower.includes("salt")) return "bg-[#F4EFF0] text-[#79565D] border-[#E8DFE2]";
    if (lower.includes("personal") || lower.includes("soap")) return "bg-[#EEF6F1] text-[#285C3E] border-[#D4E8DC]";
    return "bg-[#F0EFEA] text-[#666864] border-[#E7E6E0]";
  };

  if (imageUrl) {
    return (
      <div
        className={`relative overflow-hidden rounded-[4px] border border-[#E7E6E0] bg-white flex items-center justify-center ${sizeClasses[size]} ${className}`}
      >
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-contain p-1"
          loading="lazy"
        />
      </div>
    );
  }

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`relative overflow-hidden rounded-[4px] border flex flex-col items-center justify-center font-bold tracking-tight select-none ${getCategoryTint(
        category
      )} ${sizeClasses[size]} ${className}`}
      title={`${name} (${category})`}
    >
      <span className="font-mono text-[11px] opacity-90">{initials}</span>
      {size === "lg" && brandName && (
        <span className="text-[9px] font-normal uppercase tracking-wider opacity-75 truncate max-w-[80%]">
          {brandName}
        </span>
      )}
    </div>
  );
}
