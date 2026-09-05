import React from "react";
import { Icon } from "./Icon.jsx";

/* Shared layout helpers for the Centro Ricambi Auto website */

/* Il portale ricambi con le sue credenziali. Vive qui perché lo citano sia
   l'intestazione sia il footer: un indirizzo scritto in due file è un
   indirizzo che prima o poi ne diventa due diversi. */
export const B2B_URL = "https://centroricambiautosrl.blusys.it/";

export function Container({ children, style = {} }) {
  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "0 var(--space-5)", ...style }}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, onDark = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "var(--space-3)" }}>
      <span style={{ width: "34px", height: "4px", background: "var(--keyline)", borderRadius: "999px" }} />
      <span style={{
        fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)",
        letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase",
        color: onDark ? "var(--cra-gold)" : "var(--cra-red)",
      }}>{children}</span>
    </div>
  );
}

/* Fade-up on scroll (IntersectionObserver). Respects prefers-reduced-motion. */
export function Reveal({ children, delay = 0, y = 28, style = {} }) {
  const ref = React.useRef(null);
  const [vis, setVis] = React.useState(false);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState === "hidden") { setVis(true); return; }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); obs.disconnect(); }
    }, { threshold: 0.12 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? "none" : `translateY(${y}px)`,
      transition: `opacity 650ms var(--ease-out) ${delay}ms, transform 650ms var(--ease-out) ${delay}ms`,
      ...style,
    }}>{children}</div>
  );
}

/* Count-up number (it-IT formatting), starts when scrolled into view. */
export function CountUp({ value, duration = 1400 }) {
  const ref = React.useRef(null);
  const [txt, setTxt] = React.useState("0");
  React.useEffect(() => {
    const m = String(value).match(/^([^0-9]*)([\d.]+)(.*)$/);
    if (!m) { setTxt(String(value)); return; }
    const prefix = m[1], suffix = m[3];
    const target = parseInt(m[2].replace(/\./g, ""), 10);
    const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState === "hidden") {
      setTxt(prefix + fmt(target) + suffix); return;
    }
    let raf, t0 = null;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const step = (t) => {
        if (t0 === null) t0 = t;
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setTxt(prefix + fmt(Math.round(target * eased)) + suffix);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [value, duration]);
  return <span ref={ref}>{txt}</span>;
}

/* Barra di avanzamento scroll — la keyline rosso→oro si riempie con lo scroll. */
export function ScrollProgress() {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    /* Aggiornamento sincrono nell'handler (niente rAF): è una singola
       assegnazione di stile e così funziona anche in documenti nascosti. */
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div aria-hidden="true" style={{ position: "fixed", top: 0, left: 0, right: 0, height: "3px", zIndex: 60, pointerEvents: "none" }}>
      <div ref={ref} style={{ height: "100%", background: "var(--keyline)", transform: "scaleX(0)", transformOrigin: "left" }} />
    </div>
  );
}

/* Bottone "torna su": appare dopo il primo scroll, fisso in basso a destra. */
export function BackToTop() {
  const [show, setShow] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button className="cra-su" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Torna all'inizio della pagina"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "fixed", right: "20px", bottom: "20px", zIndex: 90,
        width: "48px", height: "48px", borderRadius: "50%",
        border: "1px solid " + (hover ? "var(--cra-gold)" : "var(--char-700)"),
        background: hover ? "var(--cra-gold)" : "rgba(27,32,31,0.92)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
        boxShadow: "var(--shadow-lg)",
        opacity: show ? 1 : 0,
        transform: show ? "none" : "translateY(14px)",
        pointerEvents: show ? "auto" : "none",
        transition: "opacity var(--dur-slow) var(--ease-standard), transform var(--dur-slow) var(--ease-standard), background var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard)",
      }}>
      <Icon name="arrow-up" size={20} color={hover ? "var(--char-900)" : "var(--cra-gold)"} />
    </button>
  );
}

/* Effetto "magnetico": il contenuto segue leggermente il cursore. */
export function Magnetic({ children, strength = 0.22, style = {} }) {
  const ref = React.useRef(null);
  const inner = React.useRef(null);
  const onMove = (e) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!ref.current || !inner.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    inner.current.style.transform = `translate(${(dx * strength).toFixed(1)}px, ${(dy * strength).toFixed(1)}px)`;
  };
  const onLeave = () => { if (inner.current) inner.current.style.transform = "translate(0px, 0px)"; };
  return (
    <span ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{ display: "inline-block", padding: "6px", margin: "-6px", ...style }}>
      <span ref={inner} style={{ display: "inline-block", transition: "transform 260ms var(--ease-out)", willChange: "transform" }}>{children}</span>
    </span>
  );
}

/* Scenic chrome-border CTA — rotating metallic sheen.
   Con `href` è un link (target _blank, es. catalogo blusys); con `onClick`
   e senza href diventa un <button> per azioni interne (login, menu Ecom). */
export function ChromeButton({ href, onClick, children, size = "md", style = {}, ...rest }) {
  const pads = { sm: "10px 18px", md: "13px 26px", lg: "17px 34px" };
  const fs = { sm: "var(--fs-xs)", md: "var(--fs-sm)", lg: "var(--fs-base)" };
  const [hover, setHover] = React.useState(false);
  const visual = {
    textDecoration: "none", display: "inline-block",
    boxShadow: hover ? "0 0 26px rgba(253,197,67,0.38)" : "0 0 0 rgba(0,0,0,0)",
    transform: hover ? "translateY(-1px)" : "none",
    transition: "box-shadow var(--dur-slow) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)",
    ...style,
  };
  const inner = (
    <span className="chrome-btn-inner" style={{ padding: pads[size], fontSize: fs[size], gap: "10px" }}>
      {children}
    </span>
  );
  if (!href) {
    return (
      <button type="button" onClick={onClick} className="chrome-btn"
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ ...visual, background: "none", border: "none", cursor: "pointer", padding: "2px" }}
        {...rest}>
        {inner}
      </button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="chrome-btn"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={visual} {...rest}>
      {inner}
    </a>
  );
}
