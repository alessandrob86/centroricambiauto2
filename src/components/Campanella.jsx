import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Icon } from "./Icon.jsx";
import { useAuth } from "../lib/auth.jsx";
import { testoSu } from "../lib/contrasto.js";
import { getNotifiche, segnaNotificaLetta, segnaTutteLette, ascolta } from "../lib/internoApi.js";

const { useState, useEffect, useRef, useCallback } = React;

/** Il neon scelto sull'annuncio si ritrova, in piccolo, sulla notifica. */
const alone = (n) =>
  n.effetto === "neon" ? { boxShadow: `0 0 0 1px ${n.colore ?? "#BD3432"}, 0 0 10px ${n.colore ?? "#BD3432"}aa` }
    : n.effetto === "alone" ? { boxShadow: `0 2px 10px ${n.colore ?? "#BD3432"}88` }
      : {};

/* Campanella delle notifiche, nell'header accanto al menu Ecom.
 *
 * Tre strade per la stessa informazione:
 *   1. il pallino sulla campanella — sempre, non chiede permessi;
 *   2. l'elenco che si apre al clic;
 *   3. la notifica di sistema di Windows, se l'utente l'ha concessa.
 *
 * Le notifiche arrivano in tempo reale: chi pubblica un annuncio lo fa
 * comparire sugli schermi degli altri senza che nessuno prema F5.
 */

const quando = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ora";
  if (m < 60) return `${m} min fa`;
  if (m < 1440) return `${Math.round(m / 60)} h fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
};

export function Campanella({ onNavigate }) {
  const { isStaff, dipendente } = useAuth();
  const menoMoto = useReducedMotion();
  const [righe, setRighe] = useState([]);
  const [aperta, setAperta] = useState(false);
  const [permesso, setPermesso] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const box = useRef(null);
  const primaVolta = useRef(true);

  const carica = useCallback(async () => {
    if (!isStaff) { setRighe([]); return; }
    try { setRighe(await getNotifiche(40)); } catch { /* silenzioso: è un di più */ }
  }, [isStaff]);

  useEffect(() => { carica(); }, [carica]);

  /* Tempo reale. Alla prima lettura non si suona: sarebbero notifiche
     vecchie che rimbalzano a ogni apertura di pagina. */
  useEffect(() => {
    if (!isStaff) return undefined;
    const stop = ascolta("notifiche", async (msg) => {
      await carica();
      if (msg.eventType !== "INSERT" || primaVolta.current) return;
      const n = msg.new;
      if (permesso === "granted" && typeof Notification !== "undefined") {
        try {
          new Notification(n.titolo ?? "Centro Ricambi Auto", {
            body: n.corpo ?? "", tag: n.id, icon: "/cra-logo-light.png",
          });
        } catch { /* alcuni browser la vogliono dal service worker: pazienza */ }
      }
    });
    primaVolta.current = false;
    return stop;
  }, [isStaff, carica, permesso]);

  // Clic fuori e Esc chiudono il pannello.
  useEffect(() => {
    if (!aperta) return undefined;
    const fuori = (e) => { if (box.current && !box.current.contains(e.target)) setAperta(false); };
    const esc = (e) => { if (e.key === "Escape") setAperta(false); };
    document.addEventListener("mousedown", fuori);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuori); document.removeEventListener("keydown", esc); };
  }, [aperta]);

  if (!isStaff) return null;

  const daLeggere = righe.filter((n) => !n.letto).length;

  const chiediPermesso = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermesso(p);
    if (p === "granted") {
      new Notification("Notifiche attive", { body: "Ti avviseremo qui sul desktop.", icon: "/cra-logo-light.png" });
    }
  };

  const apri = async (n) => {
    await segnaNotificaLetta(n.id, dipendente?.id).catch(() => {});
    setRighe((prev) => prev.map((x) => (x.id === n.id ? { ...x, letto: true } : x)));
    setAperta(false);
    if (n.rotta) onNavigate?.(n.rotta);
  };

  const tutteLette = async () => {
    await segnaTutteLette(righe, dipendente?.id).catch(() => {});
    setRighe((prev) => prev.map((x) => ({ ...x, letto: true })));
  };

  return (
    <div className="dip-camp" ref={box}>
      {/* `data-giro`: il giro di presentazione si aggancia qui. Non alla
          classe, che cambia col foglio di stile. */}
      <button className="dip-camp-btn" data-giro="campanella"
        onClick={() => setAperta((v) => !v)}
        aria-label={daLeggere ? `Notifiche: ${daLeggere} da leggere` : "Notifiche"}
        aria-expanded={aperta}>
        {/* La campanella si scuote solo quando c'è qualcosa di nuovo. */}
        <motion.span
          animate={daLeggere && !menoMoto ? { rotate: [0, -12, 10, -6, 0] } : { rotate: 0 }}
          transition={{ duration: 0.7, repeat: daLeggere && !menoMoto ? Infinity : 0, repeatDelay: 4.5 }}
          style={{ display: "inline-flex" }}>
          <Icon name="bell" size={18} color="var(--cra-white)" />
        </motion.span>
        <AnimatePresence>
          {daLeggere > 0 && (
            <motion.span className="dip-camp-badge"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 22 }}>
              {daLeggere > 9 ? "9+" : daLeggere}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Il pannello si apre verso l'alto: il pulsante sta in basso. */}
      <AnimatePresence>
        {aperta && (
          <motion.div className="dip-camp-pannello" role="dialog" aria-label="Notifiche"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
            <div className="dip-camp-testa">
              <b>Notifiche</b>
              {daLeggere > 0 && (
                <button className="dip-camp-link" onClick={tutteLette}>segna tutte lette</button>
              )}
            </div>

            {permesso === "default" && (
              <button className="dip-camp-permesso" onClick={chiediPermesso}>
                <Icon name="bell" size={14} color="var(--cra-charcoal)" />
                Attiva gli avvisi sul desktop
              </button>
            )}
            {permesso === "denied" && (
              <p className="dip-camp-vuoto">
                Gli avvisi di sistema sono bloccati per questo sito. Si riattivano dal lucchetto
                nella barra degli indirizzi.
              </p>
            )}

            <div className="dip-camp-lista">
              {righe.length === 0 ? <p className="dip-camp-vuoto">Nessuna notifica.</p> :
                righe.map((n, i) => (
                  <motion.button key={n.id} className={`dip-camp-riga ${n.letto ? "letta" : ""}`}
                    onClick={() => apri(n)}
                    initial={menoMoto ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.025, 0.2) }}>
                    {/* Icona, colore ed effetto arrivano dall'avviso che
                        l'ha generata: quello che scegli si ritrova qui. */}
                    <span className="dip-camp-icona"
                      style={{ background: n.colore || "var(--cra-charcoal)", ...alone(n) }}>
                      <Icon name={n.icona || "bell"} size={13} color={testoSu(n.colore || "#272D2B")} />
                    </span>
                    <span className="dip-camp-testo">
                      <b>{n.titolo}</b>
                      {n.corpo && <span>{n.corpo}</span>}
                      <em>{quando(n.created_at)}</em>
                    </span>
                    {!n.letto && <span className="dip-camp-punto" aria-hidden="true" />}
                  </motion.button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
