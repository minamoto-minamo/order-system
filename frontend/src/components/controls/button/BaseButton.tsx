import type { ButtonHTMLAttributes } from "react";

const VARIANT_CLASSES = {
  primary: "bg-brand text-white border-none",
  secondary: "border border-line bg-white text-dim",
  ghost: "bg-transparent border-none",
  danger: "bg-danger text-white border-none",
  takeout: "bg-amber text-white border-none",
} as const;

type Variant = keyof typeof VARIANT_CLASSES;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function BaseButton({ variant, className = "", ...props }: ButtonProps) {
  const variantClass = variant ? VARIANT_CLASSES[variant] : "";
  return (
    <button
      className={["action-btn", variantClass, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
