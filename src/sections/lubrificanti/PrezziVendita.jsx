import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { dataIt } from "./aiuti.js";
import * as api from "./api.js";
import { cerca } from "./dati.js";
import { GRUPPI, gruppo, euro, numero, venditaLitro, confezione } from "./calcolo.js";

const { useState, useMemo, useRef, useLayoutEffect } = React;

/* I prezzi di vendita dei marchi che non sono della casa: li imposta a mano
   l'amministratore e restano salvati (i listini cambiano solo i costi, mai la
   vendita). Come nella tavola del Design: si sceglie il marchio da tarare e il
   formato; gli oli sono raggruppati per famiglia e ogni riga ha la linea con i
   prezzi al litro di tutti i marchi della famiglia, col proprio in evidenza.
   Manager e finanza leggono soltanto. */

const MARGINE_MINIMO = 0.25;
const arrotonda = (x) => Math.round(x * 10) / 10;
const numeroDa = (testo) => {
  const v = Number(String(testo).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
};

export default function PrezziVendita({ indici, catalogo, isAdmin, setErr, cambiaPrezzoLocale }) {
  const marchi = useMemo(() => indici.elencoMarchi.filter((m) => !m.casa), [indici]);
  const [marchioId, setMarchioId] = useState(marchi[0]?.id ?? null);
  const [gruppoScelto, setGruppoScelto] = useState("1");
  const [q, setQ] = useState("");
  const [soloVuoti, setSoloVuoti] = useState(false);
  const [ancheSenzaFamiglia, setAncheSenzaFamiglia] = useState(false);
  const [bozze, setBozze] = useState({});
  const [margineVoluto, setMargineVoluto] = useState(35);
  const [lavoro, setLavoro] = useState(false);

  const nomeMarchio = indici.marchi.get(marchioId)?.nome ?? "";
  const casa = indici.elencoMarchi.find((m) => m.casa);

  /* i formati che il marchio ha davvero: solo quelli si possono scegliere */
  const gruppiDelMarchio = useMemo(() => {
    const presenti = new Set();
    for (const o of indici.oli.values()) if (o.marchio_id === marchioId) for (const f of o.formati) presenti.add(gruppo(f.litri));
    return GRUPPI.filter((g) => presenti.has(g.chiave));
  }, [indici, marchioId]);
  const gruppoAttivo = gruppiDelMarchio.some((g) => g.chiave === gruppoScelto) ? gruppoScelto : gruppiDelMarchio[0]?.chiave;

  /* gli oli del marchio, raggruppati per famiglia (la principale, se sono in più d'una) */
  const sezioni = useMemo(() => {
    const trovati = q.trim().length >= 2 ? new Set(cerca(indici, q, { marchioId }).map((o) => o.id)) : null;
    const perFamiglia = new Map();
    const senza = [];
    for (const o of indici.oli.values()) {
      if (o.marchio_id !== marchioId || (trovati && !trovati.has(o.id))) continue;
      const formati = o.formati.filter((f) => gruppo(f.litri) === gruppoAttivo && (!soloVuoti || !indici.prezzi.get(f.id)));
      if (!formati.length) continue;
      const legami = indici.famiglieDellOlio(o).filter((e) => e.stato !== "scartata")
        .sort((a, b) => Number(b.principale) - Number(a.principale));
      const famiglia = legami.length ? indici.famiglie.get(legami[0].famiglia_id) : null;
      const riga = { olio: o, formati, legame: legami[0] ?? null };
      if (!famiglia) { senza.push(riga); continue; }
      if (!perFamiglia.has(famiglia.id)) perFamiglia.set(famiglia.id, { famiglia, righe: [] });
      perFamiglia.get(famiglia.id).righe.push(riga);
    }
    const perNome = (a, b) => a.olio.nome.localeCompare(b.olio.nome, "it");
    const elenco = [...perFamiglia.values()]
      .sort((a, b) => (a.famiglia.titolo ?? a.famiglia.codice).localeCompare(b.famiglia.titolo ?? b.famiglia.codice, "it"));
    for (const s of elenco) s.righe.sort(perNome);
    if (ancheSenzaFamiglia && senza.length) elenco.push({ famiglia: null, righe: senza.sort(perNome) });
    return elenco;
  }, [indici, marchioId, gruppoAttivo, q, soloVuoti, ancheSenzaFamiglia]);

  const righeVisibili = useMemo(() => sezioni.flatMap((s) => s.righe.flatMap((r) => r.formati.map((f) => ({ ...r, f })))), [sezioni]);
  const vuotiConCosto = useMemo(() => righeVisibili.filter(({ f }) => !indici.prezzi.get(f.id))
    .map(({ olio, f }) => ({ f, costo: indici.costoDi({ formato: f, olio }) }))
    .filter((v) => v.costo), [righeVisibili, indici]);

  const salva = async (f) => {
    const testo = bozze[f.id];
    if (testo == null) return;
    const valore = numeroDa(testo);
    try {
      if (!String(testo).trim()) { await api.eliminaPrezzoVendita(f.id); cambiaPrezzoLocale(f.id, null); }
      else if (valore) { await api.salvaPrezzoVendita(f.id, valore); cambiaPrezzoLocale(f.id, valore); }
      else { setErr("Inserisci un prezzo maggiore di zero."); return; }
      setBozze((b) => { const n = { ...b }; delete n[f.id]; return n; });
    } catch (e) {
      setErr(e.message);
    }
  };

  const riempi = async () => {
    const m = Number(margineVoluto) / 100;
    if (!(m > 0 && m < 0.9)) { setErr("Inserisci un margine tra 1% e 89%."); return; }
    const voci = vuotiConCosto.map(({ f, costo }) => ({ formatoId: f.id, prezzo: arrotonda(costo.finito * f.litri / (1 - m)) })).filter((v) => v.prezzo > 0);
    if (!voci.length) return;
    if (!window.confirm(`Vuoi impostare ${voci.length} prezzi mancanti con un margine del ${numero(Number(margineVoluto))}% sul costo attuale, arrotondati a 10 centesimi?`)) return;
    setLavoro(true);
    try {
      await api.salvaPrezziVendita(voci);
      for (const v of voci) cambiaPrezzoLocale(v.formatoId, v.prezzo);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLavoro(false);
    }
  };

  const aggiornatoIl = useMemo(() => new Map(catalogo.prezzi.map((p) => [p.formato_id, p.aggiornato_il])), [catalogo.prezzi]);
  const LIMITE = 120;
  let contate = 0;

  return (
    <React.Fragment>
      <section className="mod-lub-scheda piena mod-lub-pv-filtri" aria-label="Filtri">
        <div className="mod-lub-riga">
          <span className="mod-lub-etichetta">Prezzi di</span>
          <div className="mod-lub-segmenti" role="group" aria-label="Marchio">
            {marchi.map((m) => <button key={m.id} type="button" className={m.id === marchioId ? "on" : ""} aria-pressed={m.id === marchioId} onClick={() => setMarchioId(m.id)}>{m.nome}</button>)}
          </div>
          <span className="mod-lub-etichetta">Formato</span>
          <div className="mod-lub-riga stretta" role="group" aria-label="Formato">
            {gruppiDelMarchio.map((g) => (
              <button key={g.chiave} type="button" className={`mod-lub-pillola ${g.chiave === gruppoAttivo ? "on" : ""}`} aria-pressed={g.chiave === gruppoAttivo} onClick={() => setGruppoScelto(g.chiave)}>{g.nome}</button>
            ))}
          </div>
        </div>
        <div className="mod-lub-riga fine">
          <label className="mod-lub-campo grande"><span>Cerca</span>
            <input type="search" value={q} placeholder="Codice, nome o gradazione" onChange={(e) => setQ(e.target.value)} /></label>
          <label className="mod-lub-spunta"><input type="checkbox" checked={soloVuoti} onChange={(e) => setSoloVuoti(e.target.checked)} /> solo senza prezzo</label>
          <label className="mod-lub-spunta"><input type="checkbox" checked={ancheSenzaFamiglia} onChange={(e) => setAncheSenzaFamiglia(e.target.checked)} /> anche senza famiglia</label>
        </div>
      </section>

      <p className="mod-lub-nota">
        Prezzi al pezzo, IVA esclusa, listino base. La linea confronta il prezzo al litro di tutti i marchi della famiglia nello stesso formato.
        {casa && !indici.casaCollegata ? ` Per ora ${casa.nome} non compare sulla linea: i suoi prezzi provengono dal catalogo del sito, non ancora collegato.` : ""}
        {isAdmin ? " Inserisci il prezzo e premi Invio per salvare: margine e posizione si aggiornano in tempo reale." : " Solo l'amministratore può modificare i prezzi."}
      </p>

      {isAdmin && vuotiConCosto.length > 0 && (
        <div className="mod-lub-avviso mod-lub-riga stretta">
          <span>{vuotiConCosto.length} formati qui sotto non hanno prezzo ma hanno un costo: riempili con un margine del</span>
          <input type="number" className="mod-lub-margine-campo" min={1} max={89} value={margineVoluto} onChange={(e) => setMargineVoluto(e.target.value)} aria-label="Margine desiderato (%)" />
          <span>%</span>
          <button type="button" className="adm-btn ghost mini" disabled={lavoro} onClick={riempi}><Icon name="pencil" size={12} /> Compila mancanti</button>
        </div>
      )}

      {sezioni.length === 0 ? <div className="mod-lub-scheda mod-lub-vuoto">Nessun olio {nomeMarchio} trovato con questi filtri.</div> : (
        <div className="mod-lub-scheda mod-lub-pv">
          <div className="mod-lub-pv-testa" aria-hidden="true">
            <div>Olio {nomeMarchio}</div><div className="mod-lub-destra">Costo</div><div className="mod-lub-destra">Vendita</div><div className="mod-lub-destra">Margine</div>
            <div className="mod-lub-pv-legenda">
              <span>Confronto €/L</span>
              <span><i className="mod-lub-segno mio" /> {nomeMarchio}</span>
              {casa && indici.casaCollegata && <span><i className="mod-lub-segno casa" /> {casa.nome}</span>}
              <span><i className="mod-lub-segno" /> altri marchi</span>
              <span><i className="mod-lub-segno verifica" /> da verificare</span>
              <span><i className="mod-lub-segno costo" /> costo</span>
            </div>
          </div>
          {sezioni.map((s) => {
            if (contate >= LIMITE) return null;
            return (
              <section key={s.famiglia?.id ?? "senza"} aria-label={s.famiglia?.titolo ?? "Senza famiglia"}>
                <div className="mod-lub-pv-famiglia">
                  <h3>{s.famiglia ? (s.famiglia.titolo ?? s.famiglia.codice) : "Senza famiglia"}</h3>
                  {s.famiglia?.specifiche && <span className="mod-lub-piccolo">{s.famiglia.specifiche}</span>}
                </div>
                {s.righe.flatMap((r) => r.formati.map((f) => {
                  contate++;
                  if (contate > LIMITE) return null;
                  return (
                    <RigaPrezzo key={f.id} indici={indici} famiglia={s.famiglia} riga={r} formato={f} nomeMarchio={nomeMarchio}
                      isAdmin={isAdmin} bozza={bozze[f.id]} aggiornatoIl={aggiornatoIl.get(f.id)}
                      onBozza={(v) => setBozze((b) => ({ ...b, [f.id]: v }))} onSalva={() => salva(f)} />
                  );
                }))}
              </section>
            );
          })}
        </div>
      )}
      {righeVisibili.length > LIMITE && <p className="mod-lub-nota">Visualizzati i primi {LIMITE} formati su {righeVisibili.length}: usa la ricerca per gli altri.</p>}
    </React.Fragment>
  );
}

function RigaPrezzo({ indici, famiglia, riga, formato: f, nomeMarchio, isAdmin, bozza, aggiornatoIl, onBozza, onSalva }) {
  const { olio, legame } = riga;
  const salvato = indici.prezzi.get(f.id) ?? null;
  const prezzo = bozza != null ? numeroDa(bozza) : salvato;
  const costo = indici.costoDi({ formato: f, olio });
  const costoLitro = costo?.finito ?? null;
  const vendLitro = venditaLitro(prezzo, f);
  const m = vendLitro && costoLitro ? (vendLitro - costoLitro) / vendLitro : null;
  const unLitro = f.litri === 1;
  const confronto = famiglia ? altriDellaFamiglia(indici, famiglia, riga, f) : { altri: [], senzaPrezzo: [] };
  const daVerificare = legame && legame.stato !== "confermata";

  return (
    <div className="mod-lub-pv-riga">
      <div>
        <strong className="mod-lub-pv-nome">{olio.nome}</strong>
        <span className="mod-lub-piccolo">{confezione(f)} · {f.codice}{daVerificare ? " · equivalenza da verificare" : ""}</span>
      </div>
      <div className="mod-lub-destra" data-etichetta="Costo">
        <span className="mod-lub-cifra piccola">{costoLitro ? euro(costoLitro * f.litri) : "—"}</span>
        {costoLitro && !unLitro ? <span className="mod-lub-piccolo">{euro(costoLitro)}/L</span> : null}
      </div>
      <div className="mod-lub-destra" data-etichetta="Vendita">
        {isAdmin ? (
          <input className={`mod-lub-prezzo-campo ${bozza != null ? "cambiato" : ""}`} inputMode="decimal" aria-label={`Prezzo di vendita di ${olio.nome} ${confezione(f)}`}
            value={bozza ?? (salvato ? salvato.toFixed(2).replace(".", ",") : "")} placeholder="—"
            onChange={(e) => onBozza(e.target.value)} onBlur={onSalva} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        ) : <span className="mod-lub-cifra piccola">{salvato ? euro(salvato) : "—"}</span>}
        <span className="mod-lub-piccolo">
          {bozza != null ? "da salvare" : [vendLitro && !unLitro ? `${euro(vendLitro)}/L` : null, aggiornatoIl && salvato ? dataIt(aggiornatoIl) : null].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="mod-lub-destra" data-etichetta="Margine">
        <strong className={`mod-lub-cifra piccola ${m != null && m < MARGINE_MINIMO ? "mod-lub-rosso" : ""}`}>{m != null ? `${numero(m * 100)}%` : "—"}</strong>
        {m != null ? <span className="mod-lub-piccolo">{euro((vendLitro - costoLitro) * f.litri)} al pezzo</span> : null}
      </div>
      <div className="mod-lub-pv-posizione">
        <Linea nomeMarchio={nomeMarchio} mio={vendLitro} costo={costoLitro} altri={confronto.altri} />
        <span className="mod-lub-piccolo">{frase(nomeMarchio, vendLitro, confronto, m)}</span>
      </div>
    </div>
  );
}

/* Gli altri marchi della famiglia con un prezzo nello stesso formato: uno per
   marchio (prima le alternative confermate, poi il prezzo più basso). */
function altriDellaFamiglia(indici, famiglia, riga, formato) {
  const g = gruppo(formato.litri);
  const perMarchio = new Map();
  const senzaPrezzo = new Set();
  for (const e of indici.oliDellaFamiglia(famiglia.id)) {
    if (e.stato === "scartata") continue;
    const o = indici.oli.get(e.olio_id);
    if (!o || o.marchio_id === riga.olio.marchio_id) continue;
    const m = indici.marchi.get(o.marchio_id);
    const candidati = o.formati.filter((f) => gruppo(f.litri) === g && indici.prezzi.get(f.id));
    if (!candidati.length) {
      if (m) senzaPrezzo.add(m.nome);
      continue;
    }
    const f2 = [...candidati].sort((a, b) => Math.abs(a.litri - formato.litri) - Math.abs(b.litri - formato.litri))[0];
    const valore = venditaLitro(indici.prezzi.get(f2.id), f2);
    const confermata = e.stato === "confermata" && riga.legame?.stato === "confermata";
    const prima = perMarchio.get(o.marchio_id);
    if (!prima || (confermata && !prima.confermata) || (confermata === prima.confermata && valore < prima.valore)) {
      perMarchio.set(o.marchio_id, { nome: m?.nome ?? "", valore, confermata, casa: Boolean(m?.casa), olio: o.nome });
    }
  }
  const altri = [...perMarchio.values()];
  for (const a of altri) senzaPrezzo.delete(a.nome);
  return { altri, senzaPrezzo: [...senzaPrezzo] };
}

function frase(nomeMarchio, mio, { altri, senzaPrezzo }, m) {
  const pezzi = [];
  if (!altri.length) {
    if (!senzaPrezzo.length) pezzi.push("Nessun altro marchio ha ancora un prezzo in questo formato");
  } else if (!mio) pezzi.push("Inserisci il prezzo per vedere dove si colloca");
  else {
    const tutti = [...altri.map((a) => a.valore), mio].sort((a, b) => a - b);
    const posto = tutti.indexOf(mio) + 1;
    const media = altri.reduce((t, a) => t + a.valore, 0) / altri.length;
    const scarto = mio - media;
    pezzi.push(posto === 1 ? `${nomeMarchio} è il più economico su ${tutti.length}` : `${nomeMarchio} è ${posto}° su ${tutti.length} dal più economico`);
    pezzi.push(Math.abs(scarto) < 0.05 ? "in linea con la media degli altri" : `${euro(Math.abs(scarto))}/L ${scarto > 0 ? "sopra" : "sotto"} la media degli altri`);
  }
  if (m != null && m < MARGINE_MINIMO) pezzi.push("margine sotto il 25%");
  if (senzaPrezzo.length) pezzi.push(`senza prezzo: ${senzaPrezzo.join(", ")}`);
  return pezzi.join(" · ");
}

/* La linea: un segno per marchio nel punto esatto del suo prezzo al litro;
   quello del marchio che si sta tarando è più grande e giallo. Le scritte
   (nome e prezzo) stanno sopra la linea; se non c'è posto passano sotto, e
   in ogni fila si scostano di lato quanto basta per non coprirsi. */
function useLarghezza() {
  const ref = useRef(null);
  const [larghezza, setLarghezza] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const osservatore = new ResizeObserver(([voce]) => setLarghezza(voce.contentRect.width));
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, []);
  return [ref, larghezza];
}

const SPAZIO = 8;
const stimaLarghezza = (p) => `${p.nome} ${euro(p.valore)}`.length * (p.tipo === "mio" ? 7.6 : 6.6);

function disponi(punti, larghezza) {
  const file = [[], []];
  for (const p of punti) {
    const centro = (p.x / 100) * larghezza;
    const libera = (f) => {
      const u = file[f].at(-1);
      return !u || centro - p.w / 2 >= u.centro + u.w / 2 + SPAZIO;
    };
    p.centro = centro;
    p.fila = libera(0) ? 0 : libera(1) ? 1 : (file[0].length <= file[1].length ? 0 : 1);
    file[p.fila].push(p);
  }
  for (const f of file) {
    for (const p of f) p.sinistra = Math.min(Math.max(p.centro - p.w / 2, 0), Math.max(larghezza - p.w, 0));
    for (let i = 1; i < f.length; i++) f[i].sinistra = Math.max(f[i].sinistra, f[i - 1].sinistra + f[i - 1].w + SPAZIO);
    const ultimo = f.at(-1);
    if (ultimo && ultimo.sinistra + ultimo.w > larghezza) {
      ultimo.sinistra = Math.max(larghezza - ultimo.w, 0);
      for (let i = f.length - 2; i >= 0; i--) f[i].sinistra = Math.min(f[i].sinistra, f[i + 1].sinistra - f[i].w - SPAZIO);
    }
  }
  return punti;
}

function Linea({ nomeMarchio, mio, costo, altri }) {
  const [ref, larghezza] = useLarghezza();
  const punti = altri.map((a) => ({ nome: a.nome, valore: a.valore, tipo: [a.casa ? "casa" : "", a.confermata ? "" : "verifica"].filter(Boolean).join(" ") }));
  if (mio) punti.push({ nome: nomeMarchio, valore: mio, tipo: "mio" });
  if (!punti.length) return null;
  const valori = [...punti.map((p) => p.valore), ...(costo ? [costo] : [])];
  let min = Math.min(...valori);
  let max = Math.max(...valori);
  const margine = Math.max((max - min) * 0.08, 0.3);
  min -= margine;
  max += margine;
  const pos = (v) => ((v - min) / (max - min)) * 100;
  const ordinati = punti.map((p) => ({ ...p, x: pos(p.valore), w: stimaLarghezza(p) })).sort((a, b) => a.x - b.x);
  const disposti = larghezza ? disponi(ordinati, larghezza) : [];
  const descrizione = ordinati.map((p) => `${p.nome} ${euro(p.valore)} al litro`).join(", ") + (costo ? `; costo ${euro(costo)} al litro` : "");
  return (
    <div className="mod-lub-linea" ref={ref} role="img" aria-label={descrizione}>
      <span className="mod-lub-linea-filo" />
      {costo ? <span className="mod-lub-segno costo mod-lub-linea-costo" style={{ left: `${pos(costo)}%` }} title={`Costo ${euro(costo)}/L`} /> : null}
      {ordinati.map((p) => <i key={`s-${p.nome}-${p.tipo}`} className={`mod-lub-segno mod-lub-linea-segno ${p.tipo}`} style={{ left: `${p.x}%` }} />)}
      {disposti.map((p) => (
        <span key={`t-${p.nome}-${p.tipo}`} className={`mod-lub-linea-testo ${p.tipo} ${p.fila ? "sotto" : "sopra"}`} style={{ left: `${p.sinistra}px` }}>
          <b>{p.nome}</b> {euro(p.valore)}
        </span>
      ))}
    </div>
  );
}
