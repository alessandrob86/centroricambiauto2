import React from "react";
import { Icon } from "../components/Icon.jsx";
import { useAuth } from "../lib/auth.jsx";
import { Personale } from "./Personale.jsx";
import { formatEuro, PLACEHOLDER_IMG, MAX_HERO, MAX_GRANDE } from "../lib/craCatalog.js";
import {
  getAllOfficine, updateOfficina, createOfficina,
  getOfficine, getContaOfficine, getContaPerCategoria, getProvinceOfficine,
  getCraOrders, updateOrderStato, ORDER_STATI, statoLabel,
  getAllProducts, getCategories, createProduct, updateProduct, deleteProduct, uploadProductImage,
  bulkUpdatePrices, syncCatalogo, ordersToCsv, downloadCsv,
  getCategorieCliente, createCategoriaCliente, updateCategoriaCliente, deleteCategoriaCliente,
  getListini, createListino, updateListino, deleteListino, setListinoCategorie,
  getPrezziMatrice, getUltimoSync, saveListinoPrezzi, removeListinoPrezziBulk,
  saveNettiBaseL2f, getRigheCatalogo, setLineaSuCra,
  getPrezziCliente, setPrezzoCliente, removePrezzoCliente,
  getAttivita,
  contaEtichetteLocali, caricaEtichette, spostaEtichette, baseEtichette,
  contaDocumentiLocali, caricaDocumenti, spostaDocumenti, baseDocumenti,
  rinominaMedia, getTipiDocumento, mediaNonUsati, togliMediaNonUsati, mediaAppenaCaricati,
  creaInvito, getInviti, annullaInvito, inviaInvito, agganciaOfficina, staccaOfficina,
} from "../lib/adminApi.js";

/* ============================================================
   ETICHETTE PRODOTTO — dal sito al deposito condiviso.

   Operazione da fare una volta sola. Il catalogo è uno e lo leggono due siti:
   finché le foto sono percorsi come «/labels/x.webp» funzionano solo dove
   qualcuno ha copiato quella cartella. Nel deposito, invece, le vede chiunque.
   ============================================================ */
/** Un trasloco: carica i file scelti, poi riscrive il catalogo.
 *  Sempre in quest'ordine — al contrario il catalogo punterebbe, per qualche
 *  secondo, a file che non sono ancora arrivati. */
function Trasloco({ titolo, spiega, cartella, base, conta, carica, sposta, esitoTesto, setErr, accetta, icona }) {
  const [stato, setStato] = useState(null);
  const [fase, setFase] = useState("attesa");   // attesa | carico | riscrivo | fatto
  const [avanz, setAvanz] = useState({ fatti: 0, totale: 0 });
  const [esito, setEsito] = useState(null);

  /* I file che nessun prodotto richiama più: restano dopo una rinomina o
     quando il selettore di cartelle si porta dietro roba che non c'entra.
     Non danno fastidio, ma nessuno sa più quali siano — e non saperlo è il
     motivo per cui poi non si cancellano mai. */
  const [inutili, setInutili] = useState(null);
  const [recenti, setRecenti] = useState(0);
  const [pulendo, setPulendo] = useState(false);

  const aggiorna = useCallback(() => {
    conta().then(setStato).catch(() => setErr("Non riesco a contare i file da spostare."));
    mediaNonUsati(cartella).then(setInutili).catch(() => setInutili(null));
    mediaAppenaCaricati(cartella).then(setRecenti).catch(() => setRecenti(0));
  }, [conta, cartella, setErr]);
  useEffect(() => { aggiorna(); }, [aggiorna]);

  const pulisci = async () => {
    const peso = (inutili.reduce((t, f) => t + f.byte, 0) / 1048576).toFixed(1);
    const elenco = inutili.slice(0, 12).map((f) => `· ${f.nome}`).join("\n");
    const altri = inutili.length > 12 ? `\n… e altri ${inutili.length - 12}` : "";
    if (!window.confirm(
      `Tolgo ${inutili.length} file dal deposito (${peso} MB)?\n\n${elenco}${altri}\n\n`
      + "Nessuno di questi è richiamato da un prodotto. Non si recuperano.")) return;
    setPulendo(true);
    try {
      // Si passano i nomi appena letti, non «tutto ciò che non serve»: fra la
      // lettura e adesso qualcuno potrebbe averne ricollegato uno.
      await togliMediaNonUsati(cartella, inutili.map((f) => f.nome));
      aggiorna();
    } catch (e) { setErr(String(e?.message || "Pulizia non riuscita.")); }
    finally { setPulendo(false); }
  };

  const scegli = async (files) => {
    if (!files?.length) return;
    setEsito(null);
    setFase("carico");
    setAvanz({ fatti: 0, totale: files.length });
    try {
      const car = await carica(files, (fatti, totale) => setAvanz({ fatti, totale }));
      if (car.caricati === 0) {
        setErr("Nessun file caricato: controlla di aver scelto la cartella giusta.");
        setFase("attesa");
        return;
      }
      setFase("riscrivo");
      // Prima i rinominati, finché il catalogo porta ancora il vecchio nome:
      // dopo si riscrive il percorso, e i due passi non si darebbero fastidio
      // ma in quest'ordine si legge meglio cos'è successo.
      await rinominaMedia(cartella, car.rinominati);
      const sp = await sposta();
      setEsito({ ...car, ...sp });
      setFase("fatto");
      aggiorna();
    } catch (e) {
      setErr(String(e?.message || "Lo spostamento non è riuscito."));
      setFase("attesa");
    }
  };

  return (
    <div className="adm-card" style={{ marginBottom: "var(--space-5)" }}>
      <h3 className="adm-h3">{titolo}</h3>
      {spiega(stato)}

      {stato?.riferimenti === 0 && (
        <p className="adm-sub">
          <Icon name="check-circle-2" size={14} color="#2E7D4F" />{" "}
          Nessun prodotto punta più a un percorso locale. Il pulsante resta:
          è ripetibile, e serve quando arrivano file nuovi o aggiornati.
        </p>
      )}

      <label className="adm-btn" style={{ cursor: fase === "attesa" ? "pointer" : "default", marginTop: "10px" }}>
        <Icon name={icona} size={15} />
        {fase === "carico" ? `Carico… ${avanz.fatti} di ${avanz.totale}`
          : fase === "riscrivo" ? "Riscrivo il catalogo…"
            : `Scegli la cartella ${cartella}`}
        <input type="file" hidden multiple accept={accetta} webkitdirectory="" directory=""
          disabled={fase !== "attesa"} onChange={(e) => scegli(e.target.files)} />
      </label>

      {fase === "carico" && avanz.totale > 0 && (
        <span className="dip-barra-quota" style={{ display: "block", height: 10, marginTop: "10px" }}>
          <span style={{ display: "block", height: "100%", background: "var(--cra-red)", width: `${(avanz.fatti / avanz.totale) * 100}%` }} />
        </span>
      )}

      {esito && (
        <React.Fragment>
          <p className="adm-sub" style={{ marginTop: "10px" }}>
            <Icon name="check-circle-2" size={14} color="#2E7D4F" /> {esitoTesto(esito)}
          </p>

          {/* Un file rifiutato sparisce senza rumore: qui deve leggersi il nome,
              sennò ci si accorge del buco solo quando un cliente apre il link. */}
          {esito.errori?.length > 0 && (
            <div className="adm-sub" style={{ marginTop: "8px", color: "var(--cra-red)" }}>
              <Icon name="triangle-alert" size={14} />{" "}
              <b>{esito.errori.length} non sono passati:</b>
              <ul style={{ margin: "4px 0 0 18px" }}>
                {esito.errori.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          {esito.rinominati?.length > 0 && (
            <div className="adm-sub" style={{ marginTop: "8px", opacity: 0.85 }}>
              <Icon name="pencil" size={14} />{" "}
              <b>{esito.rinominati.length} rinominati</b> — il deposito non accetta
              parentesi quadre, accenti e simili. Il catalogo è stato aggiornato di conseguenza.
              <ul style={{ margin: "4px 0 0 18px" }}>
                {esito.rinominati.map((r) => <li key={r.leggibile}>{r.leggibile}</li>)}
              </ul>
            </div>
          )}
        </React.Fragment>
      )}

      <p className="adm-sub" style={{ marginTop: "8px", opacity: 0.75 }}>
        Destinazione: <code>{base()}</code>
      </p>

      {inutili?.length > 0 && (
        <div className="adm-sub" style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border-subtle, #e2e0da)" }}>
          <b>{inutili.length} file nel deposito non sono richiamati da nessun prodotto</b>
          {" "}({(inutili.reduce((t, f) => t + f.byte, 0) / 1048576).toFixed(1)} MB).
          Restano dopo una rinomina, o quando il selettore si porta dietro una sottocartella.
          {recenti > 0 && (
            <> I <b>{recenti}</b> caricati nelle ultime 24 ore non sono in elenco: quasi sempre
            sono lavoro in corso, non ancora agganciato a un prodotto.</>
          )}
          <details style={{ marginTop: "6px" }}>
            <summary style={{ cursor: "pointer" }}>Vedi quali</summary>
            <ul style={{ margin: "6px 0 0 18px" }}>
              {inutili.map((f) => (
                <li key={f.nome}>{f.nome} <span style={{ opacity: 0.7 }}>· {Math.round(f.byte / 1024)} kB</span></li>
              ))}
            </ul>
          </details>
          <button className="adm-btn ghost mini" style={{ marginTop: "8px" }}
            disabled={pulendo} onClick={pulisci}>
            <Icon name="trash-2" size={13} /> {pulendo ? "Tolgo…" : `Togli i ${inutili.length} file`}
          </button>
        </div>
      )}
    </div>
  );
}

function EtichetteProdotto({ setErr }) {
  return (
    <React.Fragment>
      <Trasloco
        setErr={setErr}
        titolo="Foto dei prodotti nel deposito"
        cartella="labels" icona="image-plus" accetta="image/*"
        base={baseEtichette} conta={contaEtichetteLocali}
        carica={caricaEtichette} sposta={spostaEtichette}
        spiega={(s) => (
          <p className="adm-sub">
            {s?.riferimenti === 0 ? (
              <React.Fragment>
                Le foto del catalogo stanno nel deposito condiviso, dove le leggono{" "}
                <b>CRA Store e L2F</b> — e anche una terza vetrina domani.
              </React.Fragment>
            ) : (
              <React.Fragment>
                {s ? <b>{s.prodotti} prodotti</b> : "Alcuni prodotti"} hanno la foto scritta come percorso
                del sito (<code>/labels/…</code>). Funziona solo dove quella cartella è stata copiata, ma il
                catalogo è uno solo e lo leggono <b>CRA Store e L2F</b>. Nel deposito condiviso la vedono
                entrambi — e anche una terza vetrina domani.
              </React.Fragment>
            )}
            <br />Scegli la cartella <code>public/labels</code> del progetto L2F.
          </p>
        )}
        esitoTesto={(e) => (
          <React.Fragment>
            <b>{e.caricati}</b> file nel deposito
            {e.principali + e.galleria > 0
              ? <React.Fragment> · <b>{e.principali}</b> foto principali e{" "}
                <b>{e.galleria}</b> gallerie riscritte.</React.Fragment>
              : " · il catalogo puntava già al posto giusto."}
          </React.Fragment>
        )}
      />

      <Trasloco
        setErr={setErr}
        titolo="Schede tecniche e di sicurezza"
        cartella="chimico" icona="file-text" accetta="application/pdf"
        base={baseDocumenti} conta={contaDocumentiLocali}
        carica={caricaDocumenti} sposta={spostaDocumenti}
        spiega={(s) => (
          <p className="adm-sub">
            {s?.riferimenti === 0 ? (
              <React.Fragment>
                Schede tecniche e <b>schede di sicurezza</b> stanno nel deposito condiviso e si
                aprono da entrambi i siti. Per un prodotto chimico la scheda di sicurezza deve
                essere raggiungibile: se ne arriva una nuova, si ricarica da qui.
              </React.Fragment>
            ) : (
              <React.Fragment>
                {s ? <b>{s.riferimenti} documenti</b> : "I documenti"} puntano a <code>/chimico/…</code>,
                una cartella che sta in <code>_sources</code> e <b>non viene pubblicata da nessuno dei due
                siti</b>: oggi quei link sono rotti dappertutto. Fra questi ci sono{" "}
                <b>{s ? s.sicurezza : "diverse"} schede di sicurezza</b>, che per un prodotto chimico devono
                essere raggiungibili.
              </React.Fragment>
            )}
            <br />Scegli la cartella <code>_sources/chimico</code> del progetto L2F.
          </p>
        )}
        esitoTesto={(e) => (
          <React.Fragment>
            <b>{e.caricati}</b> documenti nel deposito
            {e.tecniche + e.sicurezza > 0
              ? <React.Fragment> · <b>{e.tecniche}</b> schede tecniche e{" "}
                <b>{e.sicurezza}</b> di sicurezza ora raggiungibili.</React.Fragment>
              : " · il catalogo puntava già al posto giusto."}
          </React.Fragment>
        )}
      />
    </React.Fragment>
  );
}

/* ============================================================
   ATTIVITÀ — chi entra, cosa guarda, cosa compra.

   Solo utenti riconosciuti: dei visitatori anonimi qui non c'è niente, e non
   ci deve essere. Per quelli servono strumenti fatti apposta (Umami, Plausible)
   che non tengono dati personali e non appesantiscono questo database.

   Le domande a cui risponde: chi ha un accesso e non lo usa, cosa guardano
   senza comprare, e se il personale entra davvero.
   ============================================================ */
const PERIODI_ATT = [
  { id: "30", nome: "30 giorni" },
  { id: "90", nome: "3 mesi" },
  { id: "365", nome: "12 mesi" },
  { id: "tutto", nome: "Tutto" },
];

function estremiAtt(periodo) {
  if (periodo === "tutto") return { dal: null, al: null };
  const oggi = new Date();
  const da = new Date(oggi);
  da.setDate(da.getDate() - Number(periodo));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { dal: iso(da), al: iso(oggi) };
}

const nAtt = (n) => new Intl.NumberFormat("it-IT").format(Number(n) || 0);

function Attivita({ setErr }) {
  const [periodo, setPeriodo] = useState("90");
  const [vista, setVista] = useState("clienti");
  const [d, setD] = useState(null);

  useEffect(() => {
    let vivo = true;
    getAttivita(estremiAtt(periodo))
      .then((x) => vivo && setD(x))
      .catch(() => setErr("Non riesco a leggere l'attività."));
    return () => { vivo = false; };
  }, [periodo, setErr]);

  if (!d) return <p className="adm-sub">Caricamento…</p>;
  const r = d.riepilogo;
  const maxG = Math.max(1, ...d.giorni.map((g) => g.visite));

  return (
    <React.Fragment>
      <div className="adm-filtri" style={{ marginBottom: "12px" }}>
        {PERIODI_ATT.map((p) => (
          <button key={p.id} className={`adm-btn mini ${periodo === p.id ? "" : "ghost"}`}
            onClick={() => setPeriodo(p.id)}>{p.nome}</button>
        ))}
      </div>

      <p className="adm-regola">
        Qui c'è solo chi ha fatto <b>l'accesso</b>: clienti dello Store e personale.
        Dei visitatori anonimi non teniamo nulla — nessun indirizzo IP, nessuna impronta
        del browser. Si registra un fatto, non una persona.
      </p>

      <div className="dip-kpi-riga" style={{ marginBottom: "var(--space-5)" }}>
        <div className="dip-kpi forte">
          <span className="dip-kpi-eti">Clienti entrati</span>
          <b className="dip-kpi-val">{nAtt(r.clienti)}</b>
          <span className="dip-kpi-nota">su {nAtt(r.clienti_con_accesso)} con accesso</span>
        </div>
        <div className="dip-kpi">
          <span className="dip-kpi-eti">Dormienti</span>
          <b className="dip-kpi-val">{nAtt(r.dormienti)}</b>
          <span className="dip-kpi-nota">non entrano da oltre 60 giorni</span>
        </div>
        <div className="dip-kpi">
          <span className="dip-kpi-eti">Mai entrati</span>
          <b className="dip-kpi-val">{nAtt(r.mai_entrati)}</b>
          <span className="dip-kpi-nota">hanno le credenziali e non le usano</span>
        </div>
        <div className="dip-kpi">
          <span className="dip-kpi-eti">Prodotti guardati</span>
          <b className="dip-kpi-val">{nAtt(r.prodotti_visti)}</b>
          <span className="dip-kpi-nota">{nAtt(r.carrelli)} messi nel carrello</span>
        </div>
        <div className="dip-kpi">
          <span className="dip-kpi-eti">Proposte inviate</span>
          <b className="dip-kpi-val">{nAtt(r.ordini)}</b>
        </div>
        <div className="dip-kpi">
          <span className="dip-kpi-eti">Personale attivo</span>
          <b className="dip-kpi-val">{nAtt(r.dipendenti)}</b>
        </div>
      </div>

      {d.giorni.length > 0 && (
        <React.Fragment>
          <h2 className="adm-h2">Andamento</h2>
          <div className="dip-graf-box" style={{ marginBottom: "var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "120px" }}>
              {d.giorni.map((g) => (
                <span key={g.giorno} title={`${g.giorno}: ${g.visite} visite · ${g.persone} persone`}
                  style={{
                    flex: 1, minWidth: 2, background: "var(--cra-red)",
                    height: `${Math.max(2, (g.visite / maxG) * 100)}%`,
                  }} />
              ))}
            </div>
            <p className="dip-legenda" style={{ marginTop: "8px" }}>
              <span>visite al giorno · dal {d.giorni[0]?.giorno} al {d.giorni.at(-1)?.giorno}</span>
            </p>
          </div>
        </React.Fragment>
      )}

      <div className="adm-filtri" style={{ marginBottom: "10px" }}>
        {[["clienti", `Clienti (${d.clienti.length})`],
          ["dormienti", `Da richiamare (${d.dormienti.length})`],
          ["prodotti", `Prodotti (${d.prodotti.length})`],
          ["dipendenti", `Personale (${d.dipendenti.length})`]].map(([k, v]) => (
          <button key={k} className={`adm-btn mini ${vista === k ? "" : "ghost"}`}
            onClick={() => setVista(k)}>{v}</button>
        ))}
      </div>

      {vista === "clienti" && (
        <TabellaAtt vuoto="Nessun cliente è entrato in questo periodo."
          righe={d.clienti} chiave="officina_id"
          colonne={[
            ["Cliente", (c) => <span>{c.cliente}<br /><span className="adm-sub">{c.codice} · {c.citta ?? "—"}</span></span>],
            ["Visite", (c) => nAtt(c.visite), true],
            ["Prodotti", (c) => nAtt(c.prodotti), true],
            ["Carrello", (c) => nAtt(c.carrelli), true],
            ["Proposte", (c) => nAtt(c.ordini_veri), true],
            ["Speso", (c) => formatEuro(c.speso), true],
            ["Ultima volta", (c) => <span className="adm-sub">{c.giorni_da_ultima === 0 ? "oggi" : `${c.giorni_da_ultima} gg fa`}</span>],
          ]} />
      )}

      {vista === "dormienti" && (
        <React.Fragment>
          <p className="adm-regola">
            Hanno le credenziali ma non entrano. È l'elenco su cui telefonare — prima
            non esisteva da nessuna parte.
          </p>
          <TabellaAtt vuoto="Nessun cliente dormiente: entrano tutti."
            righe={d.dormienti} chiave="officina_id"
            colonne={[
              ["Cliente", (c) => <span>{c.cliente}<br /><span className="adm-sub">{c.codice} · {c.citta ?? "—"}</span></span>],
              ["Contatti", (c) => <span className="adm-sub">{c.email ?? "—"}{c.telefono ? ` · ${c.telefono}` : ""}</span>],
              ["Proposte fatte", (c) => nAtt(c.ordini), true],
              ["Ultima volta", (c) => (
                <span className={c.giorni == null ? "adm-sub" : undefined}>
                  {c.giorni == null ? "mai entrato" : `${c.giorni} giorni fa`}
                </span>
              )],
            ]} />
        </React.Fragment>
      )}

      {vista === "prodotti" && (
        <React.Fragment>
          <p className="adm-regola">
            <b>Guardati e non comprati</b>: il divario fra interesse e ordine. Un prodotto
            molto visto e poco messo nel carrello è un prezzo sbagliato o una scheda che non convince.
          </p>
          <TabellaAtt vuoto="Nessun prodotto guardato in questo periodo."
            righe={d.prodotti} chiave="codice"
            colonne={[
              ["Prodotto", (p) => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <img src={p.immagine || PLACEHOLDER_IMG} alt="" width="34" height="34"
                    style={{ objectFit: "contain", background: "var(--surface-subtle, #f2f1ed)" }} />
                  <span>{p.nome ?? p.codice}<br /><span className="adm-sub">{p.codice}</span></span>
                </span>
              )],
              ["Visto", (p) => nAtt(p.visti), true],
              ["Da clienti", (p) => nAtt(p.clienti), true],
              ["Nel carrello", (p) => nAtt(p.nel_carrello), true],
              ["Pezzi ordinati", (p) => nAtt(p.ordinati), true],
              ["Conversione", (p) => (p.conversione == null ? "—" : `${p.conversione}%`), true],
            ]} />
        </React.Fragment>
      )}

      {vista === "dipendenti" && (
        <TabellaAtt vuoto="Nessun dato sul personale."
          righe={d.dipendenti} chiave="dipendente_id"
          colonne={[
            ["Persona", (x) => <span>{x.persona}<br /><span className="adm-sub">{x.ruolo} · {x.filiale ?? "nessuna filiale"}</span></span>],
            ["Giorni", (x) => nAtt(x.giorni), true],
            ["Eventi", (x) => nAtt(x.eventi), true],
            ["Schede lette", (x) => nAtt(x.schede_lette), true],
            ["Ultima presenza", (x) => <span className="adm-sub">{x.ultima_presenza ?? "mai"}</span>],
            ["Accesso", (x) => (
              <span className={`adm-badge ${x.ha_account ? "ok" : ""}`}>
                {x.ha_account ? "collegato" : "da invitare"}
              </span>
            )],
          ]} />
      )}
    </React.Fragment>
  );
}

/** Tabella semplice: le colonne sono [intestazione, come si legge, numerica?]. */
function TabellaAtt({ righe, colonne, chiave, vuoto }) {
  if (!righe.length) return <p className="adm-vuoto">{vuoto}</p>;
  return (
    <div className="dip-tab-scroll">
      <table className="dip-tabella">
        <thead><tr>{colonne.map(([t, , num]) => (
          <th key={t} className={num ? "dip-num" : undefined}>{t}</th>
        ))}</tr></thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r[chiave]}>
              {colonne.map(([t, leggi, num]) => (
                <td key={t} className={num ? "dip-num" : undefined}>{leggi(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Slug per l'id di una categoria cliente: "Clienti VIP" → "clienti-vip". */
const slug = (s) =>
  s.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Prezzo scritto all'italiana → numero. "1.234,50" → 1234.5, "" → null.
 *  Se c'è una virgola, i punti sono separatori di migliaia: la conversione
 *  ingenua faceva diventare NaN "1.234,50", che veniva poi scartato in
 *  silenzio dal salvataggio. Stessa logica della Edge Function. */
function parsePrezzo(v) {
  let s = String(v ?? "").replace(/[€\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;   // NaN = testo non valido
}

/** Id della colonna "prezzo base" nella matrice. */
const BASE = "base";

const { useEffect, useState, useRef, useMemo, useCallback } = React;

/* Un prodotto creato a mano dal pannello CRA nasce a marchio generico e
   pubblicato sul CRA Store: è il caso normale (i prodotti L2F arrivano dal
   foglio). Il marchio va scritto: "L2F" solo se è davvero private label. */
const EMPTY_FORM = {
  codice: "", nome: "", categoria: "", prezzo: "", descrizione: "", immagine: "", tags: "",
  marchio: "", su_l2f: false, su_cra: true,
  cra_taglia: "normale", cra_offerta_da: "", cra_offerta_a: "", cra_offerta_prezzo: "", cra_offerta_etichetta: "",
  attrs: [], attrsExtra: {},
};

/** Misure della scheda nel catalogo, con quante caselle occupano. */
const MISURE = [
  { v: "normale", label: "Normale — 1 casella", celle: 1 },
  { v: "grande", label: "Grande — 2 caselle in larghezza", celle: 2 },
  { v: "vetrina", label: "Vetrina — 6 caselle (3 × 2)", celle: 6 },
  { v: "vetrina_xl", label: "Vetrina XL — 9 caselle (3 × 3)", celle: 9 },
];

/* Il campo datetime-local lavora in ora LOCALE: convertire con
   toISOString().slice(0,16) perderebbe il fuso e mostrerebbe due ore in meno. */
const isoToInput = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const inputToIso = (s) => (s ? new Date(s).toISOString() : null);

/* Chiavi attributo suggerite: le stesse che alimentano i filtri dello store. */
const ATTR_KEYS = [
  "tecnologia", "ah", "spunto", "polo", "box", "dimensioni",
  "attacco", "kelvin", "canbus", "linea", "potenza", "voltaggio", "utilizzo",
  "gradazione", "categoria", "confezione",
];

/* ---------- Megamenu categorie: macro a sinistra, sottocategorie a destra,
   filtro rapido in alto. Le macro senza figli si selezionano direttamente. ---------- */
function CategoryPicker({ categorie, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [activeMacro, setActiveMacro] = useState(null);
  const wrapRef = useRef(null);

  const macros = useMemo(() => categorie.filter((c) => !c.parent_id), [categorie]);
  const subsOf = (mid) => categorie.filter((c) => c.parent_id === mid);
  const byId = useMemo(() => Object.fromEntries(categorie.map((c) => [c.id, c])), [categorie]);

  const label = (() => {
    if (!value || !byId[value]) return "— Nessun reparto";
    const cat = byId[value];
    const parent = cat.parent_id ? byId[cat.parent_id] : null;
    return parent ? `${parent.nome} › ${cat.nome}` : cat.nome;
  })();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (id) => { onChange(id); setOpen(false); setFiltro(""); };

  const q = filtro.trim().toLowerCase();
  const filtered = q
    ? categorie
        .filter((c) => c.parent_id || subsOf(c.id).length === 0) // voci selezionabili
        .filter((c) => {
          const parent = c.parent_id ? byId[c.parent_id] : null;
          return `${parent?.nome ?? ""} ${c.nome}`.toLowerCase().includes(q);
        })
    : null;

  const itemStyle = (active = false) => ({
    display: "block", width: "100%", textAlign: "left", cursor: "pointer",
    padding: "8px 12px", border: "none",
    background: active ? "var(--cra-charcoal)" : "transparent",
    color: active ? "var(--cra-white)" : "var(--text-strong)",
    fontFamily: "var(--font-body)", fontSize: "var(--fs-xs)",
  });

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer",
          width: "100%", padding: "9px 11px", background: "var(--surface-card)",
          border: "var(--border-w-2) solid var(--border-strong)",
          fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", color: "var(--text-strong)",
          justifyContent: "space-between",
        }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <Icon name="chevron-down" size={14} color="var(--text-muted, #5c6462)" />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 70,
          width: "min(560px, 92vw)", background: "var(--surface-card)",
          border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-lg)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "10px", borderBottom: "1px solid var(--border-subtle, #e2e0da)", display: "flex", gap: "8px" }}>
            <input autoFocus type="text" value={filtro} onChange={(e) => setFiltro(e.target.value)}
              placeholder="Cerca categoria… (es. dischi, candele, olio)"
              style={{ flex: 1, padding: "8px 10px", border: "var(--border-w-2) solid var(--border-strong)", fontFamily: "var(--font-body)", fontSize: "var(--fs-xs)", outline: "none" }} />
            <button type="button" className="adm-btn ghost mini" onClick={() => pick(null)}>Nessuna</button>
          </div>

          {filtered ? (
            <div style={{ maxHeight: "320px", overflowY: "auto", padding: "6px 0" }}>
              {filtered.length === 0 && <p className="adm-sub" style={{ padding: "10px 14px", margin: 0 }}>Nessun reparto trovato.</p>}
              {filtered.map((c) => {
                const parent = c.parent_id ? byId[c.parent_id] : null;
                return (
                  <button key={c.id} type="button" style={itemStyle(c.id === value)} onClick={() => pick(c.id)}>
                    {parent ? <span style={{ color: "var(--text-muted)" }}>{parent.nome} › </span> : null}{c.nome}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", maxHeight: "340px" }}>
              <div style={{ width: "48%", overflowY: "auto", borderRight: "1px solid var(--border-subtle, #e2e0da)" }}>
                {macros.map((m) => {
                  const hasSubs = subsOf(m.id).length > 0;
                  const isActive = activeMacro === m.id || (!hasSubs && value === m.id);
                  return (
                    <button key={m.id} type="button"
                      style={{ ...itemStyle(isActive), display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", fontWeight: "var(--fw-semibold)" }}
                      onClick={() => (hasSubs ? setActiveMacro(m.id) : pick(m.id))}
                      onMouseEnter={() => hasSubs && setActiveMacro(m.id)}>
                      {m.nome}
                      {hasSubs && <Icon name="chevron-right" size={13} color={isActive ? "var(--cra-gold)" : "var(--text-muted, #5c6462)"} />}
                    </button>
                  );
                })}
              </div>
              <div style={{ width: "52%", overflowY: "auto" }}>
                {!activeMacro && <p className="adm-sub" style={{ padding: "12px 14px", margin: 0 }}>Passa su una categoria per vedere le sottocategorie.</p>}
                {activeMacro && subsOf(activeMacro).map((s) => (
                  <button key={s.id} type="button" style={itemStyle(s.id === value)} onClick={() => pick(s.id)}>
                    {s.nome}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Matrice prezzi: una riga per prodotto, una colonna per
   categoria cliente. È la stessa forma del foglio MASTER, così il pannello
   e il foglio parlano la stessa lingua.

   Prestazioni: una sola cella per volta è un vero <input>; tutte le altre
   sono <span>. Con 112 righe × N colonne rendere tutto un input controllato
   renderebbe la digitazione visibilmente lenta. ---------- */
function MatricePrezzi({ righe, colonne, valoreDi, baseDi, bloccoDi, bulk, cellaAttiva, setCellaAttiva, onCella, onSpiega, catLabel }) {
  const chiave = (r, c) => `${c.id}|${r.quale}|${r.id}`;

  return (
    <div className="adm-mx-scroll">
      <table className="adm-mx">
        <thead>
          <tr>
            <th className="adm-mx-prod">Prodotto</th>
            {colonne.map((c) => (
              <th key={c.id} className="adm-mx-col">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {c.colore && <span style={{ width: 10, height: 10, background: c.colore, flex: "0 0 auto" }} />}
                  <span>{c.nome}</span>
                </div>
                <div style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, opacity: .75, marginTop: 3 }}>
                  {c.sottotitolo}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span className={`adm-badge ${c.dalFoglio ? "oro" : "grigio"}`} style={{ fontSize: 9 }}>
                    {c.dalFoglio ? `dal foglio · colonna ${c.nome}` : "gestita a mano"}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={`${r.quale}|${r.id}`}>
              <td className="adm-mx-prod">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <img className="adm-item-thumb" style={{ width: 32, height: 32 }} src={r.immagine || PLACEHOLDER_IMG} alt="" loading="lazy" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="adm-mx-nome" title={r.nome}>
                      {r.variante ? "↳ " : ""}{r.nome}
                    </div>
                    <div className="adm-mx-meta">
                      <span>{r.codice}</span>
                      {r.reparto && <span>· {catLabel ? catLabel(r.reparto) : r.reparto}</span>}
                      <span className={`adm-badge ${r.fonte_listino ? "oro" : "grigio"}`} style={{ fontSize: 9 }}>
                        {r.fonte_listino ? `dal foglio · ${r.fonte_listino}` : "a mano"}
                      </span>
                      {r.nascosto && <span className="adm-badge grigio" style={{ fontSize: 9 }}>nascosto</span>}
                    </div>
                  </div>
                </div>
              </td>

              {colonne.map((c) => {
                const k = chiave(r, c);
                const bloccata = bloccoDi(r, c);
                const originale = valoreDi(r, c);
                const inSospeso = bulk[k];
                const modificata = inSospeso !== undefined;
                const mostrato = modificata ? inSospeso : (originale != null ? String(originale) : "");
                const errore = modificata && inSospeso !== "" && Number.isNaN(parsePrezzo(inSospeso));
                const eredita = !modificata && originale == null;
                const attiva = cellaAttiva === k;

                const classi = ["adm-mx-cell"];
                if (bloccata) classi.push("bloccata");
                else if (errore) classi.push("errore");
                else if (modificata) classi.push("modificata");
                else if (eredita) classi.push("eredita");
                else classi.push("dedicato");

                if (bloccata) {
                  return (
                    <td key={c.id} className={classi.join(" ")} tabIndex={-1}
                      onClick={() => onSpiega({ riga: r, colonna: c })}
                      title="Prezzo comandato dal foglio — clicca per sapere dove cambiarlo">
                      <span className="adm-mx-val">
                        <Icon name="lock" size={10} />
                        {originale != null ? formatEuro(originale) : "—"}
                      </span>
                    </td>
                  );
                }
                return (
                  <td key={c.id} className={classi.join(" ")}>
                    {attiva ? (
                      <input autoFocus type="text" inputMode="decimal"
                        aria-label={`${c.nome} · ${r.nome}`}
                        value={mostrato}
                        onChange={(e) => onCella(k, e.target.value, originale)}
                        onBlur={() => setCellaAttiva(null)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }} />
                    ) : (
                      <span className="adm-mx-val" tabIndex={0} role="button"
                        onClick={() => setCellaAttiva(k)}
                        onFocus={() => setCellaAttiva(k)}>
                        {modificata
                          ? (inSospeso === "" ? <em style={{ opacity: .7 }}>torna al base</em> : mostrato)
                          : eredita
                            ? (c.id === BASE ? "—" : `= ${formatEuro(baseDi(r))}`)
                            : formatEuro(originale)}
                        {modificata && originale != null && (
                          <span className="adm-mx-precedente">{formatEuro(originale)}</span>
                        )}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Prezzi validi soltanto per QUESTO cliente.
 *
 * Le categorie cliente coprono i gruppi (nord, sud, vip…). Quando il prezzo è
 * di una officina sola, una colonna in più nella matrice non è la risposta:
 * con cento clienti diventa illeggibile, e comunque un prezzo speciale è un
 * fatto del cliente, non del catalogo. Quindi sta nella sua scheda.
 *
 * Ordine di precedenza, applicato dal database: prezzo dedicato al cliente →
 * prezzo della sua categoria → prezzo base.
 */
function PrezziCliente({ officina, righe, categoriaNome, prezzoCorrente, onCambio }) {
  const [stato, setStato] = useState(null);          // { listinoId, prezzi }
  const [q, setQ] = useState("");
  const [bozza, setBozza] = useState({});            // rigaId → testo digitato
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    let vivo = true;
    getPrezziCliente(officina.id)
      .then((r) => { if (vivo) setStato(r); })
      .catch(() => { if (vivo) setErrore("Non riesco a leggere i prezzi dedicati."); });
    return () => { vivo = false; };
  }, [officina.id]);

  const indice = useMemo(() => new Map((righe ?? []).map((r) => [r.id, r])), [righe]);

  /** Prezzi già impostati, con la riga di catalogo a cui si riferiscono. */
  const impostati = useMemo(() => (stato?.prezzi ?? [])
    .map((p) => ({ ...p, riga: indice.get(p.id) }))
    .filter((p) => p.riga)
    .sort((a, b) => String(a.riga.codice).localeCompare(String(b.riga.codice))),
  [stato, indice]);

  /** Ricerca nel catalogo, escludendo ciò che ha già un prezzo dedicato. */
  const risultati = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const già = new Set((stato?.prezzi ?? []).map((p) => p.id));
    return (righe ?? [])
      .filter((r) => !già.has(r.id))
      .filter((r) => t.split(/\s+/).every((w) => `${r.codice} ${r.nome}`.toLowerCase().includes(w)))
      .slice(0, 8);
  }, [righe, q, stato]);

  const salva = async (riga, testo) => {
    const prezzo = parsePrezzo(testo);
    if (prezzo == null || Number.isNaN(prezzo)) { setErrore("Scrivi un prezzo valido, es. 19,90"); return; }
    setBusy(true); setErrore(null);
    try {
      const listinoId = await setPrezzoCliente(officina.id, officina.ragione_sociale, riga.quale, riga.id, prezzo);
      setStato((s) => ({
        listinoId,
        prezzi: [...(s?.prezzi ?? []).filter((p) => p.id !== riga.id), { quale: riga.quale, id: riga.id, prezzo }],
      }));
      setBozza((b) => ({ ...b, [riga.id]: "" }));
      setQ("");
      onCambio?.();          // il contatore sul pulsante vive fuori di qui
    } catch { setErrore("Salvataggio non riuscito."); }
    finally { setBusy(false); }
  };

  const togli = async (riga) => {
    if (!stato?.listinoId) return;
    setBusy(true); setErrore(null);
    try {
      await removePrezzoCliente(stato.listinoId, riga.quale, riga.id);
      setStato((s) => ({ ...s, prezzi: (s?.prezzi ?? []).filter((p) => p.id !== riga.id) }));
      onCambio?.();
    } catch { setErrore("Rimozione non riuscita."); }
    finally { setBusy(false); }
  };

  /* formatEuro(null) dice "su richiesta": in vetrina va bene, qui no. */
  const cifra = (n) => (n == null ? "—" : formatEuro(n));

  const senzaPrezzo = categoriaNome
    ? `senza un prezzo qui, paga i prezzi della categoria ${categoriaNome.toUpperCase()}`
    : "senza un prezzo qui, paga il prezzo base";

  return (
    <React.Fragment>
      <p className="adm-sub" style={{ marginTop: "12px" }}>
        Si scavalca la categoria un articolo alla volta: {senzaPrezzo}.
      </p>

      {errore && <p className="adm-sub" style={{ color: "var(--cra-red)" }}>{errore}</p>}

      <label className="adm-fld" style={{ maxWidth: "460px" }}>
        <span>Cerca l'articolo da prezzare</span>
        <input type="search" value={q} placeholder="codice o nome, es. gdb1330 oppure pastiglie"
          onChange={(e) => { setQ(e.target.value); setErrore(null); }} />
      </label>

      {q.trim() && risultati.length === 0 && (
        <p className="adm-sub">Nessun articolo trovato (o ha già un prezzo qui sotto).</p>
      )}

      {risultati.map((r) => (
        <div key={r.id} className="adm-row-head" style={{ gap: "10px", padding: "6px 0" }}>
          <span style={{ flex: 1, minWidth: "200px" }}>
            {r.nome}
            <br />
            <span className="adm-sub">
              {r.codice}{r.variante ? " · formato" : ""} · prezzo attuale {cifra(prezzoCorrente(r))}
            </span>
          </span>
          <input type="text" value={bozza[r.id] ?? ""} placeholder="prezzo dedicato" inputMode="decimal"
            style={{ width: "130px", padding: "6px 8px", border: "var(--border-w-2) solid var(--border-strong)", fontVariantNumeric: "tabular-nums" }}
            onChange={(e) => setBozza((b) => ({ ...b, [r.id]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") salva(r, bozza[r.id]); }} />
          <button className="adm-btn mini" disabled={busy || !String(bozza[r.id] ?? "").trim()}
            onClick={() => salva(r, bozza[r.id])}>
            <Icon name="save" size={13} /> Imposta
          </button>
        </div>
      ))}

      {stato === null ? <p className="adm-sub">Caricamento…</p> :
        impostati.length === 0 ? <p className="adm-sub">Nessun prezzo speciale: {senzaPrezzo}.</p> : (
          <div style={{ marginTop: "10px", borderTop: "1px solid var(--border-subtle, #e2e0da)" }}>
            {impostati.map((p) => (
              <div key={p.id} className="adm-row-head" style={{ gap: "10px", padding: "8px 0", borderBottom: "1px solid var(--border-subtle, #e2e0da)" }}>
                <span style={{ flex: 1, minWidth: "200px" }}>
                  {p.riga.nome}
                  <br />
                  <span className="adm-sub">
                    {p.riga.codice}{p.riga.variante ? " · formato" : ""} · senza questo pagherebbe {cifra(prezzoCorrente(p.riga))}
                  </span>
                </span>
                <input type="text" defaultValue={String(p.prezzo).replace(".", ",")} inputMode="decimal"
                  aria-label={`Prezzo dedicato per ${p.riga.codice}`}
                  style={{ width: "130px", padding: "6px 8px", border: "var(--border-w-2) solid var(--cra-gold)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                  onBlur={(e) => { const v = parsePrezzo(e.target.value); if (v != null && !Number.isNaN(v) && v !== Number(p.prezzo)) salva(p.riga, e.target.value); }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
                <button className="adm-btn rosso mini" disabled={busy} onClick={() => togli(p.riga)}
                  title="Togli il prezzo dedicato: torna a quello della categoria">
                  <Icon name="trash-2" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
    </React.Fragment>
  );
}

/* Il cancello sta in un componente suo, e il pannello in un altro.
 *
 * Non è pignoleria: prima le due uscite anticipate stavano in mezzo, con
 * ventitré hook dopo. Al primo disegno `loading` è vero e la funzione esce
 * subito, quindi quegli hook non vengono chiamati; appena l'accesso si
 * risolve vengono chiamati tutti. React conta gli hook a ogni disegno e
 * pretende lo stesso numero: ne trovava ventitré in più e si fermava.
 *
 * Succedeva solo ricaricando la pagina direttamente su #/admin, quando il
 * controllo dell'accesso finiva dopo il download del codice — una corsa,
 * cioè un difetto che si presenta a caso e a qualcun altro. Separando i due
 * componenti gli hook del pannello girano solo quando il cancello è già
 * passato: è la stessa condizione di prima, ma senza rami dentro. */
export function Admin({ onNavigate }) {
  const { loading, isAdmin } = useAuth();
  if (loading) {
    return <section className="adm-page"><div className="adm-wrap"><p className="adm-state">Caricamento…</p></div></section>;
  }
  if (!isAdmin) {
    return (
      <section className="adm-page">
        <div className="adm-wrap">
          <div className="adm-state">
            <Icon name="shield-check" size={40} color="var(--cra-gold)" />
            <h1 className="adm-title" style={{ margin: "12px 0 6px" }}>Area riservata</h1>
            <p style={{ margin: 0 }}>Questa sezione è accessibile solo agli amministratori.</p>
            <button className="adm-btn" style={{ marginTop: "16px" }} onClick={() => onNavigate("home")}>Torna alla home</button>
          </div>
        </div>
      </section>
    );
  }

  return <PannelloAdmin />;
}

/* Il pannello vero. Qui dentro `loading` è per forza finito e `isAdmin` per
   forza vero: se li ricontrollasse sarebbe un dubbio senza motivo. */
function PannelloAdmin() {
  const { isAdmin, officina: mia, refreshOfficina } = useAuth();
  const [tab, setTab] = useState("prezzi");
  const [err, setErr] = useState(null);

  // officine — l'elenco è UNA PAGINA di risultati, non tutta l'anagrafica:
  // dal caricamento del gestionale sono migliaia di righe.
  const [officine, setOfficine] = useState(null);     // la pagina corrente
  const [totaleOfficine, setTotaleOfficine] = useState(0);
  const [contaStati, setContaStati] = useState({});
  const [contaCat, setContaCat] = useState({});
  const [savedId, setSavedId] = useState(null);
  // Filtri dell'elenco clienti + quale pannello è aperto (uno per volta:
  // con molti clienti tenerne aperti dieci riporta al muro di partenza).
  const [cliQ, setCliQ] = useState("");
  const [cliVista, setCliVista] = useState("con_accesso");
  const [cliStato, setCliStato] = useState("");
  const [cliCat, setCliCat] = useState("");
  const [cliProv, setCliProv] = useState("");
  const [cliPagina, setCliPagina] = useState(0);
  const [cliPerPagina, setCliPerPagina] = useState(50);
  const [province, setProvince] = useState([]);
  const [cliBusy, setCliBusy] = useState(false);
  const [cliAperta, setCliAperta] = useState(null);   // anagrafica aperta
  const [cliPrezzi, setCliPrezzi] = useState(null);   // prezzi dedicati aperti
  const [nuovaOff, setNuovaOff] = useState(null);     // form "nuova officina", null = chiuso
  const [nuovaBusy, setNuovaBusy] = useState(false);

  // ordini
  const [orders, setOrders] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);

  // prodotti
  const [products, setProducts] = useState(null);
  const [categorie, setCategorie] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [prodottoOk, setProdottoOk] = useState(null);
  /** Il form dei prodotti nasce chiuso: si apre per creare o per modificare. */
  const [formAperto, setFormAperto] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncReport, setSyncReport] = useState(null);

  // filtri dell'elenco prodotti (condivisi da Prezzi e Prodotti)
  const [fQ, setFQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fStato, setFStato] = useState("tutti");
  const [fOrigine, setFOrigine] = useState("tutti");   // tutti | foglio | mano
  const [fEvidenza, setFEvidenza] = useState(false);   // solo schede ingrandite

  /** Modifiche di prezzo in sospeso. Chiave: `${colonna}|${quale}|${idRiga}`.
   *  Valore: la stringa digitata; "" significa "togli il prezzo dedicato". */
  const [bulk, setBulk] = useState({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkOk, setBulkOk] = useState(null);
  const [cellaAttiva, setCellaAttiva] = useState(null);
  const [spiega, setSpiega] = useState(null);          // cella bloccata da spiegare
  const [vediModifiche, setVediModifiche] = useState(false);

  // prezzi: matrice completa + esito dell'ultimo aggiornamento dal foglio
  const [matrice, setMatrice] = useState({ cra: {}, prod: {}, var: {} });
  const [ultimoSync, setUltimoSync] = useState(null);
  const [catalogo, setCatalogo] = useState("cra");     // cra | l2f

  // categorie cliente + contenitori prezzi
  const [categorieCli, setCategorieCli] = useState([]);
  /* I tre documenti non cambiano mentre si lavora: si leggono una volta. */
  const [tipiDoc, setTipiDoc] = useState([]);
  useEffect(() => { getTipiDocumento().then(setTipiDoc).catch(() => setTipiDoc([])); }, []);
  const [listini, setListini] = useState([]);
  const [catForm, setCatForm] = useState({ nome: "", colore: "#bd3432" });
  const [listForm, setListForm] = useState({ nome: "", priorita: 0 });

  // righe del catalogo unico per la matrice (prodotti + varianti)
  const [l2fRighe, setL2fRighe] = useState(null);

  // nota una tantum sul cambio di struttura
  const [notaVisibile, setNotaVisibile] = useState(() => {
    try { return localStorage.getItem("cra_admin_nota_prezzi") !== "letta"; } catch { return true; }
  });
  const chiudiNota = () => {
    setNotaVisibile(false);
    try { localStorage.setItem("cra_admin_nota_prezzi", "letta"); } catch { /* modalità privata */ }
  };

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      getCraOrders(), getAllProducts(), getCategories(),
      getCategorieCliente(), getListini(), getPrezziMatrice(), getUltimoSync(),
      getContaOfficine(), getContaPerCategoria(), getProvinceOfficine(),
    ])
      .then(([o, p, c, cc, l, mx, us, cs, ccat, pr]) => {
        setOrders(o); setProducts(p); setCategorie(c);
        setCategorieCli(cc); setListini(l); setMatrice(mx); setUltimoSync(us);
        setContaStati(cs); setContaCat(ccat); setProvince(pr);
      })
      .catch(() => setErr("Errore di caricamento. Ricarica la pagina."));
  }, [isAdmin]);

  /* L'elenco clienti si chiede al server a ogni cambio di filtro o di pagina,
     non si filtra in memoria: le anagrafiche sono migliaia e PostgREST ne
     restituisce comunque al massimo 1000 per chiamata. */
  const filtriCli = useMemo(
    () => ({ q: cliQ, vista: cliVista, stato: cliStato, categoria: cliCat, provincia: cliProv }),
    [cliQ, cliVista, cliStato, cliCat, cliProv],
  );

  // Cambiare un filtro o la dimensione pagina riporta alla prima: restare
  // a pagina 7 di un elenco che ora ne ha 2 mostrerebbe il vuoto.
  useEffect(() => { setCliPagina(0); }, [filtriCli, cliPerPagina]);

  useEffect(() => {
    if (!isAdmin || tab !== "officine") return undefined;
    let vivo = true;
    setCliBusy(true);
    // Attesa mentre si digita: senza, ogni lettera sarebbe una richiesta.
    const t = setTimeout(() => {
      getOfficine({ ...filtriCli, limit: cliPerPagina, offset: cliPagina * cliPerPagina })
        .then(({ righe, totale }) => {
          if (!vivo) return;
          setOfficine(righe); setTotaleOfficine(totale);
        })
        .catch(() => vivo && setErr("Non riesco a leggere l'elenco clienti."))
        .finally(() => vivo && setCliBusy(false));
    }, cliQ ? 400 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [isAdmin, tab, filtriCli, cliPagina, cliPerPagina, cliQ]);

  /** Rilegge la pagina corrente e i conteggi dopo una modifica. */
  const ricaricaOfficine = useCallback(async () => {
    const [{ righe, totale }, cs, ccat] = await Promise.all([
      getOfficine({ ...filtriCli, limit: cliPerPagina, offset: cliPagina * cliPerPagina }),
      getContaOfficine(), getContaPerCategoria(),
    ]);
    setOfficine(righe); setTotaleOfficine(totale); setContaStati(cs); setContaCat(ccat);
  }, [filtriCli, cliPagina, cliPerPagina]);

  // Modifiche di prezzo non salvate: chiudere la pagina deve chiedere, non
  // buttare via in silenzio.
  useEffect(() => {
    if (!Object.keys(bulk).length) return;
    const avvisa = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [bulk]);

  // Righe della matrice: un solo catalogo, caricato una volta sola.
  useEffect(() => {
    if (!isAdmin || l2fRighe) return;
    getRigheCatalogo()
      .then(setL2fRighe)
      .catch(() => setErr("Caricamento del catalogo non riuscito."));
  }, [isAdmin, l2fRighe]);


  /* ---------- officine ---------- */
  const patchOfficina = (id, patch) =>
    setOfficine((prev) => prev?.map((o) => (o.id === id ? { ...o, ...patch } : o)) ?? prev);

  const saveOfficina = async (o) => {
    try {
      await updateOfficina(o.id, o);
      await ricaricaOfficine();
      // Se ho modificato la MIA anagrafica, aggiorna subito il contesto auth
      // (menu Ecom, gate dello store) senza dover ricaricare la pagina.
      if (o.id === mia?.id) await refreshOfficina();
      setSavedId(o.id);
      setTimeout(() => setSavedId((s) => (s === o.id ? null : s)), 1800);
    } catch { setErr("Salvataggio non riuscito."); }
  };

  const VUOTA_OFF = {
    ragione_sociale: "", codice_cliente: "", piva: "", email: "", telefono: "",
    indirizzo: "", citta: "", provincia: "", cap: "", categoria_cliente: "",
  };

  const creaOfficina = async () => {
    const f = nuovaOff ?? VUOTA_OFF;
    if (!f.ragione_sociale.trim()) { setErr("La ragione sociale è obbligatoria."); return; }
    setNuovaBusy(true); setErr(null);
    try {
      await createOfficina(f);
      setNuovaOff(null);
      // La nuova scheda è un'anagrafica: si mostra cercandola, così si vede
      // subito che è stata creata. L'elenco lo ricarica l'effetto dei filtri.
      setCliVista("anagrafica"); setCliStato(""); setCliCat(""); setCliProv("");
      setCliQ(f.ragione_sociale.trim());
      const [cs, ccat] = await Promise.all([getContaOfficine(), getContaPerCategoria()]);
      setContaStati(cs); setContaCat(ccat);
    } catch (e) {
      const m = String(e?.message || "");
      setErr(m.includes("codice_cliente") ? "Esiste già un cliente con questo codice." : "Creazione non riuscita.");
    } finally { setNuovaBusy(false); }
  };

  /* ---------- ordini ---------- */
  const onStato = async (id, stato) => {
    setOrders((prev) => prev?.map((o) => (o.id === id ? { ...o, stato } : o)) ?? prev);
    try { await updateOrderStato(id, stato); } catch { setErr("Aggiornamento stato non riuscito."); }
  };
  const exportCsv = () => {
    if (!orders?.length) return;
    downloadCsv(`proposte-cra-${new Date().toISOString().slice(0, 10)}.csv`, ordersToCsv(orders));
  };

  /* ---------- prodotti ---------- */
  const resetForm = () => {
    setForm({ ...EMPTY_FORM, attrs: [], attrsExtra: {} });
    setEditingId(null);
    setFormAperto(false);   // finito il lavoro, il form si richiude e libera lo schermo
  };
  /** Colonne del catalogo unico. Il prezzo NON è qui: vive in product_netto. */
  const buildFields = () => {
    const marchio = form.marchio.trim() || "L2F";
    const eL2f = marchio.toUpperCase() === "L2F";
    return {
      codice_l2f: form.codice.trim(),
      nome: form.nome.trim(),
      reparto_cra: form.categoria || null,
      marchio,
      // Il vincolo a DB rifiuta su_l2f su un marchio generico: qui lo
      // anticipiamo, così l'utente non incontra un errore SQL.
      su_l2f: eL2f && form.su_l2f,
      su_cra: form.su_cra,
      // Vetrina: misura della scheda e finestra d'offerta.
      cra_taglia: MISURE.some((m) => m.v === form.cra_taglia) ? form.cra_taglia : "normale",
      cra_offerta_da: inputToIso(form.cra_offerta_da),
      cra_offerta_a: inputToIso(form.cra_offerta_a),
      cra_offerta_prezzo: form.cra_offerta_a && form.cra_offerta_prezzo !== ""
        ? parsePrezzo(form.cra_offerta_prezzo) : null,
      cra_offerta_etichetta: form.cra_offerta_etichetta.trim() || null,
      descrizione: form.descrizione.trim() || null,
      immagine: form.immagine || null,
      tags: form.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      // attrsExtra preserva le parti non modificabili da qui (es. schede annidate)
      attributi: {
        ...form.attrsExtra,
        ...Object.fromEntries(
          form.attrs
            .filter((r) => r.k.trim() && String(r.v).trim())
            .map((r) => [r.k.trim().toLowerCase(), String(r.v).trim()]),
        ),
      },
    };
  };
  const saveProduct = async () => {
    if (!form.codice.trim() || !form.nome.trim()) return;
    // Senza questa guardia un doppio clic lancia due creazioni: la prima
    // riesce, la seconda torna "codice già esistente" e sembra un errore.
    if (savingProduct) return;

    // Guardie sulla finestra d'offerta: meglio dirlo prima che scoprirlo dal
    // vincolo del database con un messaggio in inglese.
    const da = form.cra_offerta_da ? new Date(form.cra_offerta_da).getTime() : null;
    const a = form.cra_offerta_a ? new Date(form.cra_offerta_a).getTime() : null;
    // Si protesta solo se la data nel passato è NUOVA: un'offerta già scaduta e
    // lasciata com'era non deve impedire di correggere il nome o la foto.
    const precedente = editingId ? (products ?? []).find((x) => x.id === editingId) : null;
    const finePrecedente = precedente?.cra_offerta_a ? new Date(precedente.cra_offerta_a).getTime() : null;
    if (a && a <= Date.now() && a !== finePrecedente) {
      setErr("La data di fine è già passata: l'offerta nascerebbe già finita. Correggi la data, oppure premi «Togli l'offerta».");
      return;
    }
    if (da && a && a <= da) { setErr("La fine dell'offerta viene prima dell'inizio."); return; }
    if (form.cra_offerta_prezzo !== "" && !a) {
      setErr("Hai messo un prezzo in offerta senza data di fine: un'offerta senza scadenza non è un'offerta.");
      return;
    }

    setSavingProduct(true);
    try {
      const campi = buildFields();
      let id = editingId;
      if (editingId) await updateProduct(editingId, campi);
      else id = await createProduct({ ...campi, attivo: true });
      // Il prezzo base sta su un'altra tabella: si scrive a parte.
      const prezzo = form.prezzo !== "" ? parsePrezzo(form.prezzo) : null;
      if (id && prezzo != null && !Number.isNaN(prezzo)) {
        await bulkUpdatePrices([{ id, prezzo }]);
      }
      const nome = form.nome.trim();
      const eraModifica = !!editingId;
      resetForm();
      const [p, righe, mx] = await Promise.all([getAllProducts(), getRigheCatalogo(), getPrezziMatrice()]);
      setProducts(p); setL2fRighe(righe); setMatrice(mx);
      // Conferma esplicita: prima il salvataggio riusciva in silenzio e non si
      // capiva se avesse funzionato.
      setProdottoOk(`«${nome}» ${eraModifica ? "aggiornato" : "creato"}.`);
      setTimeout(() => setProdottoOk(null), 4000);
    } catch (e) {
      const msg = String(e?.message || "");
      setErr(
        msg.includes("duplicate")
          ? `Esiste già un prodotto con il codice «${form.codice.trim()}»: controlla nell'elenco qui sotto, potresti averlo già creato.`
          : msg.includes("su_l2f_solo_private_label") ? "Solo i prodotti a marchio L2F possono stare sul sito L2F."
          : `Salvataggio prodotto non riuscito: ${msg || "errore sconosciuto"}`,
      );
    } finally {
      setSavingProduct(false);
    }
  };
  const editProduct = (p) => {
    const attrs = [];
    const attrsExtra = {};
    for (const [k, v] of Object.entries(p.attributi ?? {})) {
      if (v != null && typeof v !== "object") attrs.push({ k, v: String(v) });
      else attrsExtra[k] = v; // annidati (es. caratteristiche): preservati intatti
    }
    // Il prezzo base non si modifica da qui: sta nella scheda Prezzi.
    setForm({
      codice: p.codice, nome: p.nome, categoria: p.categoria ?? "",
      prezzo: "", descrizione: p.descrizione ?? "", immagine: p.immagine ?? "",
      tags: (p.tags ?? []).join(", "),
      marchio: p.marchio ?? "", su_l2f: !!p.su_l2f, su_cra: !!p.su_cra,
      cra_taglia: p.cra_taglia ?? "normale",
      cra_offerta_da: isoToInput(p.cra_offerta_da),
      cra_offerta_a: isoToInput(p.cra_offerta_a),
      cra_offerta_prezzo: p.cra_offerta_prezzo != null ? String(p.cra_offerta_prezzo) : "",
      cra_offerta_etichetta: p.cra_offerta_etichetta ?? "",
      attrs, attrsExtra,
    });
    setEditingId(p.id);
    setFormAperto(true);    // "Modifica" deve mostrare i campi, non solo caricarli
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggleProduct = async (p) => {
    try { await updateProduct(p.id, { attivo: !p.attivo }); setProducts(await getAllProducts()); }
    catch { setErr("Operazione non riuscita."); }
  };
  const removeProduct = async (id, nome) => {
    if (!window.confirm(`Elimino «${nome ?? "questo prodotto"}»? L'operazione non si può annullare.`)) return;
    try { await deleteProduct(id); setProducts((prev) => prev?.filter((p) => p.id !== id) ?? prev); }
    catch { setErr("Eliminazione non riuscita."); }
  };
  const onUploadImg = async (file) => {
    if (!file) return;
    setUploading(true);
    try { setForm((f) => ({ ...f, immagine: null })); const url = await uploadProductImage(file); setForm((f) => ({ ...f, immagine: url })); }
    catch { setErr("Upload foto non riuscito."); }
    finally { setUploading(false); }
  };
  const doSync = async () => {
    setSyncBusy(true);
    setSyncReport(null);
    setErr(null);
    const prima = new Map((products ?? []).map((p) => [p.id, p.fonte_listino]));
    try {
      const r = await syncCatalogo();
      const [p, mx, l, us] = await Promise.all([
        getAllProducts(), getPrezziMatrice(), getListini(), getUltimoSync(),
      ]);
      setProducts(p); setMatrice(mx); setListini(l); setUltimoSync(us);
      if (catalogo === "l2f") setL2fRighe(await getRigheCatalogo());

      // Passaggio di consegne: prodotti che gestivi a mano e che ora comanda il foglio.
      const passati = p.filter((x) => x.fonte_listino && prima.has(x.id) && !prima.get(x.id));
      setSyncReport({ ...r, passati: passati.map((x) => x.codice) });
    } catch (e) {
      setErr(`Aggiornamento dal foglio non riuscito: ${e?.message ?? "errore sconosciuto"}`);
    }
    finally { setSyncBusy(false); }
  };

  const ORIGINE_ETICHETTA = { cra: "reg. CRA", l2f: "reg. L2F", gestionale: "gestionale", manuale: "a mano" };
  const origineBadge = (o) => (
    <span className={`adm-badge ${o.origine === "cra" ? "oro" : "grigio"}`}>
      {ORIGINE_ETICHETTA[o.origine] ?? o.origine}
    </span>
  );

  /* ---------- elenco clienti ---------- */

  /** La pagina arriva già filtrata e ordinata dal server; qui si fa salire in
   *  cima solo chi è in attesa, perché sono gli unici che chiedono una
   *  decisione e in fondo a un elenco si perderebbero. */
  const officineFiltrate = useMemo(() => {
    if (!officine) return null;
    const peso = (o) => (o.stato === "in_attesa" ? 0 : o.stato === "attiva" ? 1 : o.stato === "sospesa" ? 2 : 3);
    return [...officine].sort((a, b) =>
      peso(a) - peso(b) || String(a.ragione_sociale ?? "").localeCompare(String(b.ragione_sociale ?? "")));
  }, [officine]);

  const nAttesa = contaStati.in_attesa ?? 0;
  const nAnagrafiche = contaStati.anagrafica ?? 0;
  const nConAccesso = (contaStati.attiva ?? 0) + (contaStati.in_attesa ?? 0) + (contaStati.sospesa ?? 0);
  const filtroCliAttivo = !!cliQ.trim() || cliVista !== "con_accesso" || !!cliStato || !!cliCat || !!cliProv;
  const azzeraFiltroCli = () => {
    setCliQ(""); setCliVista("con_accesso"); setCliStato(""); setCliCat(""); setCliProv("");
  };

  const ultimaPagina = Math.max(0, Math.ceil(totaleOfficine / cliPerPagina) - 1);
  /** Numeri di pagina da mostrare: le prime e le ultime, più un intorno
   *  di quella corrente. Con 3.376 clienti e 25 per pagina sono 136 pagine:
   *  disegnarle tutte sarebbe una barra lunga quanto lo schermo. */
  const numeriPagina = useMemo(() => {
    const dentro = new Set([0, ultimaPagina, cliPagina - 1, cliPagina, cliPagina + 1]);
    if (cliPagina <= 2) [1, 2, 3].forEach((n) => dentro.add(n));
    if (cliPagina >= ultimaPagina - 2) [ultimaPagina - 1, ultimaPagina - 2, ultimaPagina - 3].forEach((n) => dentro.add(n));
    const n = [...dentro].filter((x) => x >= 0 && x <= ultimaPagina).sort((a, b) => a - b);
    const out = [];
    n.forEach((x, i) => { if (i && x - n[i - 1] > 1) out.push("…"); out.push(x); });
    return out;
  }, [cliPagina, ultimaPagina]);

  /** Quanti prezzi dedicati ha un cliente, senza aprirgli il pannello. */
  const nPrezziDedicati = useCallback((officinaId) => {
    const cont = listini.find((l) => (l.officine ?? []).includes(officinaId));
    return cont ? (cont.n_cra ?? 0) + (cont.n_l2f ?? 0) : 0;
  }, [listini]);

  /* "Macro › Sottocategoria" leggibile per l'elenco prodotti */
  const catLabel = (id) => {
    if (!id) return "";
    const c = categorie.find((x) => x.id === id);
    if (!c) return id;
    const parent = c.parent_id ? categorie.find((x) => x.id === c.parent_id) : null;
    return parent ? `${parent.nome} › ${c.nome}` : c.nome;
  };

  /* ---------- filtro elenco prodotti ---------- */
  const macroCat = useMemo(() => categorie.filter((c) => !c.parent_id), [categorie]);
  const catParent = (id) => categorie.find((c) => c.id === id)?.parent_id ?? null;

  const prodottiFiltrati = useMemo(() => {
    if (!products) return null;
    const q = fQ.trim().toLowerCase();
    return products.filter((p) => {
      if (fStato === "attivi" && !p.attivo) return false;
      if (fStato === "nascosti" && p.attivo) return false;
      if (fOrigine === "foglio" && !p.fonte_listino) return false;
      if (fOrigine === "mano" && p.fonte_listino) return false;
      if (fEvidenza && (!p.cra_taglia || p.cra_taglia === "normale") && !p.cra_offerta_a) return false;
      // la macro seleziona anche tutti i suoi sottoreparti
      if (fCat && p.categoria !== fCat && catParent(p.categoria) !== fCat) return false;
      if (!q) return true;
      const hay = [p.nome, p.codice, ...(p.tags ?? [])].join(" ").toLowerCase();
      return q.split(/\s+/).every((t) => hay.includes(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, categorie, fQ, fCat, fStato, fOrigine, fEvidenza]);

  const filtroAttivo = fQ !== "" || fCat !== "" || fStato !== "tutti" || fOrigine !== "tutti" || fEvidenza;
  const azzeraFiltro = () => { setFQ(""); setFCat(""); setFStato("tutti"); setFOrigine("tutti"); setFEvidenza(false); };

  /** Riga in italiano che descrive cosa vedrà il cliente: vale più di un
   *  mockup, perché l'admin non deve immaginarsi il layout. */
  const anteprimaVetrina = useMemo(() => {
    const m = MISURE.find((x) => x.v === form.cra_taglia);
    const parti = [];
    if (m && m.v !== "normale") {
      parti.push(`Occuperà ${m.celle} caselle: il posto di ${m.celle} prodotti normali.`);
    }
    if (form.cra_offerta_a) {
      const fine = new Date(form.cra_offerta_a);
      const inizio = form.cra_offerta_da ? new Date(form.cra_offerta_da) : new Date();
      const ore = Math.max(0, Math.round((fine - inizio) / 3600e3));
      const g = Math.floor(ore / 24);
      const durata = g >= 1 ? `${g} giorn${g === 1 ? "o" : "i"} e ${ore % 24} ore` : `${ore} ore`;
      const fmt = (d) => d.toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      parti.push(`Il conto alla rovescia resterà acceso ${durata}, dal ${fmt(inizio)} al ${fmt(fine)}.`);
      if (m && m.v !== "normale") {
        parti.push("Alla scadenza la scheda torna da sola di misura Normale: non devi rientrare qui a sistemarla.");
      }
    }
    return parti.join(" ");
  }, [form.cra_taglia, form.cra_offerta_da, form.cra_offerta_a]);

  /** Quante schede ingrandite ci sono, e quante ne mostra davvero il catalogo. */
  const inEvidenza = useMemo(() => {
    const l = (products ?? []).filter((p) => p.cra_taglia && p.cra_taglia !== "normale");
    return {
      vetrine: l.filter((p) => p.cra_taglia === "vetrina" || p.cra_taglia === "vetrina_xl").length,
      grandi: l.filter((p) => p.cra_taglia === "grande").length,
      elenco: l,
    };
  }, [products]);

  /** Marchi già in catalogo: suggerimenti per il campo, senza inventare un elenco. */
  const marchiNoti = useMemo(
    () => [...new Set((products ?? []).map((p) => p.marchio).filter(Boolean))].sort(),
    [products],
  );

  const daFoglio = useMemo(() => (products ?? []).filter((p) => p.fonte_listino).length, [products]);
  const aMano = useMemo(() => (products ?? []).filter((p) => !p.fonte_listino).length, [products]);

  /* ---------- quali linee del foglio sono pubblicate sul CRA Store ---------- */
  const [lineaBusy, setLineaBusy] = useState(false);
  const linee = useMemo(() => {
    const per = new Map();
    for (const p of products ?? []) {
      if (!p.fonte_listino) continue;
      const g = per.get(p.fonte_listino) ?? { fonte: p.fonte_listino, totale: 0, suCra: 0 };
      g.totale++;
      if (p.su_cra) g.suCra++;
      per.set(p.fonte_listino, g);
    }
    return [...per.values()]
      .map((g) => ({ ...g, tutte: g.suCra === g.totale }))
      .sort((a, b) => a.fonte.localeCompare(b.fonte));
  }, [products]);

  const cambiaLinea = async (fonte, pubblica) => {
    setLineaBusy(true); setErr(null);
    try {
      await setLineaSuCra(fonte, pubblica);
      const [p, righe] = await Promise.all([getAllProducts(), getRigheCatalogo()]);
      setProducts(p); setL2fRighe(righe);
    } catch { setErr("Non sono riuscito a cambiare la visibilità della linea."); }
    finally { setLineaBusy(false); }
  };

  /* ================= MATRICE PREZZI =================
     Righe = prodotti; colonne = PREZZO BASE + una per categoria cliente.
     È la stessa forma del foglio MASTER. */

  /** Contenitore prezzi collegato a una categoria (nell'interfaccia non si nomina). */
  const contenitoreDi = useCallback(
    (catId) => listini.find((l) => (l.categorie ?? []).includes(catId)) ?? null,
    [listini],
  );

  /** Che cosa paga oggi un'officina per una riga di catalogo: il prezzo della
   *  sua categoria se c'è, altrimenti il prezzo base. Nella scheda cliente fa
   *  vedere da quale cifra si parte, prima di scriverne una dedicata. */
  const prezzoOggiPer = useCallback((officina) => {
    const cont = contenitoreDi(officina.categoria_cliente);
    return (riga) => {
      const dedicato = cont ? matrice?.[riga.quale]?.[cont.id]?.[riga.id] : undefined;
      return dedicato ?? riga.base ?? null;
    };
  }, [contenitoreDi, matrice]);

  /** Quali categorie sono alimentate dal foglio: verità dall'ultimo aggiornamento.
   *  Se non l'abbiamo ancora, si dichiara "a mano" e si avvisa: indovinare
   *  in senso restrittivo bloccherebbe celle che il foglio non tocca mai. */
  const categorieDalFoglio = useMemo(() => {
    const s = new Set();
    for (const c of ultimoSync?.categorie_dal_foglio ?? []) s.add(c.id);
    return s;
  }, [ultimoSync]);

  const colonne = useMemo(() => ([
    { id: BASE, nome: "PREZZO BASE", sottotitolo: "chi non ha categoria · colonna netto del foglio", dalFoglio: true, colore: null },
    ...categorieCli.filter((c) => c.attiva !== false).map((c) => ({
      id: c.id,
      nome: (c.nome || c.id).toUpperCase(),
      colore: c.colore,
      listinoId: contenitoreDi(c.id)?.id ?? null,
      dalFoglio: categorieDalFoglio.has(c.id),
      sottotitolo: `${(contaCat[c.id]?.conAccesso ?? 0) + (contaCat[c.id]?.anagrafiche ?? 0)} officine`,
    })),
  /* `contaCat` c'era nel corpo ma non fra le dipendenze: i conteggi
     «N officine» accanto a ogni categoria restavano quelli del caricamento
     precedente. `officine` invece qui non si legge: c'era come sostituto di
     quello che mancava davvero. */
  ]), [categorieCli, contenitoreDi, categorieDalFoglio, contaCat]);

  /** Righe della matrice: un solo catalogo, la vetrina è un filtro.
   *  Prodotti e varianti insieme; le varianti restano sotto il loro padre. */
  const righeMatrice = useMemo(() => {
    if (!l2fRighe) return null;
    const q = fQ.trim().toLowerCase();
    return l2fRighe
      .filter((r) => (catalogo === "l2f" ? r.su_l2f : r.su_cra))
      // ricerca su codice, nome e tag: gli stessi campi della scheda Prodotti
      .filter((r) => !q || q.split(/\s+/).every((t) =>
        `${r.codice} ${r.nome} ${(r.tags ?? []).join(" ")}`.toLowerCase().includes(t)))
      .filter((r) => !fCat || r.reparto === fCat || catParent(r.reparto) === fCat)
      .filter((r) => fStato === "tutti"
        || (fStato === "attivi" ? !r.nascosto : r.nascosto))
      .filter((r) => fOrigine === "tutti"
        || (fOrigine === "foglio" ? !!r.fonte_listino : !r.fonte_listino))
      .slice(0, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l2fRighe, fQ, fCat, fStato, fOrigine, catalogo, categorie]);

  const baseDi = useCallback((r) => r.base ?? null, []);

  /** Prezzo attualmente salvato per (riga, colonna). */
  const valoreDi = useCallback((r, c) => {
    if (c.id === BASE) return r.base ?? null;
    if (!c.listinoId) return null;
    return matrice[r.quale]?.[c.listinoId]?.[r.id] ?? null;
  }, [matrice]);

  /** Cella bloccata = il prodotto viene dal foglio E quella colonna la comanda
   *  il foglio. Non per riga: la categoria Nord non ha colonna nel foglio, e
   *  bloccare l'intera riga renderebbe impossibile compilarla a mano. */
  const bloccoDi = useCallback((r, c) => !!r.fonte_listino && !!c.dalFoglio, []);

  /* ---------- modifiche in sospeso ---------- */
  const bulkCount = Object.keys(bulk).length;

  /** Registra la modifica di una cella. Stringa vuota = togli il prezzo
   *  dedicato (prima non era rappresentabile: svuotare annullava e basta). */
  const onCella = useCallback((k, raw, originale) => {
    setBulk((b) => {
      const next = { ...b };
      const v = raw.trim();
      const n = parsePrezzo(v);
      if (v === "") {
        if (originale == null) delete next[k];   // era già assente: niente da fare
        else next[k] = "";                        // rimozione in sospeso
      } else if (originale != null && !Number.isNaN(n) && n === Number(originale)) {
        delete next[k];                           // tornato al valore di partenza
      } else {
        next[k] = v;
      }
      return next;
    });
  }, []);

  /** Le modifiche in sospeso, in chiaro, per l'elenco e per il salvataggio. */
  const modifiche = useMemo(() => Object.entries(bulk).map(([k, v]) => {
    const [colId, quale, id] = k.split("|");
    const col = colonne.find((c) => c.id === colId);
    const riga = (righeMatrice ?? []).find((r) => r.id === id && r.quale === quale);
    const prezzo = v === "" ? null : parsePrezzo(v);
    return { k, colId, quale, id, col, riga, valore: v, prezzo, errore: v !== "" && Number.isNaN(prezzo) };
  }), [bulk, colonne, righeMatrice]);

  const conErrore = modifiche.filter((m) => m.errore).length;

  const salvaBulk = async () => {
    if (conErrore) { setErr(`${conErrore} valore${conErrore > 1 ? "i" : ""} da correggere: non è un numero.`); return; }
    if (!modifiche.length) return;
    setBulkBusy(true); setErr(null);
    try {
      // Raggruppo per destinazione: una richiesta per colonna e catalogo.
      const perDest = new Map();
      for (const m of modifiche) {
        const dest = `${m.colId}|${m.quale}`;
        if (!perDest.has(dest)) perDest.set(dest, { colId: m.colId, quale: m.quale, scrivi: [], togli: [] });
        const g = perDest.get(dest);
        if (m.valore === "") g.togli.push(m.id);
        else g.scrivi.push({ id: m.id, prezzo: m.prezzo });
      }

      let falliti = [];
      for (const g of perDest.values()) {
        if (g.colId === BASE) {
          // Il prezzo base vive in product_netto / product_variant_netto:
          // stesse tabelle per entrambe le vetrine, il catalogo è uno solo.
          await saveNettiBaseL2f(g.quale, g.scrivi);
          // il prezzo base non si "toglie": resta quello che c'è
        } else {
          const col = colonne.find((c) => c.id === g.colId);
          let lid = col?.listinoId;
          if (!lid) {
            // la categoria non ha ancora un contenitore prezzi: lo creo in silenzio
            lid = await createListino({ nome: col?.nome ?? g.colId, priorita: 0 });
            await setListinoCategorie(lid, [g.colId]);
          }
          if (g.scrivi.length) await saveListinoPrezzi(lid, g.quale, g.scrivi);
          if (g.togli.length) await removeListinoPrezziBulk(lid, g.quale, g.togli);
        }
      }

      const [p, mx, l, righe] = await Promise.all([
        getAllProducts(), getPrezziMatrice(), getListini(), getRigheCatalogo(),
      ]);
      setProducts(p); setMatrice(mx); setListini(l); setL2fRighe(righe);

      // Le celle fallite restano evidenziate: non si butta via il lavoro.
      setBulk(falliti.length
        ? Object.fromEntries(Object.entries(bulk).filter(([k]) => falliti.includes(k.split("|")[2])))
        : {});
      const salvate = modifiche.length - falliti.length;
      const perCol = {};
      for (const m of modifiche) perCol[m.col?.nome ?? m.colId] = (perCol[m.col?.nome ?? m.colId] ?? 0) + 1;
      setBulkOk({ n: salvate, dettaglio: Object.entries(perCol).map(([k, v]) => `${v} in ${k}`).join(", "), falliti: falliti.length });
      setVediModifiche(false);
      setTimeout(() => setBulkOk(null), 5000);
    } catch (e) {
      setErr(`Salvataggio non riuscito: ${e?.message ?? "errore sconosciuto"}`);
    } finally { setBulkBusy(false); }
  };

  /* ---------- categorie cliente ---------- */
  const creaCategoria = async () => {
    const nome = catForm.nome.trim();
    if (!nome) return;
    try {
      const id = slug(nome);
      await createCategoriaCliente({ id, nome, colore: catForm.colore, sort_order: categorieCli.length });
      // Il contenitore prezzi si crea e si collega da solo: crearlo a mano e
      // dimenticare il collegamento lo renderebbe invisibile a tutti i clienti.
      const lid = await createListino({ nome, descrizione: `Prezzi ${nome}` });
      await setListinoCategorie(lid, [id]);
      setCatForm({ nome: "", colore: "#bd3432" });
      const [cc, l] = await Promise.all([getCategorieCliente(), getListini()]);
      setCategorieCli(cc); setListini(l);
    } catch (e) {
      setErr(String(e?.message || "").includes("duplicate") ? "Categoria già esistente." : "Creazione categoria non riuscita.");
    }
  };
  const salvaCategoria = async (c) => {
    try {
      await updateCategoriaCliente(c.id, { nome: c.nome, colore: c.colore, attiva: c.attiva });
      // Rinomino anche il contenitore collegato: tenerlo col vecchio nome
      // lascerebbe i suoi prezzi orfani al prossimo aggiornamento dal foglio.
      const cont = contenitoreDi(c.id);
      if (cont && cont.nome !== c.nome) await updateListino(cont.id, { nome: c.nome });
      const [cc, l] = await Promise.all([getCategorieCliente(), getListini()]);
      setCategorieCli(cc); setListini(l);
    } catch { setErr("Salvataggio categoria non riuscito."); }
  };
  const eliminaCategoria = async (id, nome, nClienti = 0, nPrezzi = 0) => {
    const dettaglio = [
      nClienti > 0 ? `${nClienti} offici${nClienti === 1 ? "na torna" : "ne tornano"} al prezzo base` : null,
      nPrezzi > 0 ? `${nPrezzi} prezzi dedicati vengono cancellati` : null,
    ].filter(Boolean).join(" e ");
    if (!window.confirm(`Elimino la categoria ${nome ?? id}?${dettaglio ? ` ${dettaglio[0].toUpperCase()}${dettaglio.slice(1)}.` : ""}`)) return;
    try {
      await deleteCategoriaCliente(id);
      const [cc, o, l, mx] = await Promise.all([
        getCategorieCliente(), getAllOfficine(), getListini(), getPrezziMatrice(),
      ]);
      setCategorieCli(cc); setOfficine(o); setListini(l); setMatrice(mx);
    } catch { setErr("Eliminazione categoria non riuscita."); }
  };

  /* ---------- listini ---------- */
  const creaListino = async () => {
    const nome = listForm.nome.trim();
    if (!nome) return;
    try {
      const id = await createListino({ nome, priorita: Number(listForm.priorita) || 0 });
      setListForm({ nome: "", priorita: 0 });
      setListini(await getListini());
      setListinoAperto(id);
    } catch { setErr("Creazione listino non riuscita."); }
  };
  const salvaListino = async (l) => {
    try {
      await updateListino(l.id, { nome: l.nome, priorita: Number(l.priorita) || 0, attivo: l.attivo });
      await setListinoCategorie(l.id, l.categorie ?? []);
      setListini(await getListini());
    } catch { setErr("Salvataggio listino non riuscito."); }
  };
  const eliminaListino = async (id) => {
    try {
      await deleteListino(id);
      setListini(await getListini());
      setMatrice(await getPrezziMatrice());
    } catch { setErr("Eliminazione del contenitore prezzi non riuscita."); }
  };
  const patchListino = (id, patch) =>
    setListini((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const toggleCategoriaListino = (l, catId) =>
    patchListino(l.id, {
      categorie: (l.categorie ?? []).includes(catId)
        ? l.categorie.filter((x) => x !== catId)
        : [...(l.categorie ?? []), catId],
    });

  /** Contenitori prezzi in stato anomalo: nell'interfaccia quotidiana non si
   *  vedono più, ma continuano a influenzare i prezzi che vedono i clienti. */
  const anomalie = useMemo(() => {
    const out = [];
    const perCat = new Map();
    for (const l of listini) {
      // I contenitori personali non hanno categorie per definizione: sono
      // legati a un cliente. Segnalarli sarebbe un falso allarme.
      if (!(l.categorie ?? []).length && !(l.officine ?? []).length) {
        out.push(`"${l.nome}" non è collegato a nessuna categoria: i suoi prezzi non li vede nessuno.`);
      }
      for (const c of l.categorie ?? []) perCat.set(c, [...(perCat.get(c) ?? []), l.nome]);
    }
    for (const [c, nomi] of perCat) {
      if (nomi.length > 1) {
        const nome = categorieCli.find((x) => x.id === c)?.nome ?? c;
        out.push(`La categoria ${nome} ha ${nomi.length} contenitori prezzi (${nomi.join(", ")}): vince quello con priorità più alta.`);
      }
    }
    return out;
  }, [listini, categorieCli]);

  return (
    <section className="adm-page">
      {/* La scheda Prezzi va da bordo a bordo: la matrice ha bisogno di tutto
          lo spazio disponibile. Le altre restano entro 1580px per leggibilità. */}
      <div className="adm-wrap" style={tab === "prezzi" ? { "--adm-max": "none" } : undefined}>
        <header className="adm-head">
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-2xs)", letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--cra-red)" }}>
              <Icon name="shield-check" size={14} /> Back-office CRA
            </span>
            <h1 className="adm-title">Amministrazione</h1>
          </div>
          {tab === "ordini" && orders?.length > 0 && (
            <button className="adm-btn ghost" onClick={exportCsv}><Icon name="download" size={15} /> Esporta CSV</button>
          )}
        </header>

        <div className="adm-tabs">
          <button className={`adm-tab ${tab === "prezzi" ? "active" : ""}`} onClick={() => setTab("prezzi")}>
            <Icon name="tag" size={15} /> Prezzi
          </button>
          <button className={`adm-tab ${tab === "prodotti" ? "active" : ""}`} onClick={() => setTab("prodotti")}>
            <Icon name="store" size={15} /> Prodotti {products && <span className="adm-count">{products.length}</span>}
          </button>
          <button className={`adm-tab ${tab === "officine" ? "active" : ""}`} onClick={() => setTab("officine")}>
            <Icon name="building-2" size={15} /> Officine
            {nConAccesso + nAnagrafiche > 0 && <span className="adm-count">{nConAccesso + nAnagrafiche}</span>}
          </button>
          <button className={`adm-tab ${tab === "ordini" ? "active" : ""}`} onClick={() => setTab("ordini")}>
            <Icon name="package-check" size={15} /> Proposte {orders && <span className="adm-count">{orders.length}</span>}
          </button>
          <button className={`adm-tab ${tab === "attivita" ? "active" : ""}`} onClick={() => setTab("attivita")}>
            <Icon name="users" size={15} /> Attività
          </button>
          <button className={`adm-tab ${tab === "impostazioni" ? "active" : ""}`} onClick={() => setTab("impostazioni")}>
            <Icon name="cog" size={15} /> Impostazioni
          </button>
          {/* Persone e permessi: stava nell'area interna, ma la vedeva solo
              l'amministratore — sta con le altre cose che fa solo lui. */}
          <button className={`adm-tab ${tab === "personale" ? "active" : ""}`} onClick={() => setTab("personale")}>
            <Icon name="user-plus" size={15} /> Personale
          </button>
          <span className="adm-foglio-stato">
            <Icon name="refresh-cw" size={13} />
            Foglio MASTER · {ultimoSync?.quando
              ? `ultimo aggiornamento ${new Date(ultimoSync.quando).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
              : "mai aggiornato"}
          </span>
        </div>

        {err && <div className="adm-err" role="alert"><Icon name="alert-circle" size={15} /> {err}</div>}

        {/* Nota una tantum: la scheda Listini è sparita, va detto perché. */}
        {notaVisibile && (
          <div className="adm-avviso">
            <Icon name="alert-circle" size={16} />
            <div style={{ flex: 1 }}>
              <b>Cosa è cambiato.</b> I listini non compaiono più come scheda a parte: ogni categoria
              cliente ha i suoi prezzi e li trovi in <b>Prezzi</b> come colonne, esattamente come nel foglio MASTER.
              I prezzi che arrivano dal foglio hanno il lucchetto e si cambiano nel foglio; i prodotti che hai
              creato tu restano modificabili da qui.
            </div>
            <button className="adm-btn ghost mini" onClick={chiudiNota}>Ho capito</button>
          </div>
        )}

        {/* ---------- PREZZI: la matrice ---------- */}
        {tab === "prezzi" && (
          <React.Fragment>
            <p className="adm-regola">
              Una riga per prodotto, una colonna per categoria cliente — la stessa forma del foglio MASTER.
              <b> I prezzi si salvano a mano con Salva; tutto il resto si salva subito.</b>
            </p>

            {/* su quale VETRINA sto impostando i prezzi (non di che marchio è il
                prodotto: quelli del foglio sono tutti a marchio L2F) */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "6px" }}>
              <span className="adm-sub" style={{ fontWeight: 700 }}>Vetrina:</span>
              <button className={`adm-tab ${catalogo === "cra" ? "active" : ""}`} onClick={() => { setCatalogo("cra"); setBulk({}); }}>
                CRA Store
              </button>
              <button className={`adm-tab ${catalogo === "l2f" ? "active" : ""}`} onClick={() => { setCatalogo("l2f"); setBulk({}); }}>
                Sito L2F
              </button>
              <button className="adm-btn ghost mini" style={{ marginLeft: "auto" }} onClick={doSync} disabled={syncBusy}>
                <Icon name="refresh-cw" size={13} /> {syncBusy ? "Aggiorno…" : "Aggiorna dal foglio"}
              </button>
            </div>
            <p className="adm-sub" style={{ marginTop: 0, marginBottom: "14px" }}>
              I prodotti del foglio sono <b>tutti a marchio L2F</b>: qui scegli soltanto su quale dei due
              siti ne stai impostando i prezzi, non di che marca sono.
            </p>

            {!ultimoSync && (
              <div className="adm-avviso">
                <Icon name="alert-circle" size={16} />
                <span>
                  Non risulta ancora nessun aggiornamento dal foglio, quindi tutte le colonne sono trattate
                  come <b>gestite a mano</b>. Premi <b>Aggiorna dal foglio</b> per avere il quadro esatto.
                </span>
              </div>
            )}

            {/* Una barra sola per entrambe le vetrine: il catalogo è unico. */}
            <div className="adm-form">
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input type="search" value={fQ} onChange={(e) => setFQ(e.target.value)}
                  placeholder="Cerca per nome, codice o tag…"
                  style={{ flex: "1 1 240px", fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "10px 12px", border: "var(--border-w-2) solid var(--border-strong)" }} />
                <select value={fCat} onChange={(e) => setFCat(e.target.value)}
                  style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "10px 12px", border: "var(--border-w-2) solid var(--border-strong)" }}>
                  <option value="">Tutti i reparti</option>
                  {macroCat.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                <select value={fStato} onChange={(e) => setFStato(e.target.value)}
                  style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "10px 12px", border: "var(--border-w-2) solid var(--border-strong)" }}>
                  <option value="tutti">Tutti</option>
                  <option value="attivi">Solo pubblicati</option>
                  <option value="nascosti">Solo nascosti</option>
                </select>
                <select value={fOrigine} onChange={(e) => setFOrigine(e.target.value)}
                  style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "10px 12px", border: "var(--border-w-2) solid var(--border-strong)" }}>
                  <option value="tutti">Origine: tutti</option>
                  <option value="foglio">Dal foglio ({daFoglio})</option>
                  <option value="mano">A mano ({aMano})</option>
                </select>
                {filtroAttivo && <button className="adm-btn ghost mini" onClick={azzeraFiltro}><Icon name="x" size={13} /> Azzera</button>}
                <span className="adm-sub" style={{ marginLeft: "auto", alignSelf: "center" }}>
                  {righeMatrice?.length ?? 0} righe
                  {righeMatrice?.length === 300 && " (le prime 300: affina la ricerca)"}
                </span>
              </div>
              <p className="adm-sub" style={{ margin: 0 }}>
                Le righe sono prodotti e formati: un olio con quattro imballi occupa cinque righe,
                il prodotto e i suoi formati.
              </p>
            </div>

            {/* legenda */}
            <div className="adm-legenda">
              <span><i /> modificabile</span>
              <span><i className="dedicato" /> ha un prezzo dedicato</span>
              <span><i className="bloccata" /> <Icon name="lock" size={10} /> comandato dal foglio</span>
              <span><i className="modificata" /> da salvare</span>
              <span>= eredita il prezzo base</span>
            </div>

            {spiega && (
              <div className="adm-spiega">
                <b>Prezzo comandato dal foglio</b>
                <p style={{ margin: 0 }}>
                  <b>{spiega.riga.nome}</b> arriva dal foglio MASTER, scheda <b>{spiega.riga.fonte_listino}</b>.
                  Questa cella è la colonna <b>{spiega.colonna.nome}</b>. Cambiala lì e premi
                  «Aggiorna dal foglio»: il pannello si riallinea da solo.
                </p>
                <p className="adm-sub" style={{ margin: 0 }}>
                  Nome, foto, descrizione, reparto e visibilità restano modificabili da qui, nella scheda Prodotti.
                </p>
                <p className="adm-sub" style={{ margin: 0, fontSize: 11 }}>
                  Non esiste uno sblocco: l'aggancio avviene per codice, quindi al prossimo aggiornamento
                  il prodotto verrebbe riadottato.
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="adm-btn ghost mini" onClick={() => navigator.clipboard?.writeText(spiega.riga.codice)}>
                    Copia il codice {spiega.riga.codice}
                  </button>
                  <button className="adm-btn mini" onClick={() => setSpiega(null)}>Ho capito</button>
                </div>
              </div>
            )}

            {bulkOk && (
              <div className="adm-ok">
                <Icon name="check-circle-2" size={15} />
                Salvati {bulkOk.n} prezzi{bulkOk.dettaglio ? `: ${bulkOk.dettaglio}` : ""}.
                {bulkOk.falliti > 0 && ` ${bulkOk.falliti} non sono stati salvati: restano evidenziati.`}
              </div>
            )}

            {!righeMatrice ? <p className="adm-state">Caricamento…</p> :
              righeMatrice.length === 0 ? <p className="adm-state">Nessun prodotto corrisponde al filtro.</p> : (
              <React.Fragment>
                <MatricePrezzi
                  righe={righeMatrice} colonne={colonne}
                  valoreDi={valoreDi} baseDi={baseDi} bloccoDi={bloccoDi}
                  bulk={bulk} cellaAttiva={cellaAttiva} setCellaAttiva={setCellaAttiva}
                  onCella={onCella} onSpiega={setSpiega} catLabel={catLabel}
                />

                {bulkCount > 0 && (
                  <div className="adm-salvabarra">
                    <span className="adm-salvabarra-testo">
                      {bulkCount} {bulkCount === 1 ? "modifica" : "modifiche"} da salvare
                      {" · "}
                      {Object.entries(modifiche.reduce((a, m) => {
                        const n = m.col?.nome ?? m.colId; a[n] = (a[n] ?? 0) + 1; return a;
                      }, {})).map(([n, v]) => `${n} ${v}`).join(" · ")}
                    </span>
                    {conErrore > 0 && (
                      <span style={{ color: "var(--cra-gold)", fontSize: "var(--fs-xs)" }}>
                        {conErrore} da correggere: non è un numero
                      </span>
                    )}
                    <button className="adm-btn ghost mini" onClick={() => setVediModifiche((v) => !v)}>
                      {vediModifiche ? "Nascondi" : `Vedi le modifiche (${bulkCount})`}
                    </button>
                    <button className="adm-btn" onClick={salvaBulk} disabled={bulkBusy || conErrore > 0}>
                      <Icon name="save" size={14} /> {bulkBusy ? "Salvo…" : "Salva tutto"}
                    </button>
                    <button className="adm-btn ghost mini" onClick={() => setBulk({})} disabled={bulkBusy}>Annulla tutto</button>
                  </div>
                )}

                {vediModifiche && bulkCount > 0 && (
                  <div className="adm-modifiche">
                    {modifiche.map((m) => (
                      <div key={m.k}>
                        <span className="adm-badge grigio" style={{ fontSize: 9 }}>{m.col?.nome ?? m.colId}</span>
                        <span style={{ flex: 1 }}>{m.riga?.nome ?? m.id}</span>
                        <span className="adm-sub">
                          {m.valore === ""
                            ? "torna al prezzo base"
                            : `${m.riga ? formatEuro(valoreDi(m.riga, m.col)) : "—"} → ${m.valore}`}
                        </span>
                        <button className="adm-btn ghost mini" aria-label="Annulla questa modifica"
                          onClick={() => setBulk((b) => { const n = { ...b }; delete n[m.k]; return n; })}>
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
            )}
          </React.Fragment>
        )}

        {/* ---------- OFFICINE ---------- */}
        {tab === "officine" && (
          !officine ? <p className="adm-state">Caricamento…</p> : (
            <React.Fragment>
              <p className="adm-regola">
                <b>Con accesso</b> sono i clienti che si sono registrati; <b>in anagrafica</b> quelli
                caricati dal gestionale, che non hanno ancora un account. Quando uno si registra con la
                sua partita IVA, si aggancia da solo alla scheda che ha già.
              </p>

              {/* Nuova officina: chiusa di default, come il form dei prodotti. */}
              <div className="adm-form">
                <button className="adm-btn ghost" style={{ alignSelf: "flex-start" }}
                  onClick={() => setNuovaOff((f) => (f ? null : { ...VUOTA_OFF }))}>
                  <Icon name={nuovaOff ? "chevron-up" : "plus"} size={14} /> Nuova officina
                </button>
                {nuovaOff && (
                  <React.Fragment>
                    <p className="adm-sub" style={{ margin: 0 }}>
                      Nasce <b>in anagrafica</b>: nessun account, nessun accesso. Se un domani il titolare
                      si registra con questa partita IVA, si collega a questa scheda.
                    </p>
                    <div className="adm-form-grid">
                      {[
                        ["ragione_sociale", "Ragione sociale *", "Officina Rossi Snc"],
                        ["codice_cliente", "Cod. cliente (AS/400)", "es. 003912"],
                        ["piva", "Partita IVA", "11 cifre"],
                        ["email", "Email", "info@officina.it"],
                        ["telefono", "Telefono", ""],
                        ["indirizzo", "Indirizzo", "Via Roma 1"],
                        ["citta", "Località", "Napoli"],
                        ["provincia", "Provincia", "NA"],
                        ["cap", "CAP", "80100"],
                      ].map(([k, label, ph]) => (
                        <label className="adm-fld" key={k}>
                          <span>{label}</span>
                          <input type="text" value={nuovaOff[k]} placeholder={ph}
                            onChange={(e) => setNuovaOff((f) => ({ ...f, [k]: e.target.value }))} />
                        </label>
                      ))}
                      <label className="adm-fld">
                        <span>Categoria cliente</span>
                        <select value={nuovaOff.categoria_cliente}
                          onChange={(e) => setNuovaOff((f) => ({ ...f, categoria_cliente: e.target.value }))}>
                          <option value="">— Nessuna (prezzo base)</option>
                          {categorieCli.filter((c) => c.attiva).map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button className="adm-btn" onClick={creaOfficina} disabled={nuovaBusy || !nuovaOff.ragione_sociale.trim()}>
                        <Icon name="save" size={14} /> {nuovaBusy ? "Creo…" : "Crea officina"}
                      </button>
                      <button className="adm-btn ghost" onClick={() => setNuovaOff(null)}>Annulla</button>
                    </div>
                  </React.Fragment>
                )}
              </div>

              <div className="adm-filtri">
                <input type="search" value={cliQ} placeholder="Cerca cliente, email, città, codice, P.IVA…"
                  onChange={(e) => setCliQ(e.target.value)} />
                <select value={cliVista} onChange={(e) => { setCliVista(e.target.value); setCliStato(""); }}>
                  <option value="con_accesso">Con accesso ({nConAccesso})</option>
                  <option value="anagrafica">In anagrafica ({nAnagrafiche})</option>
                  <option value="tutti">Tutti ({nConAccesso + nAnagrafiche})</option>
                </select>
                {cliVista !== "anagrafica" && (
                  <select value={cliStato} onChange={(e) => setCliStato(e.target.value)}>
                    <option value="">Tutti gli stati</option>
                    <option value="in_attesa">In attesa{nAttesa ? ` (${nAttesa})` : ""}</option>
                    <option value="attiva">Attive</option>
                    <option value="sospesa">Sospese</option>
                  </select>
                )}
                <select value={cliProv} onChange={(e) => setCliProv(e.target.value)}>
                  <option value="">Tutte le province</option>
                  {province.map((p) => <option key={p.sigla} value={p.sigla}>{p.sigla} ({p.n})</option>)}
                </select>
                <select value={cliCat} onChange={(e) => setCliCat(e.target.value)}>
                  <option value="">Tutte le categorie</option>
                  <option value="__senza">Senza categoria</option>
                  {categorieCli.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <select value={cliPerPagina} onChange={(e) => setCliPerPagina(Number(e.target.value))}
                  aria-label="Righe per pagina">
                  <option value={25}>25 per pagina</option>
                  <option value={50}>50 per pagina</option>
                  <option value={100}>100 per pagina</option>
                </select>
                {filtroCliAttivo && (
                  <button className="adm-btn ghost mini" onClick={azzeraFiltroCli}><Icon name="x" size={13} /> Azzera</button>
                )}
                <span className="adm-sub" style={{ marginLeft: "auto" }}>
                  {cliBusy ? "cerco…" : totaleOfficine === 0 ? "nessun risultato"
                    : `${cliPagina * cliPerPagina + 1}–${Math.min((cliPagina + 1) * cliPerPagina, totaleOfficine)} di ${totaleOfficine}`}
                </span>
              </div>

              {officineFiltrate.length === 0 ? (
                <p className="adm-state">
                  {cliBusy ? "Cerco…" : "Nessun cliente con questi filtri."}
                  {!cliBusy && cliVista === "con_accesso" && nAnagrafiche > 0 && (
                    <React.Fragment>
                      <br />
                      <button className="adm-btn ghost mini" style={{ marginTop: "10px" }}
                        onClick={() => setCliVista("tutti")}>
                        Cerca anche fra le {nAnagrafiche} anagrafiche senza accesso
                      </button>
                    </React.Fragment>
                  )}
                </p>
              ) :
                officineFiltrate.map((o) => {
                  const cat = categorieCli.find((c) => c.id === o.categoria_cliente);
                  const anagrafica = cliAperta === o.id;
                  const prezzi = cliPrezzi === o.id;
                  const nDedicati = nPrezziDedicati(o.id);
                  const siti = [o.cra_abilitata && "CRA", o.l2f_abilitata && "L2F"].filter(Boolean).join(" · ");
                  const statoPill = o.stato === "attiva" ? "attiva"
                    : o.stato === "in_attesa" ? "attesa"
                      : o.stato === "sospesa" ? "sospesa" : "spenta";
                  return (
                    <div key={o.id} className={`adm-cli ${anagrafica || prezzi ? "aperta" : ""}`}>
                      <div className="adm-cli-head">
                        <span className="adm-cli-id">
                          <span className="adm-cli-nome">
                            {o.ragione_sociale}
                            {o.is_admin && <span className="adm-badge oro">admin</span>}
                            {origineBadge(o)}
                          </span>
                          <span className="adm-cli-meta" title={`${o.email ?? ""}${o.piva ? ` · ${o.piva}` : ""}`}>
                            {o.email ?? "—"}{o.citta ? ` · ${o.citta}` : ""}{o.codice_cliente ? ` · ${o.codice_cliente}` : ""}
                          </span>
                        </span>

                        {/* Come sta il cliente, senza aprire niente. */}
                        <span className="adm-cli-stato">
                          <span className={`adm-pill ${statoPill}`} title={o.stato === "anagrafica" ? "Caricata dal gestionale: non ha mai chiesto l'accesso" : undefined}>
                            {o.stato === "attiva" ? "attiva"
                              : o.stato === "in_attesa" ? "in attesa"
                                : o.stato === "sospesa" ? "sospesa" : "senza accesso"}
                          </span>
                          <span className={`adm-pill ${cat ? "" : "spenta"}`} title="Categoria cliente">
                            <span className="adm-pill-punto" style={{ background: cat?.colore || "var(--border-strong)" }} />
                            {cat?.nome ?? "prezzo base"}
                          </span>
                          <span className={`adm-pill ${siti ? "" : "spenta"}`} title="Siti su cui può entrare">
                            {siti || "nessun sito"}
                          </span>
                        </span>

                        <span className="adm-cli-azioni">
                          <button className="adm-btn ghost mini" aria-expanded={prezzi}
                            onClick={() => { setCliPrezzi(prezzi ? null : o.id); setCliAperta(null); }}
                            title="Prezzi validi solo per questo cliente">
                            <Icon name="tag" size={13} /> Prezzi
                            {nDedicati > 0 && <span className="adm-count">{nDedicati}</span>}
                            <Icon name={prezzi ? "chevron-up" : "chevron-down"} size={13} />
                          </button>
                          <button className="adm-btn ghost mini" aria-expanded={anagrafica}
                            onClick={() => { setCliAperta(anagrafica ? null : o.id); setCliPrezzi(null); }}>
                            <Icon name="pencil" size={13} /> Anagrafica
                            <Icon name={anagrafica ? "chevron-up" : "chevron-down"} size={13} />
                          </button>
                        </span>
                      </div>

                      {anagrafica && (
                        <div className="adm-cli-pannello">
                          <div className="adm-fields">
                            <label className="adm-fld wide">
                              <span>Ragione sociale</span>
                              <input type="text" value={o.ragione_sociale ?? ""}
                                onChange={(e) => patchOfficina(o.id, { ragione_sociale: e.target.value })} />
                            </label>
                            <label className="adm-fld">
                              <span>Stato</span>
                              <select value={o.stato} onChange={(e) => patchOfficina(o.id, { stato: e.target.value })}>
                                <option value="anagrafica" disabled={!!o.user_id}>Senza accesso</option>
                                <option value="in_attesa">In attesa</option>
                                <option value="attiva">Attiva</option>
                                <option value="sospesa">Sospesa</option>
                              </select>
                              {!o.user_id && (
                                <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                                  nessun account collegato: non può entrare
                                </span>
                              )}
                            </label>
                            <label className="adm-fld">
                              <span>Cod. cliente (AS/400)</span>
                              <input type="text" value={o.codice_cliente ?? ""} placeholder="es. 003912"
                                onChange={(e) => patchOfficina(o.id, { codice_cliente: e.target.value })} />
                            </label>
                            <label className="adm-fld">
                              <span>Partita IVA</span>
                              <input type="text" value={o.piva ?? ""} placeholder="11 cifre"
                                onChange={(e) => patchOfficina(o.id, { piva: e.target.value })} />
                            </label>
                            <label className="adm-fld">
                              <span>Email</span>
                              <input type="text" value={o.email ?? ""} disabled={!!o.user_id}
                                title={o.user_id ? "È la credenziale d'accesso: si cambia da Supabase" : undefined}
                                onChange={(e) => patchOfficina(o.id, { email: e.target.value })} />
                            </label>
                            <label className="adm-fld">
                              <span>Telefono</span>
                              <input type="text" value={o.telefono ?? ""}
                                onChange={(e) => patchOfficina(o.id, { telefono: e.target.value })} />
                            </label>
                            <label className="adm-fld wide">
                              <span>Indirizzo</span>
                              <input type="text" value={o.indirizzo ?? ""}
                                onChange={(e) => patchOfficina(o.id, { indirizzo: e.target.value })} />
                            </label>
                            <label className="adm-fld">
                              <span>Località</span>
                              <input type="text" value={o.citta ?? ""}
                                onChange={(e) => patchOfficina(o.id, { citta: e.target.value })} />
                            </label>
                            <label className="adm-fld" style={{ minWidth: "80px" }}>
                              <span>Prov.</span>
                              <input type="text" value={o.provincia ?? ""} style={{ width: "70px" }}
                                onChange={(e) => patchOfficina(o.id, { provincia: e.target.value })} />
                            </label>
                            <label className="adm-fld" style={{ minWidth: "90px" }}>
                              <span>CAP</span>
                              <input type="text" value={o.cap ?? ""} style={{ width: "90px" }}
                                onChange={(e) => patchOfficina(o.id, { cap: e.target.value })} />
                            </label>
                            <label className="adm-fld">
                              <span>Categoria cliente</span>
                              <select value={o.categoria_cliente ?? ""}
                                onChange={(e) => patchOfficina(o.id, { categoria_cliente: e.target.value || null })}>
                                <option value="">— Nessuna</option>
                                {categorieCli.filter((c) => c.attiva).map((c) => (
                                  <option key={c.id} value={c.id}>{c.nome}</option>
                                ))}
                              </select>
                              {/* La conseguenza, non solo l'impostazione */}
                              <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                                {o.categoria_cliente
                                  ? `vede i prezzi della categoria ${(cat?.nome ?? o.categoria_cliente).toUpperCase()}`
                                  : "nessuna categoria: vede il prezzo base"}
                              </span>
                            </label>
                            <label className="adm-fld">
                              <span>Documento abituale</span>
                              <select value={o.documento_predefinito ?? ""}
                                onChange={(e) => patchOfficina(o.id, { documento_predefinito: e.target.value || null })}>
                                <option value="">— Nessuno</option>
                                {tipiDoc.map((t) => (
                                  <option key={t.codice} value={t.codice}>{t.codice} — {t.nome}</option>
                                ))}
                              </select>
                              {/* La conseguenza, non solo l'impostazione */}
                              <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                                {o.documento_predefinito
                                  ? "proposto all'agente a ogni proposta d'ordine"
                                  : "l'agente dovrà sceglierlo ogni volta"}
                              </span>
                            </label>
                            <div className="adm-fld">
                              <span>Abilitazione siti</span>
                              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", padding: "8px 0" }}>
                                <label className="adm-check">
                                  <input type="checkbox" checked={!!o.cra_abilitata}
                                    onChange={(e) => patchOfficina(o.id, { cra_abilitata: e.target.checked })} /> CRA Store
                                </label>
                                <label className="adm-check">
                                  <input type="checkbox" checked={!!o.l2f_abilitata}
                                    onChange={(e) => patchOfficina(o.id, { l2f_abilitata: e.target.checked })} /> L2F
                                </label>
                              </div>
                            </div>
                            <div className="adm-fld">
                              <span>Ruolo</span>
                              <div style={{ padding: "8px 0" }}>
                                <label className="adm-check" title={o.id === mia?.id ? "Non puoi rimuovere il ruolo admin a te stesso" : "Accesso completo ai back-office CRA e L2F"}>
                                  <input type="checkbox" checked={!!o.is_admin} disabled={o.id === mia?.id}
                                    onChange={(e) => {
                                      if (e.target.checked && !window.confirm(
                                        `Rendere "${o.ragione_sociale}" amministratore?\n\nAvrà accesso completo ai back-office di CRA e L2F: tutte le officine, gli ordini, i prodotti e i corsi.`,
                                      )) return;
                                      patchOfficina(o.id, { is_admin: e.target.checked });
                                    }} /> Admin back-office
                                </label>
                              </div>
                            </div>
                            <button className="adm-btn" onClick={() => saveOfficina(o)}>
                              {savedId === o.id ? <React.Fragment><Icon name="check" size={14} /> Salvato</React.Fragment> : <React.Fragment><Icon name="save" size={14} /> Salva</React.Fragment>}
                            </button>
                          </div>
                          {o.stato === "in_attesa" && (
                            <p className="adm-sub" style={{ marginTop: "10px", marginBottom: 0 }}>
                              <Icon name="clock" size={12} color="var(--cra-gold)" /> All'attivazione si abilita in automatico il sito di registrazione ({o.origine === "cra" ? "CRA Store" : "L2F"}).
                            </p>
                          )}
                          <Accesso officina={o} setErr={setErr} onCambio={ricaricaOfficine} />
                        </div>
                      )}

                      {prezzi && (
                        <div className="adm-cli-pannello">
                          {!l2fRighe ? <p className="adm-sub">Caricamento del catalogo…</p> : (
                            <PrezziCliente
                              officina={o}
                              righe={l2fRighe}
                              categoriaNome={cat?.nome ?? null}
                              prezzoCorrente={prezzoOggiPer(o)}
                              onCambio={async () => { try { setListini(await getListini()); } catch { /* il contatore si aggiorna al prossimo caricamento */ } }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

              {ultimaPagina > 0 && (
                <nav className="adm-pagine" aria-label="Pagine dell'elenco clienti">
                  <button className="adm-btn ghost mini" disabled={cliPagina === 0 || cliBusy}
                    onClick={() => setCliPagina(cliPagina - 1)} aria-label="Pagina precedente">
                    <Icon name="chevron-left" size={13} />
                  </button>
                  {numeriPagina.map((n, i) => (n === "…"
                    ? <span key={`gap${i}`} className="adm-sub" style={{ padding: "0 4px" }}>…</span>
                    : (
                      <button key={n} disabled={cliBusy}
                        className={`adm-btn mini ${n === cliPagina ? "" : "ghost"}`}
                        aria-current={n === cliPagina ? "page" : undefined}
                        onClick={() => setCliPagina(n)}>
                        {n + 1}
                      </button>
                    )))}
                  <button className="adm-btn ghost mini" disabled={cliPagina >= ultimaPagina || cliBusy}
                    onClick={() => setCliPagina(cliPagina + 1)} aria-label="Pagina successiva">
                    <Icon name="chevron-right" size={13} />
                  </button>
                  <span className="adm-sub" style={{ marginLeft: "8px" }}>
                    pagina {cliPagina + 1} di {ultimaPagina + 1}
                  </span>
                </nav>
              )}
            </React.Fragment>
          )
        )}

        {/* ---------- PROPOSTE CRA ---------- */}
        {tab === "ordini" && (
          !orders ? <p className="adm-state">Caricamento…</p> :
          orders.length === 0 ? <p className="adm-state">Nessuna proposta d'ordine ricevuta.</p> :
          orders.map((o) => {
            const isOpen = openOrder === o.id;
            return (
              <div key={o.id} className="adm-row">
                <div className="adm-row-head">
                  <button onClick={() => setOpenOrder(isOpen ? null : o.id)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "12px", flex: 1, padding: 0 }}>
                    <span className="adm-num">{o.numero}</span>
                    <span className="adm-sub">
                      {o.officine?.ragione_sociale ?? "—"}
                      {o.officine?.codice_cliente ? ` · ${o.officine.codice_cliente}` : ""}
                      {" · "}{new Date(o.created_at).toLocaleDateString("it-IT")}
                    </span>
                    <Icon name={isOpen ? "chevron-left" : "chevron-right"} size={14} color="var(--text-muted, #5c6462)" />
                  </button>
                  <span className="adm-num" style={{ fontVariantNumeric: "tabular-nums" }}>{formatEuro(o.totale_listino)}</span>
                  <select value={o.stato} onChange={(e) => onStato(o.id, e.target.value)}
                    style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-xs)", padding: "8px 10px", border: "var(--border-w-2) solid var(--border-strong)" }}>
                    {ORDER_STATI.map((s) => <option key={s} value={s}>{statoLabel(s)}</option>)}
                  </select>
                </div>
                {isOpen && (
                  <div style={{ marginTop: "12px" }}>
                    {o.order_items.map((it) => (
                      <div key={it.id} className="adm-item">
                        <img className="adm-item-thumb" src={it.immagine || PLACEHOLDER_IMG} alt="" loading="lazy" />
                        <span style={{ flex: 1 }}>{it.nome}<br /><span className="adm-sub">{it.codice_l2f}</span></span>
                        <span>×{it.quantita}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatEuro(it.prezzo_unitario * it.quantita)}</span>
                      </div>
                    ))}
                    {o.note && <p className="adm-sub" style={{ marginTop: "10px" }}>Note: {o.note}</p>}
                    <p className="adm-sub" style={{ marginBottom: 0 }}>{o.officine?.email}{o.officine?.telefono ? ` · ${o.officine.telefono}` : ""}{o.officine?.citta ? ` · ${o.officine.citta}` : ""}</p>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* ---------- PRODOTTI ---------- */}
        {tab === "prodotti" && (
          <React.Fragment>
            <p className="adm-regola">
              Qui gestisci l'anagrafica: nome, foto, descrizione, reparto, tag, visibilità.
              <b> I prezzi si modificano nella scheda Prezzi.</b>
            </p>

            {prodottoOk && (
              <div className="adm-ok"><Icon name="check-circle-2" size={15} /> {prodottoOk}</div>
            )}

            {/* Form crea/modifica: chiuso di default, altrimenti occupa tutto
                lo schermo anche quando si vuole solo consultare l'elenco. */}
            <div className="adm-form">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setFormAperto((v) => !v)}
                  aria-expanded={formAperto}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "none", border: "none", padding: 0, cursor: "pointer",
                    fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase",
                    fontSize: "var(--fs-xs)", letterSpacing: "var(--ls-caps)", color: "var(--text-strong)" }}>
                  <Icon name={editingId ? "pencil" : "plus"} size={14} color="var(--cra-red)" />
                  {editingId ? `Modifica: ${form.nome || form.codice}` : "Nuovo prodotto"}
                  <Icon name={formAperto ? "chevron-down" : "chevron-right"} size={14} color="var(--text-muted, #5c6462)" />
                </button>
                {editingId && <button className="adm-btn ghost mini" onClick={resetForm}><Icon name="x" size={13} /> Annulla modifica</button>}
              </div>

              {!formAperto && (
                <p className="adm-sub" style={{ margin: 0 }}>
                  {editingId
                    ? "Apri per vedere i campi di questo prodotto."
                    : "Apri per creare un prodotto a mano (i prodotti L2F arrivano dal foglio MASTER)."}
                </p>
              )}

              {formAperto && (
              <React.Fragment>
              <div className="adm-form-grid">
                <label className="adm-fld"><span>Codice * (è la chiave che aggancia il foglio)</span>
                  <input type="text" value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} placeholder="ACC-0001" /></label>
                <label className="adm-fld wide"><span>Nome *</span>
                  <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Compressore portatile 12V…" /></label>
                <div className="adm-fld wide"><span>Reparto (macro › sottoreparto)</span>
                  <CategoryPicker categorie={categorie} value={form.categoria}
                    onChange={(id) => setForm({ ...form, categoria: id ?? "" })} /></div>
                <label className="adm-fld"><span>Marchio *</span>
                  <input type="text" list="marchi-noti" value={form.marchio}
                    onChange={(e) => {
                      const m = e.target.value;
                      // Un marchio generico non può stare sul sito L2F: il DB lo
                      // rifiuterebbe, meglio spegnere la spunta subito.
                      setForm({ ...form, marchio: m, su_l2f: m.trim().toUpperCase() === "L2F" ? form.su_l2f : false });
                    }}
                    placeholder="es. Brembo, TRW, LuK…" />
                  <datalist id="marchi-noti">
                    {marchiNoti.map((m) => <option key={m} value={m} />)}
                  </datalist>
                  <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                    scrivi <b>L2F</b> solo se è private label
                  </span>
                </label>
                <label className="adm-fld"><span>Prezzo base €</span>
                  <input type="text" inputMode="decimal" value={form.prezzo} onChange={(e) => setForm({ ...form, prezzo: e.target.value })}
                    placeholder="24,90" disabled={!!editingId} />
                  <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                    {editingId ? "si modifica nella scheda Prezzi" : "poi si modifica nella scheda Prezzi"}
                  </span>
                </label>
              </div>

              {/* Misura nel catalogo e offerta a tempo. */}
              <div className="adm-form-grid">
                <label className="adm-fld"><span>Misura nel catalogo</span>
                  <select value={form.cra_taglia} onChange={(e) => setForm({ ...form, cra_taglia: e.target.value })}>
                    {MISURE.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
                  </select>
                  <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                    Vale solo nel catalogo senza filtri. Appena il cliente cerca o sceglie
                    un reparto, tutte le schede tornano uguali. I prodotti ingranditi passano in cima.
                  </span>
                </label>
              </div>

              <div className="adm-fld">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span>Offerta a tempo (facoltativa)</span>
                  {(form.cra_offerta_da || form.cra_offerta_a || form.cra_offerta_prezzo || form.cra_offerta_etichetta) && (
                    <button type="button" className="adm-btn ghost mini"
                      onClick={() => setForm({
                        ...form,
                        cra_offerta_da: "", cra_offerta_a: "",
                        cra_offerta_prezzo: "", cra_offerta_etichetta: "",
                      })}>
                      <Icon name="x" size={12} /> Togli l'offerta
                    </button>
                  )}
                </div>
                <div className="adm-form-grid" style={{ paddingTop: "4px" }}>
                  <label className="adm-fld"><span>Comincia il</span>
                    <input type="datetime-local" value={form.cra_offerta_da}
                      onChange={(e) => setForm({ ...form, cra_offerta_da: e.target.value })} />
                    <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>vuoto = comincia subito</span>
                  </label>
                  <label className="adm-fld"><span>Finisce il</span>
                    <input type="datetime-local" value={form.cra_offerta_a}
                      onChange={(e) => setForm({ ...form, cra_offerta_a: e.target.value })} />
                    <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>accende il conto alla rovescia; vuoto = nessun countdown</span>
                  </label>
                  <label className="adm-fld"><span>Scritta sul nastro</span>
                    <input type="text" maxLength={24} value={form.cra_offerta_etichetta}
                      onChange={(e) => setForm({ ...form, cra_offerta_etichetta: e.target.value })}
                      placeholder="Offerta di agosto" />
                    <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>vuoto = compare «Offerta a tempo»</span>
                  </label>
                </div>
                {anteprimaVetrina && (
                  <p className="adm-sub" style={{ margin: "8px 0 0", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                    {anteprimaVetrina}
                  </p>
                )}
                {form.cra_taglia === "vetrina_xl" && (
                  <div className="adm-avviso" style={{ marginTop: "8px", marginBottom: 0 }}>
                    <Icon name="alert-circle" size={15} />
                    <span>Vetrina XL riempie quasi tutto lo schermo: chi apre il catalogo vede
                    un solo prodotto. Consigliata solo per campagne brevi con countdown.</span>
                  </div>
                )}
              </div>

              {/* Su quali vetrine compare. La regola è a senso unico: il sito
                  L2F ospita solo il private label. */}
              <div className="adm-fld">
                <span>Dove si vede</span>
                <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", padding: "8px 0" }}>
                  <label className="adm-check">
                    <input type="checkbox" checked={form.su_cra}
                      onChange={(e) => setForm({ ...form, su_cra: e.target.checked })} /> CRA Store
                  </label>
                  <label className="adm-check" title={form.marchio.trim().toUpperCase() === "L2F" ? "" : "Solo i prodotti a marchio L2F possono stare sul sito L2F"}>
                    <input type="checkbox" checked={form.su_l2f}
                      disabled={form.marchio.trim().toUpperCase() !== "L2F"}
                      onChange={(e) => setForm({ ...form, su_l2f: e.target.checked })} /> Sito L2F
                  </label>
                  {form.marchio.trim() && form.marchio.trim().toUpperCase() !== "L2F" && (
                    <span className="adm-sub">
                      «{form.marchio.trim()}» non è private label: sul sito L2F non può comparire.
                    </span>
                  )}
                </div>
              </div>
              {!editingId && (
                <p className="adm-sub" style={{ margin: 0 }}>
                  ⚠️ Se questo codice compare nel foglio MASTER, al prossimo aggiornamento il prodotto
                  passerà sotto il foglio e il prezzo scritto qui verrà sovrascritto.
                </p>
              )}
              <label className="adm-fld"><span>Tag di ricerca (separati da virgola)</span>
                <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="es. h7, led, 6000k, canbus" /></label>

              {/* attributi tecnici → filtri dello store + scheda tecnica */}
              <div className="adm-fld">
                <span>Attributi / Filtri (es. ah, attacco, gradazione…)</span>
                <datalist id="attr-keys">
                  {ATTR_KEYS.map((k) => <option key={k} value={k} />)}
                </datalist>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px" }}>
                  {form.attrs.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input type="text" list="attr-keys" value={r.k} placeholder="chiave (es. ah)"
                        style={{ width: "170px", fontFamily: "var(--font-body)", fontSize: "var(--fs-xs)", padding: "8px 10px", border: "var(--border-w-2) solid var(--border-strong)" }}
                        onChange={(e) => setForm({ ...form, attrs: form.attrs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)) })} />
                      <input type="text" value={r.v} placeholder="valore (es. 60)"
                        style={{ flex: 1, fontFamily: "var(--font-body)", fontSize: "var(--fs-xs)", padding: "8px 10px", border: "var(--border-w-2) solid var(--border-strong)" }}
                        onChange={(e) => setForm({ ...form, attrs: form.attrs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)) })} />
                      <button type="button" className="adm-btn rosso mini" aria-label="Rimuovi attributo"
                        onClick={() => setForm({ ...form, attrs: form.attrs.filter((_, j) => j !== i) })}>
                        <Icon name="trash-2" size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="adm-btn ghost mini" style={{ alignSelf: "flex-start" }}
                    onClick={() => setForm({ ...form, attrs: [...form.attrs, { k: "", v: "" }] })}>
                    <Icon name="plus" size={13} /> Aggiungi attributo
                  </button>
                </div>
              </div>
              <label className="adm-fld"><span>Descrizione</span>
                <textarea rows={3} value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} placeholder="Caratteristiche, compatibilità, contenuto della confezione…" /></label>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <label className="adm-btn ghost" style={{ cursor: "pointer" }}>
                  <Icon name="image-plus" size={15} /> {uploading ? "Carico…" : form.immagine ? "Cambia foto" : "Carica foto"}
                  <input type="file" accept="image/*" hidden onChange={(e) => onUploadImg(e.target.files?.[0])} />
                </label>
                {form.immagine && <img src={form.immagine} alt="" className="adm-thumb-preview" />}
                <button className="adm-btn" style={{ marginLeft: "auto" }} onClick={saveProduct}
                  disabled={uploading || savingProduct || !form.marchio.trim() || !form.codice.trim() || !form.nome.trim()}>
                  <Icon name="save" size={14} />
                  {savingProduct ? "Salvo…" : editingId ? "Salva modifiche" : "Crea prodotto"}
                </button>
              </div>
              </React.Fragment>
              )}
            </div>

            {/* filtro elenco */}
            <div className="adm-form">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                <b style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", fontSize: "var(--fs-xs)", letterSpacing: "var(--ls-caps)" }}>
                  <Icon name="search" size={14} color="var(--cra-red)" /> Filtra prodotti
                </b>
                {products && (
                  <span className="adm-sub">
                    {prodottiFiltrati?.length ?? 0} di {products.length}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input type="search" value={fQ} onChange={(e) => setFQ(e.target.value)}
                  placeholder="Cerca per nome, codice o tag…"
                  style={{ flex: "1 1 260px", fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "10px 12px", border: "var(--border-w-2) solid var(--border-strong)" }} />
                <select value={fCat} onChange={(e) => setFCat(e.target.value)}
                  style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "10px 12px", border: "var(--border-w-2) solid var(--border-strong)" }}>
                  <option value="">Tutti i reparti</option>
                  {macroCat.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                <select value={fStato} onChange={(e) => setFStato(e.target.value)}
                  style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "10px 12px", border: "var(--border-w-2) solid var(--border-strong)" }}>
                  <option value="tutti">Tutti</option>
                  <option value="attivi">Solo pubblicati</option>
                  <option value="nascosti">Solo nascosti</option>
                </select>
                <select value={fOrigine} onChange={(e) => setFOrigine(e.target.value)}
                  style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "10px 12px", border: "var(--border-w-2) solid var(--border-strong)" }}>
                  <option value="tutti">Origine: tutti</option>
                  <option value="foglio">Dal foglio ({daFoglio})</option>
                  <option value="mano">A mano ({aMano})</option>
                </select>
                <label className="adm-check">
                  <input type="checkbox" checked={fEvidenza} onChange={(e) => setFEvidenza(e.target.checked)} />
                  Solo in evidenza
                </label>
                {filtroAttivo && (
                  <button className="adm-btn ghost mini" onClick={azzeraFiltro}><Icon name="x" size={13} /> Azzera</button>
                )}
              </div>

              {/* Il freno a mano: quante schede sono ingrandite e quante ne mostra
                  davvero il catalogo. */}
              <p className={inEvidenza.vetrine > MAX_HERO || inEvidenza.grandi > MAX_GRANDE ? "adm-sub" : "adm-sub"}
                style={{ margin: 0, color: (inEvidenza.vetrine > MAX_HERO || inEvidenza.grandi > MAX_GRANDE) ? "var(--cra-red)" : undefined }}>
                In evidenza: {inEvidenza.vetrine} vetrine, {inEvidenza.grandi} grandi su {products?.length ?? 0} prodotti.
                {inEvidenza.vetrine > MAX_HERO &&
                  ` Attenzione: il catalogo ne ingrandisce solo ${MAX_HERO} (la prima per ordine di listino); le altre compaiono di misura normale, ma con il nastro dell'offerta.`}
                {inEvidenza.grandi > MAX_GRANDE &&
                  ` Le schede Grandi mostrate sono al massimo ${MAX_GRANDE}.`}
              </p>
            </div>

            {/* elenco: anagrafica, senza prezzi */}
            {!products ? <p className="adm-state">Caricamento…</p> :
              products.length === 0 ? <p className="adm-state">Nessun prodotto: creane uno qui sopra.</p> :
              prodottiFiltrati.length === 0 ? <p className="adm-state">Nessun prodotto corrisponde al filtro.</p> :
              prodottiFiltrati.map((p) => {
                const dedicati = colonne.filter((c) => c.id !== BASE && c.listinoId
                  && matrice.prod?.[c.listinoId]?.[p.id] != null).length;
                return (
                <div key={p.id} className="adm-row">
                  <div className="adm-row-head">
                    <img className="adm-item-thumb" src={p.immagine || PLACEHOLDER_IMG} alt="" loading="lazy" />
                    <span style={{ flex: 1, minWidth: "160px" }}>
                      <span className="adm-num">{p.nome}</span>{" "}
                      <span className={`adm-badge ${p.marchio === "L2F" ? "oro" : "grigio"}`}>{p.marchio}</span>{" "}
                      <span className={`adm-badge ${p.fonte_listino ? "oro" : "grigio"}`}>
                        {p.fonte_listino ? `dal foglio · ${p.fonte_listino}` : "a mano"}
                      </span>{" "}
                      {p.cra_taglia && p.cra_taglia !== "normale" && (
                        <span className="adm-badge oro">
                          {MISURE.find((m) => m.v === p.cra_taglia)?.label.split(" — ")[0] ?? p.cra_taglia}
                        </span>
                      )}{" "}
                      {p.cra_offerta_a && (() => {
                        const fine = Date.parse(p.cra_offerta_a);
                        const da = p.cra_offerta_da ? Date.parse(p.cra_offerta_da) : null;
                        const ora = Date.now();
                        if (fine <= ora) return <span className="adm-badge grigio">offerta finita</span>;
                        if (da && da > ora) {
                          return <span className="adm-badge grigio">offerta programmata · dal {new Date(da).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}</span>;
                        }
                        const g = Math.max(0, Math.ceil((fine - ora) / 86400e3));
                        return <span className="adm-badge rosso">offerta · finisce fra {g} g</span>;
                      })()}{" "}
                      {!p.attivo && <span className="adm-badge grigio">nascosto</span>}
                      <br />
                      <span className="adm-sub">
                        {p.codice}{p.categoria ? ` · ${catLabel(p.categoria)}` : ""}
                        {" · "}{[p.su_cra && "CRA Store", p.su_l2f && "sito L2F"].filter(Boolean).join(" + ") || "non pubblicato"}
                        {p.tags?.length ? ` · #${p.tags.join(" #")}` : ""}
                      </span>
                    </span>
                    <span className="adm-sub" style={{ textAlign: "right", minWidth: "150px" }}>
                      Base {formatEuro(p.prezzo)}
                      <br />
                      {dedicati === 0 ? "nessun prezzo dedicato" : `${dedicati} prezz${dedicati === 1 ? "o" : "i"} dedicat${dedicati === 1 ? "o" : "i"}`}
                    </span>
                    <button className="adm-btn ghost mini" title="Vai ai prezzi di questo prodotto"
                      onClick={() => { setTab("prezzi"); setCatalogo("cra"); setFQ(p.codice); }}>
                      Prezzi →
                    </button>
                    <button className="adm-btn ghost mini" onClick={() => editProduct(p)}><Icon name="pencil" size={13} /> Modifica</button>
                    <button className="adm-btn ghost mini" onClick={() => toggleProduct(p)}>{p.attivo ? "Nascondi" : "Pubblica"}</button>
                    <button className="adm-btn rosso mini" onClick={() => removeProduct(p.id, p.nome)} aria-label={`Elimina ${p.nome}`}><Icon name="trash-2" size={14} /></button>
                  </div>
                </div>
              );})}
          </React.Fragment>
        )}

        {tab === "attivita" && <Attivita setErr={setErr} />}

        {/* ---------- IMPOSTAZIONI: categorie cliente, foglio, uso avanzato ---------- */}
        {tab === "impostazioni" && (
          <React.Fragment>

            <EtichetteProdotto setErr={setErr} />

            {/* ===== categorie cliente ===== */}
            <p className="adm-regola">
              Una <b>categoria cliente</b> è un gruppo di officine con prezzi propri. Ogni officina ne ha
              una sola; chi non ne ha vede il <b>prezzo base</b>. Nel foglio MASTER ogni categoria è una
              colonna con lo stesso nome.
            </p>

            <div className="adm-form">
              <b style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", fontSize: "var(--fs-xs)", letterSpacing: "var(--ls-caps)" }}>
                <Icon name="plus" size={14} color="var(--cra-red)" /> Nuova categoria cliente
              </b>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <label className="adm-fld" style={{ flex: "1 1 240px" }}>
                  <span>Nome</span>
                  <input type="text" value={catForm.nome} placeholder="es. VIP, Moroso, Contrassegno…"
                    onChange={(e) => setCatForm({ ...catForm, nome: e.target.value })} />
                </label>
                <label className="adm-fld">
                  <span>Colore</span>
                  <input type="color" value={catForm.colore} style={{ width: "64px", height: "42px", padding: "2px" }}
                    onChange={(e) => setCatForm({ ...catForm, colore: e.target.value })} />
                </label>
                <button className="adm-btn" onClick={creaCategoria} disabled={!catForm.nome.trim()}>
                  <Icon name="save" size={14} /> Crea categoria
                </button>
              </div>
              {catForm.nome.trim() && (
                <p className="adm-sub" style={{ margin: 0 }}>
                  Identificativo: <code>{slug(catForm.nome)}</code> · nel foglio, intitola una colonna <b>{catForm.nome.toUpperCase()}</b>
                </p>
              )}
            </div>

            {categorieCli.length === 0 ? <p className="adm-state">Nessuna categoria: creane una qui sopra.</p> :
              categorieCli.map((c) => {
                const nClienti = (officine ?? []).filter((o) => o.categoria_cliente === c.id).length;
                const cont = contenitoreDi(c.id);
                const nCra = cont ? Object.keys(matrice.prod?.[cont.id] ?? {}).length : 0;
                const nL2f = cont ? Object.keys(matrice.var?.[cont.id] ?? {}).length : 0;
                const inFoglio = categorieDalFoglio.has(c.id);
                return (
                  <div key={c.id} className="adm-row">
                    <div className="adm-row-head">
                      <span style={{ width: "14px", height: "14px", background: c.colore || "var(--cra-red)", flex: "0 0 auto" }} />
                      <span style={{ flex: 1, minWidth: "200px" }}>
                        <input type="text" value={c.nome}
                          onChange={(e) => setCategorieCli((prev) => prev.map((x) => (x.id === c.id ? { ...x, nome: e.target.value } : x)))}
                          style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "6px 8px", border: "var(--border-w-2) solid var(--border-strong)", width: "220px" }} />
                        <br />
                        <span className="adm-sub">
                          {nClienti === 0
                            ? "0 officine — questi prezzi non li vede nessuno"
                            : `${nClienti} offici${nClienti === 1 ? "na" : "ne"}`}
                          {" · "}
                          {nCra + nL2f === 0
                            ? `nessun prezzo dedicato: i clienti ${c.nome} pagano il prezzo base`
                            : `${nCra} prezzi sul CRA Store · ${nL2f} sul sito L2F`}
                        </span>
                        <br />
                        <span className="adm-sub">
                          {inFoglio
                            ? <React.Fragment>✓ nel foglio: colonna <b>{(c.nome || c.id).toUpperCase()}</b> riconosciuta</React.Fragment>
                            : <React.Fragment>✗ nessuna colonna con questo nome nel foglio: questa categoria la compili a mano</React.Fragment>}
                        </span>
                      </span>
                      <input type="color" value={c.colore || "#bd3432"} aria-label={`Colore ${c.nome}`}
                        onChange={(e) => setCategorieCli((prev) => prev.map((x) => (x.id === c.id ? { ...x, colore: e.target.value } : x)))}
                        style={{ width: "44px", height: "34px", padding: "2px" }} />
                      <label className="adm-check">
                        <input type="checkbox" checked={c.attiva !== false}
                          onChange={(e) => setCategorieCli((prev) => prev.map((x) => (x.id === c.id ? { ...x, attiva: e.target.checked } : x)))} /> Attiva
                      </label>
                      <button className="adm-btn ghost mini" onClick={() => { setTab("prezzi"); setCatalogo("cra"); }}>
                        Prezzi →
                      </button>
                      <button className="adm-btn ghost mini" onClick={() => salvaCategoria(c)}><Icon name="save" size={13} /> Salva</button>
                      <button className="adm-btn rosso mini" onClick={() => eliminaCategoria(c.id, c.nome, nClienti, nCra + nL2f)} aria-label={`Elimina ${c.nome}`}>
                        <Icon name="trash-2" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

            {/* ===== quali linee L2F pubblicare sul CRA Store ===== */}
            <div className="adm-form" style={{ marginTop: "var(--space-6)" }}>
              <b style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", fontSize: "var(--fs-xs)", letterSpacing: "var(--ls-caps)" }}>
                <Icon name="store" size={14} color="var(--cra-red)" /> Linee L2F sul CRA Store
              </b>
              <p className="adm-sub" style={{ margin: 0 }}>
                Il catalogo è uno solo: L2F è il private label di CRA. Il sito L2F mostra tutto il
                private label; qui scegli <b>quali linee portare anche sul CRA Store</b>. I prodotti a
                marchio generico (Brembo, TRW…) restano sempre e solo su CRA.
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {linee.map((l) => (
                  <button key={l.fonte} className={`adm-btn mini ${l.tutte ? "" : "ghost"}`}
                    disabled={lineaBusy}
                    onClick={() => cambiaLinea(l.fonte, !l.tutte)}
                    title={l.tutte ? "Togli dal CRA Store" : "Pubblica sul CRA Store"}>
                    {l.tutte ? "✓ " : ""}{l.fonte} ({l.suCra}/{l.totale})
                  </button>
                ))}
              </div>
            </div>

            {/* ===== aggiornamento dal foglio ===== */}
            <div className="adm-form" style={{ marginTop: "var(--space-6)" }}>
              <b style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", fontSize: "var(--fs-xs)", letterSpacing: "var(--ls-caps)" }}>
                <Icon name="refresh-cw" size={14} color="var(--cra-red)" /> Aggiorna dal foglio MASTER
              </b>
              <ol className="adm-sub" style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "3px" }}>
                <li>I prodotti con un codice del foglio prendono da lì il <b>prezzo base</b>.</li>
                <li>Ogni colonna intitolata come una categoria diventa il <b>prezzo dedicato</b> di quella categoria.</li>
                <li>Una cella di categoria <b>vuota</b> toglie il prodotto da quei prezzi e lo riporta al prezzo base.</li>
                <li>I codici del foglio che a catalogo non esistono <b>non vengono creati</b>: li trovi qui sotto.</li>
              </ol>
              <p className="adm-sub" style={{ margin: 0 }}>
                I prodotti che non sono nel foglio non vengono toccati. Quelli che ci sono vengono riscritti:
                prezzo base e prezzi delle categorie.
              </p>
              <div>
                <button className="adm-btn rosso" onClick={doSync} disabled={syncBusy}>
                  <Icon name="refresh-cw" size={14} /> {syncBusy ? "Aggiorno…" : "Aggiorna dal foglio"}
                </button>
              </div>

              {syncReport && (
                <div className="adm-ok" style={{ marginBottom: 0, display: "block" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <Icon name="check-circle-2" size={15} /> <b>Aggiornamento completato</b>
                  </div>
                  <div className="adm-sub" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span>
                      Prezzi base: <b>{syncReport.netti_universali ?? 0}</b> ·
                      righe di catalogo aggiornate: <b>{syncReport.aggiornati_l2f ?? 0}</b>
                    </span>
                    {syncReport.categorie_dal_foglio?.length > 0 && (
                      <span>
                        Colonne riconosciute: {syncReport.categorie_dal_foglio
                          .map((c) => `${c.nome} (${c.schede.join(", ")})`).join(" · ")}
                      </span>
                    )}
                    {syncReport.colonne_ignorate?.length > 0 && (
                      <span style={{ color: "var(--cra-red)" }}>
                        Colonne ignorate, nessuna categoria con questo nome: {syncReport.colonne_ignorate.join(" · ")}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {syncReport?.passati?.length > 0 && (
                <div className="adm-avviso" style={{ marginBottom: 0 }}>
                  <Icon name="alert-circle" size={16} />
                  <span>
                    <b>{syncReport.passati.length} prodotti</b> che gestivi a mano ora sono comandati dal foglio:{" "}
                    {syncReport.passati.join(", ")} — i prezzi che avevi messo sono stati sostituiti.
                  </span>
                </div>
              )}

              {/* coda di lavoro: codici nel foglio che a catalogo non esistono */}
              {(ultimoSync?.non_trovati?.length > 0) && (
                <div>
                  <b style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", fontSize: "var(--fs-xs)", letterSpacing: "var(--ls-caps)" }}>
                    Da creare a catalogo ({ultimoSync.non_trovati.length})
                  </b>
                  {/* Questo elenco è una FOTOGRAFIA dell'ultimo aggiornamento,
                      non un controllo dal vivo: se un codice viene creato dopo,
                      resta scritto qui finché non si riaggiorna. Senza la data
                      sembra una segnalazione di adesso, e si va a cercare un
                      problema che non c'è più. */}
                  <p className="adm-sub" style={{ margin: "4px 0 8px" }}>
                    Codici che al momento dell'ultimo aggiornamento
                    {ultimoSync?.quando
                      ? ` — ${new Date(ultimoSync.quando).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} — `
                      : " "}
                    erano nel foglio ma non a catalogo. Il foglio non crea prodotti: li crei tu.
                    Se li hai creati dopo, <b>riaggiorna</b> e spariscono.
                  </p>
                  <div style={{ maxHeight: "220px", overflow: "auto", border: "1px solid var(--border-subtle, #e2e0da)" }}>
                    {ultimoSync.non_trovati.slice(0, 200).map((n, i) => {
                      const codice = typeof n === "string" ? n : n.codice;
                      const scheda = typeof n === "string" ? "" : n.scheda;
                      /* Le colonne descrittive del foglio: il codice da solo
                         costringe ad andare a cercare cosa sia. */
                      const riga = (typeof n === "object" && n.riga) || {};
                      const descrizione = [riga.nome, riga.gamma, riga.imballo].filter(Boolean).join(" · ");
                      const prezzi = [
                        riga.listino ? `listino ${riga.listino}` : null,
                        (riga.netto ?? riga.netto_nord) ? `netto ${riga.netto ?? riga.netto_nord}` : null,
                      ].filter(Boolean).join(" · ");
                      return (
                        <div key={`${codice}-${i}`} className="adm-item" style={{ padding: "7px 10px", alignItems: "flex-start" }}>
                          <span className="adm-num" style={{ minWidth: "140px" }}>{codice}</span>
                          <span className="adm-sub" style={{ flex: 1, textTransform: "none", letterSpacing: 0 }}>
                            {descrizione || scheda}
                            {descrizione && <><br /><span style={{ opacity: 0.7 }}>{scheda}{prezzi ? ` · ${prezzi}` : ""}</span></>}
                            {riga.specifiche && <><br /><span style={{ opacity: 0.7 }}>{riga.specifiche}</span></>}
                          </span>
                          <button className="adm-btn ghost mini" onClick={() => {
                            setTab("prodotti");
                            resetForm();
                            // Si porta dietro quello che il foglio sa già: il
                            // nome scritto a mano una seconda volta è il modo
                            // più facile per farlo diverso dal foglio.
                            setForm((f) => ({
                              ...f, codice,
                              nome: riga.nome || f.nome,
                              prezzo: riga.listino || f.prezzo,
                            }));
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}>Crea a catalogo</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ===== uso avanzato ===== */}
            {anomalie.length > 0 && (
              <div className="adm-avviso">
                <Icon name="alert-circle" size={16} />
                <div>
                  <b>Controllo di integrità</b>
                  <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
                    {anomalie.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <details className="adm-form">
              <summary style={{ cursor: "pointer", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", fontSize: "var(--fs-xs)", letterSpacing: "var(--ls-caps)" }}>
                Uso avanzato — contenitori prezzi (serve solo se qualcosa non torna)
              </summary>
              <p className="adm-sub" style={{ marginTop: "10px" }}>
                Il <b>contenitore prezzi</b> è dove il software salva i prezzi di una categoria.
                Normalmente non serve toccarlo: viene creato e collegato da solo.
                La <b>priorità</b> conta solo se due contenitori valgono per la stessa categoria: vince il numero più alto.
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <label className="adm-fld" style={{ flex: "1 1 220px" }}>
                  <span>Nome nuovo contenitore</span>
                  <input type="text" value={listForm.nome} placeholder="es. Promo primavera"
                    onChange={(e) => setListForm({ ...listForm, nome: e.target.value })} />
                </label>
                <label className="adm-fld">
                  <span>Priorità</span>
                  <input type="number" value={listForm.priorita} style={{ width: "90px" }}
                    onChange={(e) => setListForm({ ...listForm, priorita: e.target.value })} />
                </label>
                <button className="adm-btn ghost" onClick={creaListino} disabled={!listForm.nome.trim()}>
                  <Icon name="plus" size={14} /> Crea contenitore
                </button>
              </div>

              {listini.length === 0 ? <p className="adm-sub">Nessun contenitore prezzi.</p> :
                listini.map((l) => (
                  <div key={l.id} className="adm-row" style={{ marginBottom: "8px" }}>
                    <div className="adm-row-head">
                      <span style={{ flex: 1, minWidth: "180px" }}>
                        <input type="text" value={l.nome}
                          onChange={(e) => patchListino(l.id, { nome: e.target.value })}
                          style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-sm)", padding: "6px 8px", border: "var(--border-w-2) solid var(--border-strong)", width: "220px" }} />
                        {!l.attivo && <span className="adm-badge grigio" style={{ marginLeft: "8px" }}>spento</span>}
                        {(l.officine ?? []).length > 0 && <span className="adm-badge" style={{ marginLeft: "8px" }}>di un cliente</span>}
                        <br />
                        <span className="adm-sub">
                          {l.n_cra} prezzi sul CRA Store · {l.n_l2f} sul sito L2F
                          {(l.officine ?? []).length > 0 && " · si gestisce dalla scheda del cliente, in Officine"}
                        </span>
                      </span>
                      <label className="adm-fld" style={{ margin: 0 }}>
                        <span>Priorità</span>
                        <input type="number" value={l.priorita} style={{ width: "80px" }}
                          onChange={(e) => patchListino(l.id, { priorita: e.target.value })} />
                      </label>
                      <label className="adm-check">
                        <input type="checkbox" checked={!!l.attivo}
                          onChange={(e) => patchListino(l.id, { attivo: e.target.checked })} /> Attivo
                      </label>
                      <button className="adm-btn ghost mini" onClick={() => salvaListino(l)}><Icon name="save" size={13} /> Salva</button>
                      <button className="adm-btn rosso mini" onClick={() => eliminaListino(l.id)} aria-label={`Elimina ${l.nome}`}>
                        <Icon name="trash-2" size={14} />
                      </button>
                    </div>
                    {/* Un contenitore di un cliente NON si attacca a una
                        categoria: i suoi prezzi valgono per lui e basta. Un
                        clic qui li darebbe a tutti i clienti di quella
                        categoria — e con la priorità alta che hanno i prezzi
                        dedicati vincerebbero pure sul listino della
                        categoria. Un incidente da un clic, silenzioso, su
                        tutti i prezzi di mezza Italia. */}
                    {(l.officine ?? []).length > 0 ? (
                      <p className="adm-sub" style={{ marginTop: "10px" }}>
                        Vale solo per il cliente a cui è intestato, non per una categoria.
                        I suoi prezzi si cambiano dalla scheda del cliente, in <b>Officine</b>.
                      </p>
                    ) : (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginTop: "10px" }}>
                        <span className="adm-sub">Vale per le categorie:</span>
                        {categorieCli.length === 0 && <span className="adm-sub">crea prima una categoria cliente</span>}
                        {categorieCli.map((c) => {
                          const on = (l.categorie ?? []).includes(c.id);
                          return (
                            <button key={c.id} onClick={() => toggleCategoriaListino(l, c.id)}
                              className={`adm-btn mini ${on ? "" : "ghost"}`}
                              style={on ? { background: c.colore || "var(--cra-red)", color: "#fff" } : undefined}>
                              {on ? "✓ " : ""}{c.nome}
                            </button>
                          );
                        })}
                        <span className="adm-sub">(ricorda di premere Salva)</span>
                      </div>
                    )}
                  </div>
                ))}
            </details>
          </React.Fragment>
        )}

        {tab === "personale" && <Personale setErr={setErr} />}
      </div>
    </section>
  );
}

/* ============================================================
   ACCESSO — come un cliente entra, e a quale scheda finisce.

   Tre situazioni, tre facce diverse dello stesso riquadro:
   · l'anagrafica senza account   -> si genera un codice d'invito;
   · la registrazione senza codice cliente -> si fonde con l'anagrafica vera;
   · la scheda già a posto        -> si dice solo com'è messa.

   Il codice sostituisce la partita IVA come chiave. La P.IVA stava sulle
   fatture di tutti: bastava conoscerla per farsi consegnare la scheda di un
   cliente vero, con dentro codice cliente, fascia di prezzo e agente.
   ============================================================ */
function Accesso({ officina, onCambio, setErr }) {
  const [inviti, setInviti] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [copiato, setCopiato] = React.useState(null);
  const [cerca, setCerca] = React.useState("");
  const [trovate, setTrovate] = React.useState(null);

  const collegata = !!officina.user_id;
  const daAgganciare = collegata && !officina.codice_cliente;

  const caricaInviti = React.useCallback(async () => {
    try { setInviti(await getInviti(officina.id)); } catch { setInviti([]); }
  }, [officina.id]);

  React.useEffect(() => { if (!collegata) caricaInviti(); }, [collegata, caricaInviti]);

  /* La ricerca dell'anagrafica: mezzo secondo di silenzio e poi si chiede,
     perché l'elenco è di tremila righe e non si filtra nel browser. */
  React.useEffect(() => {
    if (!daAgganciare || cerca.trim().length < 3) { setTrovate(null); return undefined; }
    const t = setTimeout(async () => {
      try {
        const r = await getOfficine({ q: cerca.trim(), vista: "anagrafica", limit: 8 });
        setTrovate(r.righe ?? []);
      } catch { setTrovate([]); }
    }, 500);
    return () => clearTimeout(t);
  }, [cerca, daAgganciare]);

  const nuovoInvito = async () => {
    setBusy(true); setErr(null);
    try { await creaInvito({ officinaId: officina.id }); await caricaInviti(); }
    catch (e) { setErr(String(e?.message || "Non riesco a creare l'invito.")); }
    finally { setBusy(false); }
  };

  /* Copiare il solo codice non basta: chi lo riceve deve sapere dove
     metterlo. Negli appunti finisce l'invito intero, pronto da incollare in
     WhatsApp. L'indirizzo si prende da dove sta girando il sito, così il
     giorno che punterai il dominio vero il testo cambia da solo. */
  const testoInvito = (c) => testoInvitoCliente(officina.ragione_sociale, c);

  const copia = async (c) => {
    try {
      await navigator.clipboard.writeText(testoInvito(c));
      setCopiato(c);
      setTimeout(() => setCopiato(null), 2200);
    } catch { setErr("Il browser non mi lascia copiare: selezionalo a mano."); }
  };

  const manda = async (c) => {
    if (!officina.email) { setErr("Questa scheda non ha un'email: aggiungila qui sopra."); return; }
    setBusy(true); setErr(null);
    try {
      await inviaInvito(c);
      await caricaInviti();
    } catch (e) { setErr(String(e?.message || "L'email non è partita.")); }
    finally { setBusy(false); }
  };

  const aggancia = async (anagrafica) => {
    if (!window.confirm(
      `Fondere "${officina.ragione_sociale}" nella scheda di "${anagrafica.ragione_sociale}"?\n\n` +
      `L'accesso e i recapiti passano sull'anagrafica; codice cliente, fascia di prezzo e agente ` +
      `restano quelli dell'anagrafica. La scheda doppia viene cancellata. Non si torna indietro.`,
    )) return;
    setBusy(true); setErr(null);
    try { await agganciaOfficina(officina.id, anagrafica.id); onCambio?.(); }
    catch (e) { setErr(String(e?.message || "Aggancio non riuscito.")); }
    finally { setBusy(false); }
  };

  const stacca = async () => {
    if (!window.confirm(
      `Staccare l'accesso da "${officina.ragione_sociale}"?\n\n` +
      `La scheda torna a essere una semplice anagrafica. L'utenza resta viva: ` +
      `per farla rientrare servirà un invito nuovo.`,
    )) return;
    setBusy(true); setErr(null);
    try { await staccaOfficina(officina.id); onCambio?.(); }
    catch (e) { setErr(String(e?.message || "Non riesco a staccare l'accesso.")); }
    finally { setBusy(false); }
  };

  const aperti = (inviti ?? []).filter((i) => !i.usato_il && new Date(i.scade_il) > new Date());

  return (
    <div className="adm-accesso">
      <b className="adm-accesso-titolo">
        <Icon name="key-round" size={13} color="var(--cra-red)" /> Accesso
      </b>

      {!collegata && (
        <React.Fragment>
          <p className="adm-sub adm-accesso-testo">
            Questa scheda non ha un account. Genera un codice e daglielo: quando si registrerà
            indicandolo, si troverà collegato <b>a questa</b> scheda, con il suo codice cliente e la
            sua fascia di prezzo. Vale una volta sola e scade dopo trenta giorni.
          </p>
          {aperti.map((i) => (
            <div key={i.codice} className="adm-invito">
              <code className="adm-invito-codice">{i.codice}</code>
              <span className="adm-sub">
                {i.inviato_il
                  ? `inviato il ${dataInvito(i.inviato_il)}`
                  : "non ancora inviato"}
                {" · scade il "}{dataInvito(i.scade_il)}
              </span>
              <span style={{ marginLeft: "auto", display: "inline-flex", gap: "6px", flexWrap: "wrap" }}>
                {/* Due strade sole. L'email parte dal sistema col mittente
                    verificato dell'azienda; «copia» mette negli appunti
                    l'invito già scritto, da incollare a mano su WhatsApp. */}
                <button type="button" className="adm-btn mini" onClick={() => manda(i.codice)}
                  disabled={busy || !officina.email}
                  title={officina.email ? `Manda a ${officina.email}` : "Questa scheda non ha un'email"}>
                  <Icon name="mail" size={13} /> {i.inviato_il ? "rimanda" : "email"}
                </button>
                <button type="button" className="adm-btn ghost mini" onClick={() => copia(i.codice)}>
                  <Icon name={copiato === i.codice ? "check" : "copy"} size={13} />
                  {copiato === i.codice ? "invito copiato" : "copia"}
                </button>
                <button type="button" className="adm-btn ghost mini" title="Ritira questo codice"
                  onClick={async () => {
                    try { await annullaInvito(i.codice); await caricaInviti(); }
                    catch { setErr("Non riesco a ritirare il codice."); }
                  }}>
                  <Icon name="x" size={13} />
                </button>
              </span>
            </div>
          ))}
          <button type="button" className="adm-btn mini" onClick={nuovoInvito} disabled={busy}>
            <Icon name="plus" size={13} /> {aperti.length ? "Un altro codice" : "Genera il codice d'invito"}
          </button>
        </React.Fragment>
      )}

      {daAgganciare && (
        <React.Fragment>
          <p className="adm-sub adm-accesso-testo">
            Si è registrato per conto suo, senza codice: è una scheda nuova, senza codice cliente.
            Se corrisponde a un cliente che hai già in anagrafica, cercalo qui e fondili.
          </p>
          <input type="text" className="adm-cerca-anagrafica" value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca l'anagrafica per nome, città, codice o partita IVA…" />
          {trovate?.length === 0 && cerca.trim().length >= 3 && (
            <p className="adm-sub adm-accesso-testo">Nessuna anagrafica libera con questi dati.</p>
          )}
          {(trovate ?? []).map((a) => (
            <div key={a.id} className="adm-invito">
              <span>
                <b>{a.ragione_sociale}</b>
                <span className="adm-sub" style={{ display: "block" }}>
                  {[a.codice_cliente, a.piva, a.citta].filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
              <button type="button" className="adm-btn mini" style={{ marginLeft: "auto" }}
                disabled={busy} onClick={() => aggancia(a)}>
                <Icon name="link" size={13} /> Fondi qui
              </button>
            </div>
          ))}
        </React.Fragment>
      )}

      {collegata && !daAgganciare && (
        <p className="adm-sub adm-accesso-testo">
          Account collegato all'anagrafica <b>{officina.codice_cliente}</b>.
          <button type="button" className="adm-btn ghost mini" style={{ marginLeft: "10px" }}
            disabled={busy} onClick={stacca}>
            <Icon name="unlink" size={13} /> Stacca l'accesso
          </button>
        </p>
      )}
    </div>
  );
}

/* La stessa forma di data che usa il pannello Personale, che dice le stesse
   identiche frasi su un altro tipo di invito. «10/9/2026» ha il giorno non
   impaginato e il mese ambiguo per chi legge in fretta una scadenza. */
const dataInvito = (s) =>
  (s ? new Date(s).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : "—");

/* Il testo che finisce negli appunti. Sta fuori dal componente perché è
   contenuto, non comportamento: si legge tutto insieme e si corregge senza
   entrare nella logica. Deve stare in un messaggio WhatsApp, quindi corto. */
function testoInvitoCliente(ragioneSociale, codice) {
  const dove = `${window.location.origin}/#/login`;
  return [
    `Buongiorno${ragioneSociale ? " " + ragioneSociale : ""},`,
    "",
    "abbiamo attivato il vostro accesso al CRA Store: catalogo, i vostri",
    "prezzi e le proposte d'ordine. Nessun pagamento online.",
    "",
    `Registratevi qui: ${dove}`,
    `Codice invito: ${codice}`,
    "",
    "Il codice vale una volta sola. Dopo la registrazione verifichiamo i",
    "dati e attiviamo l'accesso.",
    "",
    "Centro Ricambi Auto",
  ].join("\n");
}
