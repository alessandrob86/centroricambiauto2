import React from "react";

/**
 * Text input with label + optional error/hint. Squared, hairline border,
 * gold focus ring.
 */
export function Input({
  label,
  hint,
  error,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled = false,
  style = {},
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const autoId = React.useId();
  const inputId = id || `cra-input-${autoId}`;
  const borderColor = error
    ? "var(--cra-red)"
    : focused
    ? "var(--char-700)"
    : "var(--border-strong)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", ...style }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontFamily: "var(--font-brand)",
            fontWeight: "var(--fw-bold)",
            fontSize: "var(--fs-2xs)",
            textTransform: "uppercase",
            letterSpacing: "var(--ls-eyebrow)",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-base)",
          color: "var(--text-strong)",
          background: disabled ? "var(--surface-subtle)" : "var(--surface-card)",
          border: `var(--border-w-2) solid ${borderColor}`,
          borderRadius: "var(--radius-sm)",
          padding: "11px 14px",
          outline: "none",
          boxShadow: focused && !error ? "0 0 0 3px var(--focus-ring)" : "none",
          transition: "border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)",
        }}
        {...rest}
      />
      {(hint || error) && (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-xs)",
            color: error ? "var(--cra-red)" : "var(--text-muted)",
          }}
        >
          {error || hint}
        </span>
      )}
    </div>
  );
}
