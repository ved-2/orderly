import React from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "accent" | "outline";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    default: "bg-[#F0EFEA] text-[#242724] border-[#E7E6E0]",
    outline: "bg-transparent text-[#666864] border-[#E7E6E0]",
    success: "bg-[#EEF6F1] text-[#205234] border-[#C3DEC9]",
    warning: "bg-[#FCF6EC] text-[#7A4E12] border-[#EED7B3]",
    danger: "bg-[#FBF0F0] text-[#8C2828] border-[#EDBCBC]",
    info: "bg-[#EFF5FB] text-[#1E4B72] border-[#BDD7ED]",
    accent: "bg-[#F4EFF0] text-[#67474E] border-[#E0D2D5]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase border rounded-[3px] tabular-nums ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
