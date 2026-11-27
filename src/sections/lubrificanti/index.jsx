import React from "react";
import { Icon } from "../../components/Icon.jsx";
import * as api from "./api.js";
import { costruisciIndici } from "./dati.js";
import TrovaOlio from "./TrovaOlio.jsx";
import Ordine from "./Ordine.jsx";
import PrezziVendita from "./PrezziVendita.jsx";
import Listini from "./Listini.jsx";
import "./stile.css";

const { useState, useEffect, useCallback, useMemo } = React;

/* ============================================================
   LUBRIFICANTI — «ognuno il suo banco» (proposta C, scelta il 26/11/2026).

   Si arriva sempre su «Trova l'olio», per tutti (scelta dell'utente, 27/11).
   Manager, finanza e amministratore hanno in più l'Ordine (elenco a cascata,
   suggeritore, alternative, paragone) e i Prezzi di vendita; l'amministratore
   anche Listini e condizioni. Gli altri vedono solo i prezzi di vendita.
   `puoGestire` e `isAdmin` decidono soltanto cosa MOSTRARE: costi, condizioni,
   ordini e giacenze a chi non comanda non arrivano nemmeno, li ferma il database.
   ============================================================ */

export default function Lub(props) {
  const { puoGestire, isAdmin, setErr } = props;
  const [catalogo, setCatalogo] = useState(null);
  const [acquisto, setAcquisto] = useState(null);
  const [errore, setErrore] = useState(null);
  const [pagina, setPagina] = useState("trova");
  const [richiestaOrdine, setRichiestaOrdine] = useState(null);

  const carica = useCallback(async () => {
    setErrore(null);
    try {
      const [c, a] = await Promise.all([api.caricaCatalogo(), puoGestire ? api.caricaAcquisto() : Promise.resolve(null)]);
      setCatalogo(c);
      setAcquisto(a);
    } catch (e) {
      setErrore(e.message);
    }
  }, [puoGestire]);

  useEffect(() => { carica(); }, [carica]);

  const indici = useMemo(() => (catalogo ? costruisciIndici(catalogo, acquisto) : null), [catalogo, acquisto]);

  /* Un prezzo cambiato si aggiorna subito qui, senza ricaricare tutto il catalogo. */
  const cambiaPrezzoLocale = useCallback((formatoId, prezzo) => {
    setCatalogo((c) => {
      const altri = c.prezzi.filter((p) => p.formato_id !== formatoId);
      return { ...c, prezzi: prezzo == null ? altri : [...altri, { formato_id: formatoId, prezzo, aggiornato_il: new Date().toISOString() }] };
    });
  }, []);

  const apriNellOrdine = useCallback((marchioId, olioId) => {
    setRichiestaOrdine({ marchioId, olioId, quando: Date.now() });
    setPagina("ordine");
  }, []);

  const pagine = [
    { id: "trova", nome: "Trova l'olio" },
    puoGestire && { id: "ordine", nome: "Ordine" },
    puoGestire && { id: "prezzi", nome: "Prezzi di vendita" },
    isAdmin && { id: "listini", nome: "Listini e condizioni" },
  ].filter(Boolean);

  if (errore) {
    return (
      <div className="mod-lub-scheda mod-lub-vuoto">
        <strong><Icon name="alert-circle" size={16} /> {errore}</strong>
        <button type="button" className="adm-btn ghost mini" onClick={carica}><Icon name="refresh-cw" size={13} /> Riprova</button>
      </div>
    );
  }
  if (!indici) return <div className="mod-lub-scheda mod-lub-vuoto">Caricamento lubrificanti…</div>;
  if (catalogo.oli.length === 0) return <div className="mod-lub-scheda mod-lub-vuoto">Il catalogo lubrificanti è ancora vuoto.</div>;

  const comuni = { ...props, indici, catalogo, acquisto, ricarica: carica, setErr };

  return (
    <div className="mod-lub-radice">
      <header className="mod-lub-testata">
        <div className="mod-lub-testata-riga">
          <span className="mod-lub-testata-titolo">{pagine.find((p) => p.id === pagina)?.nome ?? "Lubrificanti"}</span>
          <nav className="mod-lub-nav" aria-label="Sezioni lubrificanti">
            {pagine.map((p) => (
              <button key={p.id} type="button" className={`mod-lub-nav-voce ${pagina === p.id ? "on" : ""}`}
                aria-current={pagina === p.id ? "page" : undefined} onClick={() => setPagina(p.id)}>
                <strong>{p.nome}</strong>
              </button>
            ))}
          </nav>
        </div>
        <div className="mod-lub-striscia" />
      </header>
      {pagina === "trova" && <TrovaOlio {...comuni} apriNellOrdine={puoGestire ? apriNellOrdine : null} />}
      {pagina === "ordine" && puoGestire && <Ordine {...comuni} richiesta={richiestaOrdine} />}
      {pagina === "prezzi" && puoGestire && <PrezziVendita {...comuni} cambiaPrezzoLocale={cambiaPrezzoLocale} />}
      {pagina === "listini" && isAdmin && <Listini {...comuni} />}
    </div>
  );
}
