import React from "react";

/**
 * Small status / category label. Solid or soft, in brand colors.
 */
export function Badge({ children, tone = "neutral", variant = "soft", style = {}, ...rest }) {
  const tones = {
    neutral: { solid: ["var(--char-800)", "#fff"], soft: ["var(--char-100)", "var(--char-700)"] },
    red:     { solid: ["var(--cra-red)", "#fff"], soft: ["var(--red-50)", "var(--red-700)"] },
    gold:    { solid: ["var(--cra-gold)", "var(--char-900)"], soft: ["var(--gold-50)", "var(--gold-700)"] },
    success: { solid: ["var(--status-success)", "#fff"], soft: ["#e6f3ec", "var(--status-success)"] },
  };
  const [bg, fg] = tones[tone][variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: bg,
        color: fg,
        fontFamily: "var(--font-brand)",
        fontWeight: "var(--fw-bold)",
        fontSize: "var(--fs-2xs)",
        textTransform: "uppercase",
        letterSpacing: "var(--ls-eyebrow)",
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        lineHeight: 1.2,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
