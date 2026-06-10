import React from "react";
import { Button } from "../components/ds/Button.jsx";
import { StatBlock } from "../components/ds/StatBlock.jsx";
import { Icon } from "../components/Icon.jsx";
import { Container, Eyebrow, Reveal } from "../components/shared.jsx";
import sfondo2 from "../assets/backgrounds/cra-sfondo-2.png";
import fotoNapoli from "../assets/photos/sede-napoli-vetrina.jpg";
import fotoBrandWall from "../assets/photos/collecchio-brand-wall.png";
import fotoBanco from "../assets/photos/collecchio-banco.png";
import fotoThule from "../assets/photos/collecchio-thule.png";
import fotoBanco2 from "../assets/photos/collecchio-banco-2.png";

const { useState, useEffect, useRef, useCallback } = React;

/* —— Slider foto sedi —— */
function SedeSlider({ slides, height = 440 }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const go = useCallback((d) => setI((p) => (p + d + n) % n), [n]);
  const to = useCallback((k) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => setI((p) => (p + 1) % n), 4200);
    return () => clearInterval(id);
  }, [paused, n]);

  const touch = useRef(null);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
      style={{ position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-lg)", background: "var(--char-900)", userSelect: "none" }}>
      {/* track */}
      <div style={{ display: "flex", height: height + "px", transform: `translateX(-${i * 100}%)`, transition: "transform 520ms cubic-bezier(0.22,0.61,0.36,1)" }}>
        {slides.map((s, k) => (
          <div key={k} style={{ flex: "0 0 100%", position: "relative", overflow: "hidden" }}>
            <img src={s.src} alt={s.cap} decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(20,23,22,0.82) 0%, rgba(20,23,22,0.10) 38%, rgba(20,23,22,0) 60%)" }}></div>
            <div style={{ position: "absolute", left: "var(--space-5)", right: "var(--space-5)", bottom: "var(--space-5)" }}>
              {s.tag && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--cra-red)", color: "#fff", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: "var(--radius-pill, 999px)", marginBottom: "var(--space-3)" }}>
                  <Icon name="map-pin" size={12} color="#fff" /> {s.tag}
                </span>
              )}
              <div style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-extrabold)", fontSize: "var(--fs-lg)", color: "#fff", lineHeight: 1.15 }}>{s.cap}</div>
            </div>
          </div>
        ))}
      </div>

      {/* arrows */}
      {[["chevron-left", -1, "left"], ["chevron-right", 1, "right"]].map(([ic, d, side]) => (
        <button key={side} aria-label={d < 0 ? "Foto precedente" : "Foto successiva"} onClick={() => go(d)} style={{
          position: "absolute", top: "50%", [side]: "var(--space-4)", transform: "translateY(-50%)",
          width: "42px", height: "42px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(20,23,22,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "background var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--cra-red)"; e.currentTarget.style.borderColor = "var(--cra-red)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(20,23,22,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}>
          <Icon name={ic} size={20} color="#fff" />
        </button>
      ))}

      {/* counter */}
      <div style={{ position: "absolute", top: "var(--space-4)", right: "var(--space-4)", background: "rgba(20,23,22,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "#fff", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)", letterSpacing: "0.06em", padding: "5px 11px", borderRadius: "var(--radius-pill, 999px)" }}>
        <span style={{ color: "var(--cra-gold)" }}>{String(i + 1).padStart(2, "0")}</span> / {String(n).padStart(2, "0")}
      </div>

      {/* dots */}
      <div style={{ position: "absolute", bottom: "var(--space-4)", right: "var(--space-5)", display: "flex", gap: "7px" }}>
        {slides.map((_, k) => (
          <button key={k} aria-label={`Vai alla foto ${k + 1}`} onClick={() => to(k)} style={{
            width: k === i ? "22px" : "8px", height: "8px", borderRadius: "999px", border: "none", padding: 0, cursor: "pointer",
            background: k === i ? "var(--cra-gold)" : "rgba(255,255,255,0.45)",
            transition: "width var(--dur-base) var(--ease-standard), background var(--dur-base) var(--ease-standard)",
          }}></button>
        ))}
      </div>
    </div>
  );
}

export function About({ onNavigate }) {
  const valori = [
    { icon: "package-search", t: "Assortimento", d: "65.000 prodotti codificati per auto, microcar e moto — solo dai grandi marchi dell'aftermarket." },
    { icon: "timer", t: "Velocità", d: "Centralino sempre pronto, preventivi chiari e spedizioni in giornata. Risposta in meno di 10 minuti." },
    { icon: "handshake", t: "Relazione", d: "Non clienti, ma partner. Conosciamo officine e carrozzerie una per una e cresciamo insieme a loro." },
    { icon: "shield-check", t: "Affidabilità", d: "Ricambi giusti, al primo colpo. Un magazzino vero e persone che conoscono il mestiere." },
  ];
  const tappe = [
    { y: "1992", t: "Nasce a Napoli", d: "Apre il primo punto vendita: pochi metri quadri, una promessa semplice — il ricambio giusto, subito." },
    { y: "2005", t: "Cresce la rete", d: "Nuove sedi e un magazzino sempre più ampio al servizio delle officine del territorio." },
    { y: "2018", t: "Verso il Nord", d: "L'espansione raggiunge l'Emilia-Romagna: Collecchio e Fiorenzuola d'Arda." },
    { y: "2026", t: "5 sedi attive", d: "Con la nuova sede di Rozzano (MI) copriamo l'Italia da Milano a Napoli." },
  ];

  return (
    <React.Fragment>
      {/* —— Intestazione —— */}
      <section style={{ background: "var(--surface-dark)", color: "var(--cra-white)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `url('${sfondo2}') center / cover no-repeat`, opacity: 0.16, pointerEvents: "none", maskImage: "linear-gradient(90deg, rgba(0,0,0,0.2), #000)", WebkitMaskImage: "linear-gradient(90deg, rgba(0,0,0,0.2), #000)" }}></div>
        <Container style={{ position: "relative", padding: "var(--space-11) 0 var(--space-10)" }}>
          <div style={{ maxWidth: "720px" }}>
            <Eyebrow onDark>Chi siamo</Eyebrow>
            <h1 className="cra-display" style={{ color: "var(--cra-white)", fontSize: "var(--fs-5xl)", margin: 0 }}>
              Da oltre 30 anni<br /><span style={{ color: "var(--cra-gold)" }}>al tuo fianco</span>
            </h1>
            <p className="cra-lead" style={{ color: "var(--char-200)", maxWidth: "56ch", marginTop: "var(--space-5)" }}>
              Centro Ricambi Auto è un distributore italiano di ricambi per l&rsquo;automotive. Lavoriamo ogni giorno
              con officine, carrozzerie e meccanici professionisti, mettendo a disposizione un assortimento enorme,
              tempi di consegna rapidi e un rapporto diretto e leale. Insieme a te con i fatti, non a parole.
            </p>
          </div>
        </Container>
      </section>

      {/* —— Storia + slider —— */}
      <section style={{ background: "var(--surface-page)", padding: "var(--space-11) 0" }}>
        <Container>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "var(--space-9)", alignItems: "center" }}>
            <Reveal>
              <Eyebrow>La nostra storia</Eyebrow>
              <h2 className="cra-h2" style={{ margin: 0 }}>Nati a Napoli, cresciuti in tutta Italia</h2>
              <p className="cra-body" style={{ marginTop: "var(--space-4)", color: "var(--text-body)" }}>
                Abbiamo iniziato più di trent&rsquo;anni fa con un&rsquo;idea precisa: dare a chi ripara i veicoli il
                ricambio giusto nel minor tempo possibile. Da quel primo punto vendita siamo diventati un punto di
                riferimento dell&rsquo;aftermarket, senza mai cambiare il modo di lavorare.
              </p>
              <p className="cra-body" style={{ marginTop: "var(--space-3)", color: "var(--text-body)" }}>
                Oggi serviamo migliaia di professionisti da cinque sedi tra Lombardia, Emilia-Romagna e Campania, con
                un magazzino di oltre 4.500 m² e centinaia di ordini evasi ogni giorno. La crescita non ci ha resi
                distanti: restiamo l&rsquo;interlocutore che conosce il tuo nome.
              </p>
              <div style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
                <Button variant="primary" onClick={() => onNavigate("contatti")}>Richiedi un preventivo</Button>
                <Button variant="secondary" onClick={() => onNavigate("sedi")}>Dove siamo</Button>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <SedeSlider height={440} slides={[
                { src: fotoNapoli, cap: "La vetrina storica di Napoli", tag: "Napoli" },
                { src: fotoBrandWall, cap: "I grandi marchi dell’aftermarket, a scaffale", tag: "Nuova sede · Collecchio (PR)" },
                { src: fotoBanco, cap: "Il banco vendita, sempre pronto a risponderti", tag: "Collecchio (PR)" },
                { src: fotoThule, cap: "Accessori e box da tetto Thule", tag: "Collecchio (PR)" },
                { src: fotoBanco2, cap: "Olii e lubrificanti delle migliori marche", tag: "Collecchio (PR)" },
              ]} />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* —— I numeri —— */}
      <section style={{ background: "var(--surface-dark)", color: "var(--cra-white)", padding: "var(--space-10) 0" }}>
        <Container>
          <Reveal>
            <Eyebrow onDark>I nostri numeri</Eyebrow>
            <h2 className="cra-display" style={{ color: "var(--cra-white)", fontSize: "var(--fs-3xl)", margin: "0 0 var(--space-7)" }}>
              Insieme a te <span style={{ color: "var(--cra-gold)" }}>con i fatti</span>
            </h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-5)" }}>
            {[
              { v: "65.000", l: "Prodotti codificati", tone: "gold" },
              { v: "4.500", u: "m²", l: "Di magazzino", tone: "red" },
              { v: "3.000", l: "Clienti serviti", tone: "gold" },
              { v: "450", u: "/ giorno", l: "Ordini evasi", tone: "red" },
            ].map((s) => (
              <Reveal key={s.l}>
                <StatBlock value={s.v} unit={s.u} label={s.l} tone={s.tone} onDark />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* —— Valori —— */}
      <section style={{ background: "var(--surface-page)", padding: "var(--space-11) 0" }}>
        <Container>
          <Reveal>
            <Eyebrow>Cosa ci muove</Eyebrow>
            <h2 className="cra-h2" style={{ margin: "0 0 var(--space-7)" }}>Quattro principi, ogni giorno</h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-5)" }}>
            {valori.map((v, i) => (
              <Reveal key={v.t} delay={i * 80}>
                <div style={{ display: "flex", gap: "var(--space-4)", background: "var(--cra-white)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--space-6)", boxShadow: "var(--shadow-sm)", height: "100%" }}>
                  <span style={{ flexShrink: 0, width: "48px", height: "48px", borderRadius: "var(--radius-sm)", background: "var(--char-900)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={v.icon} size={22} color="var(--cra-gold)" />
                  </span>
                  <div>
                    <h3 style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-extrabold)", fontSize: "var(--fs-lg)", textTransform: "uppercase", letterSpacing: "0.02em", margin: 0, color: "var(--text-strong)" }}>{v.t}</h3>
                    <p className="cra-body" style={{ margin: "var(--space-2) 0 0", color: "var(--text-muted)" }}>{v.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* —— Timeline —— */}
      <section style={{ background: "var(--surface-subtle)", padding: "var(--space-11) 0" }}>
        <Container>
          <Reveal>
            <Eyebrow>Il percorso</Eyebrow>
            <h2 className="cra-h2" style={{ margin: "0 0 var(--space-8)" }}>Le tappe che ci hanno portato qui</h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-5)" }}>
            {tappe.map((t, i) => (
              <Reveal key={t.y} delay={i * 80}>
                <div style={{ borderTop: "3px solid var(--cra-gold)", paddingTop: "var(--space-4)" }}>
                  <div style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-2xl)", color: "var(--cra-red)", lineHeight: 1 }}>{t.y}</div>
                  <h3 style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-md)", textTransform: "uppercase", letterSpacing: "0.02em", margin: "var(--space-3) 0 var(--space-2)", color: "var(--text-strong)" }}>{t.t}</h3>
                  <p className="cra-body" style={{ margin: 0, color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>{t.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* —— CTA finale —— */}
      <section style={{ background: "var(--cra-red)", padding: "var(--space-10) 0" }}>
        <Container style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-6)", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)", letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "rgba(255,255,255,0.8)" }}>#AndiamoInsiemeOltre</div>
            <h2 className="cra-display" style={{ color: "var(--cra-white)", fontSize: "var(--fs-3xl)", margin: "var(--space-2) 0 0" }}>Mettici alla prova</h2>
          </div>
          <Button variant="primary" size="lg" onClick={() => onNavigate("contatti")}
            style={{ background: "var(--cra-white)", color: "var(--cra-red)" }}>Richiedi un preventivo</Button>
        </Container>
      </section>
    </React.Fragment>
  );
}
