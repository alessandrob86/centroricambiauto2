import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "./Icon.jsx";
import { useAuth } from "../lib/auth.jsx";
import { inviaFeedback } from "../lib/internoApi.js";

const { useState, useEffect, useRef } = React;

/* La cassetta dei suggerimenti, sopra la campanella.
 *
 * Sta lì e basta: nessun questionario, nessuna stella da assegnare, nessuna
 * finestra che compare da sola dopo trenta secondi. Chi trova una cosa
 * storta la scrive nel momento in cui la vede — che è l'unico momento in cui
 * se la ricorda per intero — e torna a lavorare.
 *
 * Tre scelte che valgono la pena spiegare:
 *
 *  · Il testo scritto NON si perde chiudendo. Il componente resta montato e
 *    si tiene la bozza: chiudere per controllare una cosa e ritrovare il
 *    riquadro vuoto è il modo più veloce per non ricevere più segnalazioni.
 *
 *  · Si manda anche con Ctrl+Invio. Chi scrive in fretta non stacca le mani
 *    dalla tastiera per cercare un pulsante.
 *
 *  · Dopo l'invio non si dice «grazie per il tuo prezioso contributo»: si
 *    dice che è arrivato, e la finestra si chiude da sola. Il ringraziamento
 *    lo fa chi risponde, non un cartello.
 */

const MAX = 4000;

export function Feedback() {
  const { isStaff, dipendente } = useAuth();
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState("");
  const [fase, setFase] = useState("scrivo");   // scrivo | mando | fatto
  const [err, setErr] = useState(null);
  const box = useRef(null);
  const area = useRef(null);

  // Clic fuori e Esc chiudono, come fa la campanella qui accanto.
  useEffect(() => {
    if (!aperto) return undefined;
    const fuori = (e) => { if (box.current && !box.current.contains(e.target)) setAperto(false); };
    const esc = (e) => { if (e.key === "Escape") setAperto(false); };
    document.addEventListener("mousedown", fuori);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuori); document.removeEventListener("keydown", esc); };
  }, [aperto]);

  /* Il fuoco arriva dopo l'animazione d'entrata: darlo subito, mentre il
     riquadro sta ancora scivolando, fa saltare la pagina sotto. */
  useEffect(() => {
    if (!aperto || fase !== "scrivo") return undefined;
    const t = setTimeout(() => area.current?.focus(), 220);
    return () => clearTimeout(t);
  }, [aperto, fase]);

  if (!isStaff) return null;

  const manda = async () => {
    const t = testo.trim();
    if (t.length < 4) { setErr("Scrivi qualcosa in più."); return; }
    setFase("mando"); setErr(null);
    try {
      await inviaFeedback(t, window.location.hash || "/");
      setFase("fatto");
      setTesto("");
      setTimeout(() => { setAperto(false); setFase("scrivo"); }, 2200);
    } catch (e) {
      setFase("scrivo");
      setErr(String(e?.message || "Non è partito. Riprova fra poco."));
    }
  };

  const tasti = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); manda(); }
  };

  return (
    <div className="dip-feed" ref={box}>
      <button className="dip-feed-btn" data-giro="feedback"
        onClick={() => setAperto((v) => !v)}
        aria-label="Manda un suggerimento" aria-expanded={aperto} title="Manda un suggerimento">
        <Icon name="message-circle" size={18} color="var(--cra-white)" />
      </button>

      <AnimatePresence>
        {aperto && (
          <motion.div className="dip-feed-pannello" role="dialog" aria-label="Manda un suggerimento"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>

            {fase === "fatto" ? (
              <div className="dip-feed-fatto">
                <Icon name="check-circle-2" size={30} color="#2e7d4f" />
                <b>Arrivato.</b>
                <span>Lo legge Alessandro. Se serve, ti risponde a questo indirizzo.</span>
              </div>
            ) : (
              <React.Fragment>
                <div className="dip-feed-testa">
                  <b>Dicci la tua</b>
                  <button className="dip-feed-x" onClick={() => setAperto(false)} aria-label="Chiudi">
                    <Icon name="x" size={14} />
                  </button>
                </div>

                <p className="dip-feed-intro">
                  Una cosa che non funziona, una che manca, una che ti fa perdere tempo.
                  Scrivila come viene{dipendente?.nome ? `, ${dipendente.nome}` : ""}: arriva
                  direttamente ad Alessandro.
                </p>

                <textarea ref={area} className="dip-feed-area" value={testo} maxLength={MAX}
                  onChange={(e) => { setTesto(e.target.value); if (err) setErr(null); }}
                  onKeyDown={tasti}
                  placeholder="Per esempio: sul telefono il pulsante «invia» finisce sotto la tastiera…" />

                {err && <p className="dip-feed-err">{err}</p>}

                <div className="dip-feed-piede">
                  <span className="dip-feed-conta">
                    {testo.length > MAX - 300 ? `${MAX - testo.length} caratteri` : "Ctrl+Invio per mandare"}
                  </span>
                  <button className="adm-btn" disabled={fase === "mando" || testo.trim().length < 4}
                    onClick={manda}>
                    {fase === "mando" ? "Mando…" : "Manda"}
                  </button>
                </div>
              </React.Fragment>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
