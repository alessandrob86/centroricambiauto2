import React from "react";
import { Icon } from "../components/Icon.jsx";
import * as api from "../lib/internoApi.js";

const { useState, useEffect, useCallback, useRef } = React;

/* ============================================================
   PERSONALE — le persone, e chi vede cosa.

   Sta nel back-office e non nell'area interna perché lo vede solo
   l'amministratore: là occupava uno dei cinque posti della barra del
   telefono, che servono alle schede che aprono tutti. Le altre cose
   riservate a lui — officine, prodotti, prezzi, proposte — sono già qui.
   ============================================================ */

/* Copia locale dell'elenco ruoli. L'originale sta in Interno.jsx, che è un
   modulo caricato a parte: importarlo da qui vorrebbe dire scaricare tutta
   l'area interna ogni volta che si apre il back-office. */
/* Finanza sta accanto a Manager, non in fondo: nell'elenco a tendina la
   posizione racconta il grado, e vederlo dopo «Dipendente» farebbe pensare
   a un ruolo minore. Fa esattamente le stesse cose di un manager. */
const RUOLI = {
  admin: "Amministratore", manager: "Manager", finanza: "Finanza",
  rappresentante: "Rappresentante", centralino: "Centralino", dipendente: "Dipendente",
};

const VUOTO = {
  nome: "", cognome: "", email: "", telefono: "", ruolo: "dipendente", zona_id: "",
  responsabile_id: "", cra_abilitata: false,
};

/* Stessa data di prima: giorno, mese per esteso e anno. Su un codice che
   scade la forma breve «27/9/2026» si legge male e si confonde con il mese. */
const dataIt = (s) => (s ? new Date(s).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export function Personale({ setErr }) {
  const [sezione, setSezione] = useState("persone");
  const [dip, setDip] = useState(null);
  const [zone, setZone] = useState([]);
  const [moduli, setModuli] = useState([]);
  const [permessi, setPermessi] = useState([]);
  const [avvii, setAvvii] = useState({});
  const [inviti, setInviti] = useState({});
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const rifModulo = useRef(null);
  const rifNome = useRef(null);

  /* Il modulo sta in cima alla sezione e l'elenco è di sedici righe: premendo
     «Modifica» sull'ultima si apriva fuori dallo schermo, e il pulsante
     sembrava non fare niente. Lo si porta sotto gli occhi e gli si dà il
     fuoco, così si vede che è successo qualcosa e si può già scrivere. */
  /* Si guarda CHE COSA è aperto, non il contenuto: dipendendo dal modulo
     intero l'effetto ripartirebbe a ogni tasto, riportando su la pagina e
     rimettendo il fuoco sul nome mentre stai scrivendo il telefono. */
  const apertoSu = form ? (form.id ?? "nuova") : null;

  useEffect(() => {
    if (!apertoSu) return undefined;
    rifModulo.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => rifNome.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [apertoSu]);

  /* Le filiali se le legge da sé: qui non arrivano dall'alto come nell'area
     interna, dove il modulo le carica una volta sola per tutte le schede. */
  const carica = useCallback(async () => {
    const [d, z, m, p, av, inv] = await Promise.all([
      api.getDipendenti(), api.getZone(), api.getTuttiModuli(), api.getPermessi(),
      api.getAvvioRuoli(), api.getInvitiDipendenti(),
    ]);
    setDip(d); setZone(z); setModuli(m); setPermessi(p); setAvvii(av); setInviti(inv);
  }, []);
  useEffect(() => { carica().catch(() => setErr("Non riesco a caricare il personale.")); }, [carica, setErr]);

  const salvaPersona = async () => {
    if (!form?.nome.trim()) { setErr("Il nome è obbligatorio."); return; }
    setBusy(true); setErr(null);
    try {
      if (form.id) await api.aggiornaDipendente(form.id, form);
      else await api.creaDipendente(form);
      setForm(null); await carica();
    } catch (e) {
      setErr(String(e?.message || "").includes("dipendenti_email_uk")
        ? "Esiste già una scheda con questa email." : "Salvataggio non riuscito.");
    } finally { setBusy(false); }
  };

  /** Quante persone rispondono a questa. Si conta sull'elenco che abbiamo
   *  già in mano: chiederlo al database una volta per riga sarebbero
   *  diciotto richieste per disegnare una tabella. */
  const squadra = (id) => (dip ?? []).filter((x) => x.responsabile_id === id).length;
  const nomeDi = (id) => {
    const x = (dip ?? []).find((y) => y.id === id);
    return x ? `${x.nome ?? ""} ${x.cognome ?? ""}`.trim() : "—";
  };

  const valore = (modulo, ruolo) => {
    const p = permessi.find((x) => x.modulo === modulo && x.ruolo === ruolo && !x.dipendente_id && !x.zona_id);
    return p ? (p.abilitato ? "si" : "no") : "";
  };

  const cambiaAvvio = async (r, dest) => {
    try {
      await api.setAvvioRuolo(r, dest);
      setAvvii(await api.getAvvioRuoli());
    } catch { setErr("Non riesco a salvare l'atterraggio del ruolo."); }
  };

  const cambiaPermesso = async (modulo, ruolo, v) => {
    try {
      await api.setPermesso({ modulo, ruolo, abilitato: v === "" ? null : v === "si" });
      setPermessi(await api.getPermessi());
    } catch { setErr("Non riesco a salvare il permesso."); }
  };

  /* Chi non è amministratore qui non ci arriva: il cancello è a monte,
     sulla pagina. Ricontrollarlo sarebbe un dubbio senza motivo. */
  if (!dip) return <p className="adm-state">Caricamento…</p>;

  return (
    <React.Fragment>
      <div className="adm-filtri">
        {[["persone", "Persone"], ["permessi", "Chi vede cosa"]].map(([k, v]) => (
          <button key={k} className={`adm-btn mini ${sezione === k ? "" : "ghost"}`} onClick={() => setSezione(k)}>{v}</button>
        ))}
      </div>

      {sezione === "persone" && (
        <React.Fragment>
          <p className="adm-regola">
            La scheda può esistere <b>prima dell'account</b>. Quando la persona riceve l'invito e
            accede con questa email, il collegamento avviene da solo: ruolo e filiale sono già qui.
          </p>

          <div className="adm-form" ref={rifModulo}>
            {/* Il pulsante dice cosa c'è aperto: arrivando quassù dall'ultima
                riga dell'elenco non ci si ricorda da dove si era partiti. */}
            <button className="adm-btn ghost" style={{ alignSelf: "flex-start" }}
              onClick={() => setForm((f) => (f ? null : { ...VUOTO }))}>
              <Icon name={form ? "chevron-up" : "plus"} size={14} />
              {form?.id
                ? `Stai modificando ${`${form.nome ?? ""} ${form.cognome ?? ""}`.trim() || "una scheda"}`
                : form ? "Chiudi" : "Nuova persona"}
            </button>
            {form && (
              <React.Fragment>
                <div className="adm-form-grid">
                  {[["nome", "Nome *"], ["cognome", "Cognome"], ["email", "Email"], ["telefono", "Telefono"]].map(([k, l]) => (
                    <label className="adm-fld" key={k}>
                      <span>{l}</span>
                      <input type="text" ref={k === "nome" ? rifNome : undefined}
                        value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                    </label>
                  ))}
                  <label className="adm-fld">
                    <span>Ruolo</span>
                    <select value={form.ruolo} onChange={(e) => setForm({ ...form, ruolo: e.target.value })}>
                      {Object.entries(RUOLI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <label className="adm-fld">
                    <span>Filiale</span>
                    <select value={form.zona_id ?? ""} onChange={(e) => setForm({ ...form, zona_id: e.target.value })}>
                      <option value="">— Nessuna</option>
                      {zone.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
                    </select>
                  </label>
                  {/* «Risponde a» è tutto quello che serve per fare un area
                      manager: chi ha qualcuno sotto vede i numeri dei suoi
                      nelle statistiche. Nessuna casella «è area manager» da
                      tenere allineata: accesa su chi non ha nessuno sarebbe
                      un interruttore che non accende niente. */}
                  <label className="adm-fld">
                    <span>Risponde a</span>
                    <select value={form.responsabile_id ?? ""}
                      onChange={(e) => setForm({ ...form, responsabile_id: e.target.value })}>
                      <option value="">— Nessuno</option>
                      {(dip ?? [])
                        .filter((x) => x.id !== form.id && x.attivo)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {`${x.nome ?? ""} ${x.cognome ?? ""}`.trim()} · {RUOLI[x.ruolo] ?? x.ruolo}
                          </option>
                        ))}
                    </select>
                    <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                      chi compare qui sopra vedrà i numeri di questa persona nelle statistiche
                    </span>
                  </label>
                  <label className="adm-fld">
                    <span>CRA Store</span>
                    <div style={{ padding: "8px 0" }}>
                      <label className="adm-check" title="Apre il catalogo con i prezzi base: nessuno sconto riservato, nessun prezzo di un'altra officina">
                        <input type="checkbox" checked={form.cra_abilitata === true}
                          onChange={(e) => setForm({ ...form, cra_abilitata: e.target.checked })} />
                        Può entrare nel CRA Store
                      </label>
                    </div>
                    <span className="adm-sub" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                      vede catalogo e <b>prezzi base</b> per consultare. Le proposte d'ordine
                      restano ai clienti: per loro si mandano dal Card Center.
                    </span>
                  </label>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button className="adm-btn" onClick={salvaPersona} disabled={busy || !form.nome.trim()}>
                    <Icon name="save" size={14} /> {busy ? "Salvo…" : form.id ? "Salva" : "Crea"}
                  </button>
                  <button className="adm-btn ghost" onClick={() => setForm(null)}>Annulla</button>
                </div>
              </React.Fragment>
            )}
          </div>

          <div className="dip-tab-scroll">
            <table className="dip-tabella">
              <thead><tr><th>Persona</th><th>Ruolo</th><th>Filiale</th><th>Accesso</th><th /></tr></thead>
              <tbody>
                {dip.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {`${d.nome ?? ""} ${d.cognome ?? ""}`.trim()}
                      <br /><span className="adm-sub">{d.email ?? "—"}</span>
                      {/* Chi ha una squadra è un area manager: si legge qui,
                          senza dover aprire la scheda. */}
                      {squadra(d.id) > 0 && (
                        <React.Fragment>
                          <br /><span className="adm-sub">
                            <Icon name="users" size={11} /> segue {squadra(d.id)} person{squadra(d.id) === 1 ? "a" : "e"}
                          </span>
                        </React.Fragment>
                      )}
                      {d.responsabile_id && (
                        <React.Fragment>
                          <br /><span className="adm-sub">risponde a {nomeDi(d.responsabile_id)}</span>
                        </React.Fragment>
                      )}
                    </td>
                    <td>
                      {RUOLI[d.ruolo] ?? d.ruolo}
                      {d.cra_abilitata && <><br /><span className="adm-pill">CRA Store</span></>}
                    </td>
                    <td>{d.zone?.nome ?? <span className="adm-sub">nessuna</span>}</td>
                    <td>
                      {d.user_id
                        ? <span className="adm-pill attiva">collegato</span>
                        : <InvitoPersona persona={d} invito={inviti[d.id]}
                            onCambio={carica} setErr={setErr} />}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="adm-btn ghost mini"
                        onClick={() => setForm({
                          ...d,
                          zona_id: d.zona_id ?? "",
                          responsabile_id: d.responsabile_id ?? "",
                          cra_abilitata: d.cra_abilitata === true,
                        })}>
                        <Icon name="pencil" size={12} /> Modifica
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="adm-sub" style={{ marginTop: "10px" }}>
            Chi non è ancora <b>collegato</b> non ha le credenziali. Genera il codice e mandaglielo:
            si registra da solo con il suo indirizzo aziendale, e la scheda — ruolo e filiale
            compresi — si aggancia quando conferma l'email.
          </p>
        </React.Fragment>
      )}

      {sezione === "permessi" && (
        <React.Fragment>
          {/* Dove si apre il sito è metà dell'esperienza: un rappresentante
              che per arrivare alle promozioni deve passare da home, menu e
              area interna, le apre meno spesso. */}
          <h2 className="adm-sezione-titolo">
            <Icon name="log-in" size={14} color="var(--cra-red)" /> Dove si atterra dopo il login
          </h2>
          <p className="adm-regola">
            Vale per chi non ha scelto diversamente dal proprio profilo: come per i permessi,
            <b> la scelta della persona batte quella del ruolo</b>. Chi non ha nulla impostato
            resta sulla home del sito, come prima.
          </p>
          <div className="adm-form-grid" style={{ marginBottom: "var(--space-5)" }}>
            {Object.entries(RUOLI).map(([k, v]) => (
              <label key={k} className="adm-fld">
                <span>{v}</span>
                <select value={avvii[k] ?? ""} onChange={(e) => cambiaAvvio(k, e.target.value)}>
                  <option value="">Home del sito</option>
                  {moduli.filter((m) => m.tipo === "scheda" && m.attivo).map((m) => (
                    <option key={m.codice} value={m.codice}>Area interna · {m.nome}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {/* Prima erano sessanta menu a tendina tutti uguali: si vedeva la
              griglia, non la risposta. Ora ogni casella dice sì o no a colpo
              d'occhio, e un clic la fa girare. Il pallino segna le eccezioni:
              senza, non si distingue una scelta da un valore ereditato. */}
          <p className="adm-regola">
            Un clic sulla casella cambia: <b>di serie → sì → no → di serie</b>. Le caselle con
            il pallino sono <b>eccezioni</b> volute; le altre seguono il valore di serie del
            modulo. Le regole sulla singola persona battono comunque quelle del ruolo.
            <br />
            L'<b>amministratore vede tutto per costruzione</b>: la sua colonna è bloccata perché
            cambiarla non avrebbe effetto — e un admin che si toglie un modulo non avrebbe più
            modo di rimetterselo.
          </p>
          <div className="dip-tab-scroll">
            <table className="adm-permessi">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Modulo</th>
                  {Object.entries(RUOLI).map(([k, v]) => <th key={k}>{v}</th>)}
                </tr>
              </thead>
              <tbody>
                {moduli.map((m) => (
                  <tr key={m.codice}>
                    <th>
                      {m.nome}
                      <br /><span className="adm-sub">
                        {m.tipo === "riquadro" ? "riquadro della home" : "scheda"}
                        {" · di serie "}<b>{m.default_abilitato ? "sì" : "no"}</b>
                      </span>
                    </th>
                    {Object.keys(RUOLI).map((r) => {
                      /* L'admin scavalca i permessi nel database: mostrargli una
                         croce rossa mentre il modulo gli compare sarebbe una
                         bugia, e lasciarlo cliccare una trappola. */
                      if (r === "admin") {
                        return (
                          <td key={r}>
                            <span className="adm-cella si bloccata" title="L'amministratore vede tutti i moduli: la regola non si applica a lui">
                              <Icon name="check" size={14} color="#2E7D4F" />
                              <em>sempre</em>
                            </span>
                          </td>
                        );
                      }
                      const scelto = valore(m.codice, r);            // "", "si", "no"
                      const acceso = scelto ? scelto === "si" : m.default_abilitato;
                      const giro = { "": "si", si: "no", no: "" };
                      return (
                        <td key={r}>
                          <button type="button"
                            className={`adm-cella ${acceso ? "si" : "no"} ${scelto ? "scelto" : ""}`}
                            onClick={() => cambiaPermesso(m.codice, r, giro[scelto])}
                            title={`${RUOLI[r]} · ${m.nome}: ${acceso ? "vede" : "non vede"}${scelto ? " (eccezione)" : " (di serie)"}`}
                            aria-label={`${RUOLI[r]} ${m.nome}: ${acceso ? "vede" : "non vede"}`}>
                            <Icon name={acceso ? "check" : "x"} size={14}
                              color={acceso ? "#2E7D4F" : "var(--cra-red)"} />
                            {scelto && <i className="adm-cella-punto" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

/* ============================================================
   INVITO A UN COLLEGA — il codice, e i due modi per mandarlo.

   Due strade sole, volutamente. L'email parte dal sistema col mittente
   verificato dell'azienda: è quella che arriva davvero, invece di finire
   nello spam come farebbe un mittente automatico qualunque. «Copia» mette
   negli appunti l'invito già scritto, da incollare su WhatsApp a mano.
   ============================================================ */
function InvitoPersona({ persona, invito, onCambio, setErr }) {
  const [busy, setBusy] = useState(false);
  const [copiato, setCopiato] = useState(false);

  const testo = (codice) => {
    const dove = `${window.location.origin}/#/login`;
    const nome = `${persona.nome ?? ""}`.trim();
    return [
      `Ciao${nome ? " " + nome : ""},`,
      "",
      "ti ho attivato l'accesso all'area interna del sito: bacheca, Card",
      "Center, i tuoi clienti e le proposte d'ordine.",
      "",
      `Registrati qui: ${dove}`,
      `Codice invito: ${codice}`,
      "",
      `Usa il tuo indirizzo aziendale (${persona.email ?? "quello dell'ufficio"}):`,
      "il codice è legato a quello.",
    ].join("\n");
  };

  const genera = async () => {
    setBusy(true); setErr(null);
    try { await api.creaInvitoDipendente(persona.id); onCambio?.(); }
    catch (e) { setErr(String(e?.message || "Non riesco a creare il codice.")); }
    finally { setBusy(false); }
  };

  const manda = async () => {
    setBusy(true); setErr(null);
    try { await api.inviaInvito(invito.codice); onCambio?.(); }
    catch (e) { setErr(String(e?.message || "L'email non è partita.")); }
    finally { setBusy(false); }
  };

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(testo(invito.codice));
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2200);
    } catch { setErr("Il browser non mi lascia copiare: selezionalo a mano."); }
  };

  if (!invito) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span className="adm-pill">da invitare</span>
        <button type="button" className="adm-btn ghost mini" onClick={genera} disabled={busy}
          title={persona.email ? `Genera il codice per ${persona.email}` : "La scheda non ha un'email: aggiungila prima"}>
          <Icon name="key-round" size={12} /> Genera il codice
        </button>
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
      <code className="adm-invito-codice">{invito.codice}</code>
      <span className="adm-sub">
        {invito.inviato_il
          ? `inviato il ${dataIt(invito.inviato_il)}`
          : "non ancora inviato"}
        {" · scade il "}{dataIt(invito.scade_il)}
      </span>
      <span style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap" }}>
        <button type="button" className="adm-btn mini" onClick={manda} disabled={busy}>
          <Icon name="mail" size={12} /> {invito.inviato_il ? "rimanda" : "email"}
        </button>
        <button type="button" className="adm-btn ghost mini" onClick={copia}>
          <Icon name={copiato ? "check" : "copy"} size={12} /> {copiato ? "invito copiato" : "copia"}
        </button>
        <button type="button" className="adm-btn ghost mini" title="Ritira questo codice"
          onClick={async () => {
            try { await api.annullaInvito(invito.codice); onCambio?.(); }
            catch { setErr("Non riesco a ritirare il codice."); }
          }}>
          <Icon name="x" size={12} />
        </button>
      </span>
    </span>
  );
}
