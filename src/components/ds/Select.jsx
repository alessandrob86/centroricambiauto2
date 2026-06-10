import React from "react";

/**
 * Native select styled to match the Input. Squared, hairline border, gold focus.
 */
export function Select({
  label,
  hint,
  error,
  id,
  value,
  onChange,
  options = [],
  placeholder,
  disabled = false,
  style = {},
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const autoId = React.useId();
  const selId = id || `cra-select-${autoId}`;
  const borderColor = error ? "var(--cra-red)" : focused ? "var(--char-700)" : "var(--border-strong)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", ...style }}>
      {label && (
        <label
          htmlFor={selId}
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
      <div style={{ position: "relative" }}>
        <select
          id={selId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            width: "100%",
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-base)",
            color: value ? "var(--text-strong)" : "var(--text-muted)",
            background: disabled ? "var(--surface-subtle)" : "var(--surface-card)",
            border: `var(--border-w-2) solid ${borderColor}`,
            borderRadius: "var(--radius-sm)",
            padding: "11px 38px 11px 14px",
            outline: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            boxShadow: focused && !error ? "0 0 0 3px var(--focus-ring)" : "none",
            transition: "border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)",
          }}
          {...rest}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((o) => {
            const val = typeof o === "string" ? o : o.value;
            const lab = typeof o === "string" ? o : o.label;
            return <option key={val} value={val}>{lab}</option>;
          })}
        </select>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "14px",
            top: "50%",
            transform: "translateY(-50%)",
            width: 0,
            height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "6px solid var(--cra-charcoal)",
            pointerEvents: "none",
          }}
        />
      </div>
      {(hint || error) && (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-xs)", color: error ? "var(--cra-red)" : "var(--text-muted)" }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
