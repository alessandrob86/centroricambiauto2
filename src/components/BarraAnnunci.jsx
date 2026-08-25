import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Icon } from "./Icon.jsx";
import { useAuth } from "../lib/auth.jsx";
import { testoSu, sfondoChiaro } from "../lib/contrasto.js";
import { motoIcona, haAlone, stileEffetto, restante, agliSgoccioli } from "../lib/stileAvviso.js";
import { getAnnunci, segnaLetto, ascolta } from "../lib/internoApi.js";

const { useState, useEffect, useCallback } = React;

/* Striscia annunci in testa a TUTTO il sito.
 *
 * Sta qui e non dentro Interno.jsx di proposito: quel modulo si carica solo
 * quando lo apri, mentre la barra deve poter comparire anche mentre il
 * dipendente guarda la home pubblica. Per chi non è personale non fa
 * nemmeno la chiamata.
 *
 * Il colore lo sceglie chi scrive l'annuncio, e la barra ci si dipinge sopra
 * per intero. È deliberato: la prima versione era antracite come l'header
 * che le sta sotto, e il risultato era una striscia che nessuno notava.
 * Un avviso che non si vede non è un avviso.
 */

/** L'icona la sceglie chi scrive; se non l'ha scelta, la priorità decide. */
const iconaDi = (a) => a.icona || (a.priorita >= 10 ? "triangle-alert" : "megaphone");

/** Conto alla rovescia: un secondo, e si ferma se la scheda è in secondo
 *  piano — nessuno guarda un timer che non vede. */
function Countdown({ fine, colore }) {
  const [r, setR] = useState(() => restante(fine));
  useEffect(() => {
    setR(restante(fine));
    const t = setInterval(() => { if (!document.hidden) setR(restante(fine)); }, 1000);
    return () => clearInterval(t);
  }, [fine]);
  if (!r) return null;
  const urgente = agliSgoccioli(r);
  return (
    <motion.span className={`dip-barra-timer ${urgente ? "urgente" : ""}`}
      style={{ borderColor: colore, color: colore }}
      animate={urgente ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
      transition={urgente ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}>
      <Icon name="timer" size={12} color={colore} />
      <span className="dip-barra-timer-cifre">{r.testo}</span>
    </motion.span>
  );
}

export function BarraAnnunci({ onNavigate }) {
  const { isStaff, dipendente } = useAuth();
  const menoMoto = useReducedMotion();
  const [avvisi, setAvvisi] = useState([]);
  const [i, setI] = useState(0);

  const carica = useCallback(async () => {
    if (!isStaff) { setAvvisi([]); return; }
    try {
      const a = await getAnnunci(true);
      setAvvisi(a.filter((x) => !x.letto));
    } catch { /* la barra è un di più: non deve rompere il sito */ }
  }, [isStaff]);

  useEffect(() => { carica(); }, [carica]);

  /* Tempo reale: pubblicare un annuncio lo fa comparire sugli schermi
     degli altri all'istante. Prima bisognava ricaricare la pagina, e un
     avviso che si vede solo dopo un F5 è un avviso mancato. */
  useEffect(() => {
    if (!isStaff) return undefined;
    return ascolta("annunci", () => { carica(); setI(0); });
  }, [isStaff, carica]);

  /* Più avvisi: scorrono da soli ogni 7 secondi. Abbastanza per leggere,
     abbastanza poco da non restare fermi su uno solo. Si ferma quando la
     pagina non è in primo piano e quando l'utente vuole meno movimento. */
  useEffect(() => {
    if (avvisi.length < 2 || menoMoto) return undefined;
    const t = setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % avvisi.length);
    }, 7000);
    return () => clearInterval(t);
  }, [avvisi.length, menoMoto]);

  if (!isStaff || !avvisi.length) return null;

  const idx = Math.min(i, avvisi.length - 1);
  const a = avvisi[idx];
  const sfondo = a.colore || "#FDC543";
  const testo = testoSu(sfondo);
  const chiaro = sfondoChiaro(sfondo);
  /* Bordi e velature devono restare visibili su qualunque colore: su fondo
     chiaro si vela di nero, su fondo scuro di bianco. */
  const velo = (q) => (chiaro ? `rgba(0,0,0,${q})` : `rgba(255,255,255,${q})`);

  const chiudi = async () => {
    await segnaLetto(a.id, dipendente?.id).catch(() => {});
    setAvvisi((prev) => prev.filter((x) => x.id !== a.id));
    setI(0);
  };

  /* Icona, animazione ed effetto li ha scelti chi ha scritto l'annuncio.
     Chi ha chiesto meno movimento al sistema operativo non li subisce. */
  const moto = menoMoto ? null : motoIcona(a.animazione);
  const effetto = stileEffetto(a.effetto, sfondo, a.colore_effetto);

  return (
    <motion.div className="dip-barra" role="status" aria-live="polite"
      style={{ background: sfondo, color: testo, "--dip-velo": velo(0.28), ...effetto }}
      initial={menoMoto ? false : { y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}>
      <div className="dip-barra-in">
        {/* Sfondo trasparente: il quadratino dietro l'icona si vedeva e
            non aggiungeva niente. Resta solo l'icona con la sua animazione. */}
        <span className="dip-barra-icona">
          {haAlone(a.animazione) && !menoMoto && (
            <motion.span aria-hidden="true" className="dip-barra-alone"
              style={{ background: testo }}
              animate={{ opacity: [0.35, 0, 0.35], scale: [1, 1.7, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
          )}
          <motion.span key={`${a.id}-icona`} style={{ display: "inline-flex", position: "relative", zIndex: 1 }} {...(moto ?? {})}>
            <Icon name={iconaDi(a)} size={17} color={testo} />
          </motion.span>
        </span>

        <div className="dip-barra-testo">
          <AnimatePresence mode="wait">
            <motion.div key={a.id}
              initial={menoMoto ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={menoMoto ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
              <b className="dip-barra-titolo">{a.titolo}</b>
              {a.corpo && <span className="dip-barra-corpo">{a.corpo}</span>}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="dip-barra-azioni">
          {/* Se c'è una scadenza, si vede quanto manca: "chiuso fino a
              venerdì" si legge diverso se mancano due ore o due giorni. */}
          {a.scade_il && <Countdown fine={a.scade_il} colore={testo} />}
          {avvisi.length > 1 && (
            <span className="dip-barra-punti" role="tablist" aria-label="Annunci">
              {avvisi.map((x, n) => (
                <button key={x.id} role="tab" aria-selected={n === idx}
                  aria-label={`Annuncio ${n + 1} di ${avvisi.length}`}
                  className={`dip-barra-punto ${n === idx ? "on" : ""}`}
                  style={{ background: testo, opacity: n === idx ? 1 : 0.35 }}
                  onClick={() => setI(n)} />
              ))}
            </span>
          )}
          <button className="dip-barra-btn" style={{ borderColor: velo(0.4), color: testo }}
            onClick={() => onNavigate?.("interno")}>
            <Icon name="chevron-right" size={13} color={testo} /> Bacheca
          </button>
          <button className="dip-barra-btn forte"
            style={{ background: testo, color: sfondo, borderColor: testo }}
            onClick={chiudi}>
            <Icon name="check" size={13} color={sfondo} /> Letto
          </button>
        </div>
      </div>
    </motion.div>
  );
}
