import React from "react";
import { Icon } from "../../components/Icon.jsx";
import * as api from "./api.js";
import { cerca } from "./dati.js";
import { GRUPPI, gruppo, euro, numero, margine, venditaLitro, confezione } from "./calcolo.js";

const { useState, useMemo, useRef, useEffect } = React;

/* «Trova l'olio»: la pagina del banco, come la tavola del Design.
   Una ricerca grande, la famiglia trovata subito sotto col titolo grande, e la
   tabella dei marchi con il prezzo di vendita di ogni formato. Chi comanda può
   accendere costo e margine (i costi glieli manda solo il database). */

export default function TrovaOlio({ indici, puoGestire, setErr, apriNellOrdine, ricarica }) {
  const [q, setQ] = useState("");
  const [famigliaElenco, setFamigliaElenco] = useState("");
  const [scelto, setScelto] = useState(0);
  const [conCosti, setConCosti] = useState(false);
  const [avviso, setAvviso] = useState(null);

  const cercando = q.trim().length >= 2;
  const trovati = useMemo(() => (cercando ? cerca(indici, q) : []), [indici, q, cercando]);

  /* Una voce per famiglia toccata dalla ricerca; gli oli senza famiglia da soli. */
  const risultati = useMemo(() => {
    const out = [];
    const viste = new Set();
    for (const o of trovati) {
      const legami = indici.famiglieDellOlio(o).filter((e) => e.stato !== "scartata");
      if (!legami.length) {
        out.push({ chiave: `o:${o.id}`, olio: o, cercato: o, titolo: `${indici.marchi.get(o.marchio_id)?.nome} ${o.nome}` });
      }
      for (const e of legami) {
        if (viste.has(e.famiglia_id)) continue;
        viste.add(e.famiglia_id);
        const f = indici.famiglie.get(e.famiglia_id);
        out.push({ chiave: e.famiglia_id, famiglia: f, cercato: o, titolo: f?.titolo });
      }
      if (out.length >= 12) break;
    }
    return out;
  }, [trovati, indici]);

  const categorie = useMemo(() => {
    const m = new Map();
    for (const f of indici.famiglie.values()) {
      const c = f.categoria || "Altro";
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(f);
    }
    return [...m.entries()];
  }, [indici]);

  const attivo = cercando
    ? risultati[Math.min(scelto, Math.max(0, risultati.length - 1))] ?? null
    : famigliaElenco ? { chiave: famigliaElenco, famiglia: indici.famiglie.get(famigliaElenco) } : null;

  const segnala = async (equivalenza, olio) => {
    const motivo = window.prompt(`Cosa non ti convince di ${olio.nome} come alternativa?`);
    if (!motivo?.trim()) return;
    try {
      await api.segnala(equivalenza.id, motivo.trim().slice(0, 1000));
      setAvviso("Segnalazione inviata: l'amministratore la trova in «Listini e condizioni».");
      ricarica();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <React.Fragment>
      <section className="mod-lub-scheda piena mod-lub-riga fine" aria-label="Ricerca">
        <label className="mod-lub-campo grande">
          <span>Che olio cerchi?</span>
          <input type="search" value={q} autoFocus placeholder="Codice, nome, gradazione o omologazione (es. 8972, Top Tec 4200, VW 504.00)"
            onChange={(e) => { setQ(e.target.value); setScelto(0); setAvviso(null); }} />
        </label>
        <label className="mod-lub-campo largo">
          <span>Oppure scegli una famiglia</span>
          <select value={cercando ? "" : famigliaElenco} onChange={(e) => { setFamigliaElenco(e.target.value); setQ(""); }}>
            <option value="">—</option>
            {categorie.map(([cat, fams]) => (
              <optgroup key={cat} label={cat}>
                {fams.map((f) => <option key={f.id} value={f.id}>{f.titolo}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {puoGestire && (
          <label className="mod-lub-spunta">
            <input type="checkbox" checked={conCosti} onChange={(e) => setConCosti(e.target.checked)} />
            Mostra costo e margine
          </label>
        )}
      </section>

      {avviso && <p className="mod-lub-avviso">{avviso}</p>}

      {cercando && risultati.length > 1 && (
        <div className="mod-lub-risultati" role="group" aria-label="Famiglie trovate">
          <span className="mod-lub-etichetta">Trovate {risultati.length}{risultati.length >= 12 ? "+" : ""}</span>
          {risultati.map((r, i) => (
            <button key={r.chiave} type="button" className={`mod-lub-risultato ${r === attivo ? "on" : ""}`} aria-pressed={r === attivo} onClick={() => setScelto(i)}>
              {r.titolo}
            </button>
          ))}
        </div>
      )}

      {cercando && !risultati.length && (
        <div className="mod-lub-scheda mod-lub-vuoto">
          <strong>Nessun olio corrisponde a «{q.trim()}»</strong>
          Prova con un codice, una gradazione (es. 5W-30) o un'omologazione (es. VW 504.00).
        </div>
      )}
      {!cercando && !attivo && (
        <div className="mod-lub-scheda mod-lub-vuoto">
          <strong>Scrivi cosa cerca il cliente</strong>
          Inserisci codice, nome, gradazione o omologazione, oppure scegli una famiglia dall'elenco.
        </div>
      )}

      {attivo && (
        <Famiglia key={attivo.chiave} r={attivo} indici={indici} puoGestire={puoGestire} conCosti={puoGestire && conCosti}
          onSegnala={segnala} apriNellOrdine={apriNellOrdine} />
      )}
    </React.Fragment>
  );
}

function Famiglia({ r, indici, puoGestire, conCosti, onSegnala, apriNellOrdine }) {
  const righe = useMemo(() => {
    if (r.olio) return [{ olio: r.olio, stato: null, equivalenza: null }];
    return indici.oliDellaFamiglia(r.famiglia.id)
      .filter((e) => e.stato !== "scartata")
      .map((e) => ({ olio: indici.oli.get(e.olio_id), stato: e.stato, equivalenza: e }))
      .filter((x) => x.olio)
      .sort((x, y) =>
        (indici.marchi.get(x.olio.marchio_id)?.sort_order ?? 9) - (indici.marchi.get(y.olio.marchio_id)?.sort_order ?? 9)
        || Number(x.stato !== "confermata") - Number(y.stato !== "confermata")
        || x.olio.nome.localeCompare(y.olio.nome));
  }, [r, indici]);

  /* Solo le colonne dei formati che qualcuno ha davvero. */
  const colonne = useMemo(() => GRUPPI.filter((g) => righe.some((x) => x.olio.formati.some((f) => f.attivo !== false && gruppo(f.litri) === g.chiave))), [righe]);
  const marchioCercato = r.cercato ? indici.marchi.get(r.cercato.marchio_id)?.nome : null;
  const ciSonoDaVerificare = righe.some((x) => x.stato === "da_verificare");

  return (
    <React.Fragment>
      <div className="mod-lub-scheda piena mod-lub-famiglia-testa">
        <h2 className="mod-lub-famiglia-titolo">{r.famiglia ? r.famiglia.titolo : r.olio.nome}</h2>
        <span className="mod-lub-famiglia-spec">{r.famiglia ? r.famiglia.specifiche : [r.olio.sae, r.olio.norme].filter(Boolean).join(" · ")}</span>
        {r.famiglia && r.cercato && <span className="mod-lub-famiglia-nota">Hai cercato «{r.cercato.nome}»: è il {marchioCercato} di questa famiglia.</span>}
        {!r.famiglia && <span className="mod-lub-famiglia-nota">Questo olio non è ancora associato a una famiglia: non ha alternative di altri marchi.</span>}
      </div>

      <div className="mod-lub-scheda">
        <div className="mod-lub-scorre">
          <table className="mod-lub-griglia">
            <caption>Prezzo di vendita della confezione, IVA esclusa · listino base{conCosti ? " · sotto: costo d'acquisto con CONOU e margine" : ""}</caption>
            <thead>
              <tr>
                <th scope="col">Marchio · Olio</th>
                {colonne.map((g) => <th key={g.chiave} scope="col">{g.nome}</th>)}
                {puoGestire && <th scope="col"><span className="mod-lub-muto">Azioni</span></th>}
              </tr>
            </thead>
            <tbody>
              {righe.map((x) => (
                <Riga key={x.olio.id} x={x} indici={indici} colonne={colonne} conCosti={conCosti} puoGestire={puoGestire}
                  cercato={r.cercato?.id === x.olio.id} onSegnala={onSegnala} apriNellOrdine={apriNellOrdine} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mod-lub-legenda">
        {ciSonoDaVerificare && (
          <span><strong>Da verificare</strong>: l'equivalenza non è ancora confermata. Il prezzo appare in grigio, ma non è ancora un'alternativa sicura da proporre al cliente.</span>
        )}
        {conCosti && <span>Margine sul prezzo di vendita: in rosso sotto il 25%.</span>}
        {righe.some((x) => indici.marchi.get(x.olio.marchio_id)?.casa) && (
          <span>{indici.casaCollegata ? "I prezzi L2F provengono dal Foglio MASTER e si modificano solo lì." : "I prezzi del nostro marchio arrivano dal catalogo del sito (collegamento non ancora attivo)."}</span>
        )}
      </div>
    </React.Fragment>
  );
}

function Riga({ x, indici, colonne, conCosti, puoGestire, cercato, onSegnala, apriNellOrdine }) {
  const marchio = indici.marchi.get(x.olio.marchio_id);
  const verifica = x.stato === "da_verificare";
  const perGruppo = new Map();
  for (const f of x.olio.formati.filter((y) => y.attivo !== false)) {
    const g = gruppo(f.litri);
    if (!perGruppo.has(g)) perGruppo.set(g, []);
    perGruppo.get(g).push(f);
  }
  const classi = [marchio?.casa ? "casa" : "", verifica ? "verifica" : "", cercato ? "cercato" : ""].join(" ");
  return (
    <tr className={classi}>
      <th scope="row">
        <span className="mod-lub-marchio-nome">{marchio?.nome}{marchio?.casa ? " · nostro marchio" : ""}</span>
        <span className="mod-lub-piccolo">{x.olio.nome}</span>
        {verifica && <span className="mod-lub-bollo giallo">da verificare</span>}
      </th>
      {colonne.map((g) => {
        const fs = perGruppo.get(g.chiave) ?? [];
        if (!fs.length) return <td key={g.chiave} className="mod-lub-solo-largo"><span className="mod-lub-cifra vuota">—</span></td>;
        const f = fs[0];
        const altri = fs.length > 1 ? ` · +${fs.length - 1} formato` : "";
        const prezzo = indici.prezzi.get(f.id);
        const costo = conCosti ? indici.costoDi({ formato: f, olio: x.olio }) : null;
        const m = conCosti ? margine(prezzo, f, costo) : null;
        return (
          <td key={g.chiave} data-etichetta={g.nome} title={`${f.codice} · ${confezione(f)}`}>
            {marchio?.casa && !prezzo ? (
              <>
                <span className="mod-lub-senza">{confezione(f)}</span>
                <span className="mod-lub-piccolo">prezzo dal catalogo{altri}</span>
              </>
            ) : prezzo ? (
              <>
                <span className="mod-lub-cifra">{euro(prezzo)}</span>
                <span className="mod-lub-piccolo">{verifica ? "da verificare · " : ""}{euro(venditaLitro(prezzo, f))} al litro · {confezione(f)}{altri}</span>
              </>
            ) : (
              <>
                <span className="mod-lub-senza">{confezione(f)}</span>
                <span className="mod-lub-piccolo">prezzo da impostare{altri}</span>
              </>
            )}
            <span className="mod-lub-codici">
              {fs.map((y) => <CopiaCodice key={y.id} codice={y.codice} />)}
            </span>
            {conCosti && (
              <span className="mod-lub-costo">
                {costo ? `costo ${euro(costo.finito * f.litri)}` : "costo —"}
                {m != null && <strong className={m < 0.25 ? "mod-lub-rosso" : ""}> · {numero(m * 100)}%</strong>}
              </span>
            )}
          </td>
        );
      })}
      {puoGestire && (
        <td>
          {apriNellOrdine && <button type="button" className="mod-lub-link" onClick={() => apriNellOrdine(x.olio.marchio_id, x.olio.id)}>Ordina</button>}
          {x.equivalenza && <button type="button" className="mod-lub-link" onClick={() => onSegnala(x.equivalenza, x.olio)}>Segnala</button>}
        </td>
      )}
    </tr>
  );
}

/* Il codice del formato, da copiare con un clic (per incollarlo nel gestionale o in un messaggio).
   Se il browser non lascia copiare, il codice resta comunque selezionabile a mano. */
function CopiaCodice({ codice }) {
  const [copiato, setCopiato] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(codice);
    } catch {
      return;
    }
    setCopiato(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiato(false), 1500);
  };
  return (
    <button type="button" className={`mod-lub-codice ${copiato ? "copiato" : ""}`} onClick={copia} title="Copia codice" aria-label={`Copia codice ${codice}`}>
      <span>{codice}</span>
      <Icon name={copiato ? "check" : "copy"} size={12} />
    </button>
  );
}
