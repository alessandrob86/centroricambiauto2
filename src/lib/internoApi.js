import { supabase } from "./supabase.js";

/* Strato dati del modulo interno (#/interno).
 *
 * Regola che vale ovunque qui dentro: il filtro sta nel DATABASE, non nel
 * browser. Le funzioni `SECURITY DEFINER` (`moduli_utente`, `annunci_utente`,
 * `schede_utente`) sanno chi sta guardando e restituiscono solo ciò che gli
 * spetta. Il client non deve ricordarsi di filtrare, e chi curiosa nella rete
 * non trova gli annunci di un'altra filiale.
 */

const BUCKET = "cra-interno";

/* Lo scaricatore di CSV è già nel back-office: stesso BOM, stesso comportamento
   su Excel italiano. Si riusa invece di riscriverlo. */
export { downloadCsv } from "./adminApi.js";

/* ============ Moduli e permessi ============ */

/** Le schede e i riquadri che questa persona può vedere, con la sua
 *  disposizione della home già applicata. */
export async function getModuli() {
  const { data, error } = await supabase.rpc("moduli_utente");
  if (error) throw error;
  const righe = data ?? [];
  return {
    schede: righe.filter((m) => m.tipo === "scheda"),
    riquadri: righe.filter((m) => m.tipo === "riquadro"),
  };
}

export async function getTuttiModuli() {
  const { data, error } = await supabase
    .from("moduli_interni").select("*").order("tipo").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getPermessi() {
  const { data, error } = await supabase.from("modulo_permessi").select("*");
  if (error) throw error;
  return data ?? [];
}

/** Regola per ruolo (con filiale facoltativa) o per singola persona.
 *  `abilitato = null` cancella la regola e fa tornare il valore di serie. */
export async function setPermesso({ modulo, ruolo = null, zonaId = null, dipendenteId = null, abilitato }) {
  const chiave = dipendenteId
    ? { modulo, dipendente_id: dipendenteId }
    : { modulo, ruolo, zona_id: zonaId };
  if (abilitato === null) {
    let q = supabase.from("modulo_permessi").delete().eq("modulo", modulo);
    q = dipendenteId ? q.eq("dipendente_id", dipendenteId) : q.eq("ruolo", ruolo);
    if (!dipendenteId) q = zonaId ? q.eq("zona_id", zonaId) : q.is("zona_id", null);
    const { error } = await q;
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("modulo_permessi")
    .upsert({ ...chiave, abilitato }, {
      onConflict: dipendenteId ? "modulo,dipendente_id" : undefined,
      ignoreDuplicates: false,
    });
  // L'upsert su indice parziale non è esprimibile da PostgREST: se non passa,
  // si cancella e si reinserisce. Due richieste invece di una, ma corretto.
  if (error) {
    let del = supabase.from("modulo_permessi").delete().eq("modulo", modulo);
    del = dipendenteId ? del.eq("dipendente_id", dipendenteId) : del.eq("ruolo", ruolo);
    if (!dipendenteId) del = zonaId ? del.eq("zona_id", zonaId) : del.is("zona_id", null);
    await del;
    const { error: e2 } = await supabase.from("modulo_permessi").insert({ ...chiave, abilitato });
    if (e2) throw e2;
  }
}

/** Disposizione della home: ordine, misura e presenza di ogni riquadro.
 *  Si salva SEMPRE l'elenco intero, nascosti compresi: altrimenti un
 *  riquadro tolto tornerebbe da solo al ricaricamento successivo. */
export async function salvaDashboard(dipendenteId, riquadri) {
  if (!dipendenteId || !riquadri?.length) return;
  const righe = riquadri.map((r, i) => ({
    dipendente_id: dipendenteId, modulo: r.codice, ordine: i,
    taglia: r.taglia ?? "1x1", visibile: r.visibile !== false,
    config: r.config ?? {},
  }));
  const { error } = await supabase
    .from("dipendente_dashboard")
    .upsert(righe, { onConflict: "dipendente_id,modulo" });
  if (error) throw error;
}

/* ============ Annunci ============ */

/** `soloBarra` = quelli da mostrare nella striscia in testa al sito.
 *  L'RPC non porta la foto: nella striscia non ci va, e chiederla lì
 *  sarebbe peso inutile su ogni pagina del sito. La bacheca la prende a
 *  parte con `getFotoAnnunci()`. */
export async function getAnnunci(soloBarra = false) {
  const { data, error } = await supabase.rpc("annunci_utente", { solo_barra: soloBarra });
  if (error) throw error;
  return data ?? [];
}

/** { annuncioId: path } per le foto: le mostra solo la bacheca. */
export async function getFotoAnnunci(ids) {
  if (!ids?.length) return {};
  const { data, error } = await supabase
    .from("annunci").select("id, immagine").in("id", ids).not("immagine", "is", null);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((a) => [a.id, a.immagine]));
}

export async function segnaLetto(annuncioId, dipendenteId) {
  if (!dipendenteId) return;
  await supabase
    .from("annuncio_letture")
    .upsert({ annuncio_id: annuncioId, dipendente_id: dipendenteId }, { onConflict: "annuncio_id,dipendente_id" });
}

export async function creaAnnuncio(campi, zone = []) {
  const { data, error } = await supabase
    .from("annunci")
    .insert({
      titolo: campi.titolo,
      corpo: campi.corpo || null,
      priorita: Number(campi.priorita) || 0,
      colore: campi.colore || null,
      icona: campi.icona || null,
      immagine: campi.immagine || null,
      animazione: campi.animazione || "pulsa",
      effetto: campi.effetto || "nessuno",
      colore_effetto: campi.colore_effetto || null,
      in_barra: !!campi.in_barra,
      scade_il: campi.scade_il || null,
      attivo: true,
      creato_da: campi.creato_da ?? null,
    })
    .select("id").single();
  if (error) throw error;
  await setAnnuncioZone(data.id, zone);
  return data.id;
}

export async function aggiornaAnnuncio(id, campi, zone) {
  const { error } = await supabase
    .from("annunci")
    .update({
      titolo: campi.titolo,
      corpo: campi.corpo || null,
      priorita: Number(campi.priorita) || 0,
      colore: campi.colore || null,
      icona: campi.icona || null,
      immagine: campi.immagine || null,
      animazione: campi.animazione || "pulsa",
      effetto: campi.effetto || "nessuno",
      colore_effetto: campi.colore_effetto || null,
      in_barra: !!campi.in_barra,
      scade_il: campi.scade_il || null,
      attivo: campi.attivo !== false,
    })
    .eq("id", id);
  if (error) throw error;
  if (zone) await setAnnuncioZone(id, zone);
}

export async function eliminaAnnuncio(id) {
  const { error } = await supabase.from("annunci").delete().eq("id", id);
  if (error) throw error;
}

/** Nessuna filiale = vale per tutti. */
export async function setAnnuncioZone(annuncioId, zone) {
  await supabase.from("annuncio_zone").delete().eq("annuncio_id", annuncioId);
  if (!zone?.length) return;
  const { error } = await supabase
    .from("annuncio_zone")
    .insert(zone.map((zona_id) => ({ annuncio_id: annuncioId, zona_id })));
  if (error) throw error;
}

/** Elenco completo per la gestione (l'RPC filtra, qui serve tutto). */
export async function getAnnunciGestione() {
  const { data, error } = await supabase
    .from("annunci")
    .select("*, annuncio_zone(zona_id)")
    .order("priorita", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a) => ({ ...a, zone: (a.annuncio_zone ?? []).map((z) => z.zona_id) }));
}

/* ============ Notifiche ============ */

export async function getNotifiche(limite = 40) {
  const { data, error } = await supabase.rpc("notifiche_utente", { p_limite: limite });
  if (error) throw error;
  return data ?? [];
}

export async function segnaNotificaLetta(notificaId, dipendenteId) {
  if (!dipendenteId) return;
  await supabase.from("notifica_letture")
    .upsert({ notifica_id: notificaId, dipendente_id: dipendenteId }, { onConflict: "notifica_id,dipendente_id" });
}

export async function segnaTutteLette(notifiche, dipendenteId) {
  const daFare = (notifiche ?? []).filter((n) => !n.letto);
  if (!dipendenteId || !daFare.length) return 0;
  await supabase.from("notifica_letture").upsert(
    daFare.map((n) => ({ notifica_id: n.id, dipendente_id: dipendenteId })),
    { onConflict: "notifica_id,dipendente_id" },
  );
  return daFare.length;
}

/** Ascolta le righe nuove di una tabella e richiama `onNovita`.
 *  Serve a non dover premere F5: chi pubblica un annuncio lo fa comparire
 *  sugli schermi degli altri, non solo sul proprio dopo un ricaricamento. */
export function ascolta(tabella, onNovita) {
  const canale = supabase
    .channel(`cra-${tabella}-${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: tabella }, (msg) => onNovita(msg))
    .subscribe();
  return () => { supabase.removeChannel(canale); };
}

/* ============ Card Center ============ */

export async function getTipiScheda() {
  const { data, error } = await supabase
    .from("tipi_scheda").select("*").eq("attivo", true).order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getSchede(tipo = null) {
  const { data, error } = await supabase.rpc("schede_utente", { p_tipo: tipo });
  if (error) throw error;
  return data ?? [];
}

export async function getSchedeGestione() {
  const { data, error } = await supabase
    .from("schede")
    .select("*, tipi_scheda(nome, colore, icona, inoltrabile), scheda_zone(zona_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, zone: (s.scheda_zone ?? []).map((z) => z.zona_id) }));
}

/** Quanti clienti ha ogni scheda: { schedaId: n }. Serve alla vista di
 *  gestione, dove le righe non passano dall'RPC che il conteggio ce l'ha. */
export async function getConteggiDestinatari() {
  const { data, error } = await supabase.from("scheda_destinatari").select("scheda_id");
  if (error) return {};
  const out = {};
  for (const r of data ?? []) out[r.scheda_id] = (out[r.scheda_id] ?? 0) + 1;
  return out;
}

export async function creaScheda(campi, zone = []) {
  const { data, error } = await supabase
    .from("schede")
    .insert({
      titolo: campi.titolo,
      descrizione: campi.descrizione || null,
      tipo: campi.tipo,
      immagine: campi.immagine || null,
      allegato: campi.allegato || null,
      valida_da: campi.valida_da || null,
      valida_a: campi.valida_a || null,
      stato: campi.stato || "attiva",
      creato_da: campi.creato_da ?? null,
    })
    .select("id").single();
  if (error) throw error;
  await setSchedaZone(data.id, zone);
  return data.id;
}

export async function aggiornaScheda(id, campi, zone) {
  const { error } = await supabase
    .from("schede")
    .update({
      titolo: campi.titolo,
      descrizione: campi.descrizione || null,
      tipo: campi.tipo,
      immagine: campi.immagine || null,
      allegato: campi.allegato || null,
      valida_da: campi.valida_da || null,
      valida_a: campi.valida_a || null,
      stato: campi.stato,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  if (zone) await setSchedaZone(id, zone);
}

export async function eliminaScheda(id) {
  const { error } = await supabase.from("schede").delete().eq("id", id);
  if (error) throw error;
}

export async function setSchedaZone(schedaId, zone) {
  await supabase.from("scheda_zone").delete().eq("scheda_id", schedaId);
  if (!zone?.length) return;
  const { error } = await supabase
    .from("scheda_zone")
    .insert(zone.map((zona_id) => ({ scheda_id: schedaId, zona_id })));
  if (error) throw error;
}

/* ---- file: il bucket è PRIVATO, gli indirizzi si firmano ---- */

export async function caricaFile(file, cartella = "schede") {
  const est = (file.name.split(".").pop() || "bin").toLowerCase();
  const nome = `${cartella}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${est}`;
  const { error } = await supabase.storage.from(BUCKET).upload(nome, file, { upsert: false });
  if (error) throw error;
  return nome;
}

/** Indirizzo temporaneo (un'ora) per mostrare o scaricare un file privato.
 *
 *  Le schede arrivate dal vecchio portale non hanno un percorso nel nostro
 *  deposito ma un indirizzo intero: quelle si passano così come sono. Finché
 *  i file non vengono ricopiati qui, le locandine storiche restano dove sono
 *  e si vedono lo stesso. */
export async function urlFirmato(path, secondi = 3600) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, secondi);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/* ============ Clienti del rappresentante ============
   Il cliente è dell'agente, non della promozione: `officine.agente_id`.
   Per ogni promozione si registra solo che cosa è successo. */

/** I miei clienti, con l'esito sulla promozione indicata (se indicata). */
export async function getClientiAgente(schedaId = null) {
  const { data, error } = await supabase.rpc("clienti_agente", { p_scheda: schedaId });
  if (error) throw error;
  return data ?? [];
}

/** Officine ancora senza rappresentante, per nome, codice, città o P.IVA.
 *
 *  Passa da una funzione del database perché un cliente libero non è di
 *  nessuno, e quindi un rappresentante non lo vedrebbe: la ricerca tornava
 *  vuota proprio a chi doveva costruirsi il portafoglio. */
export async function cercaOfficineLibere(q, limite = 8) {
  const { data, error } = await supabase.rpc("officine_da_prendere", { p_q: q, p_limite: limite });
  if (error) throw error;
  return data ?? [];
}

/** Prendo in carico un cliente. Si prende solo ciò che è libero. */
export async function prendiCliente(officinaId) {
  const { error } = await supabase.rpc("prendi_cliente", { p_officina: officinaId });
  if (error) throw error;
}

/** Lo lascio: torna libero, non sparisce. */
export async function lasciaCliente(officinaId) {
  const { error } = await supabase.rpc("lascia_cliente", { p_officina: officinaId });
  if (error) throw error;
}

/** L'unico esito che si mette a mano è il rifiuto: "accettata" la scrive
 *  la spedizione, perché è un fatto, non un'opinione. */
export async function rifiuta(schedaId, officinaId, note, dipendenteId) {
  const { error } = await supabase.from("scheda_esiti").upsert({
    scheda_id: schedaId, officina_id: officinaId, esito: "rifiutata",
    note: note || null, aggiornato_da: dipendenteId ?? null,
    aggiornato_il: new Date().toISOString(),
  }, { onConflict: "scheda_id,officina_id" });
  if (error) throw error;
}

/** Torna al punto di partenza: né inviata né rifiutata. */
export async function annullaEsito(schedaId, officinaId) {
  const { error } = await supabase.from("scheda_esiti").delete()
    .eq("scheda_id", schedaId).eq("officina_id", officinaId);
  if (error) throw error;
}

/* ============ (in disuso) assegnazione per promozione ============ */

/** I clienti che questa scheda promozionale tocca. La RLS decide se sono
 *  tutti (admin, manager, centralino) o solo i propri (rappresentante). */
export async function getDestinatari(schedaId) {
  const { data, error } = await supabase
    .from("scheda_destinatari")
    .select("officina_id, agente_id, officine(id, ragione_sociale, codice_cliente, citta, provincia, telefono, email), dipendenti(nome, cognome)")
    .eq("scheda_id", schedaId);
  if (error) throw error;
  const esiti = await getEsiti(schedaId);
  const perOfficina = Object.fromEntries(esiti.map((e) => [e.officina_id, e]));
  return (data ?? []).map((d) => ({
    officina_id: d.officina_id,
    agente_id: d.agente_id,
    officina: d.officine,
    agente: d.dipendenti ? `${d.dipendenti.nome ?? ""} ${d.dipendenti.cognome ?? ""}`.trim() : null,
    esito: perOfficina[d.officina_id]?.esito ?? "da_contattare",
    note: perOfficina[d.officina_id]?.note ?? "",
  }));
}

export async function getEsiti(schedaId) {
  const { data, error } = await supabase
    .from("scheda_esiti").select("*").eq("scheda_id", schedaId);
  if (error) return [];
  return data ?? [];
}

export async function setEsito(schedaId, officinaId, esito, note, dipendenteId) {
  const { error } = await supabase.from("scheda_esiti").upsert({
    scheda_id: schedaId, officina_id: officinaId, esito,
    note: note || null, aggiornato_da: dipendenteId ?? null,
    aggiornato_il: new Date().toISOString(),
  }, { onConflict: "scheda_id,officina_id" });
  if (error) throw error;
}

/** Assegna un elenco di officine alla scheda, con l'agente che le segue. */
export async function assegnaDestinatari(schedaId, righe) {
  if (!righe.length) return 0;
  const { error } = await supabase.from("scheda_destinatari").upsert(
    righe.map((r) => ({ scheda_id: schedaId, officina_id: r.officina_id, agente_id: r.agente_id ?? null })),
    { onConflict: "scheda_id,officina_id" },
  );
  if (error) throw error;
  return righe.length;
}

export async function rimuoviDestinatario(schedaId, officinaId) {
  const { error } = await supabase
    .from("scheda_destinatari").delete().eq("scheda_id", schedaId).eq("officina_id", officinaId);
  if (error) throw error;
}

/** Tutto quello che questo agente ha in mano, scheda per scheda. */
/** ⚠️ Modello superato: i clienti si assegnavano alla singola promozione.
 *  Ora il portafoglio è dell'agente e la promozione gli si propone tutta
 *  intera — vedi `getClientiAgente()`. Resta solo perché una vecchia
 *  chiamata potrebbe passare di qui: torna sempre vuoto, e va bene così. */
export async function getDestinatariStorici(dipendenteId) {
  if (!dipendenteId) return [];
  const { data, error } = await supabase
    .from("scheda_destinatari")
    .select("scheda_id, officina_id, officine(ragione_sociale, codice_cliente, citta, provincia, telefono), schede(titolo, tipo, stato)")
    .eq("agente_id", dipendenteId);
  if (error) throw error;
  const righe = data ?? [];
  const schedaIds = [...new Set(righe.map((r) => r.scheda_id))];
  let esiti = [];
  if (schedaIds.length) {
    const { data: e } = await supabase
      .from("scheda_esiti").select("*").in("scheda_id", schedaIds);
    esiti = e ?? [];
  }
  const chiave = (s, o) => `${s}|${o}`;
  const perChiave = Object.fromEntries(esiti.map((e) => [chiave(e.scheda_id, e.officina_id), e]));
  return righe
    .filter((r) => r.schede?.stato === "attiva")
    .map((r) => ({
      scheda_id: r.scheda_id,
      officina_id: r.officina_id,
      scheda: r.schede?.titolo ?? "—",
      tipo: r.schede?.tipo,
      officina: r.officine,
      esito: perChiave[chiave(r.scheda_id, r.officina_id)]?.esito ?? "da_contattare",
      note: perChiave[chiave(r.scheda_id, r.officina_id)]?.note ?? "",
    }));
}

/** Manda la proposta d'ordine al magazzino. Il controllo che il tipo sia
 *  inoltrabile lo rifà la edge function: qui è solo interfaccia. */
export async function inviaProposta({ schedaId, officinaId, quantita, note, documento }) {
  const { data, error } = await supabase.functions.invoke("invia-proposta-scheda", {
    // `documento` vuoto non è un errore: significa «quello abituale del
    // cliente», e a risolverlo è il database, non il browser.
    body: { scheda_id: schedaId, officina_id: officinaId, quantita, note, documento: documento || null },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/** I documenti che possono accompagnare la merce. */
export async function getTipiDocumento() {
  const { data, error } = await supabase.rpc("tipi_documento_attivi");
  if (error) throw error;
  return data ?? [];
}

/* ============ Persone e filiali ============ */

export async function getZone() {
  const { data, error } = await supabase
    .from("zone").select("*").eq("attiva", true).order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getDipendenti() {
  const { data, error } = await supabase
    .from("dipendenti").select("*, zone(id, nome)").order("cognome").order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function creaDipendente(campi) {
  const { data, error } = await supabase.from("dipendenti").insert({
    nome: campi.nome, cognome: campi.cognome || null,
    email: (campi.email || "").trim().toLowerCase() || null,
    telefono: campi.telefono || null,
    ruolo: campi.ruolo || "dipendente",
    zona_id: campi.zona_id || null,
    attivo: true,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function aggiornaDipendente(id, patch) {
  const { error } = await supabase.from("dipendenti").update({
    nome: patch.nome, cognome: patch.cognome || null,
    email: (patch.email || "").trim().toLowerCase() || null,
    telefono: patch.telefono || null,
    ruolo: patch.ruolo, zona_id: patch.zona_id || null,
    attivo: patch.attivo !== false,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

/* ============ Statistiche ============ */

/** Conversione per promozione e rendimento per agente.
 *  Il conto si fa nel database: quattro funzioni che partono tutte dallo
 *  stesso registro delle proposte, così i numeri non possono divergere fra
 *  una tabella e l'altra. Il filtro per ruolo è dentro le funzioni: un
 *  rappresentante vede il suo, non il lavoro degli altri.
 *
 *  Le date sono estremi INCLUSI: `al` comprende tutta la sua giornata. */
const numerico = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) =>
  [k, typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v]));

const RIEPILOGO_VUOTO = {
  proposte: 0, accettate: 0, rifiutate: 0, pezzi: 0, valore: 0, margine: 0, costo: 0,
  clienti: 0, promozioni: 0, agenti: 0, scontrino: null, margine_pct: null,
  incidenza: null, portafoglio: 0, copertura: null,
};

const par = ({ dal = null, al = null, agente = null, scheda = null } = {}) =>
  ({ p_dal: dal, p_al: al, p_agente: agente, p_scheda: scheda });

export async function getStat(filtri = {}) {
  const p = par(filtri);
  const [riep, mesi, agenti, promo, clienti] = await Promise.all([
    supabase.rpc("stat_riepilogo", p),
    supabase.rpc("stat_mensile", p),
    supabase.rpc("stat_agente", p),
    supabase.rpc("stat_promozione", p),
    supabase.rpc("stat_cliente", { ...p, p_limite: 100 }),
  ]);
  const err = riep.error || mesi.error || agenti.error || promo.error || clienti.error;
  if (err) throw err;
  return {
    riepilogo: numerico(riep.data?.[0] ?? RIEPILOGO_VUOTO),
    mesi: (mesi.data ?? []).map(numerico),
    agenti: (agenti.data ?? []).map(numerico),
    promozioni: (promo.data ?? []).map(numerico),
    clienti: (clienti.data ?? []).map(numerico),
  };
}

/** Solo i totali: serve per il confronto col periodo precedente. */
export async function getRiepilogo(filtri = {}) {
  const { data, error } = await supabase.rpc("stat_riepilogo", par(filtri));
  if (error) throw error;
  return numerico(data?.[0] ?? RIEPILOGO_VUOTO);
}

/* ============ Inviti al personale ============

   Prima un collega entrava solo se qualcuno lo invitava dal pannello di
   Supabase: una cosa da amministratore di sistema, per una faccenda
   ordinaria. Con un codice monouso il giro si chiude qui dentro.

   Il codice è legato per forza all'indirizzo aziendale della scheda, e il
   collegamento vero avviene quando quell'indirizzo viene confermato: il
   codice da solo non basta a farsi passare per un collega. */

/** Gli inviti aperti del personale: { dipendenteId: invito }. */
export async function getInvitiDipendenti() {
  const { data, error } = await supabase
    .from("inviti")
    .select("codice, dipendente_id, email, scade_il, usato_il, inviato_il")
    .not("dipendente_id", "is", null)
    .is("usato_il", null)
    .order("created_at", { ascending: false });
  if (error) return {};
  const out = {};
  for (const i of data ?? []) if (!out[i.dipendente_id]) out[i.dipendente_id] = i;
  return out;
}

export async function creaInvitoDipendente(dipendenteId, giorni = 14) {
  const { data, error } = await supabase.rpc("crea_invito_dipendente", {
    p_dipendente: dipendenteId, p_giorni: giorni,
  });
  if (error) throw error;
  return data;
}

/** Manda il codice per email, dal mittente aziendale verificato. */
export async function inviaInvito(codice) {
  const { data, error } = await supabase.functions.invoke("invia-invito", {
    body: { codice, sito: window.location.origin },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function annullaInvito(codice) {
  const { error } = await supabase.from("inviti").delete().eq("codice", codice);
  if (error) throw error;
}

/* ============ Manutenzione ============ */

const VECCHIO_DEPOSITO = "https://kliqbpdqufsgniqspbrb.supabase.co/storage/v1/object/public/card-center/";

/** Quante schede hanno ancora foto o allegati sul vecchio portale. */
export async function contaMediaDaMigrare() {
  const { count, error } = await supabase
    .from("schede")
    .select("id", { count: "exact", head: true })
    .or(`immagine.like.${VECCHIO_DEPOSITO}%,allegato.like.${VECCHIO_DEPOSITO}%`);
  if (error) throw error;
  return count ?? 0;
}

/** Sposta uno scaglione di media. Si richiama finché `rimasti` non è zero. */
export async function migraMedia(limite = 15) {
  const { data, error } = await supabase.functions.invoke("migra-media", { body: { limite } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/* ============ Profilo ============ */

/** La propria scheda, letta fresca: dopo un salvataggio il contesto di
 *  autenticazione non si ricarica da solo. */
export async function getMioProfilo(dipendenteId) {
  if (!dipendenteId) return null;
  const { data, error } = await supabase
    .from("dipendenti")
    .select("id, nome, cognome, email, telefono, ruolo, avatar_url, motto, avvio, created_at, zone(nome)")
    .eq("id", dipendenteId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Due tracce d'uso, per poter premiare anche chi non vende: il giorno in
 *  cui sei entrato e la scheda che hai aperto. Nessun orario, nessuna durata:
 *  serve a misurare la partecipazione, non a fare il cartellino. */
/* `supabase.rpc()` non torna una Promise vera ma un costruttore di query:
   è "thenable", quindi `await` funziona, ma `.catch()` non esiste. Da qui
   il try/catch invece della catena. */
export async function segnaPresenza() {
  try { await supabase.rpc("segna_presenza"); } catch { /* è un di più */ }
}

export async function segnaSchedaLetta(schedaId) {
  if (!schedaId) return;
  try { await supabase.rpc("segna_scheda_letta", { p_scheda: schedaId }); }
  catch { /* è un di più */ }
}

/** I numeri del proprio lavoro: da qui nascono i traguardi. */
export async function getMieiNumeri() {
  const { data, error } = await supabase.rpc("profilo_riepilogo");
  if (error) throw error;
  return numerico(data?.[0] ?? {});
}

/** I traguardi: la scala vive nel database, non nel sito. La chiamata
 *  REGISTRA anche i gradini nuovi e crea la notifica — per questo non è una
 *  semplice lettura. */
export async function getTraguardi() {
  const { data, error } = await supabase.rpc("miei_traguardi");
  if (error) throw error;
  return (data ?? []).map(numerico);
}

/** La squadra, per chi la guida. Manager: la propria filiale. Admin: tutti. */
export async function getTraguardiFiliale() {
  const { data, error } = await supabase.rpc("traguardi_filiale");
  if (error) return [];
  return (data ?? []).map(numerico);
}

/** Si cambia solo ciò che è proprio: recapito, avatar, motto, atterraggio. */
export async function salvaProfilo({ telefono, avatar_url, motto, avvio }) {
  const { error } = await supabase.rpc("aggiorna_profilo", {
    p_telefono: telefono ?? null, p_avatar: avatar_url ?? null, p_motto: motto ?? null,
    // "" = nessuna scelta personale: si torna a seguire il proprio ruolo.
    p_avvio: avvio || null,
  });
  if (error) throw error;
}

/* ---- atterraggio: dove si apre il sito dopo il login ----
   Due livelli, come per i permessi dei moduli: la regola del ruolo sta qui,
   la scelta della singola persona nel suo profilo — e quella vince. */

/** { ruolo: destinazione }. Un ruolo assente significa "home del sito". */
export async function getAvvioRuoli() {
  const { data, error } = await supabase.from("avvio_ruolo").select("ruolo, destinazione");
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [r.ruolo, r.destinazione]));
}

/** `dest` vuoto cancella la regola e riporta quel ruolo sulla home. */
export async function setAvvioRuolo(ruolo, dest) {
  const { error } = await supabase.rpc("imposta_avvio_ruolo", { p_ruolo: ruolo, p_dest: dest || null });
  if (error) throw error;
}

/** Le voci dei menu a tendina: solo ciò che l'utente può davvero vedere. */
export async function getStatFiltri() {
  const { data, error } = await supabase.rpc("stat_filtri");
  if (error) throw error;
  const righe = data ?? [];
  return {
    agenti: righe.filter((r) => r.genere === "agente"),
    promozioni: righe.filter((r) => r.genere === "promozione"),
  };
}

/** I movimenti, a pagine. `totale` viaggia su ogni riga: una query sola. */
export async function getMovimenti(filtri = {}, limite = 50, scarto = 0) {
  const { data, error } = await supabase.rpc("stat_movimenti", {
    ...par(filtri), p_limite: limite, p_scarto: scarto,
  });
  if (error) throw error;
  const righe = (data ?? []).map(numerico);
  return { righe, totale: righe[0]?.totale ?? 0 };
}

/** CSV dei movimenti: il punto e virgola perché Excel italiano si aspetta quello. */
export function movimentiToCsv(righe) {
  const testa = ["Data", "Codice cliente", "Cliente", "Città", "Promozione", "Agente",
    "Quantità", "Prezzo", "Valore", "Margine", "Esito", "Note"];
  const cella = (v) => {
    const s = v == null ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const dec = (n) => (n == null ? "" : String(n).replace(".", ","));
  return [testa.join(";")].concat(righe.map((r) => [
    new Date(r.quando).toLocaleDateString("it-IT"), r.codice, r.cliente, r.citta,
    r.promozione, r.agente, r.quantita, dec(r.prezzo), dec(r.valore), dec(r.margine),
    r.esito, r.note,
  ].map(cella).join(";"))).join("\n");
}

/** Vecchio conteggio, tenuto per il riquadro della home. */
export async function getStatistiche() {
  const [schede, clienti, esiti, dip] = await Promise.all([
    supabase.from("schede").select("id, titolo, tipo, created_at").eq("tipo", "promozione").eq("stato", "attiva"),
    supabase.from("officine").select("id, agente_id").not("agente_id", "is", null),
    supabase.from("scheda_esiti").select("scheda_id, officina_id, esito, quantita"),
    supabase.from("dipendenti").select("id, nome, cognome, ruolo"),
  ]);
  const inCarico = clienti.data ?? [];
  const agenteDi = Object.fromEntries(inCarico.map((o) => [o.id, o.agente_id]));
  const nome = Object.fromEntries((dip.data ?? []).map((d) => [d.id, `${d.nome ?? ""} ${d.cognome ?? ""}`.trim()]));

  const perScheda = new Map();
  const perAgente = new Map();
  const base = () => ({ inviate: 0, rifiutate: 0, pezzi: 0 });

  for (const e of esiti.data ?? []) {
    const s = perScheda.get(e.scheda_id) ?? base();
    if (e.esito === "accettata") { s.inviate++; s.pezzi += Number(e.quantita) || 0; }
    else if (e.esito === "rifiutata") s.rifiutate++;
    perScheda.set(e.scheda_id, s);

    const ag = agenteDi[e.officina_id];
    if (ag) {
      const a = perAgente.get(ag) ?? base();
      if (e.esito === "accettata") { a.inviate++; a.pezzi += Number(e.quantita) || 0; }
      else if (e.esito === "rifiutata") a.rifiutate++;
      perAgente.set(ag, a);
    }
  }

  const clientiDi = new Map();
  for (const o of inCarico) clientiDi.set(o.agente_id, (clientiDi.get(o.agente_id) ?? 0) + 1);
  const totaleInCarico = inCarico.length;

  return {
    schede: (schede.data ?? [])
      .map((s) => {
        const v = perScheda.get(s.id) ?? base();
        return { ...s, ...v, platea: totaleInCarico, aperte: Math.max(0, totaleInCarico - v.inviate - v.rifiutate) };
      })
      .sort((a, b) => b.inviate - a.inviate),
    agenti: [...clientiDi.entries()]
      .map(([id, quanti]) => {
        const v = perAgente.get(id) ?? base();
        return { id, nome: nome[id] ?? "—", clienti: quanti, ...v };
      })
      .sort((a, b) => b.inviate - a.inviate),
  };
}
