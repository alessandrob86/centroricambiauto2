import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { dataIt, useMobile } from "./aiuti.js";
import * as api from "./api.js";
import { cerca } from "./dati.js";
import { GRUPPI, gruppo, euro, numero, confezione, calcolaOrdine, suggerisci, paragona, giorniScorta, promoPerCodice } from "./calcolo.js";
import { scaricaHtml, scaricaCsv } from "./documento.js";

const { useState, useEffect, useMemo, useCallback } = React;

const STATI = { bozza: "Bozza", inviato: "Inviato", ricevuto: "Ricevuto", annullato: "Annullato" };
const oggiIt = () => new Date().toLocaleDateString("it-IT");
const copia = (x) => JSON.parse(JSON.stringify(x ?? {}));

/* L'ordine a un fornitore. Il manager arriva qui: l'elenco a cascata del
   marchio al centro, suggeritore, alternative e paragone in un pannello di
   lato, i totali in basso. Le condizioni del giorno si possono toccare per
   questo ordine soltanto: quelle del marchio le cambia l'admin in «Listini». */

export default function Ordine({ indici, isAdmin, dipendente, zone, setErr, richiesta }) {
  const mobile = useMobile();
  const marchiOrdinabili = useMemo(() => indici.elencoMarchi.filter((m) => m.attivo !== false && indici.condizioni.has(m.id)), [indici]);
  const zonaMia = dipendente?.zona_id ?? null;
  const zoneScrivibili = useMemo(() => (isAdmin ? zone : zone.filter((z) => z.id === zonaMia)), [isAdmin, zone, zonaMia]);

  const [vista, setVista] = useState("ordine");
  const [marchioId, setMarchioId] = useState(() => richiesta?.marchioId ?? marchiOrdinabili[0]?.id ?? null);
  const [zonaId, setZonaId] = useState(() => zoneScrivibili[0]?.id ?? zonaMia ?? zone[0]?.id ?? null);
  const [quantita, setQuantita] = useState({});          // formatoId → { cartoni, pezzi }
  const [regoleGiorno, setRegoleGiorno] = useState(() => copia(indici.regoleDi(richiesta?.marchioId ?? marchiOrdinabili[0]?.id)));
  const [filtro, setFiltro] = useState([]);              // chiavi di GRUPPI, al massimo 2; vuoto = tutti
  const [q, setQ] = useState("");
  const [aperte, setAperte] = useState({});
  const [soloRotazione, setSoloRotazione] = useState(false);
  const [pannello, setPannello] = useState("suggeritore");
  const [marchioB, setMarchioB] = useState(null);
  const [regoleB, setRegoleB] = useState({});
  const [includiDaVerificare, setIncludiDaVerificare] = useState(false);
  const [testata, setTestata] = useState({ id: null, stato: "bozza", riferimento: "", note_fornitore: "", note_interne: "" });
  const [salvando, setSalvando] = useState(false);
  const [avviso, setAvviso] = useState(null);
  const [ordini, setOrdini] = useState(null);
  const [sola, setSolaLettura] = useState(false);
  const [docAperti, setDocAperti] = useState(false);

  const marchio = indici.marchi.get(marchioId);

  /* Da «Trova l'olio → Ordina»: si apre il marchio e la famiglia di quell'olio. */
  useEffect(() => {
    if (!richiesta?.marchioId) return;
    setMarchioId(richiesta.marchioId);
    setQ(indici.oli.get(richiesta.olioId)?.nome ?? "");
  }, [richiesta, indici]);

  useEffect(() => {
    if (!testata.id) setRegoleGiorno(copia(indici.regoleDi(marchioId)));
  }, [marchioId, indici, testata.id]);

  useEffect(() => {
    const altro = marchiOrdinabili.find((m) => m.id !== marchioId);
    setMarchioB((b) => (b && b !== marchioId ? b : altro?.id ?? null));
  }, [marchioId, marchiOrdinabili]);
  useEffect(() => { if (marchioB) setRegoleB(copia(indici.regoleDi(marchioB))); }, [marchioB, indici]);

  const costoDi = useCallback((r) => indici.costoDi(r, regoleGiorno, zonaId), [indici, regoleGiorno, zonaId]);
  const rotazioneDi = useCallback((f) => indici.rotazioneDi(f, zonaId), [indici, zonaId]);

  /* L'elenco a cascata: famiglia → olio → formati; gli oli senza famiglia per sezione. */
  const gruppiElenco = useMemo(() => {
    if (!marchioId) return [];
    const trovati = q.trim().length >= 2 ? new Set(cerca(indici, q, { marchioId }).map((o) => o.id)) : null;
    const oliMarchio = [...indici.oli.values()].filter((o) => o.marchio_id === marchioId && o.attivo !== false && (!trovati || trovati.has(o.id)));
    const perFamiglia = new Map();
    const senza = new Map();
    for (const o of oliMarchio) {
      const formati = o.formati.filter((f) => f.attivo !== false && (!filtro.length || filtro.includes(gruppo(f.litri)))
        && (!soloRotazione || rotazioneDi(f)));
      if (!formati.length) continue;
      const voce = { olio: o, formati };
      const legame = indici.famiglieDellOlio(o).find((e) => e.stato !== "scartata" && e.principale) ?? indici.famiglieDellOlio(o).find((e) => e.stato !== "scartata");
      if (legame) {
        if (!perFamiglia.has(legame.famiglia_id)) perFamiglia.set(legame.famiglia_id, []);
        perFamiglia.get(legame.famiglia_id).push(voce);
      } else {
        const sez = o.sezione || "Altri oli";
        if (!senza.has(sez)) senza.set(sez, []);
        senza.get(sez).push(voce);
      }
    }
    const fam = [...perFamiglia.entries()].map(([id, voci]) => ({ chiave: id, titolo: indici.famiglie.get(id)?.titolo, sotto: indici.famiglie.get(id)?.specifiche, voci, famiglia: true }))
      .sort((a, b) => (indici.famiglie.get(a.chiave)?.codice ?? "").localeCompare(indici.famiglie.get(b.chiave)?.codice ?? ""));
    const altri = [...senza.entries()].map(([sez, voci]) => ({ chiave: `s:${sez}`, titolo: sez, sotto: `${voci.length} oli senza famiglia`, voci, famiglia: false }))
      .sort((a, b) => a.titolo.localeCompare(b.titolo));
    return [...fam, ...altri];
  }, [indici, marchioId, q, filtro, soloRotazione, rotazioneDi]);

  const righe = useMemo(() => Object.entries(quantita)
    .map(([id, v]) => ({ formato: indici.formati.get(id), cartoni: v.cartoni || 0, pezzi: v.pezzi || 0 }))
    .filter((r) => r.formato && (r.cartoni > 0 || r.pezzi > 0))
    .map((r) => ({ ...r, olio: indici.oli.get(r.formato.olio_id) }))
    .filter((r) => r.olio?.marchio_id === marchioId), [quantita, indici, marchioId]);

  const conto = useMemo(() => calcolaOrdine(righe, regoleGiorno, costoDi), [righe, regoleGiorno, costoDi]);

  const candidatiScorta = useMemo(() => [...indici.oli.values()].filter((o) => o.marchio_id === marchioId)
    .flatMap((o) => o.formati.map((f) => ({ olio: o, formato: f }))).filter((c) => rotazioneDi(c.formato)), [indici, marchioId, rotazioneDi]);

  const mosse = useMemo(() => suggerisci({
    conto, regole: regoleGiorno, rotazioneDi, tetti: indici.tetti, giorniPeriodo: indici.giorniPeriodo,
    formatiDellOlio: (o) => o.formati, costoDi, candidatiScorta,
  }), [conto, regoleGiorno, rotazioneDi, indici, costoDi, candidatiScorta]);

  const confronto = useMemo(() => (marchioB ? paragona({
    conto, includiDaVerificare,
    equivalentiDi: (o) => indici.equivalentiDi(o, marchioB),
    costoB: (r) => indici.costoDi(r, regoleB, zonaId),
  }) : null), [conto, marchioB, regoleB, includiDaVerificare, indici, zonaId]);

  const imposta = (formatoId, campo, valore) => {
    if (sola) return;
    setQuantita((qq) => ({ ...qq, [formatoId]: { cartoni: 0, pezzi: 0, ...qq[formatoId], [campo]: Math.max(0, Math.trunc(Number(valore) || 0)) } }));
  };

  const applica = (m) => {
    if (!m.applica || sola) return;
    setQuantita((qq) => {
      const nuovo = { ...qq };
      if (m.applica.sostituisci) delete nuovo[m.applica.sostituisci];
      nuovo[m.applica.formatoId] = { cartoni: m.applica.cartoni ?? 0, pezzi: m.applica.pezzi ?? 0 };
      return nuovo;
    });
  };

  const nuovoOrdine = () => {
    setQuantita({}); setSolaLettura(false); setAvviso(null);
    setTestata({ id: null, stato: "bozza", riferimento: "", note_fornitore: "", note_interne: "" });
    setRegoleGiorno(copia(indici.regoleDi(marchioId)));
    setVista("ordine");
  };

  const salva = async (stato) => {
    if (!righe.length) { setErr("L'ordine è vuoto."); return; }
    if (!zonaId) { setErr("Scegli la filiale di consegna."); return; }
    setSalvando(true);
    try {
      const id = await api.salvaOrdine(
        { ...testata, stato, marchio_id: marchioId, zona_id: zonaId,
          condizioni: { marchio: marchio?.codice, regole: regoleGiorno, calcolato: { merce: conto.merce, conou: conto.conou, sconto: conto.scontoSoglia, totale: conto.totale } } },
        conto.righe.map((r) => ({
          formato_id: r.formato.id, codice: r.formato.codice,
          descrizione: `${r.olio.nome} · ${confezione(r.formato)}`.slice(0, 300),
          cartoni: r.formato.pezzi_cartone > 1 ? r.cartoni : 0,
          pezzi: r.formato.pezzi_cartone > 1 ? r.pezzi : r.pz,
          omaggi: r.omaggiPz,
          costo_unitario: r.costo ? Number((r.costo.finito * r.formato.litri).toFixed(4)) : null,
          costo_netto: r.costo ? Number(r.totale.toFixed(4)) : null,
          classe_abc: rotazioneDi(r.formato)?.classe ?? null,
        })));
      setTestata((t) => ({ ...t, id, stato }));
      setAvviso(stato === "inviato" ? "Ordine salvato come inviato." : "Bozza salvata.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const apriElenco = async () => {
    setVista("elenco");
    try { setOrdini(await api.elencaOrdini()); } catch (e) { setErr(e.message); }
  };

  const apriOrdine = async (o) => {
    try {
      const d = await api.caricaOrdine(o.id);
      const qq = {};
      for (const r of d.righe ?? []) {
        if (!r.formato_id || !indici.formati.has(r.formato_id)) continue;
        qq[r.formato_id] = { cartoni: r.cartoni, pezzi: r.pezzi };
      }
      setMarchioId(d.marchio_id); setZonaId(d.zona_id); setQuantita(qq);
      setTestata({ id: d.id, stato: d.stato, riferimento: d.riferimento ?? "", note_fornitore: d.note_fornitore ?? "", note_interne: d.note_interne ?? "" });
      setRegoleGiorno(copia(d.condizioni?.regole ?? indici.regoleDi(d.marchio_id)));
      setSolaLettura(!isAdmin && d.zona_id !== zonaMia);
      setAvviso(!isAdmin && d.zona_id !== zonaMia ? "Ordine di un'altra filiale: puoi solo consultarlo, non modificarlo." : null);
      setVista("ordine");
    } catch (e) {
      setErr(e.message);
    }
  };

  const cambiaStato = async (o, stato) => {
    try { await api.cambiaStatoOrdine(o.id, stato); setOrdini(await api.elencaOrdini()); } catch (e) { setErr(e.message); }
  };

  const documento = (tipo) => {
    const args = { marchio, filiale: zone.find((z) => z.id === zonaId), data: oggiIt().replaceAll("/", "-"), riferimento: testata.riferimento, noteFornitore: testata.note_fornitore, conto };
    if (tipo === "csv") scaricaCsv(args); else scaricaHtml(args);
  };

  if (!marchiOrdinabili.length) {
    return <div className="mod-lub-scheda mod-lub-vuoto"><strong>Nessun marchio ha ancora condizioni d'acquisto impostate</strong>Puoi impostarle in «Listini e condizioni».</div>;
  }

  if (vista === "elenco") {
    return (
      <React.Fragment>
        <div className="mod-lub-riga">
          <button type="button" className="adm-btn ghost mini" onClick={() => setVista("ordine")}><Icon name="chevron-left" size={13} /> Torna all'ordine</button>
          <span className="mod-lub-spinta" />
          <button type="button" className="adm-btn rosso mini" onClick={nuovoOrdine}><Icon name="plus" size={13} /> Nuovo ordine</button>
        </div>
        {!ordini ? <div className="mod-lub-scheda mod-lub-vuoto">Caricamento ordini…</div> : ordini.length === 0 ? (
          <div className="mod-lub-scheda mod-lub-vuoto"><strong>Non ci sono ancora ordini salvati</strong>Qui trovi gli ordini salvati di tutte le filiali.</div>
        ) : (
          <div className="mod-lub-scheda mod-lub-scorre">
            <table className="mod-lub-griglia a-tessere">
              <thead><tr><th>Data</th><th>Marchio</th><th>Filiale</th><th>Stato</th><th className="mod-lub-destra">Righe</th><th>Creato da</th><th /></tr></thead>
              <tbody>
                {ordini.map((o) => {
                  const mia = isAdmin || o.zona_id === zonaMia;
                  return (
                    <tr key={o.id}>
                      <th scope="row"><span className="mod-lub-marchio-nome">{dataIt(o.creato_il)}</span>{o.riferimento ? <span className="mod-lub-piccolo">{o.riferimento}</span> : null}</th>
                      <td data-etichetta="Marchio">{indici.marchi.get(o.marchio_id)?.nome}</td>
                      <td data-etichetta="Filiale">{zone.find((z) => z.id === o.zona_id)?.nome ?? "—"}</td>
                      <td data-etichetta="Stato"><span className={`mod-lub-bollo ${o.stato === "bozza" ? "giallo" : o.stato === "annullato" ? "rosso" : "verde"}`}>{STATI[o.stato]}</span></td>
                      <td data-etichetta="Righe" className="mod-lub-destra">{o.righe?.[0]?.count ?? 0}</td>
                      <td data-etichetta="Creato da">{o.autore ? `${o.autore.nome} ${o.autore.cognome ?? ""}`.trim() : "—"}</td>
                      <td>
                        <button type="button" className="mod-lub-link" onClick={() => apriOrdine(o)}>{mia ? "Apri" : "Guarda"}</button>
                        {mia && o.stato === "inviato" && <button type="button" className="mod-lub-link" onClick={() => cambiaStato(o, "ricevuto")}>Ricevuto</button>}
                        {mia && o.stato !== "annullato" && o.stato !== "ricevuto" && <button type="button" className="mod-lub-link" onClick={() => cambiaStato(o, "annullato")}>Annulla</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </React.Fragment>
    );
  }

  const r0 = regoleGiorno ?? {};
  const promo = r0.promo ?? {};
  const soglia = r0.soglia ?? {};
  const cambiaRegola = (campo, valore) => { if (!sola) setRegoleGiorno((r) => ({ ...r, [campo]: valore })); };
  const nascosti = filtro.length
    ? [...indici.oli.values()].filter((o) => o.marchio_id === marchioId).reduce((a, o) => a + o.formati.filter((f) => !filtro.includes(gruppo(f.litri))).length, 0)
    : 0;
  const nomeB = indici.marchi.get(marchioB)?.nome;
  const azioni = (
    <span className="mod-lub-azioni-barra">
      {docAperti && <button type="button" className="adm-btn ghost mini" disabled={!righe.length} onClick={() => documento("html")}><Icon name="download" size={13} /> Scarica per il fornitore</button>}
      {docAperti && <button type="button" className="adm-btn ghost mini" disabled={!righe.length} onClick={() => documento("csv")}>CSV</button>}
      {!sola && <button type="button" className="adm-btn ghost mini" disabled={salvando || !righe.length} onClick={() => salva("bozza")}><Icon name="save" size={13} /> Salva bozza</button>}
      {!sola && <button type="button" className="adm-btn rosso mini" disabled={salvando || !righe.length} onClick={() => salva("inviato")}><Icon name="truck" size={13} /> Inviato</button>}
    </span>
  );

  return (
    <React.Fragment>
      {/* ---------- testata: marchio, filiale, condizioni del giorno ---------- */}
      <section className="mod-lub-scheda piena mod-lub-riga" aria-label="Intestazione ordine">
        <div className="mod-lub-segmenti" role="group" aria-label="Marchio dell'ordine">
          {marchiOrdinabili.map((m) => (
            <button key={m.id} type="button" className={m.id === marchioId ? "on" : ""} aria-pressed={m.id === marchioId}
              disabled={!!testata.id && m.id !== marchioId} onClick={() => { setMarchioId(m.id); setQuantita({}); }}>{m.nome}</button>
          ))}
        </div>
        <label className="mod-lub-in-riga">Consegna a
          <select value={zonaId ?? ""} disabled={sola} onChange={(e) => setZonaId(e.target.value)}>
            {(sola ? zone : zoneScrivibili).map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
          </select>
        </label>
        <div className="mod-lub-riga stretta" role="group" aria-label={`Condizioni ${marchio?.nome} per questo ordine`}>
          <span className="mod-lub-muto">Condizioni {marchio?.nome}:</span>
          {Number(r0.sconto_listino_pct) > 0 && <span className="mod-lub-pillola fissa">listino −{numero(Number(r0.sconto_listino_pct))}%</span>}
          <button type="button" className={`mod-lub-pillola ${promo.attiva ? "on" : ""}`} aria-pressed={!!promo.attiva} disabled={sola}
            onClick={() => cambiaRegola("promo", { ...promo, attiva: !promo.attiva })}>promo {promo.compra}+{promo.omaggio}</button>
          <button type="button" className={`mod-lub-pillola ${soglia.attiva ? "on" : ""}`} aria-pressed={!!soglia.attiva} disabled={sola}
            onClick={() => cambiaRegola("soglia", { ...soglia, attiva: !soglia.attiva })}>
            soglia {soglia.tipo === "cartoni" ? `${numero(Number(soglia.valore))} crt` : euro(Number(soglia.valore), 0)} −{numero(Number(soglia.sconto_extra_pct))}%
          </button>
          <button type="button" className={`mod-lub-pillola ${r0.aggiungi_conou !== false ? "on" : ""}`} aria-pressed={r0.aggiungi_conou !== false} disabled={sola}
            onClick={() => cambiaRegola("aggiungi_conou", r0.aggiungi_conou === false)}>{r0.etichetta_conou || "CONOU"} {euro(Number(r0.conou_per_litro), 2)}/L</button>
        </div>
        <span className="mod-lub-spinta" />
        <button type="button" className="mod-lub-link" onClick={apriElenco}>Ordini salvati</button>
        {(testata.id || righe.length > 0) && <button type="button" className="mod-lub-link" onClick={nuovoOrdine}>Nuovo ordine</button>}
      </section>

      {avviso && <p className="mod-lub-avviso">{avviso}</p>}

      {/* ---------- filtri ---------- */}
      <section className="mod-lub-riga" aria-label="Filtri">
        <div className="mod-lub-riga stretta" role="group" aria-label="Formati da mostrare">
          <span className="mod-lub-etichetta">Formati</span>
          {GRUPPI.map((g) => {
            const on = filtro.includes(g.chiave);
            return (
              <label key={g.chiave} className={`mod-lub-casella ${on ? "on" : ""}`}>
                <input type="checkbox" checked={on}
                  onChange={() => setFiltro((f) => (f.includes(g.chiave) ? f.filter((x) => x !== g.chiave) : [...f, g.chiave].slice(-2)))} />
                {g.nome}
              </label>
            );
          })}
        </div>
        {candidatiScorta.length > 0 && (
          <div className="mod-lub-segmenti" role="group" aria-label="Articoli da mostrare">
            <button type="button" className={!soloRotazione ? "on" : ""} aria-pressed={!soloRotazione} onClick={() => setSoloRotazione(false)}>Tutto il listino</button>
            <button type="button" className={soloRotazione ? "on" : ""} aria-pressed={soloRotazione} onClick={() => setSoloRotazione(true)}>Solo con rotazione</button>
          </div>
        )}
        <input type="search" className="mod-lub-cerca-elenco" aria-label="Cerca nell'elenco" placeholder="Cerca codice, nome o gradazione"
          value={q} onChange={(e) => setQ(e.target.value)} />
        {nascosti > 0 && <span className="mod-lub-nota">{nascosti} formati nascosti dal filtro · al massimo due formati insieme</span>}
      </section>

      <div className="mod-lub-corpo">
        {/* ---------- l'elenco a cascata ---------- */}
        <section className="mod-lub-scheda mod-lub-cascata" aria-label="Elenco oli">
          {gruppiElenco.length === 0 && <div className="mod-lub-vuoto">Nessun olio trovato con questi filtri.</div>}
          {gruppiElenco.map((g) => {
            const aperta = aperte[g.chiave] ?? (g.famiglia || q.trim().length >= 2);
            const quante = g.voci.reduce((a, v) => a + v.formati.filter((f) => (quantita[f.id]?.cartoni || 0) + (quantita[f.id]?.pezzi || 0) > 0).length, 0);
            const classi = g.voci.flatMap((v) => v.formati.map((f) => rotazioneDi(f)?.classe)).filter(Boolean).sort();
            const nomi = g.voci.length === 1 ? g.voci[0].olio.nome : `${g.voci.length} oli`;
            return (
              <div key={g.chiave} className="mod-lub-fam">
                <button type="button" className="mod-lub-fam-testa" aria-expanded={aperta} onClick={() => setAperte((a) => ({ ...a, [g.chiave]: !aperta }))}>
                  <strong className="mod-lub-fam-titolo"><Icon name={aperta ? "chevron-down" : "chevron-right"} size={14} /> {g.titolo}</strong>
                  <span className="mod-lub-piccolo">{nomi}{g.famiglia && g.sotto ? ` · ${g.sotto}` : ""}</span>
                  {classi[0] && <span className={`mod-lub-bollo classe-${classi[0]}`}>Classe {classi[0]}</span>}
                  {quante > 0 && <span className="mod-lub-bollo giallo">{quante} in ordine</span>}
                </button>
                {aperta && g.voci.map(({ olio, formati }) => (
                  <React.Fragment key={olio.id}>
                    {g.voci.length > 1 && <div className="mod-lub-olio-sotto">{olio.nome}</div>}
                    {formati.map((f) => (
                      <RigaFormato key={f.id} f={f} q={quantita[f.id]} costo={costoDi({ formato: f, olio })} rot={rotazioneDi(f)}
                        indici={indici} regole={regoleGiorno} sola={sola} riga={conto.righe.find((r) => r.formato.id === f.id)} onImposta={imposta} />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            );
          })}
        </section>

        {/* ---------- il pannello ---------- */}
        <aside className="mod-lub-scheda bordo-forte mod-lub-lato" aria-label="Pannello">
          <div className="mod-lub-lato-tab" role="tablist">
            {[["suggeritore", "Suggeritore"], ["alternative", "Alternative"], ["paragone", "Paragone"]].map(([id, nome]) => (
              <button key={id} type="button" role="tab" aria-selected={pannello === id} className={pannello === id ? "on" : ""} onClick={() => setPannello(id)}>
                {nome}{id === "suggeritore" && mosse.filter((m) => m.consigliato).length > 0 ? ` · ${mosse.filter((m) => m.consigliato).length}` : ""}
              </button>
            ))}
          </div>
          <div className="mod-lub-lato-corpo">
            {pannello === "suggeritore" && (
              <>
                {!righe.length && !mosse.length && <p className="mod-lub-nota">Seleziona almeno una riga per avere suggerimenti su omaggi, soglie, formati e scorte.</p>}
                {righe.length > 0 && !mosse.length && <p className="mod-lub-nota">Nessun suggerimento: con queste condizioni l'ordine è già a posto.</p>}
                {mosse.map((m, i) => (
                  <div key={i} className={`mod-lub-mossa ${m.consigliato ? "" : "spenta"}`}>
                    <span className="mod-lub-mossa-tipo">{m.tipo}</span>
                    <span className="mod-lub-mossa-testo">{m.testo}</span>
                    <span className="mod-lub-mossa-effetto">{m.effetto}</span>
                    {m.applica && !sola && <button type="button" className="adm-btn rosso mini" onClick={() => applica(m)}><Icon name="check" size={12} /> Applica</button>}
                  </div>
                ))}
                <p className="mod-lub-nota">Al massimo 5 mosse; niente che superi i giorni di scorta della classe (A {indici.tetti.A} · B {indici.tetti.B} · C {indici.tetti.C}).</p>
              </>
            )}

            {pannello === "alternative" && <Alternative righe={righe} indici={indici} isAdmin={isAdmin} marchioId={marchioId} setErr={setErr} />}

            {pannello === "paragone" && (
              <>
                <span className="mod-lub-nota">Sulle {righe.length} righe spuntate, a parità di litri. Scegli tu le condizioni di tutti e due.</span>
                <div className="mod-lub-riga stretta">
                  <span className="mod-lub-etichetta">Confronta con</span>
                  <div className="mod-lub-segmenti">
                    {marchiOrdinabili.filter((m) => m.id !== marchioId).map((m) => (
                      <button key={m.id} type="button" className={m.id === marchioB ? "on" : ""} aria-pressed={m.id === marchioB} onClick={() => setMarchioB(m.id)}>{m.nome}</button>
                    ))}
                  </div>
                </div>
                {marchioB && (
                  <div className="mod-lub-riga stretta mod-lub-condizioni-b">
                    <strong>{nomeB}</strong>
                    <button type="button" className={`mod-lub-pillola ${regoleB.promo?.attiva ? "on" : ""}`} aria-pressed={!!regoleB.promo?.attiva}
                      onClick={() => setRegoleB((r) => ({ ...r, promo: { ...r.promo, attiva: !r.promo?.attiva } }))}>promo {regoleB.promo?.compra}+{regoleB.promo?.omaggio}</button>
                    <button type="button" className={`mod-lub-pillola ${regoleB.aggiungi_conou !== false ? "on" : ""}`} aria-pressed={regoleB.aggiungi_conou !== false}
                      onClick={() => setRegoleB((r) => ({ ...r, aggiungi_conou: r.aggiungi_conou === false }))}>{regoleB.etichetta_conou || "CONOU"} {euro(Number(regoleB.conou_per_litro), 2)}/L</button>
                  </div>
                )}
                <label className="mod-lub-spunta">
                  <input type="checkbox" checked={includiDaVerificare} onChange={(e) => setIncludiDaVerificare(e.target.checked)} />
                  Includi alternative da confermare
                </label>
                {!confronto || !confronto.totali ? <p className="mod-lub-nota">Seleziona qualche riga per vedere il confronto.</p> : (
                  <>
                    <div className="mod-lub-due">
                      <div className="mod-lub-totalino"><span className="mod-lub-etichetta">{marchio?.nome}, stesse righe</span><strong>{euro(confronto.totA, 0)}</strong></div>
                      <div className="mod-lub-totalino"><span className="mod-lub-etichetta">{nomeB}, a parità di litri</span><strong>{euro(confronto.totB, 0)}</strong></div>
                    </div>
                    <div className={`mod-lub-differenza ${confronto.diff < 0 ? "meglio" : "peggio"}`}>
                      <strong>{nomeB} costa {euro(Math.abs(confronto.diff), 0)} {confronto.diff < 0 ? "in meno" : "in più"}</strong>
                      <span className="mod-lub-piccolo">Spesa reale a cartoni interi: {euro(confronto.reale, 0)}</span>
                    </div>
                    <span className="mod-lub-nota">Righe con un'alternativa: {confronto.coperte} su {confronto.totali}</span>
                    <div className="mod-lub-elenco-righe">
                      {confronto.dettagli.map((d) => (
                        <div key={d.riga.formato.id}>
                          <span>{d.riga.olio.nome} {confezione(d.riga.formato)}<span className="mod-lub-piccolo">
                            {d.equiv ? `${d.equiv.olio.nome} ${confezione(d.equiv.formato)}${d.equiv.stato === "da_verificare" ? " · da verificare" : ""}` : "nessuna alternativa"}</span></span>
                          <strong className={d.valoreB == null ? "mod-lub-muto" : d.valoreB < d.valoreA ? "mod-lub-verde" : "mod-lub-rosso"}>
                            {d.valoreB != null ? `${d.valoreB - d.valoreA > 0 ? "+" : ""}${euro(d.valoreB - d.valoreA, 0)}` : "—"}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <span className="mod-lub-nota">Solo nel riepilogo interno, mai nell'ordine al fornitore.</span>
                  </>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ---------- la barra in basso ---------- */}
      <div className="mod-lub-barra">
        {docAperti && (
          <div className="mod-lub-documenti">
            <label className="mod-lub-campo"><span>Riferimento</span>
              <input value={testata.riferimento} maxLength={60} disabled={sola} placeholder="facoltativo" onChange={(e) => setTestata({ ...testata, riferimento: e.target.value })} /></label>
            <label className="mod-lub-campo"><span>Note per il fornitore</span>
              <textarea rows={2} maxLength={2000} disabled={sola} value={testata.note_fornitore} onChange={(e) => setTestata({ ...testata, note_fornitore: e.target.value })} /></label>
            <label className="mod-lub-campo"><span>Note interne · non visibili al fornitore</span>
              <textarea rows={2} maxLength={2000} disabled={sola} value={testata.note_interne} onChange={(e) => setTestata({ ...testata, note_interne: e.target.value })} /></label>
          </div>
        )}
        <div className="mod-lub-barra-riga">
          <span className="mod-lub-barra-voce">Righe <strong>{righe.length}</strong></span>
          {!mobile && <span className="mod-lub-barra-voce">Merce <strong>{euro(conto.merce, 0)}</strong></span>}
          {!mobile && conto.scontoSoglia > 0 && <span className="mod-lub-barra-voce">Sconto soglia <strong>−{euro(conto.scontoSoglia, 0)}</strong></span>}
          {!mobile && <span className="mod-lub-barra-voce">{r0.etichetta_conou || "CONOU"} <strong>{euro(conto.conou, 0)}</strong></span>}
          <span className="mod-lub-barra-voce totale">Totale ordine <strong>{euro(conto.totale, 0)}</strong></span>
          <span className="mod-lub-barra-nota">
            {conto.cartoni} cartoni{conto.omaggiCartoni ? ` · ${conto.omaggiCartoni} in omaggio` : ""}{conto.omaggiOrdine ? ` · ${conto.omaggiOrdine} in omaggio sull'ordine` : ""}
            {conto.soglia && (conto.soglia.raggiunta ? ` · soglia raggiunta (−${numero(conto.soglia.scontoPct)}%)`
              : ` · mancano ${conto.soglia.tipo === "euro" ? euro(conto.soglia.mancano, 0) : `${numero(conto.soglia.mancano)} cartoni`} alla soglia`)}
          </span>
          <button type="button" className="adm-btn ghost mini" aria-expanded={docAperti} onClick={() => setDocAperti((d) => !d)}>
            <Icon name={docAperti ? "chevron-down" : "file-text"} size={13} /> {mobile ? "Salvataggio e documenti" : "Documenti"}
          </button>
          {(!mobile || docAperti) && azioni}
        </div>
      </div>
    </React.Fragment>
  );
}

function RigaFormato({ f, q, costo, rot, indici, regole, sola, riga, onImposta }) {
  const cartone = f.pezzi_cartone > 1;
  const promo = promoPerCodice(regole, f);
  const giorni = giorniScorta(rot, riga?.pz ?? 0, indici.giorniPeriodo);
  const tetto = rot?.classe ? indici.tetti[rot.classe] : null;
  const valore = cartone ? q?.cartoni ?? 0 : q?.pezzi ?? 0;
  const campo = cartone ? "cartoni" : "pezzi";
  let omaggio = null;
  if (promo) {
    if (riga?.omaggiCartoni) omaggio = { testo: `+${riga.omaggiCartoni} ${riga.omaggiCartoni === 1 ? "cartone" : "cartoni"} in omaggio`, preso: true };
    else if (valore > 0) omaggio = { testo: `${promo.compra}+${promo.omaggio}: ne mancano ${promo.compra - (valore % promo.compra)}` };
    else omaggio = { testo: `${promo.compra}+${promo.omaggio} a cartoni` };
  }
  return (
    <div className={`mod-lub-formato ${valore > 0 ? "scelto" : ""}`}>
      <input type="checkbox" className="mod-lub-f-spunta" checked={valore > 0} disabled={sola} aria-label={`Aggiungi ${f.codice} all'ordine`}
        onChange={(e) => onImposta(f.id, campo, e.target.checked ? 1 : 0)} />
      <span className="mod-lub-f-nome"><strong>{confezione(f)}</strong><span className="mod-lub-piccolo">{f.codice}{f.descrizione && f.descrizione !== confezione(f) ? ` · ${f.descrizione}` : ""}</span></span>
      <span className="mod-lub-f-scorta">
        {rot ? (
          <>
            {rot.classe && <span className={`mod-lub-bollo classe-${rot.classe}`}>{rot.classe}</span>}{" "}
            <span className={giorni != null && tetto && giorni > tetto ? "mod-lub-rosso" : ""}>
              {giorni != null ? `${numero(giorni)} gg di scorta${tetto ? ` / ${tetto}` : ""}` : `giacenza ${numero(rot.giacenza)}`}
            </span>
          </>
        ) : null}
      </span>
      <span className="mod-lub-f-prezzo">
        {costo ? (
          <>
            <strong>{euro(costo.finito, 2)}/L</strong>
            <span className="mod-lub-piccolo">{euro(costo.finito * f.litri)} il pezzo{cartone ? ` · ${euro(costo.finito * f.litri * f.pezzi_cartone, 0)} a cartone` : ""}</span>
          </>
        ) : <span className="mod-lub-muto">senza costo</span>}
        {omaggio && <span className={`mod-lub-omaggio ${omaggio.preso ? "preso" : ""}`}>{omaggio.testo}</span>}
      </span>
      <span className="mod-lub-passi mod-lub-f-passi">
        <button type="button" disabled={sola || valore <= 0} aria-label={`Un ${cartone ? "cartone" : "pezzo"} in meno di ${f.codice}`} onClick={() => onImposta(f.id, campo, valore - 1)}>−</button>
        <input type="number" min={0} inputMode="numeric" value={valore || ""} placeholder="0" disabled={sola}
          aria-label={`${cartone ? "Cartoni" : "Pezzi"} di ${f.codice}`} onChange={(e) => onImposta(f.id, campo, e.target.value)} />
        <button type="button" disabled={sola} aria-label={`Un ${cartone ? "cartone" : "pezzo"} in più di ${f.codice}`} onClick={() => onImposta(f.id, campo, valore + 1)}>+</button>
      </span>
      <strong className="mod-lub-f-totale">{riga?.pz ? euro(riga.totale, 0) : ""}</strong>
    </div>
  );
}

function Alternative({ righe, indici, isAdmin, marchioId, setErr }) {
  const [decise, setDecise] = useState({});
  const oli = [...new Map(righe.map((r) => [r.olio.id, r.olio])).values()];
  if (!oli.length) return <p className="mod-lub-nota">Seleziona qualche riga per vedere gli oli equivalenti degli altri marchi.</p>;
  const decidi = async (equivalenza, stato) => {
    try { await api.decidiEquivalenze([equivalenza.id], stato); setDecise((d) => ({ ...d, [equivalenza.id]: stato })); } catch (e) { setErr(e.message); }
  };
  return (
    <>
      {oli.map((o) => {
        const alt = indici.equivalentiDi(o).filter((a) => a.olio.marchio_id !== marchioId);
        return (
          <div key={o.id} className="mod-lub-elenco-righe">
            <strong className="mod-lub-marchio-nome">{o.nome}</strong>
            {!alt.length && <div><span className="mod-lub-muto">Nessuna alternativa di altri marchi.</span></div>}
            {alt.map((a) => {
              const stato = decise[a.equivalenza.id] ?? a.stato;
              return (
                <div key={a.olio.id}>
                  <span><strong>{indici.marchi.get(a.olio.marchio_id)?.nome}</strong> · {a.olio.nome}
                    {isAdmin && stato === "da_verificare" && (
                      <span className="mod-lub-piccolo">
                        <button type="button" className="mod-lub-link" onClick={() => decidi(a.equivalenza, "confermata")}>Conferma</button>
                        <button type="button" className="mod-lub-link" onClick={() => decidi(a.equivalenza, "scartata")}>Scarta</button>
                      </span>
                    )}
                  </span>
                  <strong className={stato === "confermata" ? "mod-lub-verde" : "mod-lub-muto"}>{stato === "confermata" ? "✓ confermata" : stato === "scartata" ? "scartata" : "da confermare"}</strong>
                </div>
              );
            })}
          </div>
        );
      })}
      <p className="mod-lub-nota">È «Confermata» quando entrambi gli oli nella famiglia sono confermati. Le conferme valgono subito per tutti.</p>
    </>
  );
}
