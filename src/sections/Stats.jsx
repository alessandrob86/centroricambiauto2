import React from "react";
import { Icon } from "../components/Icon.jsx";
import { craMark } from "../components/ds/Logo.jsx";
import { Container, Eyebrow, Reveal, CountUp } from "../components/shared.jsx";
import sfondo2 from "../assets/backgrounds/cra-sfondo-2.png";

/* Featured trio — huge figures with draw-in keylines */
const FEATURED = [
  { value: "65.000", label: "Prodotti codificati", color: "var(--cra-gold)" },
  { value: "4.500", unit: "MQ", label: "Di magazzino", color: "var(--cra-white)" },
  { value: "<10", unit: "MIN", label: "Tempi di risposta", color: "var(--red-400)" },
];

/* Secondary strip — machined panel with hairline dividers */
const SECONDARY = [
  { icon: "users", value: "3.000", label: "Clienti totali" },
  { icon: "heart-handshake", value: "600", label: "Clienti fidelizzati" },
  { icon: "file-text", value: "700", unit: "/ giorno", label: "Preventivi" },
  { icon: "package-check", value: "450", unit: "/ giorno", label: "Ordini evasi" },
  { icon: "phone-call", value: "1.500", unit: "/ mese", label: "Conversazioni gestite" },
];

export function StatsBand() {
  const sectionRef = React.useRef(null);
  const gearRef = React.useRef(null);
  const [inView, setInView] = React.useState(false);

  /* Drive the keyline draw-ins; bail visible in hidden documents. */
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState === "hidden") { setInView(true); return; }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold: 0.2 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  /* Gear watermark turns with scroll — same mechanism as the hero. */
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        if (gearRef.current) gearRef.current.style.transform = `rotate(${window.scrollY * -0.06}deg)`;
        raf = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <section ref={sectionRef} style={{ background: "var(--surface-darker)", color: "var(--cra-white)", position: "relative", overflow: "hidden" }}>
      {/* signature keyline across the top */}
      <div style={{ height: "4px", background: "var(--keyline)", position: "relative", zIndex: 1 }} />
      {/* sfondo: scie luminose notturne (cra-sfondo-2), tenute scure per leggibilità */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `url('${sfondo2}') center / cover no-repeat`, opacity: 0.22, pointerEvents: "none", maskImage: "linear-gradient(90deg, rgba(0,0,0,0.35), #000)", WebkitMaskImage: "linear-gradient(90deg, rgba(0,0,0,0.35), #000)" }}></div>
      {/* slow-turning gear watermark */}
      <img ref={gearRef} src={craMark} alt="" aria-hidden="true" style={{
        position: "absolute", left: "-160px", bottom: "-160px", width: "480px", opacity: 0.045,
        filter: "grayscale(1) brightness(3)", pointerEvents: "none", willChange: "transform",
      }} />
      <Container style={{ position: "relative", padding: "var(--space-10) var(--space-5) var(--space-11)" }}>
        {/* header row: title left, motto right */}
        <Reveal>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)", marginBottom: "var(--space-9)" }}>
            <div>
              <Eyebrow onDark>I nostri numeri</Eyebrow>
              <h2 className="cra-h1" style={{ color: "var(--cra-white)", margin: 0 }}>Insieme a te con i fatti</h2>
            </div>
            <span style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-lg)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--cra-gold)", opacity: 0.9 }}>
              #Andiamo<span style={{ color: "var(--cra-white)" }}>Insieme</span>Oltre
            </span>
          </div>
        </Reveal>

        {/* featured trio */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-8)", marginBottom: "var(--space-10)" }}>
          {FEATURED.map((f, i) => (
            <Reveal key={f.label} delay={i * 140}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-4xl)", lineHeight: 1, letterSpacing: "var(--ls-tight)", color: f.color }}>
                  <CountUp value={f.value} duration={1700} />
                  {f.unit && <span style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", color: "var(--char-400)" }}>{f.unit}</span>}
                </div>
                {/* keyline draws in under the figure */}
                <div style={{ height: "5px", background: "var(--keyline)", borderRadius: "999px", margin: "var(--space-4) 0 var(--space-3)", transform: inView ? "scaleX(1)" : "scaleX(0)", transformOrigin: "left", transition: `transform 900ms var(--ease-out) ${300 + i * 180}ms` }} />
                <div style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-sm)", textTransform: "uppercase", letterSpacing: "var(--ls-eyebrow)", color: "var(--char-300)" }}>
                  {f.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* machined secondary strip */}
        <Reveal delay={250}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", border: "1px solid var(--char-700)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "rgba(255,255,255,0.02)" }}>
            {SECONDARY.map((s, i) => <StatCell key={s.label} s={s} first={i === 0} />)}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function StatCell({ s, first }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "var(--space-5) var(--space-5) var(--space-4)",
        borderLeft: first ? "none" : "1px solid var(--char-700)",
        background: hover ? "rgba(253,197,67,0.05)" : "transparent",
        boxShadow: hover ? "inset 0 3px 0 var(--cra-gold)" : "inset 0 3px 0 transparent",
        transition: "background var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)",
        display: "flex", flexDirection: "column", gap: "var(--space-3)",
      }}
    >
      <span style={{ display: "inline-flex", color: hover ? "var(--cra-gold)" : "var(--char-400)", transition: "color var(--dur-base) var(--ease-standard)" }}>
        <Icon name={s.icon} size={20} color={hover ? "var(--cra-gold)" : "var(--char-400)"} />
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "6px", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-xl)", lineHeight: 1, color: "var(--cra-white)" }}>
        <CountUp value={s.value} duration={1300} />
        {s.unit && <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-bold)", whiteSpace: "nowrap", color: "var(--char-400)", letterSpacing: "0.04em" }}>{s.unit}</span>}
      </div>
      <div style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "var(--ls-eyebrow)", color: "var(--char-400)" }}>
        {s.label}
      </div>
    </div>
  );
}

const STRENGTHS = [
  { icon: "phone-call", title: "Centralino sempre pronto", desc: "Rispondiamo a ogni richiesta, con oltre 10.000 conversazioni processate al mese." },
  { icon: "receipt-text", title: "Preventivi chiari", desc: "Assoluta chiarezza dei prezzi: nessuna sorpresa, solo trasparenza." },
  { icon: "truck", title: "Spedizioni affidabili", desc: "Consegne precise e puntuali, perché il tuo tempo in officina vale." },
];

export function Strengths() {
  return (
    <section style={{ background: "var(--surface-page)", padding: "var(--space-11) 0" }}>
      <Container>
        <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "var(--space-9)", alignItems: "center" }}>
          <Reveal>
            <div>
              <Eyebrow>I nostri punti di forza</Eyebrow>
              <h2 className="cra-h1" style={{ margin: 0 }}>Un partner serio, ogni giorno</h2>
              <p className="cra-lead" style={{ marginTop: "var(--space-4)" }}>
                Ogni giorno Centro Ricambi Auto è insieme a te con i fatti, non a parole.
                Andiamo insieme oltre, sempre.
              </p>
            </div>
          </Reveal>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {STRENGTHS.map((s, i) => (
              <Reveal key={s.title} delay={i * 130}>
                <div style={{
                  display: "flex", gap: "var(--space-4)", alignItems: "flex-start",
                  background: "var(--surface-card)", border: "1px solid var(--border-subtle)",
                  borderLeft: "var(--border-w-bold) solid var(--cra-red)",
                  borderRadius: "var(--radius-sm)", padding: "var(--space-4) var(--space-5)",
                }}>
                  <span style={{ display: "inline-flex", color: "var(--cra-red)", marginTop: "2px" }}>
                    <Icon name={s.icon} size={24} color="var(--cra-red)" />
                  </span>
                  <div>
                    <h3 className="cra-h3" style={{ margin: 0, fontSize: "var(--fs-lg)" }}>{s.title}</h3>
                    <p className="cra-body" style={{ margin: "4px 0 0" }}>{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
