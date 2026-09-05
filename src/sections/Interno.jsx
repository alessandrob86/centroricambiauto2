import React from "react";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import { Icon } from "../components/Icon.jsx";
import { Giro } from "../components/Giro.jsx";
import { useAuth } from "../lib/auth.jsx";
import { testoSu } from "../lib/contrasto.js";
import {
  ICONE_AVVISO, ANIMAZIONI, EFFETTI, EFFETTI_CON_COLORE,
  motoIcona, haAlone, stileEffetto, coloreEffettoDiSerie, restante,
} from "../lib/stileAvviso.js";
import * as api from "../lib/internoApi.js";
import * as push from "../lib/push.js";

const { useState, useEffect, useCallback, useMemo, useRef } = React;

/* ============================================================
   MODULO INTERNO — #/interno
   L'area di lavoro del personale CRA. A tutta larghezza come il
   back-office, e animata: le transizioni raccontano dove stai andando.
   Chi ha chiesto meno movimento al sistema operativo non lo vede
   (MotionConfig reducedMotion="user").
   ============================================================ */

/* Finanza sta accanto a Manager, non in fondo: nell'elenco a tendina la
   posizione racconta il grado, e vederlo dopo «Dipendente» farebbe pensare
   a un ruolo minore. Fa esattamente le stesse cose di un manager. */
const RUOLI = {
  admin: "Amministratore", manager: "Manager", finanza: "Finanza",
  rappresentante: "Rappresentante", centralino: "Centralino", dipendente: "Dipendente",
};
/* Due esiti soli, più l'assenza. «Accettata» non è un giudizio dell'agente:
   la scrive l'invio, perché mandare la proposta su ordini@ significa che il
   cliente ha detto sì. L'unica cosa che si dichiara a mano è il rifiuto. */
const ESITI = { accettata: "accettata", rifiutata: "rifiutata" };
const ETICHETTA_ESITO = (e) => (e ? ESITI[e] ?? e : "da fare");
const MISURE = ["1x1", "2x1", "2x2", "3x2"];

/* Entrata scaglionata, ma con un tetto: alla ventesima riga l'attesa
   diventa fastidio, non eleganza. */
const entra = (i = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay: Math.min(i * 0.03, 0.24), ease: [0.16, 1, 0.3, 1] },
});

const dataIt = (s) => (s ? new Date(s).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : "—");

/* Telefono o schermo grande.
   Non è un punto di rottura del foglio di stile: alcune cose non si possono
   sistemare col CSS. Sul telefono la bacheca personalizzabile non ha senso —
   nessuno trascina riquadri con un dito su 390 pixel — quindi lì si disegna
   un'altra cosa, non la stessa cosa più stretta. */
const SOGLIA_MOBILE = "(max-width: 760px)";

function useMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(SOGLIA_MOBILE).matches);
  useEffect(() => {
    const mq = window.matchMedia(SOGLIA_MOBILE);
    const cambia = (e) => setMobile(e.matches);
    mq.addEventListener("change", cambia);
    setMobile(mq.matches);
    return () => mq.removeEventListener("change", cambia);
  }, []);
  return mobile;
}

/** Etichetta del tipo scheda, sempre leggibile qualunque colore abbia
 *  (il colore lo sceglie l'admin: vedi lib/contrasto.js). */
/* L'etichetta del tipo porta anche l'icona: il colore da solo non basta a
   chi non distingue bene rosso e verde, e nove pastiglie colorate una accanto
   all'altra si confondono comunque. Il testo lo sceglie `testoSu()` fra
   bianco e antracite, prendendo quello che si legge meglio sul fondo. */
function Tipo({ nome, colore, icona, style }) {
  const bg = colore || "#272D2B";
  const testo = testoSu(bg);
  return (
    <span className="dip-tipo" style={{ background: bg, color: testo, ...style }}>
      {icona && <Icon name={icona} size={11} color={testo} />}
      {nome}
    </span>
  );
}

/** Indirizzo firmato per un file del bucket privato. */
function useUrlFirmato(path) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (!path) { setUrl(null); return undefined; }
    api.urlFirmato(path).then((u) => vivo && setUrl(u));
    return () => { vivo = false; };
  }, [path]);
  return url;
}

/* La striscia annunci in testa al sito vive in components/BarraAnnunci.jsx:
   deve poter comparire anche fuori da questo modulo, che è lazy. */

/* ============================================================
   PAGINE — 25/50/100 per volta, come nelle statistiche di sempre.
   Un elenco lungo senza pagine non si legge: si scorre e basta.
   ============================================================ */
const QUANTITA = [25, 50, 100];

function usePagina(righe) {
  const [quanti, setQuanti] = useState(25);
  const [pagina, setPagina] = useState(0);
  const totale = righe?.length ?? 0;
  const pagine = Math.max(1, Math.ceil(totale / quanti));
  /* Se il filtro accorcia l'elenco mentre sei a pagina 7, non si resta su
     una pagina che non esiste più. */
  const p = Math.min(pagina, pagine - 1);
  useEffect(() => { setPagina(0); }, [totale, quanti]);
  return {
    viste: (righe ?? []).slice(p * quanti, p * quanti + quanti),
    pagina: p, setPagina, quanti, setQuanti, pagine, totale,
    primo: totale ? p * quanti + 1 : 0,
    ultimo: Math.min(totale, (p + 1) * quanti),
  };
}

function Paginatore({ p, nome = "righe" }) {
  if (p.totale === 0) return null;
  return (
    <div className="dip-pagine">
      <label className="dip-pagine-quanti">
        Mostra
        <select value={p.quanti} onChange={(e) => p.setQuanti(Number(e.target.value))}>
          {QUANTITA.map((q) => <option key={q} value={q}>{q}</option>)}
        </select>
        {nome}
      </label>
      <span className="dip-sub">
        {p.primo}–{p.ultimo} di {new Intl.NumberFormat("it-IT").format(p.totale)}
      </span>
      {p.pagine > 1 && (
        <span className="dip-pagine-nav">
          <button className="adm-btn ghost mini" disabled={p.pagina === 0}
            onClick={() => p.setPagina(p.pagina - 1)} aria-label="Pagina precedente">
            <Icon name="chevron-left" size={13} />
          </button>
          <span className="dip-sub">pag. {p.pagina + 1} di {p.pagine}</span>
          <button className="adm-btn ghost mini" disabled={p.pagina + 1 >= p.pagine}
            onClick={() => p.setPagina(p.pagina + 1)} aria-label="Pagina successiva">
            <Icon name="chevron-right" size={13} />
          </button>
        </span>
      )}
    </div>
  );
}

/* ============================================================
   IL GIRO DI PRESENTAZIONE — i passi, scritti come dati.

   Parte da solo la prima volta che una persona entra qui dentro (finché
   `dipendenti.giro_il` è vuoto) e si rivede dal profilo. Il componente che
   li mostra è components/Giro.jsx: quello sa come si accende un faro, non
   cosa c'è scritto sopra. Il contenuto sta qui, tutto insieme, così si
   corregge una frase senza andare a cercarla in mezzo al codice.

   `scheda`    — dove deve trovarsi la persona: il giro ci passa da solo prima
                 di illuminare. Vedere la Bacheca mentre si parla della Bacheca
                 vale più di mille parole.
   `bersaglio` — l'attributo `data-giro` dell'elemento da illuminare. Se è un
                 elenco vince il primo che esiste davvero. Senza bersaglio la
                 vignetta sta al centro dello schermo.
   ============================================================ */
const PASSI_GIRO = [
  {
    codice: "benvenuto",
    titolo: (c) => (c.nome ? `Ciao ${c.nome}` : "Benvenuto"),
    testo: (c) =>
      `${c.ruolo}${c.filiale ? `, ${c.filiale}` : ""}. Questa è l'area interna: `
      + "in due minuti ti faccio vedere dove sta cosa. Se hai fretta, puoi saltarla.",
  },
  {
    codice: "desk",
    scheda: "home",
    bersaglio: ["desk-personalizza", "desk"],
    titolo: "Il Desk",
    testo: (c) => (c.mobile
      ? "È la tua pagina: il riepilogo di quello che ti riguarda, in ordine. "
        + "Da computer i riquadri si spostano e si ridimensionano con «Personalizza»."
      : "È la tua pagina. Con «Personalizza» sposti i riquadri e ne cambi la misura. "
        + "Restano come li lasci, anche domani."),
  },
  {
    codice: "bacheca",
    scheda: "bacheca",
    bersaglio: "bacheca",
    titolo: "La Bacheca",
    testo: (c) => "Gli avvisi dell'azienda. Alcuni valgono per tutti, altri solo per "
      + "la tua filiale: qui trovi i tuoi. Il numero accanto a «Bacheca» dice quanti "
      + "ne hai ancora da leggere."
      + (c.gestisce
        ? " Gli avvisi li scrivi anche tu, e scegli quali filiali li devono vedere."
        : ""),
  },
  {
    codice: "schede",
    scheda: "schede",
    bersaglio: "schede",
    titolo: "Il Card Center",
    /* Qui il mestiere cambia tutto. Per un rappresentante è lo strumento con
       cui vende; per il magazzino e il centralino è materiale da consultare.
       Dire a tutti «mandala al cliente» significa dirlo a chi clienti non ne
       ha: la prima frase che non ti riguarda spegne l'attenzione su tutto il
       resto. */
    testo: (c) => {
      const base = "Il materiale: listini, comunicazioni, promozioni. Apri una scheda, "
        + "la leggi, scarichi l'allegato.";
      if (c.gestisce) {
        return `${base} Le promozioni si mandano ai clienti, e da qui pubblichi tu `
          + "le schede nuove scegliendo a quali filiali arrivano.";
      }
      if (c.vende) {
        return `${base} Le promozioni le mandi ai tuoi clienti da qui: scegli il `
          + "cliente, la quantità e il documento, e parte la proposta.";
      }
      return `${base} Le promozioni le girano ai clienti i rappresentanti; a te `
        + "servono per sapere che cosa è in giro.";
    },
  },
  {
    codice: "clienti",
    scheda: "clienti",
    bersaglio: "clienti",
    titolo: (c) => (c.gestisce ? "I clienti" : "I miei clienti"),
    testo: (c) => (c.gestisce
      ? "Le officine della rete, con recapiti e codice cliente. Vedi anche a chi "
        + "sono affidate, e puoi spostarle da un rappresentante all'altro."
      : "Le officine affidate a te, con recapiti e codice cliente. Da qui prendi "
        + "in carico chi non ha ancora un referente."),
  },
  {
    codice: "campanella",
    bersaglio: "campanella",
    titolo: "La campanella",
    testo: (c) => "Sta qui, sempre, anche fuori dall'area interna. Si segna quando "
      + "esce un avviso o una scheda nuova mentre stai lavorando su altro. "
      + `${c.mobile ? "Toccala" : "Cliccala"} e vai dritto alla novità.`,
  },
  {
    codice: "profilo",
    scheda: "profilo",
    bersaglio: "profilo",
    titolo: "Il tuo profilo",
    /* I traguardi non misurano la stessa cosa per tutti: chi vende è contato
       sulle proposte, chi non vende sulla presenza. Prometterli uguali
       significa promettere a un magazziniere una classifica di vendite in
       cui resterà a zero per sempre. */
    testo: (c) => "Recapito, foto, motto. Sotto ci sono i traguardi: "
      + (c.vende
        ? "si muovono con le proposte che mandi e i clienti che lavori, non cliccando qui. "
        : "si muovono con i giorni in cui ci sei e le schede che leggi, non cliccando qui. ")
      + "Con «Quando entro, portami a…» scegli su quale pagina si apre il sito quando entri.",
  },
  {
    codice: "fine",
    scheda: "home",
    bersaglio: "nav",
    titolo: "Ci siamo",
    /* Niente compiti a casa: il primo giorno non c'è nessun arretrato da
       recuperare, e prometterlo fa sembrare finto tutto il resto. Meglio
       dire dov'è il tasto per rivedere questa presentazione, che altrimenti
       non lo trova nessuno. */
    /* Una cosa sola da fare adesso, e diversa a seconda del mestiere: un
       elenco di suggerimenti non lo segue nessuno. */
    testo: (c) => "Da qui ti sposti fra le pagine: il resto si impara usandolo. "
      + (c.vende
        ? "Comincia dal Card Center, guarda che promozioni sono in corso. "
        : "Comincia dalla Bacheca, così sai a che punto siamo. ")
      + "Se ti serve rivedere questa presentazione, il tasto è nel tuo profilo.",
  },
];

const dice = (v, c) => (typeof v === "function" ? v(c) : v);

/* Una volta per sessione, non una per visita: uscire dall'area interna e
   rientrare smonta e rimonta tutto, e `dipendente` — che arriva da useAuth —
   porta ancora la data vecchia, perché non si ricarica da solo. Senza questa
   riga il giro ripartirebbe da capo a ogni rientro, anche appena finito.
   Ci si segna CHI, non un sì: al banco il computer è di tutti, e un collega
   che entra dopo un altro senza ricaricare la pagina deve vedere il suo giro,
   non ereditare quello di chi c'era prima. */
let giroGiaPartito = null;

/* Un passo su una scheda che questa persona non ha non si mostra proprio: non
   è solo inutile, manderebbe l'area interna su una scheda che per lei non
   esiste — pagina vuota. È il caso di «I miei clienti» per il magazzino. */
function passiDelGiro(dipendente, ruolo, schede, mobile) {
  const c = {
    nome: (dipendente?.nome ?? "").trim(),
    ruolo: RUOLI[ruolo] ?? ruolo ?? "In squadra",
    filiale: dipendente?.zone?.nome ?? "",
    mobile,
    /* Due domande sole, e bastano a cambiare quattro vignette: questa
       persona VENDE (ha clienti da lavorare) e GESTISCE (pubblica schede e
       annunci, sposta i clienti fra agenti)? Sono le stesse due condizioni
       che il resto del modulo usa già per decidere cosa mostrare, quindi il
       giro racconta esattamente il sito che quella persona si troverà. */
    vende: ["admin", "manager", "finanza", "rappresentante"].includes(ruolo),
    gestisce: ["admin", "manager", "finanza"].includes(ruolo),
  };
  return PASSI_GIRO
    .filter((p) => !p.scheda || schede.some((m) => m.codice === p.scheda))
    .map((p) => ({
      codice: p.codice,
      scheda: p.scheda ?? null,
      bersaglio: p.bersaglio ?? null,
      titolo: dice(p.titolo, c),
      testo: dice(p.testo, c),
    }));
}

/* ============================================================
   Cancello: qui entra solo il personale.
   ============================================================ */
function StaffGate({ onNavigate, children }) {
  const { loading, isStaff, session } = useAuth();
  if (loading) return <div className="dip-page"><div className="dip-wrap"><p className="dip-vuoto">Caricamento…</p></div></div>;
  if (!isStaff) {
    return (
      <div className="dip-page">
        <div className="dip-wrap">
          <div className="dip-vuoto">
            <Icon name="lock" size={38} color="var(--cra-gold)" />
            <h1 className="dip-title" style={{ margin: "12px 0 6px" }}>Area del personale</h1>
            <p style={{ margin: "0 0 16px" }}>
              {session
                ? "Questo account non risulta fra il personale CRA. Se dovresti averne accesso, chiedi all'amministratore."
                : "Accedi con l'account che ti ha dato l'azienda."}
            </p>
            <button className="adm-btn" onClick={() => onNavigate(session ? "home" : "login")}>
              {session ? "Torna alla home" : "Accedi"}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return children;
}

export function Interno({ onNavigate, tab }) {
  return <StaffGate onNavigate={onNavigate}><InternoInner onNavigate={onNavigate} tab={tab} /></StaffGate>;
}

function InternoInner({ onNavigate, tab: tabUrl }) {
  const { dipendente, ruolo, isAdmin, avvio } = useAuth();
  const menoMoto = useReducedMotion();
  const [moduli, setModuli] = useState(null);
  const [tab, setTab] = useState(null);
  const [err, setErr] = useState(null);
  const [zone, setZone] = useState([]);
  const [daLeggere, setDaLeggere] = useState(0);
  const [fuoco, setFuoco] = useState(null);
  const [giro, setGiro] = useState(false);

  /* Una riga al giorno, appena entri: è la traccia che permette di premiare
     anche chi non vende. Se fallisce, non se ne accorge nessuno. */
  useEffect(() => { api.segnaPresenza(); }, []);

  useEffect(() => {
    Promise.all([api.getModuli(), api.getZone(), api.getAnnunci()])
      .then(([m, z, a]) => {
        setModuli(m);
        setZone(z);
        setDaLeggere(a.filter((x) => !x.letto).length);
      })
      .catch(() => setErr("Non riesco a caricare il modulo. Ricarica la pagina."));
  }, []);

  /* Su quale scheda si apre l'area interna, in ordine di precedenza:
     1. l'indirizzo — #/interno/schede — che è come arrivano le notifiche e
        i segnalibri, e vince sempre perché è una richiesta esplicita;
     2. quella già aperta, se si sta solo ricaricando qualcosa;
     3. l'atterraggio scelto dalla persona o dal suo ruolo;
     4. la prima scheda che vede.
     Una destinazione che non c'è più — modulo spento, permesso tolto — non
     deve lasciare la pagina vuota: `esiste` la scarta e si scende di uno. */
  useEffect(() => {
    if (!moduli) return;
    const esiste = (c) => (c && moduli.schede.some((s) => s.codice === c) ? c : null);
    setTab((t) => esiste(tabUrl) ?? t ?? esiste(avvio) ?? moduli.schede[0]?.codice ?? null);
  }, [moduli, tabUrl, avvio]);

  /* Chi gestisce: amministratore, manager e finanza — lo stesso grado.
     Il centralino non gestisce, ma cura le schede Education: e' un permesso
     stretto sul tipo di scheda, non sulla persona, e viaggia a parte. */
  const puoGestire = isAdmin || ruolo === "manager" || ruolo === "finanza";
  const curaEducation = ruolo === "centralino";
  /* Prima di ogni uscita anticipata: React conta gli hook a ogni disegno e
     pretende sempre lo stesso numero. Chiamandolo dopo il `return` di
     «Caricamento…» il primo disegno ne aveva uno in meno del secondo, e il
     modulo si schiantava appena arrivavano i dati. */
  const mobile = useMobile();

  const passiGiro = useMemo(
    () => (moduli ? passiDelGiro(dipendente, ruolo, moduli.schede, mobile) : []),
    [moduli, dipendente, ruolo, mobile],
  );

  /* Il giro parte da solo la prima volta — `giro_il` ancora vuoto — e solo
     quando c'è già qualcosa da illuminare: prima dei moduli e della scheda
     d'atterraggio il faro cadrebbe sul vuoto, che è peggio di niente. */
  useEffect(() => {
    if (!moduli || !tab || !dipendente) return;
    if (giroGiaPartito === dipendente.id) return;
    if (dipendente.giro_il != null || passiGiro.length === 0) return;
    giroGiaPartito = dipendente.id;
    setGiro(true);
  }, [moduli, tab, dipendente, passiGiro]);

  if (!moduli) {
    return <div className="dip-page"><div className="dip-wrap"><p className="dip-vuoto">Caricamento…</p></div></div>;
  }

  /* Da un riquadro della home si salta alla scheda giusta, e se serve
     direttamente sulla riga: cliccare un annuncio e ritrovarsi in cima a un
     elenco di venti sarebbe mezzo servizio. */
  const vaiA = (destinazione, id = null) => {
    setFuoco(id);
    setTab(destinazione);
    onNavigate("interno/" + destinazione);
  };

  /* Cambiare scheda dal menu azzera il fuoco. Senza, toccando una promozione
     nel Desk e poi «Card Center» dalla barra si riapriva quella di
     prima: il fuoco serve al salto mirato, non deve sopravvivergli. */
  const vaiScheda = (destinazione) => {
    setFuoco(null);
    setTab(destinazione);
    /* L'indirizzo segue la scheda: così il tasto Indietro torna dov'eri, il
       segnalibro riapre la stessa pagina, e una notifica può puntare dritta
       al Card Center invece che all'ingresso. */
    onNavigate("interno/" + destinazione);
  };

  /* Arrivato in fondo o saltato: è lo stesso gesto, e la rpc non si aspetta.
     Se non passa, il giro si chiude comunque — un tutorial non deve mai
     mettersi in mezzo al lavoro. */
  const chiudiGiro = () => { setGiro(false); api.giroFatto(); };

  /* «Rivedi la presentazione», dal profilo: riparte subito, e basta. La data
     su `giro_il` non si tocca, perché vuol dire «l'ha già visto» ed è vero:
     azzerarla per il ripasso significava che chi lo lasciava a metà e usciva
     se lo ritrovava da solo al prossimo accesso, come se fosse il primo
     giorno. Alla fine `chiudiGiro` la riscrive comunque. */
  const rivediGiro = () => setGiro(true);

  const comuni = { dipendente, ruolo, isAdmin, puoGestire, curaEducation, zone, setErr, onNavigate, vaiA,
    schedeVisibili: moduli.schede, rivediGiro };

  return (
    <MotionConfig reducedMotion="user">
      <div className="dip-page">
        <div className="dip-wrap">
          <header className="dip-head">
            <div>
              <span className="dip-eyebrow"><Icon name="users" size={14} /> Area interna</span>
              <h1 className="dip-title">Centro Ricambi Auto</h1>
            </div>
            <button type="button" className="dip-chi" onClick={() => vaiScheda("profilo")}
              title="Vai al tuo profilo">
              <span>
                <b>{`${dipendente?.nome ?? ""} ${dipendente?.cognome ?? ""}`.trim() || "—"}</b>
                {RUOLI[ruolo] ?? ruolo}{dipendente?.zone?.nome ? ` · ${dipendente.zone.nome}` : " · nessuna filiale"}
              </span>
              <Faccia persona={dipendente} taglia={40} />
            </button>
          </header>

          {err && <div className="adm-err"><Icon name="alert-circle" size={15} /> {err}</div>}

          {!mobile && (
            <nav className="dip-tabs" data-giro="nav">
              {moduli.schede.map((m) => (
                <button key={m.codice} className={`dip-tab ${tab === m.codice ? "on" : ""}`}
                  onClick={() => vaiScheda(m.codice)} aria-current={tab === m.codice ? "page" : undefined}>
                  <Icon name={m.icona || "chevron-right"} size={15} />
                  {m.nome}
                  {m.codice === "bacheca" && daLeggere > 0 && <span className="dip-tab-badge">{daLeggere}</span>}
                </button>
              ))}
            </nav>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity: 0, y: menoMoto ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: menoMoto ? 0 : -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
              {tab === "home" && <Home {...comuni} riquadri={moduli.riquadri} />}
              {tab === "bacheca" && <Bacheca {...comuni} onConteggio={setDaLeggere} fuoco={fuoco} />}
              {tab === "schede" && <CardCenter {...comuni} fuoco={fuoco} />}
              {tab === "clienti" && <MieiClienti {...comuni} />}
              {tab === "statistiche" && <Statistiche {...comuni} />}
              {tab === "profilo" && <Profilo {...comuni} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {mobile && (
          <BarraInBasso schede={moduli.schede} attiva={tab} vai={vaiScheda} daLeggere={daLeggere} />
        )}

        {giro && passiGiro.length > 0 && (
          <Giro passi={passiGiro} vaiScheda={vaiScheda} onChiudi={chiudiGiro} />
        )}
      </div>
    </MotionConfig>
  );
}

/* ============================================================
   BARRA IN BASSO — la navigazione del telefono.

   In basso e non in alto perché è dove arriva il pollice. Al massimo cinque
   voci: oltre, i bersagli diventano troppo stretti per un dito, quindi le
   rimanenti finiscono dietro «Altro».
   ============================================================ */
/* Nella barra c'è spazio per una parola, non per un titolo: a cinque voci
   su 390 pixel ognuna ha settanta pixel scarsi. Il nome per esteso resta
   ovunque altro — qui serve riconoscere, non leggere. */
const NOME_CORTO = {
  home: "Desk", bacheca: "Bacheca", schede: "Card",
  clienti: "Clienti", statistiche: "Dati", profilo: "Profilo",
};

function BarraInBasso({ schede, attiva, vai, daLeggere }) {
  const [altro, setAltro] = useState(false);
  const dirette = schede.length <= 5 ? schede : schede.slice(0, 4);
  const nascoste = schede.length <= 5 ? [] : schede.slice(4);
  const inAltro = nascoste.some((m) => m.codice === attiva);

  const voce = (m, esteso = false) => (
    <button key={m.codice} type="button"
      className={`dip-giu-voce ${attiva === m.codice ? "on" : ""}`}
      onClick={() => { vai(m.codice); setAltro(false); }}
      aria-current={attiva === m.codice ? "page" : undefined}>
      <span className="dip-giu-icona">
        <Icon name={m.icona || "chevron-right"} size={20} />
        {m.codice === "bacheca" && daLeggere > 0 && <span className="dip-giu-bollo">{daLeggere}</span>}
      </span>
      <span className="dip-giu-nome">{esteso ? m.nome : (NOME_CORTO[m.codice] ?? m.nome)}</span>
    </button>
  );

  return (
    <React.Fragment>
      <AnimatePresence>
        {altro && (
          <React.Fragment>
            <motion.div className="dip-velo" onClick={() => setAltro(false)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div className="dip-foglio"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
              <span className="dip-foglio-presa" />
              {nascoste.map((m) => voce(m, true))}
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>

      <nav className="dip-giu" aria-label="Sezioni" data-giro="nav">
        {dirette.map(voce)}
        {nascoste.length > 0 && (
          <button type="button" className={`dip-giu-voce ${inAltro ? "on" : ""}`}
            onClick={() => setAltro((v) => !v)} aria-expanded={altro}>
            <span className="dip-giu-icona"><Icon name="menu" size={20} /></span>
            <span className="dip-giu-nome">Altro</span>
          </button>
        )}
      </nav>
    </React.Fragment>
  );
}

/* ============================================================
   HOME — i riquadri li dispone ognuno per sé.
   Le misure sono preset e non pixel liberi: "come sul telefono",
   non come un editor di layout. Su mobile l'ordine resta, le misure
   decadono a una colonna.
   ============================================================ */
function Home({ dipendente, riquadri: iniziali, setErr, zone, vaiA }) {
  const mobile = useMobile();
  const [lista, setLista] = useState(iniziali);
  const [modifica, setModifica] = useState(false);
  const [salvato, setSalvato] = useState(false);
  const [dati, setDati] = useState({ annunci: [], schede: [], clienti: [], colleghi: [], tipi: [] });
  /* Trascinamento: `preso` è il riquadro in mano, `mira` la posizione dove
     finirebbe adesso. Finché il mouse è giù si vede solo l'anteprima; al
     rilascio si conferma. Niente framer Reorder: quello ragiona su un
     asse solo, e su una griglia a più colonne sbaglia i conti — era il
     motivo per cui il riquadro grande non arrivava a sinistra. */
  const [preso, setPreso] = useState(null);
  const [mira, setMira] = useState(null);
  const [regola, setRegola] = useState(null);

  useEffect(() => { setLista(iniziali); }, [iniziali]);

  /* I riquadri sono un riepilogo: se una fonte non risponde, gli altri
     devono restare in piedi. Con `Promise.all` bastava un errore per
     svuotare l'intera home — che è esattamente il contrario di «pazienza». */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [annunci, schede, clienti, colleghi, tipi] = (await Promise.allSettled([
        api.getAnnunci(), api.getSchede(), api.getClientiAgente(), api.getDipendenti(),
        api.getTipiScheda(),
      ])).map((e, i) => {
        if (e.status === "fulfilled") return e.value ?? [];
        console.warn(`riquadri: fonte ${i} non risponde`, e.reason);
        return [];
      });
      /* La foto non arriva dall'elenco (nella striscia in testa al sito non
         serve): si chiede a parte, e la mostrano solo i riquadri grandi. */
      const foto = annunci.length
        ? await api.getFotoAnnunci(annunci.map((a) => a.id)).catch(() => ({}))
        : {};
      if (!vivo) return;
      setDati({
        annunci: annunci.map((a) => ({ ...a, immagine: foto[a.id] ?? null })),
        schede,
        clienti,
        colleghi: colleghi.filter((c) => c.attivo && c.zona_id && c.zona_id === dipendente?.zona_id),
        tipi,
      });
    })();
    return () => { vivo = false; };
  }, [dipendente]);

  const salva = async (nuova) => {
    setLista(nuova);
    try {
      await api.salvaDashboard(dipendente?.id, nuova);
      setSalvato(true);
      setTimeout(() => setSalvato(false), 1600);
    } catch { setErr("Non riesco a salvare la disposizione."); }
  };

  const cambiaMisura = (codice, taglia) =>
    salva(lista.map((r) => (r.codice === codice ? { ...r, taglia } : r)));

  /* La misura resta il valore di partenza; questo la scavalca solo dove
     l'utente ha detto qualcosa. Chi non tocca niente non se ne accorge. */
  const cambiaConfig = (codice, chiave, valore) =>
    salva(lista.map((r) => (
      r.codice === codice ? { ...r, config: { ...(r.config ?? {}), [chiave]: valore } } : r
    )));

  /* Il trascinamento è la strada bella, questi sono la strada sicura:
     su una griglia il drag-and-drop può essere impreciso, e con la
     tastiera non esiste proprio. */
  /* Le frecce lavorano sull'elenco VISIBILE: i nascosti non hanno una
     posizione da scambiare, e mescolarli falserebbe gli indici. */
  const sposta = (i, verso) => {
    const vis = lista.filter((r) => r.visibile !== false);
    const j = i + verso;
    if (j < 0 || j >= vis.length) return;
    const n = [...vis];
    [n[i], n[j]] = [n[j], n[i]];
    salva([...n, ...lista.filter((r) => r.visibile === false)]);
  };

  /* Togliere e rimettere. Il riquadro non si cancella: si nasconde, così
     rimetterlo non richiede di ricostruire niente. */
  const mostra = (codice, si) =>
    salva(lista.map((r) => (r.codice === codice ? { ...r, visibile: si } : r)));

  const visibili = lista.filter((r) => r.visibile !== false);
  const nascosti = lista.filter((r) => r.visibile === false);

  /* Ordine da disegnare: durante il trascinamento è quello ANTEPRIMA, così
     gli altri riquadri si spostano davvero e si vede dove andrà a finire.
     Al rilascio quell'ordine diventa quello vero. */
  const ordineMostrato = useMemo(() => {
    if (!preso || mira == null) return visibili;
    const da = visibili.findIndex((r) => r.codice === preso);
    if (da < 0 || da === mira) return visibili;
    const n = [...visibili];
    const [x] = n.splice(da, 1);
    n.splice(mira, 0, x);
    return n;
  }, [visibili, preso, mira]);

  const rilascia = () => {
    if (preso && mira != null) {
      const nascosteDopo = lista.filter((r) => r.visibile === false);
      salva([...ordineMostrato, ...nascosteDopo]);
    }
    setPreso(null); setMira(null);
  };

  if (!lista.length) return <p className="dip-vuoto">Nessun riquadro abilitato per te.</p>;

  /* Sul telefono la bacheca non si compone: si legge. Stesso caricamento
     dati, disegno completamente diverso — trascinare riquadri con un dito
     su 390 pixel non serve a nessuno. */
  if (mobile) return <HomeTelefono dati={dati} zone={zone} vaiA={vaiA} />;

  return (
    <React.Fragment>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <button className={`adm-btn ${modifica ? "" : "ghost"}`} data-giro="desk-personalizza"
          onClick={() => setModifica(!modifica)}>
          <Icon name={modifica ? "check" : "pencil"} size={14} /> {modifica ? "Fatto" : "Personalizza"}
        </button>
        <span className="dip-sub">
          {modifica
            ? "Trascina per spostare, scegli la misura, e togli quelli che non usi."
            : "La tua pagina: i riquadri restano come li lasci."}
        </span>
        {modifica && nascosti.length > 0 && (
          <span className="dip-rimetti">
            <span className="dip-sub">Tolti:</span>
            {nascosti.map((r) => (
              <button key={r.codice} className="dip-scelta" onClick={() => mostra(r.codice, true)}>
                <Icon name="plus" size={11} /> {r.nome}
              </button>
            ))}
          </span>
        )}
        <AnimatePresence>
          {salvato && (
            <motion.span className="dip-sub" style={{ color: "#2e7d4f", marginLeft: "auto" }}
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <Icon name="check" size={13} /> salvato
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="dip-griglia" data-giro="desk"
        onDragOver={(e) => e.preventDefault()} onDrop={rilascia}>
        {ordineMostrato.map((r, i) => (
          <motion.div key={r.codice} layout
            className={`dip-card dip-riquadro ${modifica ? "modifica" : ""} ${preso === r.codice ? "presa" : ""}`}
            data-taglia={r.taglia}
            draggable={modifica}
            onDragStart={(e) => { setPreso(r.codice); setMira(i); e.dataTransfer.effectAllowed = "move"; }}
            onDragEnter={() => { if (preso && preso !== r.codice) setMira(i); }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={rilascia}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ layout: { type: "spring", stiffness: 420, damping: 38 }, duration: 0.28 }}>
            <h2 className="dip-card-titolo">
              {modifica && <span className="dip-presa" aria-hidden="true">⠿</span>}
              <Icon name={r.icona || "chevron-right"} size={14} color="var(--cra-red)" /> {r.nome}
            </h2>
            {modifica && (
              <div className="dip-riquadro-barra">
                {/* Solo le misure che hanno senso per QUESTO riquadro. */}
                {(r.taglie?.length ? r.taglie : MISURE).map((m) => (
                  <button key={m} className={`dip-misura ${r.taglia === m ? "on" : ""}`}
                    onClick={() => cambiaMisura(r.codice, m)}>{m.replace("x", "×")}</button>
                ))}
                <span style={{ marginLeft: "auto", display: "inline-flex", gap: "4px" }}>
                  {OPZIONI[r.codice]?.length > 0 && (
                    <button className={`dip-misura ${regola === r.codice ? "on" : ""}`}
                      onClick={() => setRegola((x) => (x === r.codice ? null : r.codice))}
                      aria-label={`Cosa mostra ${r.nome}`} title="Cosa mostra">
                      <Icon name="cog" size={11} />
                    </button>
                  )}
                  <button className="dip-misura" onClick={() => sposta(i, -1)} disabled={i === 0}
                    aria-label={`Sposta ${r.nome} indietro`}><Icon name="chevron-left" size={11} /></button>
                  <button className="dip-misura" onClick={() => sposta(i, 1)} disabled={i === visibili.length - 1}
                    aria-label={`Sposta ${r.nome} avanti`}><Icon name="chevron-right" size={11} /></button>
                  <button className="dip-misura togli" onClick={() => mostra(r.codice, false)}
                    aria-label={`Togli ${r.nome} dalla home`} title="Togli dalla home">
                    <Icon name="x" size={11} />
                  </button>
                </span>
              </div>
            )}
            <AnimatePresence>
              {modifica && regola === r.codice && (
                <motion.div className="dip-regolazioni"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                  {OPZIONI[r.codice].map((o) => (
                    <label key={o.chiave} className="dip-campo">
                      <span>{o.nome}</span>
                      <select value={r.config?.[o.chiave] ?? o.valori[0][0]}
                        onChange={(e) => cambiaConfig(r.codice, o.chiave, e.target.value)}>
                        {(o.dinamico === "tipi"
                          ? [["", "tutti"], ...(dati.tipi ?? []).map((t) => [t.id, t.nome])]
                          : o.valori
                        ).map(([v, eti]) => <option key={v} value={v}>{eti}</option>)}
                      </select>
                    </label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="dip-riquadro-corpo">
              <ContenutoRiquadro codice={r.codice} dati={dati} zone={zone}
                taglia={r.taglia} config={r.config} vaiA={modifica ? null : vaiA} />
            </div>
          </motion.div>
        ))}
      </div>
    </React.Fragment>
  );
}

/* Le righe dei riquadri della home: qui il mouse si perde più che altrove,
   perché sono quattro pannelli fitti di voci tutte uguali. Serve una risposta
   netta — non un grigino appena più scuro. */
const MOLLA_RIGA = { type: "spring", stiffness: 420, damping: 30 };
const RIGA_SU = {
  riposo: { x: 0, backgroundColor: "rgba(242,241,237,0)" },
  sopra: { x: 5, backgroundColor: "rgba(242,241,237,1)" },
};
const SEGNO_SU = { riposo: { scaleY: 0 }, sopra: { scaleY: 1 } };
const FRECCIA_SU = { riposo: { opacity: 0, x: -6 }, sopra: { opacity: 1, x: 0 } };
const FOTOMINI_SU = { riposo: { scale: 1 }, sopra: { scale: 1.09 } };

function FotoMini({ path }) {
  const url = useUrlFirmato(path);
  if (!url) return null;
  return (
    <span className="dip-mini-cornice">
      <motion.img className="dip-mini-foto" src={url} alt="" loading="lazy"
        variants={FOTOMINI_SU} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />
    </span>
  );
}

/* Una tabella che sul telefono si scompone in schede.
 *
 * L'etichetta la copia dall'intestazione invece di farsela scrivere cella
 * per cella: sette tabelle per una media di cinque colonne sono trentacinque
 * attributi da tenere allineati a mano, e il primo che si sfila mente.
 * La prima colonna resta senza: fa da titolo della scheda.
 */
function TabellaSchede({ children, ...resto }) {
  const rif = useRef(null);
  useEffect(() => {
    const t = rif.current;
    // Su schermo grande le etichette non le legge nessuno: farle comunque
    // sarebbero settecento scritture inutili a ogni battuta nel campo di
    // ricerca di una tabella da cento righe.
    if (!t || !window.matchMedia(SOGLIA_MOBILE).matches) return;
    const teste = [...t.querySelectorAll("thead th")].map((h) => h.textContent.trim());
    for (const tr of t.querySelectorAll("tbody tr")) {
      [...tr.children].forEach((td, i) => {
        if (i > 0 && teste[i]) td.setAttribute("data-etichetta", teste[i]);
        else td.removeAttribute("data-etichetta");
      });
    }
  });
  return <table ref={rif} className="dip-tabella a-schede" {...resto}>{children}</table>;
}

/** Una voce cliccabile dentro un riquadro della home. */
function RigaRiquadro({ onClick, titolo, coda, children }) {
  return (
    <motion.button type="button" className="dip-mini-annuncio" onClick={onClick} title={titolo}
      variants={RIGA_SU} initial="riposo" whileHover="sopra" whileFocus="sopra"
      whileTap={{ scale: 0.99 }} transition={MOLLA_RIGA}>
      <motion.span className="dip-mini-segno" variants={SEGNO_SU}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} />
      {children}
      {coda}
      <motion.span className="dip-mini-freccia" variants={FRECCIA_SU} transition={MOLLA_RIGA}>
        <Icon name="chevron-right" size={14} color="var(--cra-red)" />
      </motion.span>
    </motion.button>
  );
}

/** La faccia di una persona, o le sue iniziali. Serve dovunque compaia un
 *  nome: in testa alla pagina, fra i colleghi, nell'elenco del personale. */
function Faccia({ persona, taglia = 28 }) {
  const url = useUrlFirmato(persona?.avatar_url);
  const iniziali = `${(persona?.nome ?? "")[0] ?? ""}${(persona?.cognome ?? "")[0] ?? ""}`.toUpperCase();
  return (
    <span className="dip-faccia" style={{ width: taglia, height: taglia, fontSize: taglia * 0.38 }}>
      {url ? <img src={url} alt="" loading="lazy" /> : (iniziali || "—")}
    </span>
  );
}

/* Quanto spazio ho, quanto racconto. Le misure non cambiano solo la
   cornice: 1×1 è un elenco di titoli, 3×2 è quasi la bacheca. */
const DENSITA = {
  "1x1": { quanti: 4, corpo: 0, foto: false },
  "2x1": { quanti: 5, corpo: 1, foto: false },
  /* Larga e bassa: le voci si mettono in fila e la foto si rimpicciolisce.
     È la striscia da tenere in cima alla pagina. */
  "4x1": { quanti: 6, corpo: 1, foto: true, fila: true },
  "2x2": { quanti: 4, corpo: 2, foto: true },
  "3x2": { quanti: 6, corpo: 3, foto: true },
};

/* Le regolazioni di ogni riquadro. «Dalla misura» è sempre la prima voce:
   chi non tocca niente continua ad avere il comportamento di prima, e chi
   vuole decidere lo fa senza dover rimpicciolire o ingrandire il riquadro. */
const QUANTI = { chiave: "quanti", nome: "Quante voci",
  valori: [["auto", "dalla misura"], ["3", "3"], ["5", "5"], ["8", "8"], ["12", "12"]] };
const FOTO = { chiave: "foto", nome: "Foto",
  valori: [["auto", "dalla misura"], ["si", "sempre"], ["no", "mai"]] };

const OPZIONI = {
  r_annunci: [QUANTI, FOTO,
    { chiave: "solo", nome: "Mostra", valori: [["tutti", "tutti"], ["nuovi", "solo non letti"]] }],
  r_promozioni: [QUANTI, FOTO,
    { chiave: "entro", nome: "Scadenza", valori: [["tutte", "tutte"], ["7", "entro 7 giorni"], ["3", "entro 3 giorni"]] },
    { chiave: "ordine", nome: "Ordina per", valori: [["scadenza", "chi scade prima"], ["recenti", "più recenti"]] }],
  r_schede: [QUANTI, FOTO,
    { chiave: "tipo", nome: "Solo il tipo", dinamico: "tipi", valori: [["", "tutti"]] }],
  r_clienti: [QUANTI,
    { chiave: "ordine", nome: "Ordina per", valori: [["nome", "nome"], ["citta", "località"]] }],
  r_filiale: [],
};

/** La misura dà il valore di partenza; la configurazione lo scavalca. */
function densita(taglia, config) {
  const base = DENSITA[taglia] ?? DENSITA["1x1"];
  const q = Number(config?.quanti);
  return {
    ...base,
    quanti: Number.isFinite(q) && q > 0 ? q : base.quanti,
    foto: config?.foto === "si" ? true : config?.foto === "no" ? false : base.foto,
  };
}

/* ============================================================
   HOME DEL TELEFONO — un riepilogo fisso, uguale per tutti.

   Niente trascinamento, niente misure, niente riquadri da togliere: su un
   telefono quella libertà è un costo, non un servizio. L'ordine è deciso e
   segue cosa serve davvero a chi è in giro — prima cosa c'è di nuovo, poi
   cosa si può girare a un cliente, poi i propri numeri.

   Il contenuto lo disegna `ContenutoRiquadro`, lo stesso della versione
   grande: le regole di filtro restano scritte in un posto solo. */
const HOME_TELEFONO = [
  { codice: "r_annunci",    nome: "Annunci",       icona: "megaphone",     taglia: "2x2" },
  { codice: "r_promozioni", nome: "Promozioni",    icona: "tag",           taglia: "2x2" },
  { codice: "r_schede",     nome: "Card Center",   icona: "file-text",     taglia: "2x1" },
  { codice: "r_clienti",    nome: "I miei clienti", icona: "building-2",   taglia: "1x1" },
  { codice: "r_filiale",    nome: "La mia filiale", icona: "users",        taglia: "1x1" },
];

function HomeTelefono({ dati, zone, vaiA }) {
  return (
    <div className="dip-tel-home" data-giro="desk">
      {HOME_TELEFONO.map((r, i) => (
        <motion.section key={r.codice} className="dip-tel-blocco" {...entra(i)}>
          <h2 className="dip-tel-titolo">
            <Icon name={r.icona} size={15} color="var(--cra-red)" /> {r.nome}
          </h2>
          <ContenutoRiquadro codice={r.codice} dati={dati} zone={zone}
            taglia={r.taglia} config={null} vaiA={vaiA} />
        </motion.section>
      ))}
    </div>
  );
}

function ContenutoRiquadro({ codice, dati, taglia, config, vaiA }) {
  if (codice === "r_annunci") {
    const d = densita(taglia, config);
    const righe = config?.solo === "nuovi"
      ? dati.annunci.filter((a) => !a.letto)
      : dati.annunci;
    if (!righe.length) {
      return <p className="dip-sub">{config?.solo === "nuovi" ? "Letti tutti." : "Nessun annuncio."}</p>;
    }
    return (
      <div className={`dip-mini-annunci ${d.foto ? "conFoto" : ""}`}>
        {righe.slice(0, d.quanti).map((a) => (
          <RigaRiquadro key={a.id} onClick={() => vaiA?.("bacheca", a.id)}
            titolo={vaiA ? "Apri nella bacheca" : undefined}>
            {d.foto && a.immagine && <FotoMini path={a.immagine} />}
            <span className="dip-mini-testo">
              <span className="dip-mini-titolo">
                <b>{a.titolo}</b>
                {!a.letto && <span className="dip-tab-badge">nuovo</span>}
              </span>
              {d.corpo > 0 && a.corpo && (
                <span className="dip-sub dip-mini-corpo" style={{ WebkitLineClamp: d.corpo }}>
                  {a.corpo}
                </span>
              )}
              <span className="dip-sub">
                {dataIt(a.created_at)}
                {d.corpo >= 2 && a.scade_il ? ` · scade il ${dataIt(a.scade_il)}` : ""}
              </span>
            </span>
          </RigaRiquadro>
        ))}
        {righe.length > d.quanti && vaiA && (
          <button type="button" className="dip-mini-tutti" onClick={() => vaiA("bacheca")}>
            e altri {righe.length - d.quanti} <Icon name="chevron-right" size={12} />
          </button>
        )}
      </div>
    );
  }
  /* Due riquadri, due mestieri diversi: «Promozioni» è quello su cui si
     lavora — solo ciò che si può girare a un cliente, con quanto manca alla
     scadenza. «Altro materiale» è tutto il resto, che si consulta e basta.
     Prima si sovrapponevano e sembravano un errore. */
  if (codice === "r_promozioni" || codice === "r_schede") {
    const promo = codice === "r_promozioni";
    const giorniDa = (s) => (s.valida_a ? Math.ceil((new Date(s.valida_a) - Date.now()) / 86400000) : null);
    let righe = dati.schede.filter((s) => (promo ? s.inoltrabile : !s.inoltrabile));

    if (promo && config?.entro && config.entro !== "tutte") {
      const soglia = Number(config.entro);
      righe = righe.filter((s) => { const g = giorniDa(s); return g != null && g <= soglia; });
    }
    if (!promo && config?.tipo) righe = righe.filter((s) => s.tipo === config.tipo);
    if (promo && config?.ordine === "scadenza") {
      /* Chi scade prima sta in cima. Le promozioni senza data vanno in fondo:
         non hanno urgenza, e mescolarle falserebbe la lettura. */
      righe = [...righe].sort((a, b) => (giorniDa(a) ?? 1e9) - (giorniDa(b) ?? 1e9));
    }

    if (!righe.length) {
      return (
        <p className="dip-sub">
          {promo
            ? (config?.entro && config.entro !== "tutte"
              ? `Nessuna promozione in scadenza entro ${config.entro} giorni.`
              : "Nessuna promozione in corso.")
            : "Niente per ora."}
        </p>
      );
    }
    const d = densita(taglia, config);
    return (
      <div className={`dip-mini-annunci ${d.foto ? "conFoto" : ""}`}>
        {righe.slice(0, d.quanti).map((s) => {
          const g = giorniDa(s);
          return (
            <RigaRiquadro key={s.id} onClick={() => vaiA?.("schede", s.id)}
              titolo={vaiA ? "Apri nel Card Center" : undefined}
              coda={/* Quanto manca sta a destra e non si accorcia mai: è il
                       dato che fa decidere se muoversi oggi o domani. */
                g != null ? (
                  <em className={`dip-mini-giorni ${g <= 3 ? "scade" : ""}`}>
                    {g < 0 ? "scaduta" : g === 0 ? "oggi" : `${g} gg`}
                  </em>
                ) : null}>
              {d.foto && s.immagine && <FotoMini path={s.immagine} />}
              <span className="dip-mini-testo">
                <span className="dip-mini-titolo">
                  {!promo && <Tipo nome={s.tipo_nome} colore={s.tipo_colore} icona={s.tipo_icona} />}
                  <b>{s.titolo}</b>
                  {s.allegato && <Icon name="paperclip" size={12} color="var(--text-muted)" />}
                </span>
                {d.corpo > 0 && s.descrizione && (
                  <span className="dip-sub dip-mini-corpo" style={{ WebkitLineClamp: d.corpo }}>
                    {s.descrizione}
                  </span>
                )}
              </span>
            </RigaRiquadro>
          );
        })}
        {righe.length > d.quanti && vaiA && (
          <button type="button" className="dip-mini-tutti" onClick={() => vaiA("schede")}>
            e altre {righe.length - d.quanti} <Icon name="chevron-right" size={12} />
          </button>
        )}
      </div>
    );
  }
  if (codice === "r_clienti") {
    /* Il portafoglio è dell'agente, non della singola promozione: il vecchio
       conteggio leggeva una tabella rimasta vuota e diceva sempre zero. */
    const n = dati.clienti.length;
    if (!n) {
      return (
        <button type="button" className="dip-mini-tutti" onClick={() => vaiA?.("clienti")}>
          Nessun cliente in carico — prendine qualcuno <Icon name="chevron-right" size={12} />
        </button>
      );
    }
    const d = densita(taglia, config);
    const citta = new Set(dati.clienti.map((c) => c.citta).filter(Boolean)).size;
    const elenco = config?.ordine === "citta"
      ? [...dati.clienti].sort((a, b) => (a.citta ?? "").localeCompare(b.citta ?? ""))
      : dati.clienti;
    return (
      <div className="dip-mini-annunci">
        <RigaRiquadro onClick={() => vaiA?.("clienti")} titolo="Vai ai tuoi clienti">
          <span className="dip-mini-testo">
            <span className="dip-conta-grosso">{numero(n)}</span>
            <span className="dip-sub">
              clienti in carico{citta ? ` · ${citta} località` : ""}
            </span>
          </span>
        </RigaRiquadro>
        {d.corpo > 0 && elenco.slice(0, d.quanti).map((c) => (
          <RigaRiquadro key={c.officina_id} onClick={() => vaiA?.("clienti")}
            titolo="Vai ai tuoi clienti">
            <span className="dip-mini-testo">
              <span className="dip-mini-titolo"><b>{c.ragione_sociale}</b></span>
              <span className="dip-sub">
                {c.codice_cliente ?? ""}{c.citta ? ` · ${c.citta}` : ""}
              </span>
            </span>
          </RigaRiquadro>
        ))}
        {d.corpo > 0 && elenco.length > d.quanti && (
          <button type="button" className="dip-mini-tutti" onClick={() => vaiA?.("clienti")}>
            e altri {elenco.length - d.quanti} <Icon name="chevron-right" size={12} />
          </button>
        )}
      </div>
    );
  }
  if (codice === "r_filiale") {
    if (!dati.colleghi.length) return <p className="dip-sub">Nessun collega nella tua filiale.</p>;
    return (
      <div className="dip-colleghi">
        {dati.colleghi.map((c) => (
          <span key={c.id} className="dip-collega">
            <Faccia persona={c} taglia={30} />
            <span>
              {`${c.nome ?? ""} ${c.cognome ?? ""}`.trim()}
              <em>{RUOLI[c.ruolo] ?? c.ruolo}</em>
            </span>
          </span>
        ))}
      </div>
    );
  }
  return <p className="dip-sub">—</p>;
}

/* ============================================================
   ASPETTO DELL'AVVISO — lo sceglie chi scrive, con l'anteprima
   accanto: nessuno può indovinare come verrà un "neon lampeggiante
   arancione" senza vederlo.
   ============================================================ */
function SceltaAspetto({ form, setForm }) {
  const sfondo = form.colore || "#FDC543";
  const testo = testoSu(sfondo);
  const moto = motoIcona(form.animazione);
  const conColore = EFFETTI_CON_COLORE.has(form.effetto);
  const colore2 = form.colore_effetto || coloreEffettoDiSerie(form.effetto, sfondo);

  const gruppo = (etichetta, voci, campo) => (
    <div className="adm-fld" style={{ minWidth: 0 }}>
      <span>{etichetta}</span>
      <div className="dip-scelte">
        {voci.map((v) => (
          <button key={v.id} type="button" title={v.nota}
            className={`dip-scelta ${form[campo] === v.id ? "on" : ""}`}
            onClick={() => setForm({ ...form, [campo]: v.id })}>
            {v.nome}
          </button>
        ))}
      </div>
    </div>
  );

  const anteprima = (
    <div className="dip-aspetto-prova">
      <span className="dip-sub">Anteprima</span>
      <div className="dip-barra"
        style={{ background: sfondo, color: testo, ...stileEffetto(form.effetto, sfondo, form.colore_effetto) }}>
        <div className="dip-barra-in" style={{ minHeight: 48, padding: "8px 12px" }}>
          <span className="dip-barra-icona">
            {haAlone(form.animazione) && (
              <motion.span aria-hidden="true" className="dip-barra-alone" style={{ background: testo }}
                animate={{ opacity: [0.35, 0, 0.35], scale: [1, 1.7, 1] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
            )}
            <motion.span key={`${form.animazione}-${form.icona}`}
              style={{ display: "inline-flex", position: "relative", zIndex: 1 }} {...(moto ?? {})}>
              <Icon name={form.icona || "megaphone"} size={17} color={testo} />
            </motion.span>
          </span>
          <div className="dip-barra-testo">
            <b className="dip-barra-titolo">{form.titolo?.trim() || "Titolo dell'annuncio"}</b>
            {form.corpo && <span className="dip-barra-corpo">{form.corpo}</span>}
          </div>
          {form.scade_il && (
            <span className="dip-barra-timer" style={{ borderColor: testo, color: testo }}>
              <Icon name="timer" size={12} color={testo} />
              <span className="dip-barra-timer-cifre">{restante(form.scade_il)?.testo ?? "scaduto"}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="dip-aspetto">
      {/* L'anteprima sta fuori dal menu: è quella che serve sempre, e
          vedere come viene non deve costare un clic. */}
      {anteprima}

      <details className="dip-avanzate">
        <summary>
          <Icon name="pencil" size={13} color="var(--cra-red)" />
          Aspetto e animazioni
          <span className="dip-sub">icona, colori, movimento, effetti</span>
        </summary>
        <div className="dip-aspetto-campi">
          <div className="adm-fld">
            <span>Icona</span>
            <div className="dip-icone">
              {ICONE_AVVISO.map((ic) => (
                <button key={ic.id} type="button" title={ic.nome}
                  className={`dip-icona-scelta ${form.icona === ic.id ? "on" : ""}`}
                  aria-label={ic.nome} aria-pressed={form.icona === ic.id}
                  onClick={() => setForm({ ...form, icona: ic.id })}>
                  <Icon name={ic.id} size={16} />
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <label className="adm-fld" style={{ minWidth: "120px" }}>
              <span>Colore di fondo</span>
              <input type="color" value={sfondo} style={{ height: "40px", padding: "2px", width: "80px" }}
                onChange={(e) => setForm({ ...form, colore: e.target.value })} />
            </label>
            {conColore && (
              <label className="adm-fld" style={{ minWidth: "150px" }}>
                <span>Colore dell'effetto</span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input type="color" value={colore2} style={{ height: "40px", padding: "2px", width: "80px" }}
                    onChange={(e) => setForm({ ...form, colore_effetto: e.target.value })} />
                  {form.colore_effetto && (
                    <button type="button" className="dip-scelta"
                      onClick={() => setForm({ ...form, colore_effetto: "" })}>di serie</button>
                  )}
                </div>
                <span className="dip-sub">
                  {form.effetto === "sfumatura" ? "dove arriva la sfumatura"
                    : form.effetto === "bordo" ? "colore delle righe sopra e sotto"
                      : "colore del bagliore"}
                </span>
              </label>
            )}
          </div>

          {gruppo("Animazione", ANIMAZIONI, "animazione")}
          {gruppo("Effetto", EFFETTI, "effetto")}
        </div>
      </details>
    </div>
  );
}

/** Foto dell'annuncio: il bucket è privato, l'indirizzo si firma.
 *  Clic per aprirla intera in una scheda nuova. */
function FotoAnnuncio({ path, titolo }) {
  const url = useUrlFirmato(path);
  if (!url) return null;
  return (
    <motion.a href={url} target="_blank" rel="noopener noreferrer"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      style={{ display: "block" }}>
      <img className="dip-annuncio-foto" src={url} alt={`Foto: ${titolo}`} loading="lazy" />
    </motion.a>
  );
}

/* ============================================================
   BACHECA
   ============================================================ */
function Bacheca({ dipendente, puoGestire, zone, setErr, onConteggio, fuoco }) {
  const [righe, setRighe] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  /* Chi gestisce vede TUTTO (anche spenti e scaduti, per poterli
     rimettere in piedi); gli altri solo quello che li riguarda. Le due
     letture si fondono così il pallino "letto" resta corretto. */
  const carica = useCallback(async () => {
    const miei = await api.getAnnunci();
    onConteggio?.(miei.filter((x) => !x.letto).length);
    if (!puoGestire) {
      // L'RPC non porta la foto (nella striscia non serve): qui sì.
      const foto = await api.getFotoAnnunci(miei.map((m) => m.id));
      setRighe(miei.map((a) => ({ ...a, immagine: foto[a.id] ?? null })));
      return;
    }
    const tutti = await api.getAnnunciGestione();
    const lettoDi = Object.fromEntries(miei.map((m) => [m.id, m.letto]));
    setRighe(tutti.map((a) => ({ ...a, letto: lettoDi[a.id] ?? true })));
  }, [onConteggio, puoGestire]);

  useEffect(() => { carica().catch(() => setErr("Non riesco a leggere gli annunci.")); }, [carica, setErr]);

  /* Arrivo da un riquadro della home: porto in vista l'annuncio giusto. */
  useEffect(() => {
    if (!fuoco || !righe) return;
    const el = document.getElementById(`annuncio-${fuoco}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fuoco, righe]);

  // Se un collega pubblica mentre sei qui, l'elenco si aggiorna da solo.
  useEffect(() => api.ascolta("annunci", () => { carica().catch(() => {}); }), [carica]);

  const leggi = async (a) => {
    await api.segnaLetto(a.id, dipendente?.id).catch(() => {});
    carica();
  };

  const VUOTO = {
    titolo: "", corpo: "", priorita: 0, colore: "#fdc543", immagine: "",
    icona: "megaphone", animazione: "pulsa", effetto: "nessuno", colore_effetto: "",
    in_barra: true, scade_il: "", attivo: true, zone: [], avvisa: true,
  };

  const apriModifica = (a) => (window.scrollTo({ top: 0, behavior: "smooth" }), setForm({
    id: a.id, titolo: a.titolo ?? "", corpo: a.corpo ?? "",
    priorita: a.priorita ?? 0, colore: a.colore || "#fdc543",
    immagine: a.immagine ?? "",
    icona: a.icona || "megaphone",
    animazione: a.animazione || "pulsa", effetto: a.effetto || "nessuno",
    colore_effetto: a.colore_effetto ?? "",
    in_barra: !!a.in_barra, attivo: a.attivo !== false,
    scade_il: a.scade_il ? String(a.scade_il).slice(0, 10) : "",
    zone: a.zone ?? [],
  }));

  const caricaFoto = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await api.caricaFile(file, "annunci");
      setForm((f) => ({ ...f, immagine: path }));
    } catch { setErr("Caricamento della foto non riuscito."); }
    finally { setBusy(false); }
  };

  const salva = async () => {
    if (!form?.titolo.trim()) { setErr("Il titolo è obbligatorio."); return; }
    setBusy(true); setErr(null);
    try {
      if (form.id) await api.aggiornaAnnuncio(form.id, form, form.zone);
      else {
        await api.creaAnnuncio({ ...form, creato_da: dipendente?.id }, form.zone);
        // La notifica è un di più: se il servizio di push fa i capricci
        // l'annuncio resta salvato lo stesso, e si dice cos'è andato storto.
        if (form.avvisa !== false && form.attivo !== false) {
          try {
            await push.inviaPush({
              titolo: form.titolo.trim(),
              corpo: (form.corpo || "").trim().slice(0, 120),
              // Chi tocca la notifica si trova sulla bacheca, non
              // all'ingresso con l'annuncio da cercare.
              url: "/#/interno/bacheca",
              zone: form.zone?.length ? form.zone : undefined,
            });
          } catch (e) {
            setErr("Annuncio salvato, ma la notifica non è partita: " + (e?.message ?? e));
          }
        }
      }
      setForm(null);
      await carica();
    } catch { setErr("Non riesco a salvare l'annuncio."); }
    finally { setBusy(false); }
  };

  const elimina = async (a) => {
    if (!window.confirm(`Elimino l'annuncio «${a.titolo}»?\n\nSparisce per tutti, anche dalla striscia in testa al sito. Non si recupera.`)) return;
    try { await api.eliminaAnnuncio(a.id); await carica(); }
    catch { setErr("Eliminazione non riuscita."); }
  };

  if (!righe) return <p className="dip-vuoto">Caricamento…</p>;

  return (
    <React.Fragment>
      <p className="dip-regola">
        Gli annunci con <b>«in testa al sito»</b> compaiono nella striscia scura sopra ogni pagina,
        anche fuori da qui. Scegliendo una o più <b>filiali</b> l'annuncio lo vede solo chi ci lavora.
      </p>

      {puoGestire && (
        <div className="adm-form">
          <button className="adm-btn ghost" style={{ alignSelf: "flex-start" }}
            onClick={() => setForm((f) => (f ? null : { ...VUOTO }))}>
            <Icon name={form ? "chevron-up" : "plus"} size={14} />
            {form?.id ? "Chiudi la modifica" : "Nuovo annuncio"}
          </button>
          <AnimatePresence>
            {form && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                <div className="adm-form-grid" style={{ marginTop: "12px" }}>
                  <label className="adm-fld wide">
                    <span>Titolo *</span>
                    <input type="text" value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} />
                  </label>
                  <label className="adm-fld">
                    <span>Priorità</span>
                    <input type="number" value={form.priorita} onChange={(e) => setForm({ ...form, priorita: e.target.value })} />
                  </label>
                  <label className="adm-fld">
                    <span>Scade il</span>
                    <input type="date" value={form.scade_il}
                      onChange={(e) => setForm({ ...form, scade_il: e.target.value })} />
                  </label>
                </div>
                <label className="adm-fld wide" style={{ marginTop: "12px" }}>
                  <span>Testo</span>
                  <textarea rows={3} value={form.corpo} onChange={(e) => setForm({ ...form, corpo: e.target.value })} />
                </label>
                <SceltaAspetto form={form} setForm={setForm} />
                <label className="adm-fld" style={{ marginTop: "12px", maxWidth: "420px" }}>
                  <span>Foto (facoltativa)</span>
                  <input type="file" accept="image/*" onChange={(e) => caricaFoto(e.target.files?.[0])} />
                  <span className="dip-sub">
                    {form.immagine
                      ? "caricata ✓ — si vede nella bacheca, non nella striscia in testa al sito"
                      : "compare solo qui nella bacheca: la striscia in alto resta una riga di testo"}
                  </span>
                </label>
                <div className="adm-fld" style={{ marginTop: "12px" }}>
                  <span>Filiali</span>
                  <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", padding: "8px 0" }}>
                    {zone.map((z) => (
                      <label key={z.id} className="adm-check">
                        <input type="checkbox" checked={form.zone.includes(z.id)}
                          onChange={(e) => setForm({
                            ...form,
                            zone: e.target.checked ? [...form.zone, z.id] : form.zone.filter((x) => x !== z.id),
                          })} /> {z.nome}
                      </label>
                    ))}
                  </div>
                  <span className="dip-sub">{form.zone.length ? `lo vedono solo queste ${form.zone.length} filiali` : "nessuna filiale scelta: lo vedono tutti"}</span>
                </div>
                <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", marginTop: "10px" }}>
                  <label className="adm-check">
                    <input type="checkbox" checked={form.in_barra}
                      onChange={(e) => setForm({ ...form, in_barra: e.target.checked })} /> Mostra in testa a tutto il sito
                  </label>
                  <label className="adm-check" title="Spento resta salvato ma non lo vede nessuno">
                    <input type="checkbox" checked={form.attivo !== false}
                      onChange={(e) => setForm({ ...form, attivo: e.target.checked })} /> Attivo
                  </label>
                  {/* Solo alla creazione: una modifica non deve far ripartire
                      la notifica a tutti, sennò correggere un refuso diventa
                      un secondo avviso sul telefono di quindici persone. */}
                  {!form.id && (
                    <label className="adm-check" title="Arriva sul telefono di chi ha attivato le notifiche">
                      <input type="checkbox" checked={form.avvisa !== false}
                        onChange={(e) => setForm({ ...form, avvisa: e.target.checked })} /> Avvisa con una notifica
                    </label>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                  <button className="adm-btn" onClick={salva} disabled={busy || !form.titolo.trim()}>
                    <Icon name="save" size={14} /> {busy ? "Salvo…" : form.id ? "Salva le modifiche" : "Pubblica"}
                  </button>
                  <button className="adm-btn ghost" onClick={() => setForm(null)}>Annulla</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Il contenitore serve al giro di presentazione, che ha bisogno di un
          elemento solo da illuminare invece di venti annunci sparsi. */}
      <div data-giro="bacheca">
        {righe.length === 0 ? <p className="dip-vuoto">Nessun annuncio per te.</p> : righe.map((a, i) => (
          <motion.div key={a.id} id={`annuncio-${a.id}`}
            className={`dip-annuncio ${a.letto ? "letto" : ""} ${fuoco === a.id ? "fuoco" : ""}`} {...entra(i)}>
            <span className="dip-barra-punto" style={{ background: a.colore || "var(--cra-gold)", marginTop: "5px" }} />
            <div className="dip-annuncio-testo">
              <h3 className="dip-annuncio-titolo">
                {a.titolo}
                {a.attivo === false && <span className="dip-esito" style={{ marginLeft: 8 }}>spento</span>}
                {a.scade_il && new Date(a.scade_il) < new Date() && <span className="dip-esito rifiutata" style={{ marginLeft: 8 }}>scaduto</span>}
              </h3>
              {a.corpo && <p className="dip-annuncio-corpo">{a.corpo}</p>}
              {a.immagine && <FotoAnnuncio path={a.immagine} titolo={a.titolo} />}
              <span className="dip-sub">
                {dataIt(a.created_at)}
                {a.scade_il ? ` · scade il ${dataIt(a.scade_il)}` : ""}
                {a.in_barra ? " · in testa al sito" : ""}
                {a.zone?.length ? ` · ${a.zone.length} filiali` : puoGestire ? " · tutte le filiali" : ""}
              </span>
            </div>
            {puoGestire && (
              <React.Fragment>
                <button className="adm-btn ghost mini" onClick={() => apriModifica(a)}>
                  <Icon name="pencil" size={13} /> Modifica
                </button>
                <button className="adm-btn rosso mini" onClick={() => elimina(a)} aria-label={`Elimina ${a.titolo}`}>
                  <Icon name="trash-2" size={13} />
                </button>
              </React.Fragment>
            )}
            {!a.letto && (
              <button className="adm-btn ghost mini" onClick={() => leggi(a)}>
                <Icon name="check" size={13} /> Letto
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </React.Fragment>
  );
}

/* ============================================================
   CARD CENTER — il materiale. Il tipo decide cosa si può farci.
   ============================================================ */
function CardCenter({ dipendente, ruolo, puoGestire, curaEducation, zone, setErr, fuoco }) {
  const [tipi, setTipi] = useState([]);
  const [righe, setRighe] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [aperta, setAperta] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stato, setStato] = useState("corso");
  const [cerca, setCerca] = useState("");
  const [filiale, setFiliale] = useState("");

  /* Chi gestisce vede anche bozze e archiviate, per poterle riprendere in
     mano; gli altri solo quello che è pubblicato e valido adesso.
     Il centralino sta in mezzo: il Card Center lo legge come tutti, ma delle
     Education — le sue — vede anche le bozze e le scadute. Una bozza che
     sparisce nel momento esatto in cui la salvi non la ritrova più nessuno. */
  const carica = useCallback(async () => {
    const t = await api.getTipiScheda();
    setTipi(t);
    const nomeDi = Object.fromEntries((zone ?? []).map((z) => [z.id, z.nome]));
    const daGestione = (s, conteggi) => ({
      ...s,
      tipo_nome: s.tipi_scheda?.nome ?? s.tipo,
      tipo_colore: s.tipi_scheda?.colore ?? null,
      tipo_icona: s.tipi_scheda?.icona ?? null,
      inoltrabile: !!s.tipi_scheda?.inoltrabile,
      /* Chi gestisce legge dalla tabella, non dalla funzione filtrata: i nomi
         delle filiali se li ricava dall'elenco che ha già in mano. */
      zone_nomi: (s.zone ?? []).map((id) => nomeDi[id]).filter(Boolean),
      destinatari: conteggi?.[s.id] ?? 0,
    });

    if (puoGestire) {
      const [tutte, conteggi] = await Promise.all([api.getSchedeGestione(), api.getConteggiDestinatari()]);
      setRighe(tutte.map((x) => daGestione(x, conteggi)));
      return;
    }

    const mie = (await api.getSchede())
      .map((x) => ({ ...x, zone: x.zone_ids ?? [], zone_nomi: x.zone_nomi ?? [] }));
    if (!curaEducation) { setRighe(mie); return; }

    // Le due letture si sovrappongono sulle Education pubblicate: vince
    // quella di gestione, che porta con sé lo stato e le filiali.
    const edu = (await api.getSchedeGestione())
      .filter((x) => x.tipo === "education")
      .map((x) => daGestione(x, null));
    const per = new Map(mie.map((x) => [x.id, x]));
    for (const x of edu) per.set(x.id, x);
    setRighe([...per.values()]
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))));
  }, [puoGestire, curaEducation, zone]);

  /* Da qui in giù la domanda non è più «puoi gestire?» ma «puoi toccare
     QUESTA scheda?»: per chi gestisce è sempre sì, per il centralino è sì
     solo sulle Education. Il permesso è stretto sul tipo, non sulla persona. */
  const puoScrivere = puoGestire || curaEducation;
  const posso = useCallback(
    (x) => puoGestire || (curaEducation && x?.tipo === "education"),
    [puoGestire, curaEducation],
  );
  const tipiCreabili = useMemo(
    () => (puoGestire ? tipi : tipi.filter((t) => t.id === "education")),
    [tipi, puoGestire],
  );
  useEffect(() => { carica().catch(() => setErr("Non riesco a leggere il Card Center.")); }, [carica, setErr]);

  /* Arrivo da un riquadro della home su una scheda precisa: si apre quella,
     senza farla cercare in una griglia da centoquaranta. */
  useEffect(() => {
    if (!fuoco || !righe) return;
    const s = righe.find((x) => x.id === fuoco);
    if (s) { setAperta(s); api.segnaSchedaLetta(s.id); }
  }, [fuoco, righe]);

  /* «In corso» vuol dire pubblicata e non ancora scaduta. È la vista che
     serve nel lavoro di tutti i giorni, quindi è quella di partenza: lo
     scaduto si va a cercare, non si subisce. */
  const conStato = useMemo(() => (righe ?? []).map((s) => ({
    ...s,
    scaduta: s.stato !== "attiva"
      || (!!s.valida_a && new Date(s.valida_a) < new Date())
      || (!!s.valida_da && new Date(s.valida_da) > new Date()),
  })), [righe]);

  const perStato = useMemo(() => conStato.filter((s) => {
    if (!(stato === "tutte" || (stato === "scadute" ? s.scaduta : !s.scaduta))) return false;
    /* Filtro filiale: «tutte» passa sempre, perché una scheda senza filiali
       è per l'azienda intera e riguarda anche chi sta cercando la sua. */
    if (!filiale) return true;
    return !(s.zone ?? []).length || (s.zone ?? []).includes(filiale);
  }), [conStato, stato, filiale]);

  /* Ricerca sul titolo, sulla descrizione e sul nome del tipo. Le parole si
     cercano tutte, in qualunque ordine: «filtri ufi» trova «Promo Filtri Ufi»
     e anche «Ufi, promo filtri». */
  const viste = useMemo(() => {
    const parole = cerca.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return perStato.filter((s) => {
      if (filtro && s.tipo !== filtro) return false;
      if (!parole.length) return true;
      const testo = `${s.titolo ?? ""} ${s.descrizione ?? ""} ${s.tipo_nome ?? ""}`.toLowerCase();
      return parole.every((p) => testo.includes(p));
    });
  }, [perStato, filtro, cerca]);

  const pg = usePagina(viste);

  const quante = useMemo(() => ({
    corso: conStato.filter((s) => !s.scaduta).length,
    scadute: conStato.filter((s) => s.scaduta).length,
    tutte: conStato.length,
  }), [conStato]);

  const VUOTA = { titolo: "", descrizione: "", tipo: "promozione", immagine: "", allegato: "", valida_da: "", valida_a: "", stato: "attiva", zone: [], avvisa: true };

  /* Il modulo di modifica sta in cima alla pagina: se si apre mentre stai
     guardando una scheda in fondo alla griglia, sembra che il pulsante non
     abbia fatto niente. Quindi si sale. */
  const apriModifica = (s) => {
    setAperta(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setForm({
      id: s.id, titolo: s.titolo ?? "", descrizione: s.descrizione ?? "", tipo: s.tipo,
      immagine: s.immagine ?? "", allegato: s.allegato ?? "", stato: s.stato ?? "attiva",
      valida_da: s.valida_da ? String(s.valida_da).slice(0, 10) : "",
      valida_a: s.valida_a ? String(s.valida_a).slice(0, 10) : "",
      zone: s.zone ?? [],
    });
  };

  const salva = async () => {
    if (!form?.titolo.trim()) { setErr("Il titolo è obbligatorio."); return; }
    setBusy(true); setErr(null);
    try {
      if (form.id) await api.aggiornaScheda(form.id, form, form.zone);
      else {
        await api.creaScheda({ ...form, creato_da: dipendente?.id }, form.zone);
        // La notifica è un di più: se il servizio di push fa i capricci la
        // scheda resta pubblicata lo stesso, e si dice cos'è andato storto.
        if (form.avvisa !== false && form.stato === "attiva") {
          try {
            await push.inviaPush({
              titolo: form.titolo.trim(),
              corpo: (form.descrizione || "").trim().slice(0, 120),
              url: "/#/interno/schede",
              zone: form.zone?.length ? form.zone : undefined,
            });
          } catch (e) {
            setErr("Scheda pubblicata, ma la notifica non è partita: " + (e?.message ?? e));
          }
        }
      }
      setForm(null);
      await carica();
    } catch { setErr("Non riesco a salvare la scheda."); }
    finally { setBusy(false); }
  };

  const elimina = async (s) => {
    if (!window.confirm(
      `Elimino la scheda «${s.titolo}»?\n\nSpariscono anche i clienti assegnati e gli esiti registrati. Non si recupera.`,
    )) return;
    try { setAperta(null); await api.eliminaScheda(s.id); await carica(); }
    catch { setErr("Eliminazione non riuscita."); }
  };

  const carica_file = async (file, campo) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await api.caricaFile(file, campo === "immagine" ? "immagini" : "allegati");
      setForm((f) => ({ ...f, [campo]: path }));
    } catch { setErr("Caricamento del file non riuscito."); }
    finally { setBusy(false); }
  };

  if (!righe) return <p className="dip-vuoto">Caricamento…</p>;

  return (
    <React.Fragment>
      <p className="dip-regola">
        Qui c'è tutto il materiale. Solo le schede di tipo <b>promozione</b> si possono
        inoltrare come proposta d'ordine: le altre si consultano.
      </p>

      <div className="dip-barra-filtri">
        <div className="dip-filtro-riga">
          {puoScrivere && (
            <div className="dip-filtro-periodo">
              {[["corso", "In corso"], ["scadute", "Scadute"], ["tutte", "Tutte"]].map(([id, nome]) => (
                <button key={id} className={`adm-tab ${stato === id ? "attivo" : ""}`}
                  onClick={() => setStato(id)}>
                  {nome} ({quante[id]})
                </button>
              ))}
            </div>
          )}
          {/* Chi vede le schede di tutte le filiali deve poter restringere:
              vedere tutto senza poter filtrare è rumore, non informazione. */}
          {puoScrivere && zone?.length > 1 && (
            <label className="dip-campo">
              <span>Filiale</span>
              <select value={filiale} onChange={(e) => setFiliale(e.target.value)}>
                <option value="">Tutte</option>
                {zone.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
              </select>
            </label>
          )}
          <label className="dip-campo cresce">
            <span>Cerca fra le schede</span>
            <input type="search" value={cerca} placeholder="titolo, descrizione, tipo…"
              onChange={(e) => setCerca(e.target.value)} />
          </label>
          {(cerca || filiale) && (
            <button className="adm-btn ghost mini" onClick={() => { setCerca(""); setFiliale(""); }}>
              <Icon name="x" size={13} /> Pulisci
            </button>
          )}
        </div>
      </div>

      <div className="adm-filtri">
        <button className={`adm-btn mini ${filtro === "" ? "" : "ghost"}`} onClick={() => setFiltro("")}>
          Tutte ({perStato.length})
        </button>
        {tipi.map((t) => {
          const n = perStato.filter((s) => s.tipo === t.id).length;
          if (!n) return null;
          return (
            <button key={t.id} className={`adm-btn mini ${filtro === t.id ? "" : "ghost"}`}
              onClick={() => setFiltro(t.id)}>
              {t.nome} ({n}){t.inoltrabile ? " ↗" : ""}
            </button>
          );
        })}
      </div>

      {puoScrivere && (
        <div className="adm-form">
          <button className="adm-btn ghost" style={{ alignSelf: "flex-start" }}
            onClick={() => setForm((f) => (f ? null : { ...VUOTA, tipo: tipiCreabili[0]?.id ?? "education" }))}>
            <Icon name={form ? "chevron-up" : "plus"} size={14} />
            {form?.id ? "Chiudi la modifica"
              : puoGestire ? "Nuova scheda" : "Nuova scheda Education"}
          </button>
          <AnimatePresence>
            {form && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                <div className="adm-form-grid" style={{ marginTop: "12px" }}>
                  <label className="adm-fld wide">
                    <span>Titolo *</span>
                    <input type="text" value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} />
                  </label>
                  <label className="adm-fld">
                    <span>Tipo</span>
                    {/* Con una sola scelta possibile un menù a tendina è una
                        bugia gentile: sembra che si possa cambiare. Meglio
                        dire com'è. */}
                    {tipiCreabili.length > 1 ? (
                      <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                        {tipiCreabili.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select>
                    ) : (
                      <input type="text" readOnly value={tipiCreabili[0]?.nome ?? "Education"}
                        style={{ cursor: "default" }} />
                    )}
                    <span className="dip-sub">
                      {tipiCreabili.length > 1
                        ? (tipi.find((t) => t.id === form.tipo)?.inoltrabile
                            ? "i rappresentanti potranno inoltrarla come proposta d'ordine"
                            : "di sola consultazione")
                        : "le informazioni tecniche sui ricambi: di sola consultazione"}
                    </span>
                  </label>
                  <label className="adm-fld"><span>Valida da</span>
                    <input type="date" value={form.valida_da} onChange={(e) => setForm({ ...form, valida_da: e.target.value })} /></label>
                  <label className="adm-fld"><span>Valida fino a</span>
                    <input type="date" value={form.valida_a} onChange={(e) => setForm({ ...form, valida_a: e.target.value })} /></label>
                  <label className="adm-fld">
                    <span>Immagine</span>
                    <input type="file" accept="image/*" onChange={(e) => carica_file(e.target.files?.[0], "immagine")} />
                    {form.immagine && <span className="dip-sub">caricata ✓</span>}
                  </label>
                  <label className="adm-fld">
                    <span>Allegato (PDF)</span>
                    <input type="file" accept=".pdf,.xlsx,.xls,.doc,.docx" onChange={(e) => carica_file(e.target.files?.[0], "allegato")} />
                    {form.allegato && <span className="dip-sub">caricato ✓</span>}
                  </label>
                </div>
                <label className="adm-fld wide" style={{ marginTop: "12px" }}>
                  <span>Descrizione</span>
                  <textarea rows={3} value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} />
                </label>
                <div className="adm-fld" style={{ marginTop: "12px" }}>
                  <span>Filiali</span>
                  <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", padding: "8px 0" }}>
                    {zone.map((z) => (
                      <label key={z.id} className="adm-check">
                        <input type="checkbox" checked={form.zone.includes(z.id)}
                          onChange={(e) => setForm({
                            ...form,
                            zone: e.target.checked ? [...form.zone, z.id] : form.zone.filter((x) => x !== z.id),
                          })} /> {z.nome}
                      </label>
                    ))}
                  </div>
                  <span className="dip-sub">{form.zone.length ? "" : "nessuna filiale scelta: la vedono tutti"}</span>
                </div>
                <label className="adm-fld" style={{ marginTop: "12px", maxWidth: "220px" }}>
                  <span>Stato</span>
                  <select value={form.stato} onChange={(e) => setForm({ ...form, stato: e.target.value })}>
                    <option value="attiva">Pubblicata</option>
                    <option value="bozza">Bozza — non la vede nessuno</option>
                    <option value="archiviata">Archiviata</option>
                  </select>
                </label>
                {/* Solo alla creazione, e solo se esce pubblicata: una bozza
                    non deve svegliare nessuno, e una correzione nemmeno. */}
                {!form.id && form.stato === "attiva" && (
                  <label className="adm-check" style={{ marginTop: "12px" }}
                    title="Arriva sul telefono di chi ha attivato le notifiche">
                    <input type="checkbox" checked={form.avvisa !== false}
                      onChange={(e) => setForm({ ...form, avvisa: e.target.checked })} /> Avvisa con una notifica
                  </label>
                )}
                <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                  <button className="adm-btn" onClick={salva} disabled={busy || !form.titolo.trim()}>
                    <Icon name="save" size={14} /> {busy ? "Salvo…" : form.id ? "Salva le modifiche" : "Pubblica scheda"}
                  </button>
                  <button className="adm-btn ghost" onClick={() => setForm(null)}>Annulla</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* `data-giro` sul contenitore e non sulla griglia: il giro deve trovare
          qualcosa da illuminare anche quando l'elenco è vuoto. */}
      <div data-giro="schede">
        {viste.length === 0 ? (
          <p className="dip-vuoto">
            {cerca ? `Nessuna scheda per «${cerca}».` : "Nessuna scheda."}
          </p>
        ) : (
          <React.Fragment>
            <div className="dip-schede">
              {pg.viste.map((s, i) => (
                <SchedaCard key={s.id} s={s} i={i}
                  onApri={() => { setAperta(s); api.segnaSchedaLetta(s.id); }} />
              ))}
            </div>
            <Paginatore p={pg} nome="schede" />
          </React.Fragment>
        )}
      </div>

      <AnimatePresence>
        {aperta && (
          <DettaglioScheda scheda={aperta} ruolo={ruolo} dipendente={dipendente}
            puoGestire={posso(aperta)} setErr={setErr} onChiudi={() => setAperta(null)}
            onModifica={() => apriModifica(aperta)} onElimina={() => elimina(aperta)} />
        )}
      </AnimatePresence>
    </React.Fragment>
  );
}

/* Il passaggio del mouse: la scheda si stacca dalla pagina, la locandina
   respira dentro la sua cornice, una lama rossa attraversa il bordo alto e
   compare l'invito ad aprire. Le parti si muovono insieme perché ereditano
   le varianti dal genitore — nessun `useState` per l'hover.
   `MotionConfig reducedMotion="user"` in cima al modulo le spegne tutte per
   chi ha chiesto meno animazioni: qui non serve ripeterlo. */
const CARD_SU = {
  riposo: { y: 0, boxShadow: "0 0 0 rgba(0,0,0,0)" },
  sopra: { y: -6, boxShadow: "0 16px 34px rgba(39,45,43,.16)" },
};
const FOTO_SU = { riposo: { scale: 1 }, sopra: { scale: 1.07 } };
const LAMA_SU = { riposo: { scaleX: 0 }, sopra: { scaleX: 1 } };
const APRI_SU = { riposo: { opacity: 0, x: -6 }, sopra: { opacity: 1, x: 0 } };
const MOLLA = { type: "spring", stiffness: 320, damping: 26 };

function SchedaCard({ s, i, onApri }) {
  const img = useUrlFirmato(s.immagine);
  /* Una promozione finita non deve gridare quanto una viva: perde il colore
     e resta lì, leggibile, senza rubare l'occhio. */
  const giorni = s.valida_a && !s.scaduta
    ? Math.ceil((new Date(s.valida_a) - Date.now()) / 86400000)
    : null;
  return (
    <motion.button className={`dip-scheda ${s.scaduta ? "spenta" : ""}`} onClick={onApri} {...entra(i)}
      variants={CARD_SU} initial="riposo" whileHover="sopra" whileFocus="sopra"
      whileTap={{ scale: 0.985 }} transition={MOLLA}
      style={{ textAlign: "left", cursor: "pointer", padding: 0 }}>
      <motion.span className="dip-scheda-lama" variants={LAMA_SU} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} />
      <span className="dip-scheda-cornice">
        {img
          ? <motion.img className="dip-scheda-img" src={img} alt="" loading="lazy"
              variants={FOTO_SU} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} />
          : <span className="dip-scheda-vuota"><Icon name="file-text" size={30} color="var(--text-muted)" /></span>}
        <motion.span className="dip-scheda-apri" variants={APRI_SU} transition={MOLLA}>
          Apri <Icon name="arrow-right" size={13} color="var(--cra-white)" />
        </motion.span>
      </span>
      <span className="dip-scheda-corpo">
        <span className="dip-scheda-alto">
          <Tipo nome={s.tipo_nome} colore={s.tipo_colore} icona={s.tipo_icona} />
          {/* La graffetta si vede prima di aprire: si sa subito dove c'è
              qualcosa da scaricare, senza entrare in ogni scheda. */}
          {s.allegato && (
            <span className="dip-graffetta" title="Ha un allegato da scaricare">
              <Icon name="paperclip" size={12} color="var(--text-muted)" />
            </span>
          )}
          {s.scaduta && <span className="dip-scaduta">{s.stato === "bozza" ? "bozza" : "scaduta"}</span>}
          {giorni != null && giorni <= 7 && (
            <span className="dip-scaduta viva">
              {giorni <= 0 ? "ultimo giorno" : `${giorni} gg`}
            </span>
          )}
        </span>
        <b className="dip-scheda-titolo">{s.titolo}</b>
        {s.descrizione && <span className="dip-sub" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.descrizione}</span>}
        {/* A chi è destinata: senza, «vedo tutte le schede» diventa «non so
            più quali sono le mie». Nessuna filiale = vale per tutta l'azienda. */}
        <Filiali nomi={s.zone_nomi} />
        <span className="dip-sub" style={{ marginTop: "auto" }}>
          {dataIt(s.created_at)}{s.inoltrabile && s.destinatari > 0 ? ` · ${s.destinatari} clienti` : ""}
        </span>
      </span>
    </motion.button>
  );
}

/** Le filiali a cui è destinata una scheda. */
function Filiali({ nomi, tutte = "Tutte le filiali" }) {
  const elenco = nomi ?? [];
  return (
    <span className="dip-filiali">
      {elenco.length === 0 ? (
        <span className="dip-filiale ovunque"><Icon name="map-pin" size={10} /> {tutte}</span>
      ) : elenco.map((n) => (
        <span key={n} className="dip-filiale"><Icon name="map-pin" size={10} /> {n}</span>
      ))}
    </span>
  );
}

/** Dettaglio scheda: per le promozioni è anche il posto dove si lavora. */
function DettaglioScheda({ scheda, dipendente, puoGestire, setErr, onChiudi, onModifica, onElimina }) {
  const mobile = useMobile();
  const img = useUrlFirmato(scheda.immagine);
  const allegato = useUrlFirmato(scheda.allegato);
  const [clienti, setClienti] = useState(null);
  const [busy, setBusy] = useState(null);
  const [q, setQ] = useState("");
  const [modulo, setModulo] = useState(null);

  /* Non si assegnano clienti a una promozione: la promozione si propone
     al PORTAFOGLIO dell'agente. Qui compare il suo elenco, con accanto
     che cosa è già successo su questa scheda. */
  const carica = useCallback(() => {
    if (!scheda.inoltrabile) { setClienti([]); return; }
    api.getClientiAgente(scheda.id).then(setClienti).catch(() => setClienti([]));
  }, [scheda]);
  useEffect(() => { carica(); }, [carica]);

  /* I documenti si chiedono una volta sola: sono tre righe che non cambiano
     mentre si lavora, e rileggerle a ogni apertura della finestra sarebbe
     un'attesa in mezzo a un gesto. */
  const [tipiDoc, setTipiDoc] = useState([]);
  useEffect(() => { api.getTipiDocumento().then(setTipiDoc).catch(() => setTipiDoc([])); }, []);

  /* Quantità e note si scrivono nella riga, non in una finestrella del
     browser: il prompt di sistema non si può stilare, non si vede su mobile
     e cancella tutto se sfiori Esc. */
  const apriModulo = (c, tipo) =>
    setModulo({ id: c.officina_id, tipo, q: String(c.quantita || 1), note: c.note ?? "" });

  const invia = async (valori) => {
    const m = modulo;
    setBusy(m.id);
    try {
      const r = await api.inviaProposta({
        schedaId: scheda.id, officinaId: m.id,
        quantita: valori?.quantita ?? (Number(m.q) || 1),
        note: valori?.note ?? (m.note || null),
        documento: valori?.documento ?? null,
      });
      setErr(r?.emailed === false
        ? "Proposta registrata, ma l'email non è partita (Resend non configurata)."
        : null);
      setModulo(null);
      carica();
    } catch (e) { setErr(String(e?.message || "Invio non riuscito.")); }
    finally { setBusy(null); }
  };

  const rifiuta = async () => {
    const m = modulo;
    setBusy(m.id);
    try {
      await api.rifiuta(scheda.id, m.id, m.note, dipendente?.id);
      setModulo(null);
      carica();
    } catch { setErr("Non riesco a registrare il rifiuto."); }
    finally { setBusy(null); }
  };

  const annulla = async (c) => {
    setBusy(c.officina_id);
    try { await api.annullaEsito(scheda.id, c.officina_id); carica(); }
    catch { setErr("Non riesco ad annullare."); }
    finally { setBusy(null); }
  };

  return (
    <React.Fragment>
      <motion.div onClick={onChiudi}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 80 }} />
      {/* Sul telefono la finestra si chiude anche scorrendola via verso
          destra, da dove è entrata. Col mouse no: il trascinamento ruberebbe
          la selezione del testo, e lì il pulsante si vede benissimo. */}
      <motion.aside role="dialog" aria-label={scheda.titolo} className="dip-pannello"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 32 }}
        drag={mobile ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.9 }}
        dragMomentum={false}
        onDragEnd={(_e, info) => {
          // Un pollice lento che arriva lontano, o uno veloce anche corto:
          // sono due modi diversi di dire la stessa cosa.
          if (info.offset.x > 90 || info.velocity.x > 600) onChiudi();
        }}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 81, width: "min(720px, 100%)",
          background: "var(--surface-page, #fff)", overflow: "auto", padding: "18px 20px 40px",
          borderLeft: "3px solid var(--cra-red)",
        }}>
        {/* `wrap`: su uno schermo da 320 pixel quattro comandi in fila non
            ci stanno, e senza andrebbero a finire sotto il bordo. */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <Tipo nome={scheda.tipo_nome} colore={scheda.tipo_colore} icona={scheda.tipo_icona} />
          {scheda.stato && scheda.stato !== "attiva" && <span className="dip-esito">{scheda.stato}</span>}
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: "8px" }}>
            {puoGestire && (
              <React.Fragment>
                <button className="adm-btn ghost mini" onClick={onModifica}>
                  <Icon name="pencil" size={13} /> Modifica
                </button>
                <button className="adm-btn rosso mini" onClick={onElimina} aria-label="Elimina la scheda">
                  <Icon name="trash-2" size={13} />
                </button>
              </React.Fragment>
            )}
            <button className="adm-btn ghost mini" onClick={onChiudi} aria-label="Chiudi">
              <Icon name="x" size={14} />
              <span className="dip-solo-largo">Chiudi</span>
            </button>
          </span>
        </div>
        {/* Il segno che si può tirare: una gesture che nessuno vede non
            esiste. Sta fisso al bordo, non scorre col contenuto. */}
        {mobile && <span className="dip-tira" aria-hidden="true" />}
        <h2 className="dip-title" style={{ fontSize: "var(--fs-xl)" }}>{scheda.titolo}</h2>
        {img && <img src={img} alt="" style={{ width: "100%", marginTop: "14px", display: "block" }} />}
        {scheda.descrizione && <p className="dip-annuncio-corpo" style={{ marginTop: "14px" }}>{scheda.descrizione}</p>}
        {allegato && (
          <p style={{ marginTop: "14px" }}>
            <a className="adm-btn ghost" href={allegato} target="_blank" rel="noopener noreferrer">
              <Icon name="download" size={14} /> Apri l'allegato
            </a>
          </p>
        )}
        <p className="dip-sub" style={{ marginTop: "10px" }}>
          {dataIt(scheda.created_at)}
          {scheda.valida_a ? ` · valida fino al ${dataIt(scheda.valida_a)}` : ""}
        </p>
        <Filiali nomi={scheda.zone_nomi} />

        {!scheda.inoltrabile ? null : (
          <div style={{ marginTop: "24px" }}>
            <h3 className="dip-card-titolo">
              <Icon name="building-2" size={14} color="var(--cra-red)" /> I tuoi clienti
            </h3>
            <p className="dip-sub" style={{ marginBottom: "10px" }}>
              <b>Invia proposta</b> manda l'ordine su ordini@centroricambiautosrl.it con quantità,
              documento e note. L'invio vale accettazione — sei tu col cliente quando lo premi;
              il rifiuto è l'unica cosa che si dichiara a mano.
            </p>

            <AnimatePresence>
              {modulo?.tipo === "invio" && (() => {
                const c = (clienti ?? []).find((x) => x.officina_id === modulo.id);
                return c ? (
                  <FinestraInvio key="invio" cliente={c} scheda={scheda} tipi={tipiDoc}
                    busy={busy === modulo.id}
                    onAnnulla={() => setModulo(null)} onInvia={invia} />
                ) : null;
              })()}
            </AnimatePresence>

            {clienti === null ? <p className="dip-sub">Caricamento…</p>
              : clienti.length === 0 ? (
                <p className="dip-sub">
                  Non hai clienti in carico. Vai in <b>I miei clienti</b> e prendine qualcuno.
                </p>
              ) : (
                <React.Fragment>
                  <label className="adm-fld" style={{ marginBottom: "10px", maxWidth: "420px" }}>
                    <span>Cerca fra i tuoi clienti</span>
                    <input type="search" value={q} placeholder="nome, codice, città…"
                      onChange={(e) => setQ(e.target.value)} />
                  </label>
                  <div className="dip-tab-scroll">
                    <table className="dip-tabella a-schede">
                      <thead><tr><th>Cliente</th><th>Stato</th><th /></tr></thead>
                      <tbody>
                        {clienti
                          .filter((c) => {
                            const t = q.trim().toLowerCase();
                            return !t || `${c.ragione_sociale ?? ""} ${c.codice_cliente ?? ""} ${c.citta ?? ""}`.toLowerCase().includes(t);
                          })
                          .map((c) => (
                            <tr key={c.officina_id}>
                              <td>
                                {c.ragione_sociale}
                                <br /><span className="dip-sub">
                                  {c.codice_cliente ?? ""}{c.citta ? ` · ${c.citta}` : ""}
                                  {c.telefono ? ` · ${c.telefono}` : ""}
                                </span>
                              </td>
                              <td data-etichetta="Stato">
                                <span className={`dip-esito ${c.esito ?? ""}`}>{ETICHETTA_ESITO(c.esito)}</span>
                                {c.esito === "accettata" && c.quantita
                                  ? <span className="dip-sub"> · {c.quantita} pz</span> : null}
                                {c.esito === "accettata" && c.documento
                                  ? <span className="dip-sub"> · {c.documento}</span> : null}
                                {c.note ? <><br /><span className="dip-sub">{c.note}</span></> : null}
                              </td>
                              <td className="dip-tab-azioni" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                {modulo?.id === c.officina_id && modulo.tipo === "rifiuto" ? (
                                  <div className="dip-modulo">
                                    <label className="cresce">
                                      <span>Perché ha detto no?</span>
                                      <input type="text" value={modulo.note} autoFocus placeholder="facoltativo"
                                        onChange={(e) => setModulo((m) => ({ ...m, note: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") rifiuta();
                                          if (e.key === "Escape") setModulo(null);
                                        }} />
                                    </label>
                                    <button className="adm-btn mini rosso" disabled={busy === c.officina_id}
                                      onClick={() => rifiuta()}>
                                      {busy === c.officina_id ? "…" : "Registra il no"}
                                    </button>
                                    <button className="adm-btn ghost mini" onClick={() => setModulo(null)}>
                                      <Icon name="x" size={12} />
                                    </button>
                                  </div>
                                ) : c.esito ? (
                                  <button className="adm-btn ghost mini" disabled={busy === c.officina_id}
                                    onClick={() => annulla(c)}>
                                    <Icon name="refresh-cw" size={12} /> Riapri
                                  </button>
                                ) : (
                                  <React.Fragment>
                                    <button className="adm-btn mini" disabled={busy === c.officina_id}
                                      onClick={() => apriModulo(c, "invio")}>
                                      <Icon name="mail" size={12} /> Invia proposta
                                    </button>
                                    <button className="adm-btn ghost mini" style={{ marginLeft: "6px" }}
                                      disabled={busy === c.officina_id} onClick={() => apriModulo(c, "rifiuto")}>
                                      <Icon name="x" size={12} /> Rifiutata
                                    </button>
                                  </React.Fragment>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </React.Fragment>
              )}
          </div>
        )}
      </motion.aside>
    </React.Fragment>
  );
}

/* ============================================================
   I MIEI CLIENTI — quello che l'agente ha in mano.
   ============================================================ */
function MieiClienti({ setErr }) {
  const [righe, setRighe] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [cerca, setCerca] = useState("");
  const [trovate, setTrovate] = useState([]);
  const [apriAggiunta, setApriAggiunta] = useState(false);

  const carica = useCallback(async () => {
    setRighe(await api.getClientiAgente());
  }, []);
  useEffect(() => { carica().catch(() => setErr("Non riesco a leggere i tuoi clienti.")); }, [carica, setErr]);

  /* Ricerca nell'anagrafica, con l'attesa mentre si digita: sono migliaia
     di righe, una richiesta per lettera non ha senso. */
  useEffect(() => {
    if (!cerca.trim()) { setTrovate([]); return undefined; }
    let vivo = true;
    const t = setTimeout(() => {
      api.cercaOfficineLibere(cerca, 8)
        .then((r) => vivo && setTrovate(r))
        .catch(() => {});
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [cerca]);

  const gia = useMemo(() => new Set((righe ?? []).map((r) => r.officina_id)), [righe]);

  const prendi = async (o) => {
    /* Non si toglie più niente a nessuno: ci si aggiunge. Ma è giusto sapere
       prima che quel cliente lo lavora già qualcun altro — e che la cosa
       verrà detta a chi di dovere, così non la si scopre dopo. */
    if (o.seguito_da_altri && !o.e_mio && !window.confirm(
      `${o.ragione_sociale} lo segue già ${(o.agenti ?? []).join(", ") || "un collega"}.\n\n`
      + "Lo prendi anche tu? Non gli togli niente: lo vedete tutti e potete "
      + "mandargli proposte. Ad Alessandro arriva un avviso, così ne parlate.",
    )) return;
    setBusy(o.id);
    try {
      await api.prendiCliente(o.id);
      setCerca(""); setTrovate([]);
      await carica();
    } catch (e) { setErr(String(e?.message || "Non riesco a prendere in carico questo cliente.")); }
    finally { setBusy(null); }
  };

  const lascia = async (r) => {
    const altri = (r.condiviso_con ?? []).length;
    if (!window.confirm(
      `Lascio ${r.ragione_sociale}?\n\n`
      + (altri
        ? `Resta a ${r.condiviso_con.join(", ")}: esci solo tu. `
        : "Torna disponibile per chiunque. ")
      + "Gli esiti già registrati restano.",
    )) return;
    setBusy(r.officina_id);
    try { await api.lasciaCliente(r.officina_id); await carica(); }
    catch { setErr("Non riesco a lasciare questo cliente."); }
    finally { setBusy(null); }
  };

  const viste = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return righe ?? [];
    return (righe ?? []).filter((r) =>
      `${r.ragione_sociale ?? ""} ${r.codice_cliente ?? ""} ${r.citta ?? ""} ${r.piva ?? ""}`
        .toLowerCase().includes(t));
  }, [righe, q]);

  if (!righe) return <p className="dip-vuoto">Caricamento…</p>;

  return (
    <React.Fragment>
      <p className="dip-regola">
        Il tuo portafoglio: i clienti che segui tu. Un cliente può essere seguito
        anche da un collega — capita, e non toglie niente a nessuno: si vede
        scritto sulla riga. Le promozioni non si assegnano cliente per cliente:
        <b> aprendo una promozione nel Card Center trovi questo elenco</b> e scegli
        a chi mandarla.
      </p>

      <div className="adm-form">
        <button className="adm-btn ghost" style={{ alignSelf: "flex-start" }}
          onClick={() => setApriAggiunta((v) => !v)}>
          <Icon name={apriAggiunta ? "chevron-up" : "plus"} size={14} /> Prendi in carico un cliente
        </button>
        <AnimatePresence>
          {apriAggiunta && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
              <label className="adm-fld" style={{ marginTop: "12px", maxWidth: "480px" }}>
                <span>Cerca in anagrafica</span>
                <input type="search" value={cerca} placeholder="nome, codice cliente o partita IVA…"
                  onChange={(e) => setCerca(e.target.value)} />
              </label>
              {cerca.trim() && trovate.length === 0 && (
                <p className="dip-sub" style={{ marginTop: "8px" }}>
                  Nessun cliente con «{cerca.trim()}» nel nome, nel codice, nella città o nella
                  partita IVA. Prova con meno lettere: la ricerca cerca il pezzo esatto.
                </p>
              )}
              {/* Un risultato per riga, col pulsante che sul telefono prende
                  tutta la larghezza: prendere un cliente è il gesto che si fa
                  in piedi davanti a un'officina, non seduti alla scrivania. */}
              {trovate.map((o, i) => (
                <motion.div key={o.id} className="dip-trovato" {...entra(i)}>
                  <span className="dip-trovato-chi">
                    <b>{o.ragione_sociale}</b>
                    <span className="dip-sub">
                      {o.codice_cliente ?? "—"}{o.citta ? ` · ${o.citta}` : ""}{o.provincia ? ` (${o.provincia})` : ""}
                    </span>
                  </span>
                  {/* Tre situazioni, tre risposte. Prima ce n'era una sola:
                      i clienti già affidati non uscivano nemmeno dalla
                      ricerca, e il pannello diceva «nessun cliente trovato»
                      di uno che c'era. */}
                  {gia.has(o.id) || o.e_mio
                    ? <span className="dip-esito accettata">già tuo</span>
                    : o.seguito_da_altri
                      ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span className="dip-sub">lo segue <b>{(o.agenti ?? []).join(", ") || "un collega"}</b></span>
                          <button className="adm-btn ghost mini" disabled={busy === o.id}
                            onClick={() => prendi(o)}>
                            <Icon name="plus" size={13} /> {busy === o.id ? "Prendo…" : "Prendilo anche tu"}
                          </button>
                        </span>
                      )
                      : (
                        <button className="adm-btn" disabled={busy === o.id} onClick={() => prendi(o)}>
                          <Icon name="plus" size={14} /> {busy === o.id ? "Prendo…" : "Prendi in carico"}
                        </button>
                      )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Come nel Card Center: l'ancora del giro sta sul contenitore, così
          esiste anche per chi non ha ancora nessun cliente. */}
      <div data-giro="clienti">
        {righe.length === 0 ? (
          <p className="dip-vuoto">Non hai ancora clienti. Usa «Prendi in carico un cliente» qui sopra.</p>
        ) : (
          <React.Fragment>
            <div className="adm-filtri">
              <input type="search" value={q} placeholder="Cerca fra i tuoi clienti…"
                onChange={(e) => setQ(e.target.value)} />
              <span className="dip-sub" style={{ marginLeft: "auto" }}>
                {viste.length} di {righe.length} client{righe.length === 1 ? "e" : "i"}
              </span>
            </div>
            <div className="dip-tab-scroll">
              {/* `a-schede`: sul telefono ogni riga diventa una scheda con le
                  etichette accanto ai valori. Cinque colonne su 390 pixel non
                  si leggono, e scorrere di lato per vedere il telefono di un
                  cliente è un lavoro, non una consultazione. */}
              <table className="dip-tabella a-schede">
                <thead><tr><th>Cliente</th><th>Codice</th><th>Dove</th><th>Contatti</th><th /></tr></thead>
                <tbody>
                  {viste.map((r, i) => (
                    <motion.tr key={r.officina_id} {...entra(i)}>
                      <td>
                        {r.ragione_sociale}
                        {/* Sapere che un cliente lo lavora anche un collega
                            cambia come ci si va: meglio leggerlo qui che
                            scoprirlo davanti all'officina. */}
                        {(r.condiviso_con ?? []).length > 0 && (
                          <span className="dip-sub" style={{ display: "block" }}>
                            <Icon name="users" size={11} /> anche {r.condiviso_con.join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="dip-sub" data-etichetta="Codice">{r.codice_cliente || "—"}</td>
                      <td className="dip-sub" data-etichetta="Dove">
                        {r.citta || "—"}{r.provincia ? ` (${r.provincia})` : ""}
                      </td>
                      <td className="dip-sub" data-etichetta="Contatti">
                        {r.telefono
                          ? <a href={`tel:${String(r.telefono).replace(/\s+/g, "")}`}>{r.telefono}</a>
                          : "—"}
                        {r.email ? <br /> : null}
                        {r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : ""}
                      </td>
                      <td className="dip-tab-azioni" style={{ textAlign: "right" }}>
                        <button className="adm-btn rosso mini" disabled={busy === r.officina_id}
                          onClick={() => lascia(r)} aria-label={`Lascia ${r.ragione_sociale}`}>
                          <Icon name="x" size={12} /> Lascia
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </React.Fragment>
        )}
      </div>
    </React.Fragment>
  );
}

/* ============================================================
   STATISTICHE — conversione e rendimento. Barre in CSS, niente
   librerie di grafici: per queste viste non aggiungono nulla.
   ============================================================ */
const euro = (n) => new Intl.NumberFormat("it-IT", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
}).format(Number(n) || 0);
const numero = (n) => new Intl.NumberFormat("it-IT").format(Number(n) || 0);
const iso = (d) => d.toISOString().slice(0, 10);

const pct = (n) => (n == null ? "—" : `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(n)}%`);
const meseCorto = (s) => new Date(s).toLocaleDateString("it-IT", { month: "short" });
const annoDi = (s) => new Date(s).getFullYear();

/* I periodi si contano all'indietro da oggi: «12 mesi» sono gli ultimi
   dodici, non l'anno solare — è quello che si guarda davvero. */
const PERIODI = [
  { id: "mese", nome: "Mese corrente" },
  { id: "scorso", nome: "Mese scorso" },
  { id: "3", nome: "3 mesi" },
  { id: "6", nome: "6 mesi" },
  { id: "12", nome: "12 mesi" },
  { id: "anno", nome: "Quest'anno" },
  { id: "tutto", nome: "Tutto" },
];

function estremi(periodo, da, a) {
  const oggi = new Date();
  if (periodo === "libero") return { dal: da || null, al: a || null };
  if (periodo === "tutto") return { dal: null, al: null };
  if (periodo === "anno") return { dal: `${oggi.getFullYear()}-01-01`, al: iso(oggi) };
  if (periodo === "mese") {
    return { dal: iso(new Date(oggi.getFullYear(), oggi.getMonth(), 1)), al: iso(oggi) };
  }
  if (periodo === "scorso") {
    return {
      dal: iso(new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1)),
      al: iso(new Date(oggi.getFullYear(), oggi.getMonth(), 0)),
    };
  }
  const inizio = new Date(oggi);
  inizio.setMonth(inizio.getMonth() - Number(periodo));
  return { dal: iso(inizio), al: iso(oggi) };
}

/* Il periodo precedente della stessa lunghezza: è il confronto che dà senso
   ai numeri. Senza «rispetto a cosa», un fatturato è solo una cifra. */
function periodoPrima({ dal, al }) {
  if (!dal || !al) return null;
  const d = new Date(dal), a = new Date(al);
  const giorni = Math.max(1, Math.round((a - d) / 86400000) + 1);
  const fine = new Date(d); fine.setDate(fine.getDate() - 1);
  const inizio = new Date(fine); inizio.setDate(inizio.getDate() - giorni + 1);
  return { dal: iso(inizio), al: iso(fine) };
}

function Delta({ ora, prima, soldi }) {
  if (prima == null || prima === 0 || ora == null) return null;
  const d = ((ora - prima) / Math.abs(prima)) * 100;
  if (!Number.isFinite(d) || Math.abs(d) < 0.5) return <span className="dip-delta pari">=</span>;
  const su = d > 0;
  return (
    <span className={`dip-delta ${su ? "su" : "giu"}`}
      title={`prima: ${soldi ? euro(prima) : numero(prima)}`}>
      {su ? "▲" : "▼"} {Math.abs(Math.round(d))}%
    </span>
  );
}

function Kpi({ etichetta, valore, nota, forte, ora, prima, soldi }) {
  return (
    <motion.div className={`dip-kpi ${forte ? "forte" : ""}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <span className="dip-kpi-eti">{etichetta}</span>
      <b className="dip-kpi-val">{valore}</b>
      <span className="dip-kpi-nota">
        {nota}{nota && prima != null ? " · " : ""}
        <Delta ora={ora} prima={prima} soldi={soldi} />
      </span>
    </motion.div>
  );
}

/* Andamento nel tempo: colonne per il valore proposto, due linee per il
   numero di sì e di no. Due scale diverse sullo stesso disegno, perché sono
   due domande diverse — quanto ho proposto, e quanto spesso mi hanno detto sì.
   Disegnato a mano in SVG: aggiungere una libreria di grafici per questo
   sarebbe mezzo megabyte per sei rettangoli. */
function GraficoAndamento({ mesi }) {
  if (!mesi.length) return <p className="dip-vuoto">Nessun dato nel periodo.</p>;
  const W = 900, H = 300, PL = 62, PR = 46, PT = 18, PB = 34;
  const gw = W - PL - PR, gh = H - PT - PB;
  const maxV = Math.max(1, ...mesi.map((m) => m.valore));
  const maxN = Math.max(1, ...mesi.map((m) => Math.max(m.accettate, m.rifiutate)));
  const passo = gw / mesi.length;
  const larg = Math.min(46, passo * 0.55);
  const x = (i) => PL + passo * i + passo / 2;
  const yV = (v) => PT + gh - (v / maxV) * gh;
  const yN = (n) => PT + gh - (n / maxN) * gh;
  const linea = (chiave) => mesi.map((m, i) => `${x(i)},${yN(m[chiave])}`).join(" ");
  const tacche = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="dip-graf-box">
      <svg viewBox={`0 0 ${W} ${H}`} className="dip-svg" role="img"
        aria-label="Andamento mensile del valore proposto e degli esiti">
        {tacche.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={PT + gh - t * gh} y2={PT + gh - t * gh}
              stroke="var(--border-subtle, #e2e0da)" strokeWidth="1" />
            <text x={PL - 8} y={PT + gh - t * gh + 4} textAnchor="end" className="dip-svg-asse">
              {euro(maxV * t)}
            </text>
            <text x={W - PR + 8} y={PT + gh - t * gh + 4} className="dip-svg-asse">
              {Math.round(maxN * t)}
            </text>
          </g>
        ))}
        {mesi.map((m, i) => {
          const h = gh - (yV(m.valore) - PT);
          const hm = m.valore ? (m.margine / m.valore) * h : 0;
          return (
            <g key={m.mese}>
              <title>
                {`${meseCorto(m.mese)} ${annoDi(m.mese)} — ${euro(m.valore)} proposti, ${euro(m.margine)} di margine · ${m.accettate} sì · ${m.rifiutate} no · ${m.pezzi} pezzi · ${m.clienti} clienti`}
              </title>
              <motion.rect x={x(i) - larg / 2} width={larg} fill="var(--cra-red)" opacity="0.9"
                initial={{ y: PT + gh, height: 0 }}
                animate={{ y: yV(m.valore), height: Math.max(1, h) }}
                transition={{ duration: 0.5, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }} />
              <motion.rect x={x(i) - larg / 2} width={larg} fill="var(--cra-gold)"
                initial={{ y: PT + gh, height: 0 }}
                animate={{ y: PT + gh - hm, height: Math.max(0, hm) }}
                transition={{ duration: 0.5, delay: i * 0.03 + 0.05, ease: [0.16, 1, 0.3, 1] }} />
              <text x={x(i)} y={H - 12} textAnchor="middle" className="dip-svg-asse">
                {meseCorto(m.mese)}
                {(i === 0 || annoDi(m.mese) !== annoDi(mesi[i - 1].mese)) && (
                  <tspan className="dip-svg-anno"> {String(annoDi(m.mese)).slice(2)}</tspan>
                )}
              </text>
            </g>
          );
        })}
        <motion.polyline points={linea("accettate")} fill="none" stroke="#2E7D4F" strokeWidth="2.5"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7 }} />
        <motion.polyline points={linea("rifiutate")} fill="none" stroke="#4A5150" strokeWidth="2"
          strokeDasharray="5 4"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.1 }} />
        {mesi.map((m, i) => (
          <circle key={m.mese} cx={x(i)} cy={yN(m.accettate)} r="3.5" fill="#2E7D4F" />
        ))}
      </svg>
      <p className="dip-legenda">
        <span><i className="q rosso" /> valore proposto</span>
        <span><i className="q oro" /> di cui margine</span>
        <span><i className="q verde" /> proposte accettate</span>
        <span><i className="q grigio" /> rifiutate</span>
        <span className="dip-sub">scala € a sinistra, conteggi a destra</span>
      </p>
    </div>
  );
}

/* Quanti sì su quanti tentativi, in un colpo d'occhio. */
function Ciambella({ ok, ko }) {
  const tot = ok + ko;
  const quota = tot ? ok / tot : 0;
  const r = 54, c = 2 * Math.PI * r;
  return (
    <div className="dip-ciambella">
      <svg viewBox="0 0 140 140" role="img" aria-label={`${ok} accettate su ${tot}`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface-subtle, #f2f1ed)" strokeWidth="18" />
        <motion.circle cx="70" cy="70" r={r} fill="none" stroke="#2E7D4F" strokeWidth="18"
          strokeDasharray={c} transform="rotate(-90 70 70)" strokeLinecap="butt"
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - quota) }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
        <text x="70" y="66" textAnchor="middle" className="dip-ciambella-val">{pct(quota * 100)}</text>
        <text x="70" y="86" textAnchor="middle" className="dip-svg-asse">incidenza</text>
      </svg>
      <p className="dip-sub" style={{ textAlign: "center", margin: 0 }}>
        <b>{numero(ok)}</b> sì · {numero(ko)} no
      </p>
    </div>
  );
}

const ORDINI_AGENTE = [
  { id: "valore", nome: "Fatturato" },
  { id: "accettate", nome: "Accettate" },
  { id: "rifiutate", nome: "Rifiutate" },
  { id: "incidenza", nome: "Incidenza" },
  { id: "rendimento", nome: "Rendimento" },
];

function Statistiche({ setErr, puoGestire }) {
  const [periodo, setPeriodo] = useState("12");
  const [da, setDa] = useState("");
  const [a, setA] = useState("");
  const [agente, setAgente] = useState("");
  const [scheda, setScheda] = useState("");
  const [ordine, setOrdine] = useState("valore");
  const [pagina, setPagina] = useState(0);
  const [perPagina, setPerPagina] = useState(25);

  const [voci, setVoci] = useState({ agenti: [], promozioni: [] });
  const [d, setD] = useState(null);
  const [prima, setPrima] = useState(null);
  const [mov, setMov] = useState({ righe: [], totale: 0 });
  const [caricando, setCaricando] = useState(true);

  const filtri = useMemo(() => ({
    ...estremi(periodo, da, a),
    agente: agente || null,
    scheda: scheda || null,
  }), [periodo, da, a, agente, scheda]);

  useEffect(() => { api.getStatFiltri().then(setVoci).catch(() => {}); }, []);
  useEffect(() => { setPagina(0); }, [periodo, da, a, agente, scheda]);

  useEffect(() => {
    let vivo = true;
    setCaricando(true);
    const indietro = periodoPrima(filtri);
    Promise.all([
      api.getStat(filtri),
      indietro ? api.getRiepilogo({ ...filtri, ...indietro }) : Promise.resolve(null),
    ])
      .then(([x, p]) => { if (vivo) { setD(x); setPrima(p); setCaricando(false); } })
      .catch(() => { if (vivo) { setCaricando(false); setErr("Non riesco a calcolare le statistiche."); } });
    return () => { vivo = false; };
  }, [filtri, periodo, setErr]);

  useEffect(() => { setPagina(0); }, [perPagina]);

  useEffect(() => {
    let vivo = true;
    api.getMovimenti(filtri, perPagina, pagina * perPagina)
      .then((m) => vivo && setMov(m))
      .catch(() => {});
    return () => { vivo = false; };
  }, [filtri, pagina, perPagina]);

  const agenti = useMemo(() => {
    const v = [...(d?.agenti ?? [])];
    v.sort((x, y) => (y[ordine] ?? 0) - (x[ordine] ?? 0));
    return v;
  }, [d, ordine]);

  /* Ogni elenco ha le sue pagine: il numero di promozioni non ha niente a
     che vedere col numero di clienti. */
  const pgAgenti = usePagina(agenti);
  const pgPromo = usePagina(d?.promozioni ?? []);
  const pgClienti = usePagina(d?.clienti ?? []);

  const esporta = async () => {
    try {
      const tutto = await api.getMovimenti(filtri, 1000, 0);
      api.downloadCsv(`proposte-${filtri.dal ?? "inizio"}_${filtri.al ?? "oggi"}.csv`,
        api.movimentiToCsv(tutto.righe));
    } catch { setErr("Non riesco a preparare il file."); }
  };

  if (!d) return <p className="dip-vuoto">Caricamento…</p>;
  const r = d.riepilogo;
  const maxOrd = Math.max(1, ...agenti.map((x) => Math.abs(x[ordine] ?? 0)));
  /* I movimenti sono migliaia: le pagine le fa il database, non il browser. */
  const pgMov = {
    totale: mov.totale, quanti: perPagina, setQuanti: setPerPagina,
    pagina, setPagina, pagine: Math.max(1, Math.ceil(mov.totale / perPagina)),
    primo: mov.totale ? pagina * perPagina + 1 : 0,
    ultimo: Math.min(mov.totale, (pagina + 1) * perPagina),
  };

  return (
    <React.Fragment>
      {/* ---- filtri ---- */}
      <div className="dip-barra-filtri">
        <div className="dip-filtro-periodo">
          {PERIODI.map((p) => (
            <button key={p.id} className={`adm-tab ${periodo === p.id ? "attivo" : ""}`}
              onClick={() => setPeriodo(p.id)}>{p.nome}</button>
          ))}
          <button className={`adm-tab ${periodo === "libero" ? "attivo" : ""}`}
            onClick={() => setPeriodo("libero")}>Da… a…</button>
        </div>

        <div className="dip-filtro-riga">
          {periodo === "libero" && (
            <React.Fragment>
              <label className="dip-campo">
                <span>Dal</span>
                <input type="date" value={da} onChange={(e) => setDa(e.target.value)} />
              </label>
              <label className="dip-campo">
                <span>Al</span>
                <input type="date" value={a} onChange={(e) => setA(e.target.value)} />
              </label>
            </React.Fragment>
          )}
          {voci.agenti.length > 1 && (
            <label className="dip-campo">
              <span>Agente</span>
              {/* Per chi gestisce, «Tutti» è tutta la rete. Per un area
                  manager sono lui e i suoi: chiamarlo «Tutti» gli farebbe
                  credere di star guardando numeri che non sono i suoi. */}
              <select value={agente} onChange={(e) => setAgente(e.target.value)}>
                <option value="">{puoGestire ? "Tutti" : "Io e la mia squadra"}</option>
                {voci.agenti.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </label>
          )}
          <label className="dip-campo cresce">
            <span>Promozione</span>
            <select value={scheda} onChange={(e) => setScheda(e.target.value)}>
              <option value="">Tutte</option>
              {voci.promozioni.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </label>
          <button className="adm-btn ghost" onClick={esporta} disabled={!r.proposte}>
            <Icon name="download" size={14} /> Esporta CSV
          </button>
          {caricando && <span className="dip-sub">aggiorno…</span>}
        </div>
      </div>

      <p className="dip-regola">
        Si conta la <b>proposta</b>: una riga per ogni volta che una promozione è partita verso un
        cliente. Il <b>valore</b> è quantità × prezzo, congelato al momento dell'invio; il
        <b> margine</b> è quel che resta tolto il costo. Il confronto in piccolo è col periodo
        precedente di pari durata.
      </p>

      {r.proposte === 0 ? (
        <p className="dip-vuoto">Nessuna proposta con questi filtri.</p>
      ) : (
        <React.Fragment>
          <div className="dip-kpi-riga">
            <Kpi etichetta="Fatturato proposto" valore={euro(r.valore)} forte soldi
              nota={`scontrino ${r.scontrino ? euro(r.scontrino) : "—"}`}
              ora={r.valore} prima={prima?.valore} />
            <Kpi etichetta="Margine" valore={euro(r.margine)} soldi
              nota={`${pct(r.margine_pct)} sul venduto`}
              ora={r.margine} prima={prima?.margine} />
            <Kpi etichetta="Proposte" valore={numero(r.proposte)}
              nota={`${r.accettate} sì · ${r.rifiutate} no`}
              ora={r.proposte} prima={prima?.proposte} />
            <Kpi etichetta="Incidenza" valore={pct(r.incidenza)}
              nota="accettate sul totale"
              ora={r.incidenza} prima={prima?.incidenza} />
            <Kpi etichetta="Clienti serviti" valore={numero(r.clienti)}
              nota={`${pct(r.copertura)} del portafoglio (${numero(r.portafoglio)})`}
              ora={r.clienti} prima={prima?.clienti} />
            <Kpi etichetta="Pezzi" valore={numero(r.pezzi)}
              nota={`${numero(r.promozioni)} promozioni · ${numero(r.agenti)} agenti`}
              ora={r.pezzi} prima={prima?.pezzi} />
          </div>

          {/* ---- andamento ---- */}
          <h2 className="dip-card-titolo">
            <Icon name="history" size={14} color="var(--cra-red)" /> Andamento mese per mese
          </h2>
          <div className="dip-due">
            <GraficoAndamento mesi={d.mesi} />
            <div className="dip-graf-box">
              <Ciambella ok={r.accettate} ko={r.rifiutate} />
              <dl className="dip-scheda-dati">
                <div><dt>Scontrino medio</dt><dd>{r.scontrino ? euro(r.scontrino) : "—"}</dd></div>
                <div><dt>Costo del venduto</dt><dd>{euro(r.costo)}</dd></div>
                <div><dt>Copertura portafoglio</dt><dd>{pct(r.copertura)}</dd></div>
              </dl>
            </div>
          </div>

          {/* ---- agenti ---- */}
          <div className="dip-titolo-riga">
            <h2 className="dip-card-titolo">
              <Icon name="users" size={14} color="var(--cra-red)" /> Classifica agenti
            </h2>
            <div className="dip-filtro-periodo">
              {ORDINI_AGENTE.map((o) => (
                <button key={o.id} className={`adm-tab ${ordine === o.id ? "attivo" : ""}`}
                  onClick={() => setOrdine(o.id)}>{o.nome}</button>
              ))}
            </div>
          </div>
          <div className="dip-graf-box">
            {agenti.map((x, i) => (
              <motion.div className="dip-rank" key={x.dipendente_id} {...entra(i)}>
                <span className="dip-rank-pos">{i + 1}</span>
                <span className="dip-rank-nome">
                  {x.agente || "—"}<em>{x.filiale || "—"}</em>
                </span>
                <span className="dip-rank-barra">
                  <motion.i initial={{ width: 0 }}
                    animate={{ width: `${(Math.abs(x[ordine] ?? 0) / maxOrd) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }} />
                </span>
                <b className="dip-rank-val">
                  {ordine === "incidenza" ? pct(x.incidenza)
                    : ordine === "rendimento" ? euro(x.rendimento)
                      : ordine === "valore" ? euro(x.valore) : numero(x[ordine])}
                </b>
              </motion.div>
            ))}
          </div>
          <details className="dip-dettaglio">
            <summary>Tutti i numeri per agente</summary>
            <div className="dip-tab-scroll">
              <TabellaSchede>
                <thead><tr>
                  <th>Agente</th><th>Filiale</th><th className="dip-num">In carico</th>
                  <th className="dip-num">Sì</th><th className="dip-num">No</th>
                  <th className="dip-num">Incidenza</th><th className="dip-num">Clienti</th>
                  <th className="dip-num">Pezzi</th><th className="dip-num">Fatturato</th>
                  <th className="dip-num">Quota</th><th className="dip-num">Margine</th>
                  <th className="dip-num">ROI</th><th className="dip-num">Scontrino</th>
                  <th className="dip-num">Rendimento</th>
                </tr></thead>
                <tbody>
                  {pgAgenti.viste.map((x) => (
                    <tr key={x.dipendente_id}>
                      <td>{x.agente || "—"}</td>
                      <td><span className="dip-sub">{x.filiale || "—"}</span></td>
                      <td className="dip-num">{x.in_carico}</td>
                      <td className="dip-num">{x.accettate}</td>
                      <td className="dip-num">{x.rifiutate}</td>
                      <td className="dip-num">{pct(x.incidenza)}</td>
                      <td className="dip-num">{x.clienti}</td>
                      <td className="dip-num">{x.pezzi || "—"}</td>
                      <td className="dip-num"><b>{euro(x.valore)}</b></td>
                      <td className="dip-num">{pct(x.quota)}</td>
                      <td className="dip-num">{euro(x.margine)}</td>
                      <td className="dip-num">{pct(x.roi)}</td>
                      <td className="dip-num">{x.scontrino ? euro(x.scontrino) : "—"}</td>
                      <td className="dip-num">{x.rendimento ? euro(x.rendimento) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </TabellaSchede>
            </div>
            <Paginatore p={pgAgenti} nome="agenti" />
            <p className="dip-sub" style={{ marginTop: "8px" }}>
              Il <b>rendimento</b> è lo scontrino medio pesato sul numero di ordini: dieci ordini da
              100 € valgono più di uno solo da 100 €. Serve un minimo di <b>3 accettate</b> per
              entrare in classifica. Il <b>ROI</b> è il margine sul costo della merce.
            </p>
          </details>

          {/* ---- promozioni ---- */}
          <h2 className="dip-card-titolo" style={{ marginTop: "var(--space-6)" }}>
            <Icon name="tag" size={14} color="var(--cra-red)" /> Riepilogo promozioni
          </h2>
          <div className="dip-tab-scroll">
            <TabellaSchede>
              <thead><tr>
                <th>Promozione</th><th className="dip-num">Clienti</th>
                <th className="dip-num">Sì</th><th className="dip-num">No</th>
                <th className="dip-num">Incidenza</th><th className="dip-num">Pezzi</th>
                <th className="dip-num">Prezzo</th><th className="dip-num">Fatturato</th>
                <th className="dip-num">Margine</th><th>Esito</th>
              </tr></thead>
              <tbody>
                {pgPromo.viste.map((s, i) => (
                  <motion.tr key={s.scheda_id} {...entra(i)}>
                    <td>{s.titolo}<br /><span className="dip-sub">{dataIt(s.quando)}</span></td>
                    <td className="dip-num">{s.clienti}</td>
                    <td className="dip-num">{s.accettate}</td>
                    <td className="dip-num">{s.rifiutate || "—"}</td>
                    <td className="dip-num">{pct(s.incidenza)}</td>
                    <td className="dip-num">{s.pezzi || "—"}</td>
                    <td className="dip-num"><span className="dip-sub">{s.prezzo ? euro(s.prezzo) : "—"}</span></td>
                    <td className="dip-num"><b>{euro(s.valore)}</b></td>
                    <td className="dip-num">{euro(s.margine)}</td>
                    <td>
                      <span className={`dip-esito ${s.riuscita ? "accettata" : ""}`}>
                        {s.riuscita ? "riuscita" : "sotto soglia"}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </TabellaSchede>
          </div>
          <Paginatore p={pgPromo} nome="promozioni" />
          <p className="dip-sub" style={{ marginTop: "8px" }}>
            «Riuscita» vuol dire più di un quarto di sì <b>e</b> almeno 150 € di margine: sotto,
            la promozione non ha ripagato la fatica di girarla.
          </p>

          {/* ---- clienti ---- */}
          <h2 className="dip-card-titolo" style={{ marginTop: "var(--space-6)" }}>
            <Icon name="building-2" size={14} color="var(--cra-red)" /> I clienti che comprano di più
          </h2>
          <div className="dip-tab-scroll">
            <TabellaSchede>
              <thead><tr>
                <th>Cliente</th><th className="dip-num">Sì</th><th className="dip-num">No</th>
                <th className="dip-num">Pezzi</th><th className="dip-num">Fatturato</th>
                <th className="dip-num">Margine</th><th>Ultima</th>
              </tr></thead>
              <tbody>
                {pgClienti.viste.map((c, i) => (
                  <motion.tr key={c.officina_id} {...entra(i)}>
                    <td>
                      {c.cliente}
                      <br /><span className="dip-sub">{c.codice} · {c.citta || "—"}</span>
                    </td>
                    <td className="dip-num">{c.accettate}</td>
                    <td className="dip-num">{c.rifiutate || "—"}</td>
                    <td className="dip-num">{c.pezzi || "—"}</td>
                    <td className="dip-num"><b>{euro(c.valore)}</b></td>
                    <td className="dip-num">{euro(c.margine)}</td>
                    <td><span className="dip-sub">{dataIt(c.ultima)}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </TabellaSchede>
          </div>
          <Paginatore p={pgClienti} nome="clienti" />

          {/* ---- movimenti ---- */}
          <h2 className="dip-card-titolo" style={{ marginTop: "var(--space-6)" }}>
            <Icon name="file-text" size={14} color="var(--cra-red)" /> Movimenti
            <span className="dip-sub" style={{ marginLeft: "8px" }}>{numero(mov.totale)}</span>
          </h2>
          <div className="dip-tab-scroll">
            <TabellaSchede>
              <thead><tr>
                <th>Data</th><th>Cliente</th><th>Promozione</th><th>Agente</th>
                <th className="dip-num">Q.tà</th><th className="dip-num">Valore</th><th>Esito</th>
              </tr></thead>
              <tbody>
                {mov.righe.map((m, i) => (
                  <motion.tr key={m.id} {...entra(i)}>
                    <td><span className="dip-sub">{dataIt(m.quando)}</span></td>
                    <td>{m.cliente}<br /><span className="dip-sub">{m.codice}</span></td>
                    <td>{m.promozione}
                      {m.note && <><br /><span className="dip-sub">{m.note}</span></>}</td>
                    <td><span className="dip-sub">{m.agente || "—"}</span></td>
                    <td className="dip-num">{m.quantita}</td>
                    <td className="dip-num">{euro(m.valore)}</td>
                    <td>
                      <span className={`dip-esito ${m.esito}`}>{m.esito}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </TabellaSchede>
          </div>
          <Paginatore p={pgMov} nome="movimenti" />
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

/* ============================================================
   PROFILO — la propria scheda e i traguardi.

   I traguardi si calcolano dal lavoro vero: nessun punteggio inventato,
   nessuna gara con gli altri. Si vede solo la propria strada, e ogni
   famiglia ha quattro gradini — così c'è sempre un prossimo passo senza
   che il primo sia irraggiungibile.
   ============================================================ */
const GRADI = ["Bronzo", "Argento", "Oro", "Platino"];

/* Due famiglie di traguardi.
 *
 *   «mestiere»  — li vede chi vende: rappresentanti, manager, admin.
 *   «casa»      — li vede chiunque: esserci, informarsi, tenere in ordine
 *                 la propria scheda. Un magazziniere o il centralino non
 *                 hanno un fatturato, ma hanno una partecipazione — e se il
 *                 gioco premia solo chi vende, per loro non è un gioco.
 *
 * Ogni famiglia ha quattro gradini, così c'è sempre un passo successivo. */
/* La scala vive nel DATABASE (tabella `traguardi`), non qui. Il motivo è che
   solo il database può datare una conquista e verificarla: se le soglie
   stessero nel sito, una medaglia sarebbe un'affermazione del browser.
   La funzione `miei_traguardi()` restituisce già la scala filtrata per ruolo,
   il valore raggiunto, il grado e la data. */
const VENDONO = ["admin", "manager", "finanza", "rappresentante"];

function Traguardo({ t, i }) {
  const mostra = (v) => (t.formato === "soldi" ? euro(v) : t.formato === "percento" ? pct(v) : numero(v));
  const massimo = t.soglie?.length ?? 1;
  const quota = t.prossima != null
    ? Math.min(1, Math.max(0, (t.valore - t.base) / (t.prossima - t.base)))
    : 1;
  return (
    <motion.div className={`dip-badge ${t.grado > 0 ? "preso" : ""}`}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}>
      <span className={`dip-badge-bollo g${t.grado}`}>
        <Icon name={t.icona} size={18} color={t.grado > 0 ? "var(--cra-white)" : "var(--text-muted)"} />
      </span>
      <span className="dip-badge-testo">
        <b>
          {t.nome}
          {t.grado > 0 && <em>{massimo > 1 ? GRADI[t.grado - 1] : "conquistato"}</em>}
        </b>
        <span className="dip-sub">{t.descrizione}</span>
        <span className="dip-badge-barra">
          <motion.i initial={{ width: 0 }} animate={{ width: `${quota * 100}%` }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} />
        </span>
        <span className="dip-sub">
          {t.bloccato
            ? "serve un minimo di proposte per entrare in gara"
            : t.prossima != null
              ? `${mostra(t.valore)} — prossimo gradino a ${mostra(t.prossima)}`
              : `${mostra(t.valore)} — al massimo`}
        </span>
        {/* La data della conquista: un premio senza quando è solo un'icona. */}
        {t.conquistato_il && (
          <span className="dip-sub">conquistato il {dataIt(t.conquistato_il)}</span>
        )}
      </span>
    </motion.div>
  );
}

function Profilo({ dipendente, ruolo, setErr, schedeVisibili = [], rivediGiro }) {
  const [scheda, setScheda] = useState(null);
  const [numeri, setNumeri] = useState(null);
  const [traguardi, setTraguardi] = useState([]);
  const [squadra, setSquadra] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [salvato, setSalvato] = useState(false);
  const avatar = useUrlFirmato(scheda?.avatar_url);

  const carica = useCallback(async () => {
    const [s, n, tg, sq] = await Promise.all([
      api.getMioProfilo(dipendente?.id), api.getMieiNumeri(),
      api.getTraguardi(), api.getTraguardiFiliale(),
    ]);
    setScheda(s);
    setNumeri(n);
    setTraguardi(tg);
    setSquadra(sq);
    setForm({ telefono: s?.telefono ?? "", motto: s?.motto ?? "",
      avatar_url: s?.avatar_url ?? "", avvio: s?.avvio ?? "" });
  }, [dipendente]);
  useEffect(() => { carica().catch(() => setErr("Non riesco a leggere il tuo profilo.")); }, [carica, setErr]);

  const caricaAvatar = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await api.caricaFile(file, "avatar");
      setForm((f) => ({ ...f, avatar_url: path }));
      await api.salvaProfilo({ ...form, avatar_url: path });
      await carica();
    } catch { setErr("Non riesco a caricare l'immagine."); }
    finally { setBusy(false); }
  };

  const salva = async () => {
    setBusy(true);
    try {
      await api.salvaProfilo(form);
      await carica();
      setSalvato(true);
      setTimeout(() => setSalvato(false), 1800);
    } catch { setErr("Non riesco a salvare il profilo."); }
    finally { setBusy(false); }
  };

  if (!scheda || !numeri) return <p className="dip-vuoto">Caricamento…</p>;

  const nome = `${scheda.nome ?? ""} ${scheda.cognome ?? ""}`.trim() || scheda.email;
  const iniziali = `${(scheda.nome ?? "?")[0] ?? ""}${(scheda.cognome ?? "")[0] ?? ""}`.toUpperCase();
  const presi = traguardi.filter((t) => t.grado > 0).length;
  const vende = VENDONO.includes(numeri.ruolo ?? ruolo);

  return (
    <React.Fragment>
      <div className="dip-profilo" data-giro="profilo">
        <div className="dip-profilo-testa">
          <label className="dip-avatar" title="Cambia immagine">
            {avatar ? <img src={avatar} alt="" /> : <span>{iniziali || "—"}</span>}
            <input type="file" accept="image/*" hidden disabled={busy}
              onChange={(e) => caricaAvatar(e.target.files?.[0])} />
            <span className="dip-avatar-cambia"><Icon name="image-plus" size={14} color="var(--cra-white)" /></span>
          </label>
          <div className="dip-profilo-chi">
            <h2 className="dip-title" style={{ fontSize: "var(--fs-xl)", margin: 0 }}>{nome}</h2>
            <span className="dip-sub">
              {RUOLI[ruolo] ?? ruolo}
              {scheda.zone?.nome ? ` · ${scheda.zone.nome}` : " · nessuna filiale"}
              {numeri.anzianita_giorni != null ? ` · in squadra da ${numero(numeri.anzianita_giorni)} giorni` : ""}
            </span>
            {scheda.motto && <p className="dip-motto">«{scheda.motto}»</p>}
          </div>
          <div className="dip-profilo-conta">
            <b>{presi}<em>/{traguardi.length}</em></b>
            <span className="dip-sub">traguardi</span>
          </div>
        </div>

        <div className="adm-form-grid">
          <label className="adm-fld">
            <span>Telefono</span>
            <input type="tel" value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </label>
          <label className="adm-fld">
            <span>Email</span>
            <input type="email" value={scheda.email ?? ""} disabled />
            <span className="dip-sub">è la credenziale d'accesso: la cambia chi gestisce</span>
          </label>
          <label className="adm-fld wide">
            <span>Motto</span>
            <input type="text" value={form.motto} maxLength={90}
              placeholder="una riga che ti descrive"
              onChange={(e) => setForm({ ...form, motto: e.target.value })} />
          </label>
          {/* Chi passa la giornata sulle promozioni non deve attraversare tre
              pagine per arrivarci: sceglie qui dove aprire, una volta sola. */}
          <label className="adm-fld wide">
            <span>Quando entro, portami a…</span>
            <select value={form.avvio}
              onChange={(e) => setForm({ ...form, avvio: e.target.value })}>
              <option value="">Dove previsto per il mio ruolo</option>
              <option value="sito">Home del sito</option>
              {schedeVisibili.map((m) => (
                <option key={m.codice} value={m.codice}>Area interna · {m.nome}</option>
              ))}
            </select>
            <span className="dip-sub">vale al prossimo accesso, da qualunque dispositivo</span>
          </label>
          <div className="adm-azioni">
            <button className="adm-btn" onClick={salva} disabled={busy}>
              <Icon name="save" size={14} /> {busy ? "Salvo…" : "Salva"}
            </button>
            {/* La presentazione parte da sola una volta sola: chi la salta, o
                chi dopo un mese non ricorda dov'era una cosa, la richiama da
                qui. Discreta, accanto al salvataggio. */}
            {rivediGiro && (
              <button className="adm-btn ghost mini" onClick={rivediGiro}>
                <Icon name="info" size={13} /> Rivedi la presentazione
              </button>
            )}
            <AnimatePresence>
              {salvato && (
                <motion.span className="dip-sub" style={{ color: "#2e7d4f" }}
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <Icon name="check" size={13} /> salvato
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* I numeri che contano cambiano col mestiere: a chi non vende non
          serve un fatturato a zero in cima alla pagina. */}
      <div className="dip-kpi-riga" style={{ marginTop: "var(--space-5)" }}>
        {vende ? (
          <React.Fragment>
            <Kpi etichetta="Proposte" valore={numero(numeri.proposte)}
              nota={`${numeri.accettate} sì · ${numeri.rifiutate} no`} />
            <Kpi etichetta="Valore proposto" valore={euro(numeri.valore)} forte
              nota={`margine ${euro(numeri.margine)}`} />
            <Kpi etichetta="Incidenza" valore={pct(numeri.incidenza)} nota="accettate sul totale" />
            <Kpi etichetta="Clienti in carico" valore={numero(numeri.in_carico)}
              nota={`${numeri.clienti} lavorati almeno una volta`} />
          </React.Fragment>
        ) : (
          <React.Fragment>
            <Kpi etichetta="Presenze" valore={numero(numeri.presenze)} forte
              nota={`${numeri.settimane} settimane diverse`} />
            <Kpi etichetta="Giorni di fila" valore={numero(numeri.striscia)}
              nota="senza saltarne uno" />
          </React.Fragment>
        )}
        <Kpi etichetta="Schede lette" valore={numero(numeri.schede_lette)}
          nota={`su ${numero(numeri.schede_totali)} in corso`} />
        <Kpi etichetta="Bacheca" valore={`${numeri.annunci_letti}/${numeri.annunci_totali}`}
          nota="annunci letti" />
      </div>

      <Notifiche setErr={setErr} />

      <h2 className="dip-card-titolo" style={{ marginTop: "var(--space-6)" }}>
        <Icon name="shield-check" size={14} color="var(--cra-red)" /> Traguardi
      </h2>
      <p className="dip-regola">
        Si conquistano lavorando, non cliccando: ogni gradino legge i numeri veri delle tue
        proposte. Nessuna classifica con i colleghi — questa è la tua strada.
      </p>
      <div className="dip-badge-griglia">
        {traguardi.map((t, i) => <Traguardo key={t.codice} t={t} i={i} />)}
      </div>

      {/* La squadra la vede solo chi la guida, e non è una classifica: è
          l'elenco di chi si è mosso e chi no. Nessun punteggio a confronto. */}
      {squadra.length > 1 && (
        <React.Fragment>
          <h2 className="dip-card-titolo" style={{ marginTop: "var(--space-6)" }}>
            <Icon name="users" size={14} color="var(--cra-red)" /> La squadra
          </h2>
          <div className="dip-tab-scroll">
            <TabellaSchede>
              <thead><tr>
                <th>Persona</th><th>Filiale</th>
                <th className="dip-num">Traguardi</th><th>Ultimo</th><th>Quando</th>
              </tr></thead>
              <tbody>
                {squadra.map((s) => (
                  <tr key={s.dipendente_id}>
                    <td>{s.persona}<br /><span className="dip-sub">{RUOLI[s.ruolo] ?? s.ruolo}</span></td>
                    <td><span className="dip-sub">{s.filiale ?? "—"}</span></td>
                    <td className="dip-num"><b>{numero(s.conquistati)}</b></td>
                    <td><span className="dip-sub">{s.ultimo_nome ?? "—"}</span></td>
                    <td><span className="dip-sub">{s.ultimo_il ? dataIt(s.ultimo_il) : "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </TabellaSchede>
          </div>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

/* ============================================================
   FINESTRA D'INVIO — quantità, documento, note.

   Sostituisce il modulo che stava schiacciato dentro la cella della tabella:
   là i campi erano larghi due centimetri e sul telefono non si toccavano.
   Su schermo grande è una finestra al centro, sul telefono un foglio che
   sale dal basso — stesso codice, perché è lo stesso gesto.

   Il documento ha quattro scelte: la prima è quella abituale del cliente,
   già selezionata. Chi non ha niente da cambiare preme invia e basta.
   ============================================================ */
function FinestraInvio({ cliente, scheda, tipi, busy, onAnnulla, onInvia }) {
  const [q, setQ] = useState(String(cliente.quantita || 1));
  const [note, setNote] = useState(cliente.note ?? "");
  /* Parte già sul documento del cliente: quasi sempre è quello giusto e non
     serve toccare niente. È un tipo vero come gli altri — «predefinito»
     significa «quello che il gestionale ha su questo cliente», che noi non
     abbiamo importato e quindi non fingiamo di sapere. */
  const [doc, setDoc] = useState(cliente.documento_predefinito || "");

  /* Esc chiude, come ci si aspetta da qualunque finestra. */
  useEffect(() => {
    const tasto = (e) => { if (e.key === "Escape") onAnnulla(); };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [onAnnulla]);

  const passo = (d) => setQ((v) => String(Math.max(1, (Number(v) || 1) + d)));

  return (
    <React.Fragment>
      <motion.div className="dip-velo" onClick={onAnnulla}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div className="dip-finestra" role="dialog" aria-modal="true"
        aria-label={`Proposta a ${cliente.ragione_sociale}`}
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>

        <header className="dip-fin-testa">
          <div>
            <span className="dip-sub">Proposta d'ordine</span>
            <h2>{cliente.ragione_sociale}</h2>
            <span className="dip-sub">
              {cliente.codice_cliente ? `${cliente.codice_cliente} · ` : ""}{scheda.titolo}
            </span>
          </div>
          <button type="button" className="adm-btn ghost mini" onClick={onAnnulla} aria-label="Chiudi">
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="dip-fin-corpo">
          <div className="dip-campo">
            <span className="dip-campo-nome">Quantità</span>
            {/* I due pulsanti non sono un vezzo: su un telefono azzeccare
                le frecciette di un campo numerico è impossibile. */}
            <div className="dip-quantita">
              <button type="button" onClick={() => passo(-1)} aria-label="Diminuisci">
                <Icon name="minus" size={16} />
              </button>
              <input type="number" inputMode="numeric" min="1" step="1" value={q}
                onChange={(e) => setQ(e.target.value)} aria-label="Quantità" />
              <button type="button" onClick={() => passo(1)} aria-label="Aumenta">
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>

          <div className="dip-campo">
            <span className="dip-campo-nome">Documento da emettere</span>
            <div className="dip-scelte">
              {tipi.map((t) => (
                <button key={t.codice} type="button"
                  className={`dip-scelta ${doc === t.codice ? "on" : ""}`}
                  onClick={() => setDoc(t.codice)}>
                  <b>{t.nome}</b>
                  <span>
                    {t.codice}
                    {t.codice === cliente.documento_predefinito ? " · abituale di questo cliente" : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="dip-campo">
            <span className="dip-campo-nome">Note</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Consegna, riferimenti, accordi presi… (facoltativo)" />
          </div>
        </div>

        <footer className="dip-fin-piede">
          <button type="button" className="adm-btn ghost" onClick={onAnnulla}>Annulla</button>
          <button type="button" className="adm-btn" disabled={busy}
            onClick={() => onInvia({ quantita: Number(q) || 1, note: note || null, documento: doc || null })}>
            <Icon name="mail" size={15} /> {busy ? "Invio…" : "Conferma e invia"}
          </button>
        </footer>
      </motion.div>
    </React.Fragment>
  );
}

/* ============================================================
   NOTIFICHE PUSH — l'interruttore, un dispositivo alla volta.

   Il permesso lo dà la persona al browser, non noi: possiamo solo chiederlo,
   e solo dentro un clic vero. Per questo qui non c'è nessun automatismo che
   attivi le notifiche da solo all'apertura della pagina.
   ============================================================ */
function Notifiche({ setErr }) {
  const [stato, setStato] = useState(null);
  const [dispositivi, setDispositivi] = useState([]);
  const [lavoro, setLavoro] = useState(null);      // attivo | spengo | provo
  const [esito, setEsito] = useState(null);

  const aggiorna = useCallback(async () => {
    setStato(await push.statoPush());
    try { setDispositivi(await push.mieiDispositivi()); } catch { /* non è essenziale */ }
  }, []);
  useEffect(() => { aggiorna(); }, [aggiorna]);

  const fai = async (quale, azione, messaggio) => {
    setLavoro(quale);
    setEsito(null);
    try {
      const r = await azione();
      setEsito(messaggio(r));
      await aggiorna();
    } catch (e) {
      setErr(String(e?.message ?? e));
    } finally {
      setLavoro(null);
    }
  };

  /* Ogni motivo ha la sua strada d'uscita: dire solo «non supportate»
     lascerebbe l'utente convinto che sia rotto. */
  const IMPOSSIBILI = {
    "non-sicuro": {
      titolo: "Serve un indirizzo sicuro",
      testo: <React.Fragment>
        Stai aprendo il sito da un indirizzo di rete (<code>http://…</code>). Le notifiche
        esistono solo su <b>https</b> o su <b>localhost</b>: è una regola del browser, non
        un'impostazione nostra. Apri il sito pubblicato e le ritrovi.
      </React.Fragment>,
    },
    "ios-da-installare": {
      titolo: "Su iPhone va aggiunto alla Home",
      testo: <React.Fragment>
        Safari da solo non riceve notifiche. Tocca <b>Condividi</b> → <b>Aggiungi alla schermata
        Home</b>, poi apri il sito da quell'icona: da lì l'interruttore compare.
        {" "}Se ce l'hai già dai giorni scorsi, <b>togli l'icona vecchia e rifallo</b>: prima
        di oggi mancava il manifest e iOS l'aveva salvato come semplice segnalibro.
      </React.Fragment>,
    },
    "non-supportate": {
      titolo: "Questo browser non le supporta",
      testo: "Prova da Chrome, Firefox o Edge aggiornati.",
    },
  };

  if (IMPOSSIBILI[stato?.stato]) {
    const m = IMPOSSIBILI[stato.stato];
    return (
      <React.Fragment>
        <h2 className="dip-card-titolo" style={{ marginTop: "var(--space-6)" }}>
          <Icon name="bell" size={14} color="var(--cra-red)" /> Notifiche
        </h2>
        <p className="dip-regola"><b>{m.titolo}.</b> {m.testo}</p>
      </React.Fragment>
    );
  }

  const attive = stato?.stato === "attive";
  const negato = stato?.stato === "negato";
  /* La prova parte verso TUTTI i dispositivi iscritti, non verso questo:
     legarla allo stato di questa finestra la nascondeva proprio a chi le
     aveva già attivate altrove. Un'iscrizione appartiene all'indirizzo dove
     è nata — localhost e il sito pubblicato sono due siti diversi per il
     browser — mentre l'elenco viene dal database, che è uno solo. */
  const altrove = dispositivi.length > 0
    && !dispositivi.some((d) => d.endpoint === stato?.endpoint);

  return (
    <React.Fragment>
      <h2 className="dip-card-titolo" style={{ marginTop: "var(--space-6)" }}>
        <Icon name="bell" size={14} color="var(--cra-red)" /> Notifiche
      </h2>
      <p className="dip-regola">
        Avvisano di una promozione nuova o di un annuncio della tua filiale anche a sito
        chiuso. Il permesso va dato una volta per ogni dispositivo: il telefono e il
        computer sono due iscrizioni diverse.
      </p>

      {negato ? (
        <p className="dip-sub" style={{ color: "var(--cra-red)" }}>
          <Icon name="triangle-alert" size={14} /> Le notifiche sono <b>bloccate</b> per questo
          sito. Si riattivano dal lucchetto accanto all'indirizzo, poi torna qui.
        </p>
      ) : (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {attive ? (
            <button className="adm-btn ghost" disabled={lavoro === "spengo"}
              onClick={() => fai("spengo", push.disattiva,
                () => "Questo dispositivo non riceverà più notifiche.")}>
              <Icon name="bell" size={15} /> {lavoro === "spengo" ? "Spengo…" : "Disattiva qui"}
            </button>
          ) : (
            <button className="adm-btn" disabled={lavoro === "attivo"}
              onClick={() => fai("attivo", push.attiva, (r) => `Attive su ${r.dispositivo}.`)}>
              <Icon name="bell" size={15} />
              {lavoro === "attivo" ? "Attivo…" : "Attiva su questo dispositivo"}
            </button>
          )}

          {/* Basta un dispositivo iscritto, ovunque sia: la prova va a tutti. */}
          {dispositivi.length > 0 && (
            <button className={`adm-btn ${attive ? "" : "ghost"}`} disabled={lavoro === "provo"}
              onClick={() => fai("provo", push.provaPush,
                (r) => r?.inviate
                  ? `Mandata a ${r.inviate} dispositiv${r.inviate === 1 ? "o" : "i"}.`
                  : "Nessuna partita — i dispositivi in elenco potrebbero non essere più validi.")}>
              <Icon name="megaphone" size={15} /> {lavoro === "provo" ? "Mando…" : "Mandami una prova"}
            </button>
          )}
        </div>
      )}

      {esito && (
        <p className="dip-sub" style={{ marginTop: "10px" }}>
          <Icon name="check-circle-2" size={14} color="#2E7D4F" /> {esito}
        </p>
      )}

      {altrove && !attive && (
        <p className="dip-sub" style={{ marginTop: "10px" }}>
          <Icon name="info" size={14} /> Le notifiche sono attive su altri dispositivi, ma non su
          questo. Un'iscrizione vale per l'indirizzo dove è nata: se le avevi attivate aprendo
          il sito da un altro indirizzo, qui vanno riattivate.
        </p>
      )}

      {dispositivi.length > 0 && (
        <div className="dip-tab-scroll" style={{ marginTop: "var(--space-4)" }}>
          <TabellaSchede>
            <thead><tr><th>Dispositivo</th><th>Iscritto</th><th>Ultima notifica</th></tr></thead>
            <tbody>
              {dispositivi.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.dispositivo || "Dispositivo"}
                    {d.endpoint === stato?.endpoint && <span className="dip-sub"> · questo</span>}
                  </td>
                  <td><span className="dip-sub">{dataIt(d.created_at)}</span></td>
                  <td><span className="dip-sub">{d.ultimo_uso ? dataIt(d.ultimo_uso) : "mai"}</span></td>
                </tr>
              ))}
            </tbody>
          </TabellaSchede>
        </div>
      )}
    </React.Fragment>
  );
}
