import React from "react";

/**
 * Big-number stat block — the brand's "I NOSTRI NUMERI" pattern.
 * Heavy gold (or red) figure over an uppercase charcoal label.
 */
export function StatBlock({
  value,
  label,
  unit,
  tone = "gold",
  align = "left",
  onDark = false,
  style = {},
  ...rest
}) {
  const figureColor = tone === "red" ? "var(--cra-red)" : tone === "gold" ? "var(--cra-gold)" : (onDark ? "var(--cra-white)" : "var(--text-strong)");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        textAlign: align,
        alignItems: align === "center" ? "center" : "flex-start",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          fontFamily: "var(--font-brand)",
          fontWeight: "var(--fw-black)",
          fontSize: "var(--fs-4xl)",
          lineHeight: "var(--lh-tight)",
          letterSpacing: "var(--ls-tight)",
          color: figureColor,
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", whiteSpace: "nowrap", color: onDark ? "var(--char-300)" : "var(--text-muted)" }}>
            {unit}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-brand)",
          fontWeight: "var(--fw-bold)",
          fontSize: "var(--fs-xs)",
          textTransform: "uppercase",
          letterSpacing: "var(--ls-eyebrow)",
          color: onDark ? "var(--char-300)" : "var(--text-muted)",
          maxWidth: "22ch",
        }}
      >
        {label}
      </div>
    </div>
  );
}
