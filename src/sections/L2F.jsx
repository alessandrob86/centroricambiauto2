import React from "react";
import { Container, Eyebrow, Reveal } from "../components/shared.jsx";
import { Icon } from "../components/Icon.jsx";
import l2fLogo from "../assets/brands/l2f.webp";
import officinaBg from "../assets/photos/l2f-officina.webp";

/* Fascia "Il nostro marchio" — presenta L2F (linea ricambi premium di Centro
   Ricambi Auto) prima delle sedi. Sfondo = foto officina L2F (la stessa della
   pagina Servizi del sito L2F) con Ken Burns lento; scrim scuro pesato a
   sinistra così il testo resta leggibile mentre il meccanico resta visibile a
   destra. Logo in un badge bianco (il wordmark "PARTS" è grigio e sparirebbe
   sul fondo scuro). CTA rossa col brand L2F. */
const POINTS = [
  { icon: "check", text: "Ricambi a marchio L2F selezionati per l'aftermarket" },
  { icon: "headset", text: "Formazione dedicata con L2F Academy" },
  { icon: "handshake", text: "Area riservata con prezzi e vantaggi per le officine partner" },
];

function L2FCta({ href, children }) {
  const [hover, setHover] = React.useState(false);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "10px",
        background: "linear-gradient(180deg, #d62b2f, #b21d22)", color: "var(--cra-white)",
        textDecoration: "none", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)",
        textTransform: "uppercase", letterSpacing: "var(--ls-caps)", fontSize: "var(--fs-sm)",
        padding: "15px 30px", borderRadius: "var(--radius-sm)",
        boxShadow: hover ? "0 12px 38px rgba(214,43,47,0.55)" : "0 6px 20px rgba(214,43,47,0.30)",
        transform: hover ? "translateY(-2px)" : "none",
        transition: "box-shadow var(--dur-slow) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)",
      }}>
      {children}
    </a>
  );
}

export function L2FBrand() {
  return (
    <section className="l2f-band">
      <div className="l2f-band-bg" style={{ backgroundImage: `url(${officinaBg})` }} aria-hidden="true" />
      <div className="l2f-band-scrim" aria-hidden="true" />
      <Container style={{ position: "relative", zIndex: 2 }}>
        <Reveal>
          <div className="l2f-band-content">
            {/* logo trasparente: argento + rosso si leggono sul fondo scuro;
                drop-shadow per staccarlo dalle zone più chiare della foto */}
            <img src={l2fLogo} alt="L2F Parts — la linea ricambi premium di Centro Ricambi Auto"
              style={{ height: "52px", width: "auto", display: "block", marginBottom: "var(--space-5)", filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.6))" }} />

            <Eyebrow onDark>Il nostro marchio</Eyebrow>
            <h2 className="cra-h1" style={{ color: "var(--cra-white)", margin: "0 0 var(--space-4)" }}>
              L2F — la linea premium per la tua officina
            </h2>
            <p className="cra-lead" style={{ color: "var(--char-100)", marginTop: 0, maxWidth: "44ch" }}>
              L2F è la linea ricambi a marchio di Centro Ricambi Auto: un programma pensato per le
              officine partner, con prodotti selezionati, formazione e servizi dedicati a chi lavora
              ogni giorno.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", margin: "var(--space-6) 0" }}>
              {POINTS.map((p) => (
                <div key={p.text} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "var(--radius-pill)", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--cra-gold)", flex: "none" }}>
                    <Icon name={p.icon} size={16} color="var(--cra-gold)" />
                  </span>
                  <span style={{ fontSize: "var(--fs-md)", color: "var(--cra-white)", fontWeight: "var(--fw-semibold)" }}>{p.text}</span>
                </div>
              ))}
            </div>
            <L2FCta href="https://www.l2f.it">
              Scopri L2F <Icon name="arrow-right" size={18} color="var(--cra-white)" />
            </L2FCta>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
