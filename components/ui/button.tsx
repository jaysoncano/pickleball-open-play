import type { ComponentProps } from "react";

const variants = {
  primary:
    "bg-fuchsia-500 text-white shadow-[0_4px_0_0_#a21caf] hover:bg-fuchsia-400 active:shadow-[0_1px_0_0_#a21caf]",
  lime: "bg-lime-400 text-lime-950 shadow-[0_4px_0_0_#4d7c0f] hover:bg-lime-300 active:shadow-[0_1px_0_0_#4d7c0f]",
  secondary:
    "bg-white text-ink ring-2 ring-ink/10 shadow-[0_4px_0_0_rgba(36,28,71,0.12)] hover:ring-ink/20 active:shadow-[0_1px_0_0_rgba(36,28,71,0.12)]",
  ghost: "text-ink/70 hover:bg-ink/5 hover:text-ink",
  /** Armed confirm: the next tap can't be undone. */
  danger:
    "bg-rose-500 text-white shadow-[0_4px_0_0_#9f1239] hover:bg-rose-400 active:shadow-[0_1px_0_0_#9f1239]",
} as const;

const sizes = {
  md: "min-h-11 px-5 text-base",
  lg: "min-h-14 px-7 text-lg",
  icon: "size-11 text-lg",
} as const;

type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-display font-semibold transition-all duration-150 select-none active:translate-y-[3px] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
