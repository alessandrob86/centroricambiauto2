import React from "react";
import { Card } from "../components/ds/Card.jsx";
import { Badge } from "../components/ds/Badge.jsx";
import { Icon } from "../components/Icon.jsx";
import { Container, Reveal } from "../components/shared.jsx";

const SERVICES = [
  { id: "srv-auto", icon: "car", title: "Ricambi auto", desc: "L'assortimento più ampio per ogni marca e modello, microcar comprese.", tag: null },
  { id: "srv-moto", icon: "bike", title: "Ricambi moto", desc: "Componentistica e consumabili per le due ruote, sempre disponibili.", tag: null },
  { id: "srv-noleggio", icon: "wrench", title: "Noleggio messa in fase", desc: "Strumenti professionali per le officine, quando e dove ti servono.", tag: null },
  { id: "srv-cortesia", icon: "key-round", title: "Auto di cortesia", desc: "La mobilità dei tuoi clienti garantita durante ogni intervento.", tag: null },
  { id: "srv-elettrica", icon: "plug-zap", title: "Divisione elettrica", desc: "Una divisione dedicata ai ricambi per auto elettriche.", tag: "In arrivo" },
  { id: "srv-centralino", icon: "headset", title: "Centralino dedicato", desc: "Oltre 2.000 conversazioni gestite al mese, risposta in meno di 10 minuti.", tag: null },
];

export function Services() {
  return (
    <section id="servizi" style={{ background: "var(--surface-page)", padding: "var(--space-11) 0" }}>
      <Container>
        <Reveal>
          <div style={{ maxWidth: "640px", marginBottom: "var(--space-8)" }}>
            <h2 className="cra-h1" style={{ margin: 0 }}>Cosa facciamo</h2>
            <p className="cra-lead" style={{ marginTop: "var(--space-4)" }}>
              Dai ricambi auto e moto ai servizi pensati per le autofficine: un partner unico,
              serio e attento alle tue esigenze.
            </p>
          </div>
        </Reveal>
        <div className="grid-services" style={{ display: "grid", gap: "var(--space-5)" }}>
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={(i % 3) * 110}>
              <div id={s.id} style={{ scrollMarginTop: "120px", height: "100%" }}>
                <ServiceCard {...s} />
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

function ServiceCard({ icon, title, desc, tag }) {
  const [hover, setHover] = React.useState(false);
  const tiltRef = React.useRef(null);

  /* Tilt 3D sobrio: la card si inclina seguendo il cursore (max ~5°). */
  const onTilt = (e) => {
    const el = tiltRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-4px)`;
  };
  const resetTilt = () => { if (tiltRef.current) tiltRef.current.style.transform = "none"; };

  return (
    <div ref={tiltRef}
      onMouseMove={onTilt}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); resetTilt(); }}
      style={{ height: "100%", transition: "transform 180ms var(--ease-out)", willChange: "transform" }}>
    <Card
      elevation={hover ? "lg" : "sm"}
      style={{
        transition: "box-shadow var(--dur-base) var(--ease-standard)",
        cursor: "default",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "52px", height: "52px", borderRadius: "var(--radius-sm)",
          background: "var(--char-900)", color: "var(--cra-gold)",
          transform: hover ? "rotate(-8deg) scale(1.06)" : "none",
          transition: "transform var(--dur-slow) var(--ease-out)",
        }}>
          <Icon name={icon} size={24} color="var(--cra-gold)" />
        </span>
        {tag && <Badge tone="red" variant="solid">{tag}</Badge>}
      </div>
      <h3 className="cra-h3" style={{ margin: 0 }}>{title}</h3>
      <p className="cra-body" style={{ marginTop: "var(--space-2)", marginBottom: 0 }}>{desc}</p>
    </Card>
    </div>
  );
}

/* "Solo grandi marchi" — marquee continuo. Lista completa dei marchi trattati
   (fornita dall'azienda, giugno 2026). I wordmark testuali verranno sostituiti
   dai loghi ufficiali man mano che sono disponibili in assets/brands/. */
const BRANDS = [
  "L2F", "BOSCH", "XENERGY", "VALEO", "LuK", "SACHS", "BREMBO", "TRW", "KÜHNER",
  "INA", "LIQUI MOLY", "JAPANPARTS", "VARTA", "PURFLUX", "NGK", "MANN-FILTER",
  "EXIDE", "FEBI", "GATES", "UNIGOM", "AKRON MALÒ", "OCAP", "GRAF", "SALERI",
  "CONTITECH", "MOOG", "MEAT & DORIA", "BLUE PRINT", "MONROE", "DENSO", "UFI",
  "JRONE", "KYB", "DAYCO", "ELRING", "FASANO", "OSRAM", "PHILIPS", "ECOTECHNICS",
  "METELLI", "PIERBURG", "WIX FILTERS", "CASTROL", "FAG", "MIRAGLIO", "CORTECO",
  "FAI", "VICTOR REINZ", "REPSOL", "GSP", "ASSO MARMITTE", "MTS", "IMASAF",
  "SNR", "KRIOS", "CTR", "SELENIA", "WYNN'S", "BERU", "TEXTAR", "LPR",
  "ERRECOM", "YUASA",
];
export function Brands() {
  return (
    <section style={{ background: "var(--surface-subtle)", padding: "var(--space-8) 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
      <Container>
        <div style={{ textAlign: "center", marginBottom: "var(--space-5)" }}>
          <span className="cra-meta">Solo grandi marchi — i principali brand dell&rsquo;aftermarket</span>
        </div>
      </Container>
      <div className="brand-marquee">
        <div className="brand-track">
          {[...BRANDS, ...BRANDS].map((b, i) => (
            <span key={b + i} style={{
              fontFamily: "var(--font-brand)", fontWeight: "var(--fw-extrabold)", fontSize: "var(--fs-md)",
              letterSpacing: "0.06em", color: "var(--char-500)", background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "10px 18px",
              marginRight: "14px", whiteSpace: "nowrap",
            }}>{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
