import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Icon } from "./Icon.jsx";

const { useState, useEffect, useLayoutEffect, useRef, useCallback } = React;

/* ============================================================
   IL GIRO DI PRESENTAZIONE — il primo giorno, fatto da un collega.

   Oscura la pagina, accende un faro sull'elemento VERO di cui sta parlando
   e ci appoggia accanto una vignetta. Un passo per volta, con la via
   d'uscita sempre in vista.

   Il faro non è un rettangolo disegnato accanto all'elemento: è un buco nel
   velo scuro. Un riquadro trasparente messo sopra l'elemento, con un'ombra
   più larga dello schermo che annerisce tutto il resto (il perché per esteso
   sta in interno.css, dove c'è il box-shadow). Così quello che si illumina è
   la cosa vera, non una sua copia da tenere allineata.

   Qui dentro non c'è scritto niente del contenuto: i passi arrivano da fuori
   come dati. Questo componente sa solo come si mostrano.
   ============================================================ */

const RESPIRO = 8;      // quanto il faro allarga l'elemento, per non tagliarlo
const STACCO = 14;      // aria fra il faro e la vignetta
const BORDO = 12;       // quanto la vignetta sta lontana dai bordi dello schermo
const ATTESA = 1400;    // quanto si aspetta un elemento che sta ancora arrivando
const GRAZIA = 400;     // dopo quanto, aspettando, compare la via d'uscita sul buio
const ASSESTAMENTI = 9; // quante volte si rimisura il faro mentre la scheda si posa
const QUOTA_FARO = 0.55; // il faro non si prende più di così dello schermo

/** Il primo bersaglio che esiste davvero.
 *  È un elenco e non un nome solo perché la stessa cosa cambia nome secondo
 *  lo schermo: «Personalizza» sul telefono non c'è, e allora si illumina il
 *  Desk intero. Se non ne esiste nessuno il passo si salta: è quello che
 *  succede a chi non ha «I miei clienti». */
function trova(bersaglio) {
  for (const nome of [].concat(bersaglio ?? [])) {
    const el = document.querySelector(`[data-giro="${nome}"]`);
    // Un elemento c'è ma è nascosto (display:none) non si può illuminare.
    if (el && el.getClientRects().length > 0) return el;
  }
  return null;
}

/** Inchiodato allo schermo — di suo o perché lo è il guscio che lo contiene.
 *  La campanella è un pulsante `position: relative` dentro un guscio
 *  `position: fixed`: guardare solo l'elemento voleva dire scorrere la pagina
 *  per portare in vista una cosa che non si sposta di un pixel. Su uno schermo
 *  basso — un telefono coricato — il sito faceva un salto di duecento pixel
 *  sotto una campanella ferma. */
function inchiodato(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position === "fixed") return true;
  }
  return false;
}

/** Porta in vista. Non si muove niente se l'elemento c'è già tutto E resta
 *  posto per la vignetta — la campanella è già dove deve stare, e scorrere
 *  per niente è solo fastidio.
 *
 *  Quando invece serve, l'elemento va a un sesto dello schermo e non al
 *  centro: al centro l'avanzo si divide in due metà troppo strette, la
 *  vignetta non ci sta né sopra né sotto e finisce per coprire proprio la
 *  cosa che sta indicando. */
function porta(el, menoMoto, altaCarta) {
  if (inchiodato(el)) return;
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const serve = altaCarta ? altaCarta + STACCO + BORDO : 0;
  const inVista = r.top >= 0 && r.bottom <= vh;
  if (inVista && Math.max(vh - r.bottom, r.top) >= serve) return;
  /* `behavior` esplicito: il sito ha `html { scroll-behavior: smooth }` e
     "auto" vorrebbe dire proprio "fai come dice il foglio di stile" — chi ha
     chiesto meno movimento se lo ritroverebbe lo stesso. */
  window.scrollTo({
    top: Math.max(0, window.scrollY + r.top - vh / 6),
    behavior: menoMoto ? "instant" : "smooth",
  });
}

/**
 * @param passi     l'elenco dei passi (vedi Interno.jsx). Deve essere stabile
 *                  fra un disegno e l'altro, o il giro riparte da capo.
 * @param vaiScheda porta la persona sulla scheda che il passo chiede.
 * @param onChiudi  fine del giro, per arrivo o per «Salta».
 */
export function Giro({ passi, vaiScheda, onChiudi }) {
  const menoMoto = useReducedMotion();
  const [indice, setIndice] = useState(0);
  const [rett, setRett] = useState(null);   // il rettangolo del faro, in pixel di schermo
  const [posa, setPosa] = useState(null);   // dove si appoggia la vignetta
  const [pronto, setPronto] = useState(false);
  /* L'attesa si sta facendo lunga: sul buio compare una via d'uscita. */
  const [tardi, setTardi] = useState(false);
  /* La finestra cambia misura anche quando il faro non si muove — un passo
     senza bersaglio ha la vignetta al centro, e il centro si sposta. */
  const [schermo, setSchermo] = useState(
    () => ({ l: window.innerWidth, a: window.innerHeight }));
  const carta = useRef(null);
  const mirino = useRef(null);   // l'elemento illuminato adesso
  const altaCarta = useRef(0);   // quanto è alta la vignetta: serve a misurare il faro
  const verso = useRef(1);       // in che direzione si stava andando: i salti la seguono

  /* Le due funzioni di fuori cambiano identità a ogni disegno del genitore.
     Tenerle in un riferimento invece che nelle dipendenze evita che l'effetto
     del passo riparta di continuo — e con lui il salto di scheda. */
  const azioni = useRef({ vaiScheda, onChiudi });
  useEffect(() => { azioni.current = { vaiScheda, onChiudi }; });

  /* Stesso motivo per l'elenco dei passi: cambia identità senza cambiare
     contenuto ogni volta che il genitore si ridisegna (il rinnovo del token
     d'accesso rifà l'oggetto `dipendente`, e con lui l'elenco). Se l'effetto
     del passo dipendesse dall'array, un ridisegno qualunque spegnerebbe il
     faro e rifarebbe il salto di scheda a metà giro. */
  const elenco = useRef(passi);
  useEffect(() => { elenco.current = passi; });

  useEffect(() => {
    const cambia = () => setSchermo({ l: window.innerWidth, a: window.innerHeight });
    window.addEventListener("resize", cambia);
    return () => window.removeEventListener("resize", cambia);
  }, []);

  const passo = passi[indice] ?? null;
  const ultimo = indice >= passi.length - 1;

  const avanti = useCallback(() => {
    verso.current = 1;
    if (indice + 1 >= passi.length) azioni.current.onChiudi?.();
    else setIndice(indice + 1);
  }, [indice, passi.length]);

  const indietro = useCallback(() => {
    verso.current = -1;
    setIndice((i) => Math.max(0, i - 1));
  }, []);

  const salta = useCallback(() => { azioni.current.onChiudi?.(); }, []);

  /* Il rettangolo del faro. Si ricalcola al ridimensionamento e a ogni
     scorrimento: l'elemento sotto si muove, il buco deve muoversi con lui. */
  const misura = useCallback(() => {
    const el = mirino.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const top = Math.max(6, r.top - RESPIRO);
    const sinistra = Math.max(6, r.left - RESPIRO);
    const destra = Math.min(vw - 6, r.right + RESPIRO);
    /* Un faro alto quanto lo schermo non indica più niente e non lascia posto
       alla vignetta: dei riquadri lunghi si illumina la testa, che è dove sta
       il titolo. E si ferma prima ancora se è l'unico modo perché la vignetta
       ci stia sotto senza coprirlo. */
    const perLaCarta = altaCarta.current ? altaCarta.current + STACCO + BORDO : 0;
    const tetto = Math.min(vh * QUOTA_FARO, Math.max(vh * 0.25, vh - top - perLaCarta));
    const fondo = Math.min(vh - 6, r.bottom + RESPIRO, top + tetto);
    if (destra <= sinistra || fondo <= top) { setRett(null); return; }
    const larghezza = destra - sinistra;
    const altezza = fondo - top;
    /* Stesso rettangolo, stesso oggetto: si rimisura anche a raffica mentre la
       scheda si posa, e senza questo ogni misura uguale all'altra farebbe
       comunque un disegno in più. */
    setRett((v) => (v && v.top === top && v.sinistra === sinistra
      && v.larghezza === larghezza && v.altezza === altezza
      ? v : { top, sinistra, larghezza, altezza }));
  }, []);

  /* Ogni passo: portati sulla scheda giusta, aspetta che l'elemento compaia
     — le schede caricano i dati dopo — e solo allora accendi il faro. Un faro
     sul vuoto è peggio di niente. Se dopo l'attesa non c'è nulla da
     illuminare, il passo si salta da solo nella direzione in cui si stava
     andando: chi torna indietro non deve essere rispedito avanti. */
  useEffect(() => {
    const p = elenco.current[indice];
    if (!p) { azioni.current.onChiudi?.(); return undefined; }
    let vivo = true;
    let attesa = 0;
    let lento = 0;
    setPronto(false);
    setRett(null);
    setTardi(false);
    mirino.current = null;
    if (p.scheda) azioni.current.vaiScheda?.(p.scheda);
    if (!p.bersaglio) { setPronto(true); return undefined; }
    /* Finché si aspetta non c'è vignetta e lo schermo è solo nero: se l'attesa
       si fa notare deve comparire qualcosa da toccare per uscirne (Esc su un
       telefono non esiste). Non subito, o lampeggerebbe a ogni passo. */
    lento = setTimeout(() => setTardi(true), GRAZIA);
    const scade = performance.now() + ATTESA;
    const cerca = () => {
      if (!vivo) return;
      const el = trova(p.bersaglio);
      if (el) {
        clearTimeout(lento);
        mirino.current = el;
        porta(el, menoMoto, altaCarta.current);
        misura();
        setPronto(true);
        return;
      }
      /* setTimeout e non requestAnimationFrame: in una scheda del browser
         lasciata sullo sfondo i fotogrammi non arrivano affatto, e il giro
         resterebbe fermo su uno schermo scuro finché non la si riguarda. */
      if (performance.now() < scade) { attesa = setTimeout(cerca, 80); return; }
      const prossimo = indice + (verso.current || 1);
      if (prossimo < 0 || prossimo >= elenco.current.length) azioni.current.onChiudi?.();
      else setIndice(prossimo);
    };
    cerca();
    return () => { vivo = false; clearTimeout(attesa); clearTimeout(lento); };
  }, [indice, passi.length, menoMoto, misura]);

  /* Il faro insegue l'elemento: scorrimento, ridimensionamento della finestra
     e anche i cambi di misura dell'elemento stesso (un elenco che finisce di
     caricarsi cresce sotto al faro). */
  useEffect(() => {
    if (!pronto || !mirino.current) return undefined;
    misura();
    let raf = 0;
    // Scorrimento e ridimensionamento arrivano a raffica: un fotogramma, una misura.
    const ora = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(misura); };
    window.addEventListener("resize", ora);
    window.addEventListener("scroll", ora, true);
    const osserva = new ResizeObserver(ora);
    osserva.observe(mirino.current);
    /* E il faro aspetta anche che la scheda finisca di posarsi. Cambiando
       scheda il contenuto entra in dissolvenza scendendo di dodici pixel
       (l'animazione del cambio scheda, in Interno.jsx): l'elemento esiste —
       e quindi il passo parte — mentre è ancora per strada, e il rettangolo
       del primo istante non è quello dove si fermerà. Lo spostamento è una
       trasformazione, non un cambio di misura: né il ResizeObserver né lo
       scorrimento se ne accorgono, e senza questo il faro restava storto per
       sempre, con il filo d'oro che tagliava dentro l'elemento. Per mezzo
       secondo, quindi, si rimisura e basta: se il rettangolo non cambia non
       ridisegna niente (vedi `misura`). */
    let battute = ASSESTAMENTI;
    let posa = setTimeout(function assesta() {
      misura();
      if (--battute > 0) posa = setTimeout(assesta, 60);
    }, 60);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(posa);
      window.removeEventListener("resize", ora);
      window.removeEventListener("scroll", ora, true);
      osserva.disconnect();
    };
  }, [pronto, indice, misura]);

  /* Dove appoggiare la vignetta: sotto il faro se ci sta, sennò sopra. Se non
     ci sta da nessuna delle due parti si sceglie il lato più largo e la si
     tiene comunque dentro lo schermo — meglio sovrapposta che tagliata fuori.
     Prima del disegno, non dopo: sennò si vede il salto. */
  useLayoutEffect(() => {
    const el = carta.current;
    if (!el || !pronto) return;
    const vw = schermo.l;
    const vh = schermo.a;
    const l = el.offsetWidth;
    const a = el.offsetHeight;
    altaCarta.current = a;
    if (!rett) {
      setPosa({ top: Math.max(BORDO, (vh - a) / 2), sinistra: Math.max(BORDO, (vw - l) / 2) });
      return;
    }
    const sotto = vh - (rett.top + rett.altezza) - STACCO;
    const sopra = rett.top - STACCO;
    let top;
    if (sotto >= a) top = rett.top + rett.altezza + STACCO;
    else if (sopra >= a) top = rett.top - STACCO - a;
    else if (sotto >= sopra) top = Math.max(BORDO, vh - a - BORDO);
    else top = BORDO;
    const centro = rett.sinistra + rett.larghezza / 2 - l / 2;
    const sinistra = Math.min(Math.max(BORDO, centro), Math.max(BORDO, vw - l - BORDO));
    setPosa({ top, sinistra });
  }, [rett, pronto, indice, schermo]);

  /* Tastiera: Esc salta, le frecce e Invio sfogliano. Invio su un pulsante lo
     lascia fare al pulsante, sennò un «Indietro» premuto col tasto andrebbe
     avanti. */
  useEffect(() => {
    const tasto = (e) => {
      if (e.key === "Escape") { e.preventDefault(); salta(); return; }
      if (e.key === "Enter" && e.target?.tagName === "BUTTON") return;
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); avanti(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); indietro(); }
    };
    document.addEventListener("keydown", tasto);
    return () => document.removeEventListener("keydown", tasto);
  }, [avanti, indietro, salta]);

  /* Il fuoco non deve scappare dietro il velo: quello che sta sotto è
     oscurato e non si può usare, quindi con il tabulatore si gira dentro la
     vignetta e basta. */
  useEffect(() => {
    const riprendi = (e) => {
      // La via d'uscita sul buio sta fuori dalla vignetta ed è l'unica cosa
      // che si può usare quando la vignetta non c'è ancora: quella si lascia.
      if (carta.current && !carta.current.contains(e.target)
        && !e.target?.closest?.(".dip-giro-fuga")) {
        carta.current.focus({ preventScroll: true });
      }
    };
    document.addEventListener("focusin", riprendi);
    return () => document.removeEventListener("focusin", riprendi);
  }, []);

  // A ogni passo la vignetta si riprende il fuoco: il lettore di schermo la legge.
  useEffect(() => {
    if (pronto) carta.current?.focus({ preventScroll: true });
  }, [pronto, indice]);

  if (!passo) return null;

  const mostra = pronto && !!posa;

  return (
    <div className="dip-giro">
      {/* Ferma i clic sul sito, e fa da velo quando non c'è niente da
          illuminare (il benvenuto). Quando il faro è acceso è il faro stesso
          a fare il buio, e questo resta trasparente. */}
      <motion.div className="dip-giro-buio"
        initial={{ opacity: 1 }}
        animate={{ opacity: rett ? 0 : 1 }}
        transition={{ duration: menoMoto ? 0 : 0.2 }}
        onMouseDown={(e) => e.preventDefault()} />

      {/* Aspettando una scheda che tarda, sullo schermo c'è solo il nero: la
          vignetta con il suo «Salta» non è ancora comparsa e su un telefono
          non c'è nessun Esc da premere. Senza questo, chi ha la rete lenta
          resta davanti a una pagina spenta che sembra guasta. */}
      {tardi && !mostra && (
        <button type="button" className="dip-giro-fuga" onClick={salta}>
          Salta la presentazione
        </button>
      )}

      <AnimatePresence>
        {rett && (
          <motion.div key="faro" className="dip-giro-faro" aria-hidden="true"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: menoMoto ? 0 : 0.2 }}
            style={{
              top: rett.top, left: rett.sinistra,
              width: rett.larghezza, height: rett.altezza,
            }} />
        )}
      </AnimatePresence>

      {/* La vignetta non scivola da un passo all'altro: sbiadisce, si sposta
          mentre non si vede, e torna. Scivolare voleva dire vederla arrivare
          dall'angolo la prima volta, quando ancora non si sa quanto è alta. */}
      <motion.aside className="dip-giro-carta" ref={carta} tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby="dip-giro-titolo"
        initial={{ opacity: 0 }}
        animate={{ opacity: mostra ? 1 : 0 }}
        transition={{ duration: menoMoto ? 0 : 0.22 }}
        style={{
          top: posa?.top ?? 0, left: posa?.sinistra ?? 0,
          pointerEvents: mostra ? "auto" : "none",
        }}>
        <span className="dip-giro-eyebrow">
          <Icon name="info" size={12} color="var(--cra-red)" />
          Come funziona
        </span>
        <h2 className="dip-giro-titolo" id="dip-giro-titolo">{passo.titolo}</h2>
        <p className="dip-giro-testo">{passo.testo}</p>

        <div className="dip-giro-piede">
          <span className="dip-giro-pallini" role="img"
            aria-label={`Passo ${indice + 1} di ${passi.length}`}>
            {passi.map((p, i) => (
              <i key={p.codice} className={i <= indice ? "on" : ""} aria-hidden="true" />
            ))}
          </span>
          <button type="button" className="adm-btn ghost mini" onClick={indietro}
            disabled={indice === 0}>
            <Icon name="chevron-left" size={13} /> Indietro
          </button>
          <button type="button" className="adm-btn mini" onClick={avanti}>
            {ultimo ? "Comincio" : "Avanti"} <Icon name="chevron-right" size={13} />
          </button>
        </div>

        <button type="button" className="dip-giro-salta" onClick={salta}>
          Salta la presentazione
        </button>
      </motion.aside>
    </div>
  );
}
