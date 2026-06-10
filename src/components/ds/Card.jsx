import React from "react";

/**
 * Surface container. Flat white with a hairline border by default;
 * optional accent keyline (top red→gold stripe) for emphasis.
 */
export function Card({
  children,
  elevation = "sm",
  keyline = false,
  padding = "var(--space-5)",
  style = {},
  ...rest
}) {
  const shadows = {
    none: "none",
    sm: "var(--shadow-sm)",
    md: "var(--shadow-md)",
    lg: "var(--shadow-lg)",
  };
  return (
    <div
      style={{
        position: "relative",
        background: "var(--surface-card)",
        border: "var(--border-w) solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        boxShadow: shadows[elevation],
        padding,
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    >
      {keyline && (
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "var(--keyline)",
          }}
        />
      )}
      {children}
    </div>
  );
}
