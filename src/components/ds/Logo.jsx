import React from "react";
import logoHorizontal from "../../assets/logos/cra-logo-horizontal.png";
import logoHorizontalNotag from "../../assets/logos/cra-logo-horizontal-notag.png";
import logoLight from "../../assets/logos/cra-logo-light.png";
import mark from "../../assets/logos/cra-mark.png";
import markRed from "../../assets/logos/cra-mark-red.png";

export { mark as craMark };

/**
 * Centro Ricambi Auto logo. Renders the official PNG lockups.
 */
export function Logo({
  variant = "horizontal",
  onDark = false,
  height,
  alt = "Centro Ricambi Auto",
  style = {},
  ...rest
}) {
  const files = {
    horizontal: onDark ? logoLight : logoHorizontal,
    "horizontal-notag": logoHorizontalNotag,
    mark,
    "mark-red": markRed,
  };
  const defaultH = { horizontal: 64, "horizontal-notag": 48, mark: 56, "mark-red": 56 };
  const src = files[variant] || files.horizontal;
  return (
    <img
      src={src}
      alt={alt}
      style={{
        height: height != null ? (typeof height === "number" ? `${height}px` : height) : `${defaultH[variant]}px`,
        width: "auto",
        display: "block",
        ...style,
      }}
      {...rest}
    />
  );
}
