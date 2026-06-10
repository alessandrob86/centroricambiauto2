import React from "react";

/**
 * Centro Ricambi Auto — Button
 * Industrial, squared, confident. Red = primary action, gold = accent.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  iconLeft = null,
  iconRight = null,
  fullWidth = false,
  disabled = false,
  type = "button",
  onClick,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: { padding: "8px 16px", fontSize: "var(--fs-xs)", gap: "6px" },
    md: { padding: "12px 24px", fontSize: "var(--fs-sm)", gap: "8px" },
    lg: { padding: "16px 32px", fontSize: "var(--fs-base)", gap: "10px" },
  };

  const variants = {
    primary: {
      background: "var(--action-primary)",
      color: "var(--text-on-dark)",
      border: "var(--border-w-2) solid var(--action-primary)",
    },
    accent: {
      background: "var(--action-accent)",
      color: "var(--text-on-gold)",
      border: "var(--border-w-2) solid var(--action-accent)",
    },
    dark: {
      background: "var(--cra-charcoal)",
      color: "var(--text-on-dark)",
      border: "var(--border-w-2) solid var(--cra-charcoal)",
    },
    secondary: {
      background: "transparent",
      color: "var(--text-strong)",
      border: "var(--border-w-2) solid var(--border-strong)",
    },
    ghost: {
      background: "transparent",
      color: "var(--action-primary)",
      border: "var(--border-w-2) solid transparent",
    },
  };

  const base = {
    display: fullWidth ? "flex" : "inline-flex",
    width: fullWidth ? "100%" : "auto",
    alignItems: "center",
    justifyContent: "center",
    gap: sizes[size].gap,
    fontFamily: "var(--font-brand)",
    fontWeight: "var(--fw-bold)",
    textTransform: "uppercase",
    letterSpacing: "var(--ls-caps)",
    lineHeight: 1,
    borderRadius: "var(--radius-sm)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    transition: "background var(--dur-base) var(--ease-standard), transform var(--dur-fast) var(--ease-standard), border-color var(--dur-base) var(--ease-standard)",
    padding: sizes[size].padding,
    fontSize: sizes[size].fontSize,
    ...variants[variant],
    ...style,
  };

  const hoverBg = {
    primary: "var(--action-primary-hover)",
    accent: "var(--action-accent-hover)",
    dark: "var(--char-900)",
    secondary: "var(--surface-subtle)",
    ghost: "var(--red-50)",
  };

  const handleEnter = (e) => {
    if (disabled) return;
    e.currentTarget.style.background = hoverBg[variant];
    if (variant === "primary") e.currentTarget.style.borderColor = "var(--action-primary-hover)";
    if (variant === "accent") e.currentTarget.style.borderColor = "var(--action-accent-hover)";
  };
  const handleLeave = (e) => {
    if (disabled) return;
    e.currentTarget.style.background = variants[variant].background;
    e.currentTarget.style.borderColor = variants[variant].border.split("solid ")[1];
  };
  const handleDown = (e) => { if (!disabled) e.currentTarget.style.transform = "translateY(1px) scale(0.99)"; };
  const handleUp = (e) => { if (!disabled) e.currentTarget.style.transform = "none"; };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={base}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
