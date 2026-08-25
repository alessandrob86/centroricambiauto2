import React from "react";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import { Container } from "../components/shared.jsx";
import { Button } from "../components/ds/Button.jsx";
import { Icon } from "../components/Icon.jsx";
import { useAuth } from "../lib/auth.jsx";
import { useCart } from "../lib/cart.jsx";
import {
  getCatalog, buildTree, matchProduct, formatEuro, unitaLabel, prezzoVisibile, ivaNota, PLACEHOLDER_IMG,
  adesso, tagliaEffettiva, statoOfferta, MAX_HERO, MAX_GRANDE,
} from "../lib/craCatalog.js";
import { submitOrder } from "../lib/craOrders.js";
import { tracciaCarrello, tracciaRicerca } from "../lib/traccia.js";

const { useEffect, useState, useMemo, useCallback } = React;

/* Curva "ease-out-expo": decelerazione decisa e meccanica, niente rimbalzi. */
const EASE = [0.16, 1, 0.3, 1];

/* ---------- un solo orologio per tutta la pagina ----------
   Con 40 offerte a video servono 1 timer e 40 letture, non 40 timer. E se la
   scheda del browser è in secondo piano non si lavora affatto. */
const iscrittiTick = new Set();
let handleTick = null;
function tick() {
  if (typeof document !== "undefined" && document.hidden) return;
  for (const f of iscrittiTick) f();
}
function iscriviTick(fn) {
  iscrittiTick.add(fn);
  if (!handleTick) handleTick = setInterval(tick, 1000);
  return () => {
    iscrittiTick.delete(fn);
    if (!iscrittiTick.size) { clearInterval(handleTick); handleTick = null; }
  };
}

/** Una cifra in un cassetto: quando cambia, la vecchia scorre via verso l'alto
 *  e la nuova entra dal basso. È il gesto di un tabellone meccanico — lo stesso
 *  linguaggio "elegante e meccanico" del resto dello store. */
function Cifra({ valore, ridotto }) {
  return (
    <span className="store-timer-cassetto">
      {/* Le due cifre convivono per un attimo, sovrapposte: sono entrambe in
          posizione assoluta, quindi nessun ricalcolo di layout. */}
      <AnimatePresence initial={false}>
        <motion.span
          key={valore}
          className="store-timer-cifra"
          initial={ridotto ? false : { y: "-100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={ridotto ? { opacity: 0 } : { y: "100%", opacity: 0 }}
          transition={{ duration: 0.32, ease: EASE }}>
          {valore}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Gruppo di due cifre con la sua etichetta (GIORNI / ORE / MIN / SEC). */
function Gruppo({ n, eti, ridotto }) {
  const [d, u] = String(n).padStart(2, "0");
  return (
    <span className="store-timer-gruppo">
      <span className="store-timer-cifre">
        <Cifra valore={d} ridotto={ridotto} />
        <Cifra valore={u} ridotto={ridotto} />
      </span>
      <span className="store-timer-eti">{eti}</span>
    </span>
  );
}

/** Conto alla rovescia. Tiene il proprio stato: quando batte si ridisegna solo
 *  lui, non tutto il catalogo. Le unità mostrate cambiano con la distanza,
 *  perché "00:00:00 per 6 giorni" è illeggibile. */
function Countdown({ fine, onScaduto, id }) {
  const ridotto = useReducedMotion();
  const [resta, setResta] = useState(() => fine - adesso());
  useEffect(() => {
    setResta(fine - adesso());
    return iscriviTick(() => setResta(fine - adesso()));
  }, [fine]);
  useEffect(() => {
    if (resta <= 0 && onScaduto) onScaduto(id);
  }, [resta <= 0, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (resta <= 0) return <span className="store-timer">Offerta conclusa</span>;

  const sec = Math.floor(resta / 1000);
  const g = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  // Oltre le 24 ore i secondi non dicono nulla: meglio giorni, ore e minuti.
  const gruppi = sec >= 86400
    ? [{ n: g, eti: g === 1 ? "giorno" : "giorni" }, { n: h, eti: "ore" }, { n: m, eti: "min" }]
    : [{ n: h, eti: "ore" }, { n: m, eti: "min" }, { n: s, eti: "sec" }];

  return (
    <span className="store-timer" aria-hidden="true">
      {gruppi.map((gr, i) => (
        <React.Fragment key={gr.eti}>
          {i > 0 && <span className="store-timer-sep">:</span>}
          <Gruppo n={gr.n} eti={gr.eti} ridotto={ridotto} />
        </React.Fragment>
      ))}
    </span>
  );
}

/** Quanto resta della finestra, da 1 a 0. Serve alla barra che si svuota. */
function frazioneResidua(inizio, fine, ora) {
  if (!inizio) return null;
  const tot = fine - inizio;
  if (!(tot > 0)) return null;
  return Math.max(0, Math.min(1, (fine - ora) / tot));
}

/** Nastro dell'offerta: primo figlio dell'articolo, mai dentro il bottone
 *  (sarebbe un bottone dentro un bottone) né dentro il riquadro foto (che ha
 *  overflow:hidden e lo taglierebbe). */
export function NastroOfferta({ offerta, prodottoId, onScaduto, isoFine, isoInizio }) {
  if (!offerta) return null;
  const urgente = !offerta.conclusa && offerta.fine - adesso() <= 2 * 3600e3;
  const classe = offerta.conclusa ? "store-nastro store-nastro--conclusa"
    : urgente ? "store-nastro store-nastro--urgente" : "store-nastro";
  const frazione = offerta.conclusa
    ? 0
    : frazioneResidua(isoInizio ? Date.parse(isoInizio) : null, offerta.fine, adesso());
  return (
    <div className={classe}>
      <span className="store-nastro-eyebrow">
        {offerta.conclusa ? "Offerta conclusa" : urgente ? "Ultime ore" : offerta.etichetta}
      </span>
      {!offerta.conclusa && <Countdown fine={offerta.fine} onScaduto={onScaduto} id={prodottoId} />}
      {frazione != null && (
        <span className="store-nastro-barra"><i style={{ width: `${frazione * 100}%` }} /></span>
      )}
      {isoFine && (
        <time dateTime={isoFine}>
          Offerta valida fino al {new Date(isoFine).toLocaleString("it-IT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </time>
      )}
    </div>
  );
}

/* ---------- disposizione della vetrina ----------
   Niente algoritmo di impacchettamento: una quota fissa e un riordino in testa
   nell'ordine vetrina → grande → grande. Con questa regola l'assenza di buchi
   si verifica a tavolino per ogni numero di colonne, e l'ordine visivo resta
   uguale a quello del DOM (quindi anche a quello del TAB). */
function disponi(prodotti, attiva, scaduti, ora) {
  const base = prodotti.map((p) => ({ p, taglia: "normale" }));
  if (!attiva || prodotti.length < 12) return base;
  const hero = [], grandi = [], resto = [];
  for (const p of prodotti) {
    const t = scaduti.has(p.id) ? "normale" : tagliaEffettiva(p, ora);
    if ((t === "vetrina" || t === "vetrina_xl") && hero.length < MAX_HERO) hero.push({ p, taglia: t });
    else if (t === "grande" && grandi.length < MAX_GRANDE) grandi.push({ p, taglia: "grande" });
    else resto.push({ p, taglia: "normale" });
  }
  return [...hero, ...grandi, ...resto];
}

/* Animazione "fly to cart": una miniatura del prodotto vola dalla card al
   bottone Proposta in alto (id cra-cart-btn). Nessun drawer che si apre. */
function flyToCart(sourceEl, imgUrl) {
  const target = document.getElementById("cra-cart-btn");
  if (!sourceEl || !target) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const s = sourceEl.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const fly = document.createElement("div");
  fly.style.cssText =
    `position:fixed;left:${s.left + s.width / 2 - 24}px;top:${s.top + s.height / 2 - 24}px;` +
    `width:48px;height:48px;z-index:200;border-radius:6px;pointer-events:none;` +
    `background:#fff center/contain no-repeat;border:2px solid #272d2b;` +
    `box-shadow:0 10px 24px rgba(27,32,31,.3);` +
    `transition:transform .6s cubic-bezier(.2,.7,.3,1),opacity .6s ease;`;
  if (imgUrl) fly.style.backgroundImage = `url("${imgUrl}")`;
  document.body.appendChild(fly);
  const dx = (t.left + t.width / 2) - (s.left + s.width / 2);
  const dy = (t.top + t.height / 2) - (s.top + s.height / 2);
  requestAnimationFrame(() => {
    fly.style.transform = `translate(${dx}px, ${dy}px) scale(.2)`;
    fly.style.opacity = "0.25";
  });
  fly.addEventListener("transitionend", () => fly.remove(), { once: true });
}

/* ---------- testata scura del negozio (banda industriale) ---------- */
export function StoreHead({ subtitle, noCart = false, wide = false }) {
  const { count, open, ivaIncl, setIvaIncl } = useCart();
  const reduce = useReducedMotion();
  const rowStyle = { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "18px", flexWrap: "wrap" };
  const inner = (
    <React.Fragment>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
            <motion.span
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
              style={{ width: "34px", height: "4px", borderRadius: "999px", background: "var(--keyline)", transformOrigin: "left" }}
            />
            <span style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-2xs)", letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--cra-gold)" }}>
              Centro Ricambi Auto
            </span>
          </div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-3xl)", textTransform: "uppercase", lineHeight: 1.05 }}>
            CRA <span style={{ color: "var(--cra-gold)" }}>Store</span>
          </h1>
          {subtitle && <p style={{ margin: "8px 0 0", color: "var(--char-300)", fontSize: "var(--fs-sm)" }}>{subtitle}</p>}
          {!noCart && (
            <p style={{ margin: "10px 0 0", color: "var(--cra-gold)", fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)" }}>
              * Prezzi netti riservati alle officine — {ivaIncl ? "IVA 22% inclusa" : "IVA 22% esclusa, da aggiungere"}.
            </p>
          )}
        </motion.div>
        {!noCart && (
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <div role="group" aria-label="Visualizzazione prezzi" style={{ display: "inline-flex", border: "2px solid rgba(255,255,255,0.3)" }}>
            {[["Senza IVA", false], ["Con IVA", true]].map(([lab, val]) => (
              <button key={lab} onClick={() => setIvaIncl(val)} aria-pressed={ivaIncl === val}
                style={{
                  cursor: "pointer", padding: "9px 13px", border: "none",
                  fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-2xs)",
                  textTransform: "uppercase", letterSpacing: "var(--ls-caps)",
                  background: ivaIncl === val ? "var(--cra-gold)" : "transparent",
                  color: ivaIncl === val ? "var(--cra-charcoal)" : "var(--cra-white)",
                  transition: "background var(--dur-base) var(--ease-standard), color var(--dur-base) var(--ease-standard)",
                }}>{lab}</button>
            ))}
          </div>
          <button id="cra-cart-btn" onClick={open} aria-label={`Apri la proposta d'ordine, ${count} articoli`} style={{
          display: "inline-flex", alignItems: "center", gap: "10px", cursor: "pointer",
          background: "transparent", color: "var(--cra-white)",
          border: "2px solid rgba(255,255,255,0.35)", padding: "12px 18px",
          fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)",
          textTransform: "uppercase", letterSpacing: "var(--ls-caps)",
          transition: "border-color var(--dur-base) var(--ease-standard), color var(--dur-base) var(--ease-standard)",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--cra-gold)"; e.currentTarget.style.color = "var(--cra-gold)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; e.currentTarget.style.color = "var(--cra-white)"; }}>
          <Icon name="shopping-cart" size={17} /> Proposta
          {/* key={count}: il badge si rimonta ad ogni aggiunta e rigioca il "pop" */}
          <span key={count} className="store-cart-badge" style={{ background: "var(--cra-gold)", color: "var(--cra-charcoal)", padding: "2px 8px", fontWeight: "var(--fw-black)", fontSize: "var(--fs-xs)" }}>
            {count}
          </span>
          </button>
        </div>
        )}
    </React.Fragment>
  );
  return (
    <section style={{
      background: "linear-gradient(180deg, #202624, var(--cra-charcoal))",
      color: "var(--cra-white)",
      padding: "var(--space-7) 0 var(--space-6)",
      borderBottom: "3px solid transparent",
      borderImage: "linear-gradient(90deg, var(--cra-red) 60%, var(--cra-gold) 100%) 1",
    }}>
      {wide
        ? <div className="store-wrap" style={rowStyle}>{inner}</div>
        : <Container style={rowStyle}>{inner}</Container>}
    </section>
  );
}

/* ---------- gate d'accesso: il catalogo è riservato alle officine abilitate.
   (La RLS applica lo stesso cancello a livello database: qui è solo UX.) ---------- */
export function StoreGate({ onNavigate, children }) {
  const { session, officina, loading, isActive } = useAuth();

  if (loading) {
    return (
      <div style={{ background: "var(--surface-page)", minHeight: "50vh" }}>
        <StoreHead noCart />
        <Container style={{ padding: "var(--space-7) var(--space-5)" }}>
          <p style={{ color: "var(--text-muted)" }}>Caricamento…</p>
        </Container>
      </div>
    );
  }
  if (isActive) return children;

  let icon = "lock";
  let title = "Riservato alle officine clienti";
  let text = "Il CRA Store è dedicato alle officine abilitate. Accedi con il tuo account oppure registrati: dopo la verifica dei dati attiveremo l'accesso al catalogo e alle proposte d'ordine.";
  if (session && officina) {
    if (officina.stato === "in_attesa") {
      icon = "clock";
      title = "Account in attesa di attivazione";
      text = "La tua registrazione è stata ricevuta: stiamo verificando i dati. Ti avviseremo via email appena il catalogo sarà accessibile.";
    } else if (officina.stato === "sospesa") {
      icon = "alert-circle";
      title = "Account sospeso";
      text = "L'accesso è momentaneamente sospeso. Contattaci per maggiori informazioni.";
    } else {
      title = "Account non abilitato al CRA Store";
      text = "Il tuo account è attivo ma non è ancora abilitato a questo catalogo. Contattaci per richiedere l'abilitazione.";
    }
  }

  return (
    <div style={{ background: "var(--surface-page)", minHeight: "60vh" }}>
      <StoreHead noCart subtitle="Accessori & attrezzatura per officine" />
      <Container style={{ padding: "var(--space-8) var(--space-5)" }}>
        <div style={{ maxWidth: "520px", margin: "0 auto", textAlign: "center", background: "var(--surface-card)", border: "1px solid var(--border-subtle, #e2e0da)", padding: "var(--space-7) var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "center" }}>
          <Icon name={icon} size={40} color={icon === "alert-circle" ? "var(--cra-red)" : "var(--cra-gold)"} />
          <h2 style={{ margin: 0, fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-lg)", textTransform: "uppercase", color: "var(--text-strong)" }}>{title}</h2>
          <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--text-muted)", lineHeight: "var(--lh-relaxed)" }}>{text}</p>
          {!session && (
            <Button variant="primary" iconLeft={<Icon name="log-in" size={16} />} onClick={() => onNavigate("login")} style={{ marginTop: "8px" }}>
              Accedi o registrati
            </Button>
          )}
        </div>
      </Container>
    </div>
  );
}

/* ---------- striscia "come funziona" (RFQ in 3 passi) ---------- */
function RfqStrip() {
  const steps = [
    ["Componi la proposta", "Aggiungi gli articoli: nessun pagamento online."],
    ["Confermiamo noi", "Verifichiamo disponibilità e tempi, ti rispondiamo via email."],
    ["Ritiro o consegna", "In una delle 5 sedi oppure con spedizione dedicata."],
  ];
  return (
    <section style={{ background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle, #e2e0da)", padding: "var(--space-5) 0" }}>
      <div className="store-wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
        {steps.map(([t, d], i) => (
          <div key={t} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <span style={{
              fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-sm)", color: "var(--cra-red)",
              border: "2px solid var(--cra-charcoal)", minWidth: "38px", height: "38px",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{i + 1}</span>
            <span>
              <b style={{ display: "block", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", fontSize: "var(--fs-xs)", letterSpacing: "var(--ls-caps)", marginBottom: "3px" }}>{t}</b>
              <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>{d}</p>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- card prodotto ---------- */
function ProductCard({ p, catNome, onNavigate, taglia = "normale", offerta = null, onScaduto }) {
  const { add, ivaIncl } = useCart();
  const [hover, setHover] = useState(false);
  const grande = taglia !== "normale";
  return (
    <motion.article
      className={`store-card${grande ? ` store-card--big store-card--${taglia.replace("_", "-")}` : ""}`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      /* Una scheda in vetrina è contenuto hero: deve esserci al primo frame,
         non entrare in dissolvenza. */
      initial={grande ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      whileHover={{ y: grande ? -6 : -3 }}
      transition={{ duration: 0.4, ease: EASE }}
      style={{
        position: "relative",
        background: "var(--surface-card)",
        border: `1px solid ${hover ? "var(--cra-charcoal)" : "var(--border-subtle, #e2e0da)"}`,
        boxShadow: hover ? (grande ? "0 22px 46px rgba(39,45,43,0.18)" : "0 14px 30px rgba(39,45,43,0.12)") : "none",
        transition: "border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)",
        padding: "var(--cra-pad, 18px)", display: "flex", flexDirection: "column",
      }}>
      {offerta && (
        <NastroOfferta offerta={offerta} prodottoId={p.id} onScaduto={onScaduto}
          isoFine={p.cra_offerta_a} isoInizio={p.cra_offerta_da} />
      )}
      <button onClick={() => onNavigate(`store/${encodeURIComponent(p.codice)}`)} aria-label={`Vedi scheda di ${p.nome}`} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", flex: grande ? "1 1 auto" : "0 0 auto", minHeight: 0 }}>
        <div className="store-fig">
          <img className="store-fig-img"
            src={grande ? (p.immagini?.[0] ?? p.immagine ?? PLACEHOLDER_IMG) : (p.immagine || PLACEHOLDER_IMG)}
            alt=""
            loading={grande ? "eager" : "lazy"}
            fetchpriority={taglia === "vetrina" || taglia === "vetrina_xl" ? "high" : "auto"} />
        </div>
        <span className="store-card-eyebrow" title={catNome ?? undefined}>{catNome ?? "catalogo"}</span>
        <h3 className="store-card-titolo" style={{ fontSize: "var(--cra-titolo, var(--fs-sm))" }}>{p.nome}</h3>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>Cod. {p.codice}</span>
      </button>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginTop: "auto", paddingTop: "12px" }}>
        {(() => {
          const nFormati = p.conVarianti ? p.varianti.length : 0;
          const unita = p.conVarianti ? unitaLabel(p.varianti[0]) : "";
          // Con un formato solo non ha senso dire "da": il prezzo è quello.
          const daPrezzo = nFormati > 1;
          return (
            <span style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--cra-prezzo, var(--fs-lg))", color: "var(--text-strong)", fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>
              {daPrezzo && <span style={{ fontSize: "0.55em", fontWeight: "var(--fw-bold)", color: "var(--text-muted)" }}>da </span>}
              {/* Il prezzo pieno barrato compare solo quando l'offerta lo
                  abbassa davvero: senza il confronto, uno sconto è solo un
                  numero. */}
              {p.prezzoPieno != null && (
                <span style={{ fontSize: "0.58em", fontWeight: "var(--fw-bold)", color: "var(--text-muted)", textDecoration: "line-through", marginRight: "6px" }}>
                  {formatEuro(prezzoVisibile(p.prezzoPieno, ivaIncl))}
                </span>
              )}
              <span style={p.prezzoPieno != null ? { color: "var(--cra-red)" } : undefined}>
                {formatEuro(prezzoVisibile(p.prezzoDa, ivaIncl))}
              </span>
              {unita && <span style={{ fontSize: "0.62em", fontWeight: "var(--fw-bold)", color: "var(--text-muted)" }}> {unita}</span>}
              <small style={{ display: "block", fontFamily: "var(--font-body)", fontWeight: 400, fontSize: "10.5px", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {nFormati > 1 ? `${nFormati} formati · ` : nFormati === 1 ? "1 formato · " : ""}
                {ivaNota(ivaIncl)} *
              </small>
            </span>
          );
        })()}
        <button
          aria-label={p.conVarianti ? `Scegli il formato di ${p.nome}` : `Aggiungi ${p.nome} alla proposta`}
          title={p.conVarianti ? "Scegli il formato" : "Aggiungi alla proposta"}
          onClick={(e) => {
            // Con più formati non si può aggiungere alla cieca: si apre la scheda
            // e si sceglie l'imballo.
            if (p.conVarianti) { onNavigate(`store/${encodeURIComponent(p.codice)}`); return; }
            add({ product_id: p.id, variant_id: null, codice: p.codice, nome: p.nome, prezzo: p.prezzo, immagine: p.immagine });
            tracciaCarrello(p.codice, 1);
            // dal catalogo: nessun drawer, solo la miniatura che vola nel bottone Proposta.
            // Si prende la foto per classe: col nastro, la prima <img> non è più quella giusta.
            flyToCart(e.currentTarget.closest("article")?.querySelector(".store-fig-img"), p.immagine || PLACEHOLDER_IMG);
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--action-primary-hover)"; e.currentTarget.style.borderColor = "var(--action-primary-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--action-primary)"; e.currentTarget.style.borderColor = "var(--action-primary)"; }}
          onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.93)"; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = "none"; }}
          style={{
            flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "var(--cra-btn, 44px)", height: "var(--cra-btn, 44px)", padding: 0, cursor: "pointer",
            background: "var(--action-primary)", color: "var(--text-on-dark)",
            border: "var(--border-w-2) solid var(--action-primary)", borderRadius: "var(--radius-sm)",
            transition: "background var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)",
          }}>
          <Icon name={p.conVarianti ? "chevron-right" : "plus"} size={20} strokeWidth={2.5} />
        </button>
      </div>
    </motion.article>
  );
}

/* ---------- drawer proposta d'ordine (riusato anche dal dettaglio) ---------- */
export function CartDrawer({ onNavigate }) {
  const { items, totale, setQty, remove, clear, isOpen, close, ivaIncl } = useCart();
  const { session, officina, isActive } = useAuth();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null); // { numero }
  const [err, setErr] = useState(null);

  const reduce = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const invia = async () => {
    setErr(null);
    setBusy(true);
    try {
      const order = await submitOrder({ officinaId: officina.id, items, note, totale });
      setSent(order);
      clear();
      setNote("");
    } catch {
      setErr("Invio non riuscito. Riprova o contattaci direttamente.");
    } finally {
      setBusy(false);
    }
  };

  const label = { fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", letterSpacing: "var(--ls-caps)", fontSize: "var(--fs-xs)" };

  let footer;
  if (sent) {
    footer = (
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
        <Icon name="check-circle-2" size={38} color="#2e7d4f" />
        <b style={{ ...label, fontSize: "var(--fs-sm)" }}>Proposta {sent.numero} inviata</b>
        <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
          Ti confermeremo disponibilità e tempi via email.
        </p>
        <Button variant="secondary" size="sm" onClick={() => { setSent(null); close(); }}>Chiudi</Button>
      </div>
    );
  } else if (items.length === 0) {
    footer = <p style={{ margin: 0, textAlign: "center", color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>La proposta è vuota: aggiungi articoli dal catalogo.</p>;
  } else if (!session) {
    footer = (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
          Per inviare la proposta d'ordine accedi con il tuo account officina (gli articoli restano salvati).
        </p>
        <Button variant="dark" fullWidth iconLeft={<Icon name="log-in" size={15} />} onClick={() => { close(); onNavigate("login"); }}>
          Accedi per inviare
        </Button>
      </div>
    );
  } else if (!isActive) {
    footer = (
      <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
        <Icon name="clock" size={14} color="var(--cra-gold)" /> Il tuo account non è ancora abilitato all'invio:
        ti avviseremo via email appena attivo.
      </p>
    );
  } else {
    footer = (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {err && (
          <p role="alert" style={{ margin: 0, color: "var(--cra-red)", fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)" }}>
            <Icon name="alert-circle" size={14} /> {err}
          </p>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ ...label, fontSize: "var(--fs-2xs)", color: "var(--text-muted)" }}>Note (facoltative)</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Riferimenti, urgenze, sede di ritiro preferita…"
            style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "10px 12px", border: "var(--border-w-2) solid var(--border-strong)", resize: "vertical" }} />
        </label>
        <Button variant="primary" fullWidth disabled={busy} iconRight={<Icon name="arrow-right" size={16} />} onClick={invia}>
          {busy ? "Invio…" : "Invia proposta d'ordine"}
        </Button>
        <p style={{ margin: 0, fontSize: "var(--fs-2xs)", color: "var(--text-muted)", textAlign: "center" }}>
          Nessun pagamento online: confermiamo noi disponibilità e tempi.
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div role="dialog" aria-modal="true" aria-label="Proposta d'ordine" style={{ position: "fixed", inset: 0, zIndex: 80 }}>
          <motion.div onClick={close}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ position: "absolute", inset: 0, background: "rgba(27,32,31,0.5)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
          <motion.aside
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 400, damping: 40 }}
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: "min(430px, 94vw)",
              background: "var(--surface-card)", boxShadow: "var(--shadow-xl)",
              display: "flex", flexDirection: "column",
            }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "var(--cra-charcoal)", color: "var(--cra-white)" }}>
          <b style={label}><Icon name="shopping-cart" size={15} color="var(--cra-gold)" /> Proposta d'ordine</b>
          <button onClick={close} aria-label="Chiudi" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cra-white)", display: "inline-flex" }}>
            <Icon name="x" size={20} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.div key={it.key} layout
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              style={{ display: "flex", gap: "12px", alignItems: "center", borderBottom: "1px solid var(--border-subtle, #e2e0da)", paddingBottom: "12px", overflow: "hidden" }}>
              <img src={it.immagine || PLACEHOLDER_IMG} alt="" style={{ width: "52px", height: "52px", objectFit: "contain", background: "var(--surface-subtle, #f2f1ed)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)", lineHeight: 1.3 }}>{it.nome}</div>
                <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{it.codice} · {formatEuro(prezzoVisibile(it.prezzo, ivaIncl))}</div>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--border-strong)" }}>
                <button onClick={() => setQty(it.key, it.quantita - 1)} aria-label="Diminuisci quantità" style={{ background: "none", border: "none", cursor: "pointer", padding: "7px 9px", display: "inline-flex" }}><Icon name="minus" size={13} /></button>
                <span style={{ minWidth: "26px", textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-sm)" }}>{it.quantita}</span>
                <button onClick={() => setQty(it.key, it.quantita + 1)} aria-label="Aumenta quantità" style={{ background: "none", border: "none", cursor: "pointer", padding: "7px 9px", display: "inline-flex" }}><Icon name="plus" size={13} /></button>
              </div>
              <button onClick={() => remove(it.key)} aria-label={`Rimuovi ${it.nome}`} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cra-red)", display: "inline-flex" }}>
                <Icon name="trash-2" size={16} />
              </button>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>

        <footer style={{ borderTop: "1px solid var(--border-subtle, #e2e0da)", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {items.length > 0 && !sent && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ ...label, fontSize: "var(--fs-2xs)", color: "var(--text-muted)" }}>Totale indicativo ({ivaIncl ? "IVA 22% incl." : "IVA escl."})</span>
              <b style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-lg)", fontVariantNumeric: "tabular-nums" }}>{formatEuro(prezzoVisibile(totale, ivaIncl))}</b>
            </div>
          )}
          {footer}
        </footer>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------- pagina catalogo ---------- */
export function Store({ onNavigate }) {
  return (
    <StoreGate onNavigate={onNavigate}>
      <StoreInner onNavigate={onNavigate} />
    </StoreGate>
  );
}

/* Filtri a faccette per macro categoria (pattern del Catalogo l2f, esteso).
   I valori escono dagli `attributi` dei prodotti: valgono anche per gli
   articoli futuri, basta compilare le stesse chiavi dall'admin. */
const FACETS = {
  batterie: [
    { dim: "tecnologia", label: "Tecnologia" },
    { dim: "ah", label: "Amperaggio", suffix: " Ah", numeric: true },
    { dim: "spunto", label: "Spunto", suffix: " A", numeric: true },
    { dim: "polo", label: "Polo positivo" },
    { dim: "box", label: "Box" },
    { dim: "dimensioni", label: "Dimensioni (mm)" },
  ],
  illuminazione: [
    { dim: "linea", label: "Linea" },
    { dim: "attacco", label: "Attacco" },
    { dim: "kelvin", label: "Colore" },
    { dim: "canbus", label: "CANBUS" },
  ],
  lubrificanti: [
    { dim: "gradazione", label: "Gradazione" },
    { dim: "categoria", label: "Specifica" },
    { dim: "confezione", label: "Confezione" },
  ],
};

function useMediaQuery(q) {
  const [match, setMatch] = useState(() => (typeof window !== "undefined" ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return match;
}

function StoreInner({ onNavigate }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [macro, setMacro] = useState("tutti");
  const [sub, setSub] = useState(null);
  const [query, setQuery] = useState("");
  const [facetVals, setFacetVals] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [soloPromo, setSoloPromo] = useState(false);
  /** Offerte scadute a pagina aperta: la scheda torna normale al prossimo
   *  ricalcolo, non sotto il dito di chi sta scorrendo. */
  const [scaduti, setScaduti] = useState(() => new Set());
  const segnalaScaduto = useCallback(
    (id) => setScaduti((s) => (s.has(id) ? s : new Set(s).add(id))),
    [],
  );
  const narrow = useMediaQuery("(max-width: 900px)");

  useEffect(() => {
    getCatalog().then(setData).catch(() => setErr(true));
  }, []);

  /* Il portatile chiuso in officina e riaperto tre giorni dopo mostrerebbe un
     catalogo fermo: i browser strozzano i timer in secondo piano. */
  useEffect(() => {
    const alRitorno = () => {
      if (document.visibilityState === "visible") {
        getCatalog().then(setData).catch(() => { /* si tiene quello che c'è */ });
      }
    };
    document.addEventListener("visibilitychange", alRitorno);
    return () => document.removeEventListener("visibilitychange", alRitorno);
  }, []);

  /* Tassonomia + conteggi: nel negozio compaiono SOLO le categorie con prodotti. */
  const categorie = data?.categorie ?? [];
  const byId = Object.fromEntries(categorie.map((c) => [c.id, c]));
  const macroOf = (catId) => (byId[catId]?.parent_id ?? catId);
  const countByCat = {};
  for (const p of data?.prodotti ?? []) {
    if (!p.categoria) continue;
    countByCat[p.categoria] = (countByCat[p.categoria] ?? 0) + 1;
  }
  const tree = buildTree(categorie)
    .map((m) => ({
      ...m,
      subs: m.subs.filter((s) => countByCat[s.id]),
      count: (countByCat[m.id] ?? 0) + m.subs.reduce((sum, s) => sum + (countByCat[s.id] ?? 0), 0),
    }))
    .filter((m) => m.count > 0);
  const activeMacro = macro !== "tutti" ? tree.find((m) => m.id === macro) : null;

  const pickMacro = (id) => { setMacro(id); setSub(null); setFacetVals({}); };
  const pickSub = (id) => { setSub(id); setFacetVals({}); };

  /* prodotti nel perimetro macro/sub/ricerca: da qui escono i valori faccetta */
  const scope = (data?.prodotti ?? []).filter((p) =>
    matchProduct(p, query) &&
    (macro === "tutti" || macroOf(p.categoria) === macro) &&
    (!sub || p.categoria === sub),
  );

  /* Le ricerche senza risultati sono l'informazione più utile del catalogo:
     dicono cosa i clienti cercano e noi non abbiamo. Si registra a digitazione
     ferma, non a ogni lettera. */
  useEffect(() => {
    const t = query.trim();
    if (t.length < 3) return undefined;
    const attesa = setTimeout(() => tracciaRicerca(t, scope.length), 900);
    return () => clearTimeout(attesa);
  }, [query, scope.length]);

  const facets = (FACETS[macro] ?? [])
    .map((f) => {
      const values = [...new Set(
        scope.map((p) => p.attributi?.[f.dim]).filter((v) => v != null && v !== "").map(String),
      )];
      values.sort(f.numeric
        ? (a, b) => Number(a) - Number(b)
        : (a, b) => a.localeCompare(b, "it", { numeric: true }));
      return { ...f, values };
    })
    .filter((f) => f.values.length > 1);

  /** In promozione = offerta a tempo attiva OPPURE tag "promozioni" scritto a
   *  mano sull'articolo. Le due strade convivono: la finestra si spegne da
   *  sola, il tag dà libertà su tutto il resto. */
  const inPromozione = (p) =>
    !!statoOfferta(p, scaduti, adesso())
    || (p.tags ?? []).some((t) => String(t).toLowerCase().includes("promozion"));

  const prodotti = scope.filter((p) =>
    Object.entries(facetVals).every(([dim, v]) => !v || String(p.attributi?.[dim] ?? "") === v)
    && (!soloPromo || inPromozione(p)),
  );

  const nPromo = (data?.prodotti ?? []).filter(inPromozione).length;

  const anyFacet = Object.values(facetVals).some(Boolean);
  const activeCount = (macro !== "tutti" ? 1 : 0) + (sub ? 1 : 0) + (soloPromo ? 1 : 0)
    + Object.values(facetVals).filter(Boolean).length;

  /* La griglia modulare vale SOLO nel catalogo generico. `activeCount` non
     conta la ricerca testuale: senza `!query.trim()` basterebbe digitare una
     lettera per ritrovarsi tre risultati con una vetrina gigante in mezzo. */
  const catalogoGenerico = activeCount === 0 && !query.trim();
  const inGriglia = useMemo(
    () => disponi(prodotti, catalogoGenerico, scaduti, adesso()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prodotti, catalogoGenerico, scaduti],
  );
  const showSidebar = !narrow || filtersOpen;
  const totale = (data?.prodotti ?? []).length;

  /* chip dei filtri attivi, ognuno rimovibile */
  const activeChips = [];
  if (macro !== "tutti") activeChips.push({ key: "m", label: byId[macro]?.nome ?? macro, remove: () => pickMacro("tutti") });
  if (sub) activeChips.push({ key: "s", label: byId[sub]?.nome ?? sub, remove: () => pickSub(null) });
  if (soloPromo) activeChips.push({ key: "promo", label: "Promozioni", remove: () => setSoloPromo(false) });
  for (const f of facets) {
    const v = facetVals[f.dim];
    if (v) activeChips.push({ key: f.dim, label: `${f.label}: ${v}${f.suffix ?? ""}`, remove: () => setFacetVals((prev) => ({ ...prev, [f.dim]: null })) });
  }
  const resetAll = () => { setMacro("tutti"); setSub(null); setFacetVals({}); setSoloPromo(false); };

  return (
    <MotionConfig reducedMotion="user">
    <div style={{ background: "var(--surface-page)" }}>
      <StoreHead wide subtitle="Accessori & attrezzatura per officine — proposta d'ordine senza pagamento online" />
      <RfqStrip />

      <div className="store-wrap" style={{ padding: "var(--space-5) 0 var(--space-9)" }}>
        {err && (
          <p role="alert" style={{ color: "var(--cra-red)", fontWeight: "var(--fw-semibold)" }}>
            <Icon name="alert-circle" size={15} /> Impossibile caricare il catalogo. Ricarica la pagina.
          </p>
        )}
        {!data && !err && <p style={{ color: "var(--text-muted)" }}>Caricamento catalogo…</p>}

        {data && (
          <div className="store-layout">
            {/* ---------- SIDEBAR: categorie + filtri ---------- */}
            {showSidebar && (
              <aside className="store-sidebar">
                <div className="store-panel">
                  <div className="store-panel-head">Categorie</div>
                  <button className={`store-cat ${macro === "tutti" ? "active" : ""}`} onClick={() => pickMacro("tutti")}>
                    <span>Tutti i prodotti</span><span className="store-cat-n">{totale}</span>
                  </button>
                  {tree.map((m) => (
                    <React.Fragment key={m.id}>
                      <button className={`store-cat ${macro === m.id ? "active" : ""}`} onClick={() => pickMacro(m.id)}>
                        <span>{m.nome}</span><span className="store-cat-n">{m.count}</span>
                      </button>
                      {macro === m.id && m.subs.length > 0 && (
                        <div className="store-subs">
                          <button className={`store-sub ${!sub ? "active" : ""}`} onClick={() => pickSub(null)}>
                            <span>Tutte</span><span className="store-sub-n">{m.count}</span>
                          </button>
                          {m.subs.map((s) => (
                            <button key={s.id} className={`store-sub ${sub === s.id ? "active" : ""}`} onClick={() => pickSub(s.id)}>
                              <span>{s.nome}</span><span className="store-sub-n">{countByCat[s.id]}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {facets.length > 0 && (
                  <div className="store-panel">
                    <div className="store-panel-head">
                      Filtri
                      {anyFacet && (
                        <button className="store-reset" onClick={() => setFacetVals({})}>
                          <Icon name="x" size={11} color="var(--cra-gold)" /> Azzera
                        </button>
                      )}
                    </div>
                    {facets.map((f) => (
                      <div key={f.dim} className="store-facet">
                        <div className="store-facet-label">{f.label}</div>
                        <div className="store-pills">
                          {f.values.map((v) => {
                            const active = facetVals[f.dim] === v;
                            return (
                              <button key={v} className={`store-pill ${active ? "active" : ""}`}
                                onClick={() => setFacetVals((prev) => ({ ...prev, [f.dim]: active ? null : v }))}>
                                {v}{f.suffix ?? ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            )}

            {/* ---------- MAIN: ricerca + risultati ---------- */}
            <div>
              <div className="store-toolbar">
                <div className="store-search">
                  <Icon name="package-search" size={17} color="var(--text-muted, #5c6462)" />
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cerca per nome, codice o parola chiave…" aria-label="Cerca nel catalogo" />
                  {query && (
                    <button onClick={() => setQuery("")} aria-label="Pulisci ricerca" style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex" }}>
                      <Icon name="x" size={15} color="var(--text-muted, #5c6462)" />
                    </button>
                  )}
                </div>
                {nPromo > 0 && (
                  <button className={`store-pill${soloPromo ? " active" : ""}`}
                    onClick={() => setSoloPromo((v) => !v)}
                    aria-pressed={soloPromo}
                    title="Prodotti in offerta a tempo o contrassegnati come promozione">
                    <Icon name="tag" size={13} /> Promozioni ({nPromo})
                  </button>
                )}
                {narrow && (
                  <button className="store-filters-toggle" onClick={() => setFiltersOpen((o) => !o)}>
                    <Icon name="cog" size={15} color="var(--cra-gold)" />
                    {filtersOpen ? "Chiudi filtri" : "Filtri e categorie"}{activeCount ? ` (${activeCount})` : ""}
                  </button>
                )}
                <span className="store-count">{prodotti.length} {prodotti.length === 1 ? "prodotto" : "prodotti"}</span>
              </div>

              {activeChips.length > 0 && (
                <div className="store-active">
                  {activeChips.map((c) => (
                    <button key={c.key} className="store-active-chip" onClick={c.remove}>
                      {c.label} <Icon name="x" size={12} />
                    </button>
                  ))}
                  <button className="store-active-chip" style={{ background: "transparent", color: "var(--text-muted)", borderColor: "var(--border-strong)" }} onClick={resetAll}>
                    Azzera tutto
                  </button>
                </div>
              )}

              {prodotti.length === 0 ? (
                <div style={{ textAlign: "center", padding: "var(--space-8) 0", color: "var(--text-muted)" }}>
                  <Icon name="package-search" size={40} color="var(--cra-gold)" />
                  <p style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", letterSpacing: "var(--ls-caps)", margin: "12px 0 4px" }}>
                    {query || activeCount ? "Nessun risultato" : "Catalogo in allestimento"}
                  </p>
                  <p style={{ margin: 0, fontSize: "var(--fs-sm)" }}>
                    {query || activeCount
                      ? "Prova con un termine diverso o azzera i filtri."
                      : "I primi articoli arrivano a breve. Per richieste urgenti: ordini@centroricambiautosrl.it"}
                  </p>
                </div>
              ) : (
                <div className={`store-grid${catalogoGenerico ? " store-grid--modulare" : ""}`}>
                  {inGriglia.map(({ p, taglia }) => (
                    <ProductCard key={p.id} p={p} taglia={taglia}
                      offerta={statoOfferta(p, scaduti, adesso())}
                      onScaduto={segnalaScaduto}
                      catNome={byId[p.categoria]?.nome} onNavigate={onNavigate} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CartDrawer onNavigate={onNavigate} />
    </div>
    </MotionConfig>
  );
}
