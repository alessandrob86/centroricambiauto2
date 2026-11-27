import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { dataIt } from "./aiuti.js";
import * as api from "./api.js";
import { numero, TETTI_PARTENZA, GIORNI_PERIODO_ABC } from "./calcolo.js";
import Specifiche from "./Specifiche.jsx";

const { useState, useMemo, useEffect } = React;

/* «Listini e condizioni»: la pagina dell'amministratore. Condizioni dei marchi
   (a versioni: se ne apre una nuova, la vecchia resta nello storico), coda delle
   alternative da confermare, segnalazioni, tetti di scorta, listini caricati e
   la tabella di chi vede cosa. */

const SEZIONI = [
  ["condizioni", "Condizioni"], ["alternative", "Alternative da confermare"], ["segnalazioni", "Segnalazioni"],
  ["impostazioni", "Tetti scorta e ABC"], ["listini", "Listini caricati"], ["permessi", "Chi vede cosa"],
];

const MODALITA = [
  ["", "—"], ["lug26_10p1", "Netti con 10+1 (prudente)"], ["lug26_realistico", "Realistico: 10+1 solo ad alta rotazione"],
  ["lug26_base", "Netti base, senza 10+1"], ["lug26_extra10p1", "Extra 10+1 (−9,09%)"], ["giacenza", "Prezzi di giacenza"],
];

export default function Listini({ indici, catalogo, acquisto, setErr, ricarica }) {
  const [sezione, setSezione] = useState("condizioni");
  const aperteSegn = (acquisto?.segnalazioni ?? []).filter((s) => s.stato === "aperta").length;
  const daConfermare = catalogo.equivalenze.filter((e) => e.stato === "da_verificare").length;
  return (
    <React.Fragment>
      <div className="mod-lub-segmenti" role="tablist">
        {SEZIONI.map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={sezione === id} className={sezione === id ? "on" : ""} onClick={() => setSezione(id)}>
            {nome}
            {id === "alternative" && daConfermare > 0 && <span className="mod-lub-bollo">{daConfermare}</span>}
            {id === "segnalazioni" && aperteSegn > 0 && <span className="mod-lub-bollo rosso">{aperteSegn}</span>}
          </button>
        ))}
      </div>
      {sezione === "condizioni" && <Condizioni indici={indici} acquisto={acquisto} setErr={setErr} ricarica={ricarica} />}
      {sezione === "alternative" && <Coda indici={indici} catalogo={catalogo} setErr={setErr} ricarica={ricarica} />}
      {sezione === "segnalazioni" && <Segnalazioni indici={indici} catalogo={catalogo} acquisto={acquisto} setErr={setErr} ricarica={ricarica} />}
      {sezione === "impostazioni" && <Impostazioni indici={indici} setErr={setErr} ricarica={ricarica} />}
      {sezione === "listini" && <ListiniCaricati indici={indici} acquisto={acquisto} />}
      {sezione === "permessi" && <ChiVedeCosa />}
    </React.Fragment>
  );
}

function Condizioni({ indici, acquisto, setErr, ricarica }) {
  const [marchioId, setMarchioId] = useState(indici.elencoMarchi[0]?.id ?? null);
  const vigente = indici.condizioni.get(marchioId);
  const [r, setR] = useState(() => JSON.parse(JSON.stringify(vigente?.regole ?? {})));
  const [note, setNote] = useState(vigente?.note ?? "");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    setR(JSON.parse(JSON.stringify(indici.condizioni.get(marchioId)?.regole ?? {})));
    setNote(indici.condizioni.get(marchioId)?.note ?? "");
  }, [marchioId, indici]);
  const storico = (acquisto?.condizioni ?? []).filter((c) => c.marchio_id === marchioId);
  const promo = r.promo ?? {};
  const soglia = r.soglia ?? {};
  const set = (campo, v) => setR((x) => ({ ...x, [campo]: v }));
  const num = (v) => (v === "" ? 0 : Number(String(v).replace(",", ".")));

  const salva = async () => {
    if (!window.confirm("Vuoi salvare queste condizioni come nuova versione? Quella attuale resterà nello storico.")) return;
    setSalvando(true);
    try {
      await api.nuoveCondizioni(marchioId, r, note, vigente?.id);
      await ricarica();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mod-lub-scheda piena mod-lub-blocco">
      <div className="mod-lub-segmenti" role="group" aria-label="Marchio">
        {indici.elencoMarchi.map((m) => <button key={m.id} type="button" className={m.id === marchioId ? "on" : ""} onClick={() => setMarchioId(m.id)}>{m.nome}</button>)}
      </div>
      <p className="mod-lub-nota">{vigente ? `In vigore dal ${dataIt(vigente.valido_dal)}.` : "Questo marchio non ha ancora condizioni impostate."} Tutti i costi sono al litro.</p>
      <div className="mod-lub-modulo">
        <label className="mod-lub-campo"><span>Voci di costo, in ordine di priorità</span>
          <input value={(r.voci_costo ?? []).join(", ")} onChange={(e) => set("voci_costo", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></label>
        <label className="mod-lub-campo"><span>Sconto di listino (%)</span>
          <input inputMode="decimal" value={r.sconto_listino_pct ?? 0} onChange={(e) => set("sconto_listino_pct", num(e.target.value))} /></label>
        <label className="mod-lub-campo"><span>Sconto extra 1 (%)</span>
          <input inputMode="decimal" value={r.sconti_extra_pct?.[0] ?? 0} onChange={(e) => set("sconti_extra_pct", [num(e.target.value), r.sconti_extra_pct?.[1] ?? 0])} /></label>
        <label className="mod-lub-campo"><span>Sconto extra 2 (%)</span>
          <input inputMode="decimal" value={r.sconti_extra_pct?.[1] ?? 0} onChange={(e) => set("sconti_extra_pct", [r.sconti_extra_pct?.[0] ?? 0, num(e.target.value)])} /></label>
        <label className="mod-lub-campo"><span>Metodo di calcolo</span>
          <select value={r.modalita_prezzo ?? ""} onChange={(e) => set("modalita_prezzo", e.target.value || undefined)}>
            {MODALITA.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select></label>
        <label className="mod-lub-campo"><span>CONOU o tasse (€ al litro)</span>
          <input inputMode="decimal" value={r.conou_per_litro ?? 0} onChange={(e) => set("conou_per_litro", num(e.target.value))} /></label>
        <label className="mod-lub-campo"><span>Nome della voce</span>
          <input value={r.etichetta_conou ?? "CONOU"} maxLength={20} placeholder="CONOU, Tasse…" onChange={(e) => set("etichetta_conou", e.target.value)} /></label>
        <label className="mod-lub-spunta"><input type="checkbox" checked={r.aggiungi_conou !== false} onChange={(e) => set("aggiungi_conou", e.target.checked)} /> Aggiungi il CONOU al costo</label>
        <label className="mod-lub-spunta"><input type="checkbox" checked={!!r.prezzi_ivati} onChange={(e) => set("prezzi_ivati", e.target.checked)} /> Listino IVA inclusa</label>
      </div>
      <h4 className="mod-lub-sottotitolo">Promo «ogni N, M omaggio»</h4>
      <div className="mod-lub-modulo">
        <label className="mod-lub-spunta"><input type="checkbox" checked={!!promo.attiva} onChange={(e) => set("promo", { ...promo, attiva: e.target.checked })} /> Attiva</label>
        <label className="mod-lub-campo"><span>Ogni</span><input inputMode="numeric" value={promo.compra ?? 10} onChange={(e) => set("promo", { ...promo, compra: num(e.target.value) })} /></label>
        <label className="mod-lub-campo"><span>Omaggio</span><input inputMode="numeric" value={promo.omaggio ?? 1} onChange={(e) => set("promo", { ...promo, omaggio: num(e.target.value) })} /></label>
        <label className="mod-lub-spunta"><input type="checkbox" checked={promo.solo_cartoni !== false} onChange={(e) => set("promo", { ...promo, solo_cartoni: e.target.checked })} /> Solo a cartoni</label>
        <label className="mod-lub-campo"><span>Si applica</span>
          <select value={promo.ambito ?? "per_codice"} onChange={(e) => set("promo", { ...promo, ambito: e.target.value })}>
            <option value="per_codice">per ogni codice</option><option value="ordine">sul totale dell'ordine</option>
          </select></label>
      </div>
      <h4 className="mod-lub-sottotitolo">Soglia sul singolo ordine</h4>
      <div className="mod-lub-modulo">
        <label className="mod-lub-spunta"><input type="checkbox" checked={!!soglia.attiva} onChange={(e) => set("soglia", { ...soglia, attiva: e.target.checked })} /> Attiva</label>
        <label className="mod-lub-campo"><span>Calcolata in</span>
          <select value={soglia.tipo ?? "euro"} onChange={(e) => set("soglia", { ...soglia, tipo: e.target.value })}>
            <option value="euro">euro di merce</option><option value="cartoni">cartoni</option>
          </select></label>
        <label className="mod-lub-campo"><span>Soglia</span><input inputMode="decimal" value={soglia.valore ?? 0} onChange={(e) => set("soglia", { ...soglia, valore: num(e.target.value) })} /></label>
        <label className="mod-lub-campo"><span>Sconto extra (%)</span><input inputMode="decimal" value={soglia.sconto_extra_pct ?? 0} onChange={(e) => set("soglia", { ...soglia, sconto_extra_pct: num(e.target.value) })} /></label>
      </div>
      <label className="mod-lub-campo"><span>Note</span><textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="mod-lub-riga">
        <button type="button" className="adm-btn rosso" disabled={salvando || !marchioId} onClick={salva}><Icon name="save" size={14} /> Salva nuova versione</button>
      </div>
      {storico.length > 1 && (
        <details className="mod-lub-storico">
          <summary>Versioni precedenti ({storico.length - 1})</summary>
          <ul>{storico.filter((c) => c.valido_al).map((c) => <li key={c.id}>dal {dataIt(c.valido_dal)} al {dataIt(c.valido_al)}{c.note ? ` · ${c.note}` : ""}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function Coda({ indici, catalogo, setErr, ricarica }) {
  const [marchioId, setMarchioId] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const gruppi = useMemo(() => {
    const m = new Map();
    for (const e of catalogo.equivalenze) {
      if (e.stato !== "da_verificare") continue;
      const o = indici.oli.get(e.olio_id);
      if (!o || (marchioId && o.marchio_id !== marchioId)) continue;
      if (!m.has(e.famiglia_id)) m.set(e.famiglia_id, []);
      m.get(e.famiglia_id).push({ e, o });
    }
    return [...m.entries()].map(([id, voci]) => ({ famiglia: indici.famiglie.get(id), voci }))
      .sort((a, b) => (a.famiglia?.codice ?? "").localeCompare(b.famiglia?.codice ?? ""));
  }, [catalogo.equivalenze, indici, marchioId]);

  const decidi = async (ids, stato, domanda) => {
    if (domanda && !window.confirm(domanda)) return;
    setLavoro(true);
    try { await api.decidiEquivalenze(ids, stato); await ricarica(); } catch (e) { setErr(e.message); } finally { setLavoro(false); }
  };

  return (
    <div>
      <div className="mod-lub-riga">
        <div className="mod-lub-segmenti">
          <button type="button" className={!marchioId ? "on" : ""} onClick={() => setMarchioId("")}>Tutti i marchi</button>
          {indici.elencoMarchi.map((m) => <button key={m.id} type="button" className={m.id === marchioId ? "on" : ""} onClick={() => setMarchioId(m.id)}>{m.nome}</button>)}
        </div>
      </div>
      {gruppi.length === 0 && <p className="mod-lub-scheda mod-lub-vuoto">Nessuna alternativa da confermare.</p>}
      {gruppi.map(({ famiglia, voci }) => (
        <section key={famiglia?.id} className="mod-lub-scheda piena mod-lub-blocco">
          <div className="mod-lub-blocco-testa">
            <div>
              <h3 className="mod-lub-blocco-titolo">{famiglia?.codice} · {famiglia?.titolo}</h3>
              <p className="mod-lub-specifiche">{famiglia?.specifiche}</p>
            </div>
            <button type="button" className="adm-btn ghost mini" disabled={lavoro}
              onClick={() => decidi(voci.map((v) => v.e.id), "confermata", `Vuoi confermare tutte le ${voci.length} alternative di «${famiglia?.titolo}»?`)}>
              <Icon name="check" size={12} /> Conferma tutte ({voci.length})
            </button>
          </div>
          <table className="mod-lub-griglia">
            <tbody>
              {voci.map(({ e, o }) => (
                <tr key={e.id}>
                  <td><span className="mod-lub-marchio-nome">{indici.marchi.get(o.marchio_id)?.nome}</span><span className="mod-lub-piccolo">{o.nome}</span>
                    {o.sae && <span className="mod-lub-piccolo">{o.sae}</span>}
                    <Specifiche olio={o} />
                    {e.nota && <span className="mod-lub-piccolo">Nota: {e.nota}</span>}</td>
                  <td>{e.principale ? <span className="mod-lub-bollo">principale</span> : <span className="mod-lub-bollo">secondaria</span>}</td>
                  <td >
                    <button type="button" className="adm-btn ghost mini" disabled={lavoro} onClick={() => decidi([e.id], "confermata")}>Confermo</button>
                    <button type="button" className="adm-btn ghost mini" disabled={lavoro} onClick={() => decidi([e.id], "scartata")}>Scarto</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function Segnalazioni({ indici, catalogo, acquisto, setErr, ricarica }) {
  const [risposte, setRisposte] = useState({});
  const perId = useMemo(() => new Map(catalogo.equivalenze.map((e) => [e.id, e])), [catalogo.equivalenze]);
  const tutte = acquisto?.segnalazioni ?? [];
  const aperte = tutte.filter((s) => s.stato === "aperta");
  const chiuse = tutte.filter((s) => s.stato !== "aperta");
  const descrivi = (s) => {
    const e = perId.get(s.equivalenza_id);
    const o = e ? indici.oli.get(e.olio_id) : null;
    const f = e ? indici.famiglie.get(e.famiglia_id) : null;
    return { o, f, e };
  };
  const chiudi = async (s, scarta) => {
    try {
      const { e } = descrivi(s);
      if (scarta && e) await api.decidiEquivalenze([e.id], "scartata");
      await api.chiudiSegnalazione(s.id, risposte[s.id] ?? "");
      await ricarica();
    } catch (err) {
      setErr(err.message);
    }
  };
  return (
    <div>
      {aperte.length === 0 && <p className="mod-lub-scheda mod-lub-vuoto">Nessuna segnalazione aperta.</p>}
      {aperte.map((s) => {
        const { o, f } = descrivi(s);
        return (
          <div key={s.id} className="mod-lub-scheda piena mod-lub-blocco">
            <p><strong>{o ? `${indici.marchi.get(o.marchio_id)?.nome} · ${o.nome}` : "Alternativa"}</strong>{f ? ` equivalente a ${f.titolo}` : ""}</p>
            <p className="mod-lub-piccolo">{dataIt(s.creato_il)} · {s.autore ? `${s.autore.nome} ${s.autore.cognome ?? ""}`.trim() : "—"}</p>
            <p>«{s.motivo}»</p>
            <label className="mod-lub-campo"><span>Risposta (facoltativa)</span>
              <input maxLength={1000} value={risposte[s.id] ?? ""} onChange={(e) => setRisposte((r) => ({ ...r, [s.id]: e.target.value }))} /></label>
            <div className="mod-lub-riga">
              <button type="button" className="adm-btn ghost mini" onClick={() => chiudi(s, false)}><Icon name="check" size={12} /> Chiudi e mantieni l'alternativa</button>
              <button type="button" className="adm-btn rosso mini" onClick={() => chiudi(s, true)}><Icon name="x" size={12} /> Chiudi e scarta l'alternativa</button>
            </div>
          </div>
        );
      })}
      {chiuse.length > 0 && (
        <details className="mod-lub-storico">
          <summary>Segnalazioni chiuse ({chiuse.length})</summary>
          <ul>{chiuse.map((s) => { const { o } = descrivi(s); return <li key={s.id}>{dataIt(s.creato_il)} · {o?.nome ?? "—"} · «{s.motivo}»{s.risposta ? ` → ${s.risposta}` : ""}</li>; })}</ul>
        </details>
      )}
    </div>
  );
}

function Impostazioni({ indici, setErr, ricarica }) {
  const [tetti, setTetti] = useState({ ...TETTI_PARTENZA, ...indici.tetti });
  const [periodo, setPeriodo] = useState(indici.giorniPeriodo ?? GIORNI_PERIODO_ABC);
  const [salvando, setSalvando] = useState(false);
  const salva = async () => {
    setSalvando(true);
    try {
      await api.salvaImpostazione("tetti_scorta", { A: Number(tetti.A), B: Number(tetti.B), C: Number(tetti.C) });
      await api.salvaImpostazione("abc_giorni_periodo", Number(periodo));
      await ricarica();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSalvando(false);
    }
  };
  return (
    <div className="mod-lub-scheda piena mod-lub-blocco">
      <p className="mod-lub-nota">I suggerimenti d'ordine non superano mai questi giorni di scorta per ciascuna classe.</p>
      <div className="mod-lub-modulo">
        {["A", "B", "C"].map((c) => (
          <label key={c} className="mod-lub-campo"><span>Classe {c} (giorni)</span>
            <input inputMode="numeric" value={tetti[c]} onChange={(e) => setTetti((t) => ({ ...t, [c]: e.target.value }))} /></label>
        ))}
        <label className="mod-lub-campo"><span>Periodo dei prelievi ABC (giorni)</span>
          <input inputMode="numeric" value={periodo} onChange={(e) => setPeriodo(e.target.value)} /></label>
      </div>
      <p className="mod-lub-nota">La rotazione caricata è quella di Fiorenzuola, usata come riferimento per tutte le filiali finché non arriveranno i dati dal gestionale per le altre.</p>
      <button type="button" className="adm-btn rosso" disabled={salvando} onClick={salva}><Icon name="save" size={14} /> Salva</button>
    </div>
  );
}

function ListiniCaricati({ indici, acquisto }) {
  const listini = acquisto?.listini ?? [];
  if (!listini.length) return <p className="mod-lub-scheda mod-lub-vuoto">Nessun listino caricato.</p>;
  return (
    <div className="mod-lub-scheda mod-lub-scorre">
      <table className="mod-lub-griglia a-tessere">
        <thead><tr><th>Marchio</th><th>File</th><th>Valido dal</th><th className="mod-lub-destra">Costi</th><th>Stato</th></tr></thead>
        <tbody>
          {listini.map((l) => (
            <tr key={l.id}>
              <td data-etichetta="Marchio">{indici.marchi.get(l.marchio_id)?.nome}</td>
              <td data-etichetta="File">{l.nome_file}<span className="mod-lub-piccolo">{l.fonte}</span></td>
              <td data-etichetta="Valido dal">{dataIt(l.valido_dal)}</td>
              <td className="mod-lub-destra" data-etichetta="Costi">{numero(Number(l.riepilogo?.costi ?? 0))}</td>
              <td data-etichetta="Stato">{l.stato}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mod-lub-nota">Il caricamento di listini nuovi (CSV o Excel) arriva più avanti; i listini cambiano solo i costi, mai i prezzi di vendita.</p>
    </div>
  );
}

function ChiVedeCosa() {
  const righe = [
    ["Catalogo, formati, alternative, prezzi di vendita", "sì", "sì", "sì"],
    ["Costi e margini, condizioni, listini caricati", "sì", "sì", "no"],
    ["Rotazione, giacenze, impostazioni", "sì", "sì", "no"],
    ["Ordini", "tutte le filiali", "vede tutte le filiali, modifica solo la sua", "no"],
    ["Modifica prezzi di vendita", "sì", "no", "no"],
    ["Conferma o scarto alternative", "sì", "può segnalare un dubbio", "no"],
  ];
  return (
    <div className="mod-lub-scheda piena mod-lub-blocco">
      <table className="mod-lub-griglia">
        <thead><tr><th /><th>Amministratore</th><th>Manager e finanza</th><th>Rappresentante, centralino, dipendente</th></tr></thead>
        <tbody>{righe.map((r) => <tr key={r[0]}>{r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}</tr>)}</tbody>
      </table>
      <p className="mod-lub-nota">Il blocco è direttamente sul database, non solo sulla pagina: chi non è abilitato ai costi non riceve proprio quei dati.</p>
    </div>
  );
}
