import { supabase } from "./supabase.js";

/* ============ Officine (anagrafica condivisa CRA + L2F, solo admin via RLS) ============ */

/* L'anagrafica importata dal gestionale è di migliaia di righe: non si carica
   più tutta. Attenzione, la vecchia getAllOfficine() faceva `select *` senza
   limite e PostgREST ne restituisce al massimo 1000: avrebbe mostrato 1000
   clienti su 3376 senza dirlo. Ricerca, filtri e conteggi stanno sul server. */

/** `vista`: 'con_accesso' (registrati) | 'anagrafica' (solo importati) | 'tutti'. */
export async function getOfficine({ q = "", vista = "con_accesso", stato = "", categoria = "", provincia = "", limit = 50, offset = 0 } = {}) {
  let query = supabase.from("officine").select("*", { count: "exact" });

  if (vista === "con_accesso") query = query.neq("stato", "anagrafica");
  else if (vista === "anagrafica") query = query.eq("stato", "anagrafica");
  if (stato) query = query.eq("stato", stato);
  if (provincia) query = query.ilike("provincia", provincia);
  if (categoria) {
    query = categoria === "__senza"
      ? query.is("categoria_cliente", null)
      : query.eq("categoria_cliente", categoria);
  }

  const t = q.trim();
  if (t) {
    // La P.IVA si cerca anche scritta come capita: "IT 0197 2380347".
    const like = `*${t}*`;
    const soloCifre = t.replace(/[^0-9]/g, "");
    const conds = [
      `ragione_sociale.ilike.${like}`,
      `email.ilike.${like}`,
      `citta.ilike.${like}`,
      `codice_cliente.ilike.${like}`,
      `piva.ilike.${like}`,
    ];
    if (soloCifre.length >= 4) conds.push(`piva.ilike.*${soloCifre}*`);
    query = query.or(conds.join(","));
  }

  const { data, error, count } = await query
    .order("ragione_sociale")
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { righe: data ?? [], totale: count ?? 0 };
}

/** Province presenti in anagrafica, con quante officine ciascuna. */
export async function getProvinceOfficine() {
  const { data, error } = await supabase.rpc("officine_province");
  if (error) return [];
  return (data ?? []).map((r) => ({ sigla: r.provincia, n: Number(r.n) }));
}

/** Conteggi per stato: servono alle etichette dei filtri, non all'elenco. */
export async function getContaOfficine() {
  const { data, error } = await supabase.rpc("conta_officine_per_stato");
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [r.stato, Number(r.n)]));
}

/** Quante officine per categoria cliente, contate dal database. */
export async function getContaPerCategoria() {
  const { data, error } = await supabase.rpc("conta_officine_per_categoria");
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [
    r.categoria_id || "__senza",
    { conAccesso: Number(r.con_accesso), anagrafiche: Number(r.anagrafiche) },
  ]));
}

/** Solo le officine con un account: sono poche e servono per intero
 *  (contatori, controlli di integrità). Non include le anagrafiche. */
export async function getAllOfficine() {
  const { data, error } = await supabase
    .from("officine")
    .select("*")
    .neq("stato", "anagrafica")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data ?? [];
}

/** Campi modificabili dal back-office CRA. L'anagrafica si gestisce da qui:
 *  il file del gestionale è stato un seme, non una sorgente permanente. */
export async function updateOfficina(id, patch) {
  const campi = {
    stato: patch.stato,
    codice_cliente: patch.codice_cliente || null,
    l2f_abilitata: !!patch.l2f_abilitata,
    cra_abilitata: !!patch.cra_abilitata,
    is_admin: !!patch.is_admin,
    categoria_cliente: patch.categoria_cliente || null,
  };
  // Anagrafica: si tocca solo se il pannello la manda, così le schermate che
  // non la mostrano non rischiano di svuotarla passando undefined.
  for (const k of ["ragione_sociale", "piva", "email", "telefono", "citta", "indirizzo", "provincia", "cap"]) {
    if (patch[k] !== undefined) campi[k] = String(patch[k]).trim() || null;
  }
  if (campi.ragione_sociale === null) delete campi.ragione_sociale;   // è obbligatoria
  const { error } = await supabase.from("officine").update(campi).eq("id", id);
  if (error) throw error;
}

/** Nuova anagrafica creata a mano: nasce senza account, come quelle importate. */
export async function createOfficina(f) {
  const pulisci = (v) => (String(v ?? "").trim() || null);
  const { data, error } = await supabase
    .from("officine")
    .insert({
      ragione_sociale: pulisci(f.ragione_sociale),
      codice_cliente: pulisci(f.codice_cliente),
      piva: pulisci(f.piva),
      email: pulisci(f.email),
      telefono: pulisci(f.telefono),
      citta: pulisci(f.citta),
      indirizzo: pulisci(f.indirizzo),
      provincia: pulisci(f.provincia),
      cap: pulisci(f.cap),
      categoria_cliente: pulisci(f.categoria_cliente),
      stato: "anagrafica",
      origine: "manuale",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/* ============ Categorie cliente (segmenti commerciali) ============ */

export async function getCategorieCliente() {
  const { data, error } = await supabase
    .from("categorie_cliente")
    .select("*")
    .order("sort_order")
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function createCategoriaCliente(fields) {
  const { error } = await supabase.from("categorie_cliente").insert(fields);
  if (error) throw error;
}

export async function updateCategoriaCliente(id, patch) {
  const { error } = await supabase.from("categorie_cliente").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCategoriaCliente(id) {
  const { error } = await supabase.from("categorie_cliente").delete().eq("id", id);
  if (error) throw error;
}

/* ============ Listini (gruppi di prodotti con prezzi dedicati) ============ */

/** Contenitori prezzi con le categorie assegnate e i conteggi. */
export async function getListini() {
  const [{ data, error }, prod, vari] = await Promise.all([
    supabase.from("listini").select("*, listino_categorie(categoria_id), listino_officine(officina_id)").order("priorita", { ascending: false }).order("nome"),
    supabase.from("listino_prezzi_prod").select("listino_id"),
    supabase.from("listino_prezzi_var").select("listino_id"),
  ]);
  if (error) throw error;
  const conta = (rows) => {
    const m = new Map();
    for (const r of rows ?? []) m.set(r.listino_id, (m.get(r.listino_id) ?? 0) + 1);
    return m;
  };
  // Catalogo unico: i conteggi sono prodotti e varianti, non due cataloghi.
  const nProd = conta(prod.data);
  const nVar = conta(vari.data);
  return (data ?? []).map((l) => ({
    ...l,
    categorie: (l.listino_categorie ?? []).map((x) => x.categoria_id),
    // Contenitore legato a un cliente in persona: i suoi prezzi battono quelli
    // della categoria. Vive nella scheda del cliente, non qui.
    officine: (l.listino_officine ?? []).map((x) => x.officina_id),
    n_cra: nProd.get(l.id) ?? 0,
    n_l2f: nVar.get(l.id) ?? 0,
  }));
}

export async function createListino(fields) {
  const { data, error } = await supabase.from("listini").insert(fields).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function updateListino(id, patch) {
  const { error } = await supabase.from("listini").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteListino(id) {
  const { error } = await supabase.from("listini").delete().eq("id", id);
  if (error) throw error;
}

/** Riscrive l'insieme delle categorie a cui il listino si applica. */
export async function setListinoCategorie(listinoId, categorieIds) {
  const del = await supabase.from("listino_categorie").delete().eq("listino_id", listinoId);
  if (del.error) throw del.error;
  if (!categorieIds.length) return;
  const { error } = await supabase
    .from("listino_categorie")
    .insert(categorieIds.map((categoria_id) => ({ listino_id: listinoId, categoria_id })));
  if (error) throw error;
}

/* ---- prezzi dentro un listino ---- */

/* Catalogo unico: i prezzi dedicati vivono su prodotti e varianti. La vecchia
   listino_prezzi_cra è sparita insieme a cra_products. */
const PREZZI_TAB = {
  prod: { tab: "listino_prezzi_prod", key: "product_id", prezzo: "prezzo_netto" },
  var: { tab: "listino_prezzi_var", key: "variant_id", prezzo: "prezzo_netto" },
};

/** TUTTI i prezzi dedicati, per tutte le categorie, in una lettura sola:
 *  { cra: { listinoId: { prodottoId: prezzo } }, prod: {…}, var: {…} }.
 *  La matrice mostra tutte le colonne insieme, quindi leggere un listino
 *  per volta costringerebbe a una richiesta per colonna. Oggi sono ~291
 *  righe in tutto: una manciata di KB. */
export async function getPrezziMatrice() {
  const out = {};
  for (const [k, cfg] of Object.entries(PREZZI_TAB)) {
    const { data, error } = await supabase
      .from(cfg.tab)
      .select(`listino_id, ${cfg.key}, ${cfg.prezzo}`);
    if (error) throw error;
    const perListino = {};
    for (const r of data ?? []) {
      (perListino[r.listino_id] ??= {})[r[cfg.key]] = r[cfg.prezzo];
    }
    out[k] = perListino;
  }
  return out;
}

/** Esito dell'ultimo "Aggiorna dal foglio" (scritto dalla Edge Function).
 *  Serve a sapere con CERTEZZA quali categorie sono alimentate dal foglio:
 *  dedurlo dai dati sbaglierebbe proprio nel caso pericoloso. */
export async function getUltimoSync() {
  const { data, error } = await supabase
    .from("app_config").select("value").eq("key", "sync_catalogo_ultimo").maybeSingle();
  if (error) return null;          // policy assente o riga mancante: si prosegue senza
  try { return data?.value ? JSON.parse(data.value) : null; } catch { return null; }
}

/** entries = [{ id, prezzo }]. `quale` ∈ 'cra' | 'prod' | 'var'. */
export async function saveListinoPrezzi(listinoId, quale, entries) {
  if (!entries.length) return 0;
  const cfg = PREZZI_TAB[quale];
  const rows = entries.map((e) => ({ listino_id: listinoId, [cfg.key]: e.id, [cfg.prezzo]: e.prezzo }));
  const { error } = await supabase.from(cfg.tab).upsert(rows, { onConflict: `listino_id,${cfg.key}` });
  if (error) throw error;
  return rows.length;
}

/** Toglie più prodotti da un listino in una sola richiesta: tornano al prezzo base. */
export async function removeListinoPrezziBulk(listinoId, quale, ids) {
  if (!ids.length) return 0;
  const cfg = PREZZI_TAB[quale];
  const { error } = await supabase.from(cfg.tab).delete().eq("listino_id", listinoId).in(cfg.key, ids);
  if (error) throw error;
  return ids.length;
}

/* ============ Prezzi dedicati a un singolo cliente ============ */

/* Le categorie cliente (nord, sud, vip…) coprono i gruppi. Quando serve un
   prezzo per UNA officina sola, questi prezzi vivono in un contenitore legato
   a lei sola: batte la categoria, che a sua volta batte il prezzo base.
   La gerarchia è applicata da cra_netto_utente()/l2f_netto_utente(). */

const nomePersonale = (ragioneSociale) => `Prezzi dedicati · ${ragioneSociale}`;

/** Prezzi dedicati di un'officina: { listinoId, prezzi: [{quale, id, prezzo}] }.
 *  listinoId è null finché non se ne imposta il primo. */
export async function getPrezziCliente(officinaId) {
  const { data, error } = await supabase
    .from("listino_officine").select("listino_id").eq("officina_id", officinaId).limit(1);
  if (error) throw error;
  const listinoId = data?.[0]?.listino_id ?? null;
  if (!listinoId) return { listinoId: null, prezzi: [] };
  const [p, v] = await Promise.all([
    supabase.from("listino_prezzi_prod").select("product_id, prezzo_netto").eq("listino_id", listinoId),
    supabase.from("listino_prezzi_var").select("variant_id, prezzo_netto").eq("listino_id", listinoId),
  ]);
  if (p.error) throw p.error;
  if (v.error) throw v.error;
  return {
    listinoId,
    prezzi: [
      ...(p.data ?? []).map((r) => ({ quale: "prod", id: r.product_id, prezzo: r.prezzo_netto })),
      ...(v.data ?? []).map((r) => ({ quale: "var", id: r.variant_id, prezzo: r.prezzo_netto })),
    ],
  };
}

/** Il contenitore personale del cliente, creandolo al primo prezzo e non prima:
 *  così un cliente senza prezzi speciali non lascia contenitori vuoti in giro. */
async function contenitorePersonale(officinaId, ragioneSociale) {
  const { listinoId } = await getPrezziCliente(officinaId);
  if (listinoId) return listinoId;
  const id = await createListino({
    nome: nomePersonale(ragioneSociale || "cliente"),
    descrizione: "Prezzi validi soltanto per questo cliente.",
    priorita: 100,
    attivo: true,
  });
  const { error } = await supabase.from("listino_officine").insert({ listino_id: id, officina_id: officinaId });
  if (error) throw error;
  return id;
}

/** Imposta il prezzo dedicato di una riga di catalogo per questo cliente. */
export async function setPrezzoCliente(officinaId, ragioneSociale, quale, rigaId, prezzo) {
  const listinoId = await contenitorePersonale(officinaId, ragioneSociale);
  await saveListinoPrezzi(listinoId, quale, [{ id: rigaId, prezzo }]);
  return listinoId;
}

/** Toglie il prezzo dedicato: il cliente torna a quello della sua categoria. */
export async function removePrezzoCliente(listinoId, quale, rigaId) {
  await removeListinoPrezziBulk(listinoId, quale, [rigaId]);
}

/** Prezzo base del catalogo L2F: sta su tabelle separate, non su una colonna. */
export async function saveNettiBaseL2f(quale, entries) {
  if (!entries.length) return 0;
  const tab = quale === "var" ? "product_variant_netto" : "product_netto";
  const key = quale === "var" ? "variant_id" : "product_id";
  const rows = entries.map((e) => ({ [key]: e.id, prezzo_netto: e.prezzo }));
  const { error } = await supabase.from(tab).upsert(rows, { onConflict: key });
  if (error) throw error;
  return rows.length;
}

/** Righe della matrice prezzi: prodotti + varianti del catalogo unico.
 *  La variante eredita dal prodotto padre provenienza e vetrine
 *  (`product_variants` non ha né fonte_listino né su_cra/su_l2f).
 *  Le righe portano con sé le vetrine, così l'interruttore del pannello è un
 *  filtro e non una seconda sorgente dati. */
export async function getRigheCatalogo() {
  const [prods, vars] = await Promise.all([
    supabase.from("products")
      .select("id, codice_l2f, nome, fonte_listino, marchio, su_cra, su_l2f, reparto_cra, tags, attivo, immagine, product_netto(prezzo_netto)")
      .order("codice_l2f"),
    supabase.from("product_variants")
      .select("id, product_id, codice_l2f, imballo, attivo, product_variant_netto(prezzo_netto)")
      .order("codice_l2f"),
  ]);
  if (prods.error) throw prods.error;
  if (vars.error) throw vars.error;
  const netto = (n) => (Array.isArray(n) ? n[0]?.prezzo_netto ?? null : n?.prezzo_netto ?? null);
  const padre = Object.fromEntries((prods.data ?? []).map((p) => [p.id, p]));
  return [
    ...(prods.data ?? []).map((p) => ({
      quale: "prod", id: p.id, codice: p.codice_l2f, nome: p.nome,
      fonte_listino: p.fonte_listino, marchio: p.marchio,
      su_cra: p.su_cra, su_l2f: p.su_l2f, reparto: p.reparto_cra, tags: p.tags,
      nascosto: !p.attivo, immagine: p.immagine, base: netto(p.product_netto),
    })),
    ...(vars.data ?? []).map((v) => {
      const pa = padre[v.product_id] ?? {};
      return {
        quale: "var", id: v.id, codice: v.codice_l2f, nome: `${pa.nome ?? "—"} · ${v.imballo}`,
        fonte_listino: pa.fonte_listino ?? null, marchio: pa.marchio ?? null,
        su_cra: !!pa.su_cra, su_l2f: !!pa.su_l2f, reparto: pa.reparto_cra ?? null, tags: pa.tags ?? [],
        variante: true, nascosto: !v.attivo || !pa.attivo, base: netto(v.product_variant_netto),
      };
    }),
  ];
}

/* ============ Ordini CRA (proposte del CRA Store) ============ */

export const ORDER_STATI = ["inviato", "in_lavorazione", "evaso", "annullato"];
const STATO_LABEL = { inviato: "Inviata", in_lavorazione: "In lavorazione", evaso: "Evasa", annullato: "Annullata" };
export const statoLabel = (s) => STATO_LABEL[s] ?? s;

export async function getCraOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, numero, stato, totale_listino, note, created_at, officine(ragione_sociale, codice_cliente, citta, email, telefono), order_items(id, codice_l2f, nome, imballo, prezzo_unitario, quantita, products(immagine))")
    .eq("sito", "cra")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o) => ({
    ...o,
    order_items: (o.order_items ?? []).map((it) => {
      const p = it.products;
      const immagine = Array.isArray(p) ? (p[0]?.immagine ?? null) : (p?.immagine ?? null);
      const { products: _drop, ...rest } = it;
      void _drop;
      return { ...rest, immagine };
    }),
  }));
}

export async function updateOrderStato(id, stato) {
  const { error } = await supabase.from("orders").update({ stato }).eq("id", id);
  if (error) throw error;
}

/* ============ Prodotti — catalogo unico condiviso coi due siti ============ */

/** Tutti i prodotti (l'admin vede anche i nascosti, per RLS).
 *  `codice` e `reparto` mantengono i nomi che il pannello già usa. */
export async function getAllProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_variants(id, codice_l2f, imballo, unita_prezzo, sort_order, attivo)")
    .order("sort_order")
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, codice: p.codice_l2f, categoria: p.reparto_cra }));
}

/** Pubblica o ritira in blocco una linea del foglio sul CRA Store.
 *  È il comando "quali linee L2F mostrare su CRA". */
export async function setLineaSuCra(fonteListino, pubblica) {
  const { error } = await supabase
    .from("products").update({ su_cra: !!pubblica }).eq("fonte_listino", fonteListino);
  if (error) throw error;
}

export async function getCategories() {
  const { data, error } = await supabase
    .from("cra_categories")
    .select("id, nome, parent_id, sort_order")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

/** Ritorna l'id del prodotto creato: serve a scrivere subito il prezzo base. */
export async function createProduct(fields) {
  const { data, error } = await supabase.from("products").insert(fields).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function updateProduct(id, patch) {
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

/** Prezzo base di più prodotti: entries = [{ id, prezzo }].
 *  Il prezzo base del catalogo vive in `product_netto`, non in una colonna
 *  del prodotto. NON lancia al primo errore: chi chiama tiene evidenziate le
 *  righe fallite invece di perdere tutto il lavoro. Ritorna { ok, ko }. */
export async function bulkUpdatePrices(entries) {
  const ok = [], ko = [];
  for (const e of entries) {
    const { error } = await supabase
      .from("product_netto")
      .upsert({ product_id: e.id, prezzo_netto: e.prezzo }, { onConflict: "product_id" });
    if (error) ko.push(e.id); else ok.push(e.id);
  }
  return { ok, ko };
}

/** Carica una foto prodotto sul bucket pubblico e ritorna l'URL. */
export async function uploadProductImage(file) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("cra-prodotti").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("cra-prodotti").getPublicUrl(path);
  return data.publicUrl;
}

/* ============ Sync catalogo dal foglio MASTER ============ */

/** Legge il foglio Google MASTER (service account) e aggiorna entrambi i cataloghi. */
export async function syncCatalogo() {
  const { data, error } = await supabase.functions.invoke("sync-catalogo", { body: {} });
  if (error) {
    // La function risponde {error: "..."} anche su 4xx/5xx: leggiamo il messaggio
    // vero invece del generico "Edge Function returned a non-2xx status code".
    let msg = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) msg = body.error;
    } catch { /* corpo non leggibile: teniamo il messaggio originale */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/* ============ Export ordini → CSV (riporto AS/400) ============ */

function csvField(v) {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Una riga per articolo, separatore ';' (convenzione italiana/Excel). */
export function ordersToCsv(orders) {
  const header = [
    "Numero proposta", "Data", "Codice cliente", "Ragione sociale",
    "Codice articolo", "Prodotto", "Quantita", "Prezzo unitario", "Totale riga", "Stato",
  ];
  const lines = [header.join(";")];
  for (const o of orders) {
    const data = new Date(o.created_at).toLocaleDateString("it-IT");
    for (const it of o.order_items) {
      lines.push([
        o.numero, data,
        o.officine?.codice_cliente ?? "", o.officine?.ragione_sociale ?? "",
        it.codice_l2f ?? "", it.nome ?? "", it.quantita,
        Number(it.prezzo_unitario).toFixed(2), (Number(it.prezzo_unitario) * it.quantita).toFixed(2),
        o.stato,
      ].map(csvField).join(";"));
    }
  }
  return lines.join("\r\n");
}

/* ============ Etichette prodotto: dai file del sito al deposito ============ */

const BUCKET_PRODOTTI = "cra-prodotti";

/** L'indirizzo pubblico di una cartella nel deposito condiviso. Si ricava
 *  dalla configurazione del client: nessun dominio scritto a mano. */
export function baseDeposito(cartella) {
  const { data } = supabase.storage.from(BUCKET_PRODOTTI).getPublicUrl(`${cartella}/`);
  return data.publicUrl;
}

export const baseEtichette = () => baseDeposito("labels");
export const baseDocumenti = () => baseDeposito("chimico");

export async function contaEtichetteLocali() {
  const { data, error } = await supabase.rpc("conta_etichette_locali");
  if (error) throw error;
  const r = data?.[0] ?? {};
  return { prodotti: Number(r.prodotti ?? 0), riferimenti: Number(r.riferimenti ?? 0) };
}

export async function contaDocumentiLocali() {
  const { data, error } = await supabase.rpc("conta_documenti_locali");
  if (error) throw error;
  const r = data?.[0] ?? {};
  return {
    prodotti: Number(r.prodotti ?? 0),
    tecniche: Number(r.tecniche ?? 0),
    sicurezza: Number(r.sicurezza ?? 0),
    riferimenti: Number(r.tecniche ?? 0) + Number(r.sicurezza ?? 0),
  };
}

/** Riscrive i percorsi dei documenti. Da fare DOPO il caricamento. */
export async function spostaDocumenti() {
  const { data, error } = await supabase.rpc("sposta_documenti", { p_base: baseDocumenti() });
  if (error) throw error;
  const r = data?.[0] ?? {};
  return { tecniche: Number(r.tecniche ?? 0), sicurezza: Number(r.sicurezza ?? 0) };
}

/* Il deposito non accetta qualunque nome di file: parentesi quadre e graffe,
   cancelletto, percento, tilde — e anche le lettere accentate — vengono
   respinte con un «InvalidKey» che arriva prima di ogni controllo di accesso.
   Provato sul posto: `città.pdf` non entra. Un file rifiutato così sparisce in
   silenzio, quindi il nome si sistema prima di partire, non dopo. */
const FUORI_NORMA = /[^\w!\-.*'()&$@=;:+,?\s]/g;

const senzaAccenti = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function nomeSicuro(nome) {
  const punto = nome.lastIndexOf(".");
  const stelo = punto > 0 ? nome.slice(0, punto) : nome;
  const coda = punto > 0 ? nome.slice(punto) : "";
  const pulito = senzaAccenti(stelo).replace(FUORI_NORMA, "").replace(/\s+/g, " ").trim();
  return (pulito || "file") + senzaAccenti(coda).replace(FUORI_NORMA, "");
}

/** Fa combaciare il catalogo coi nomi davvero finiti nel deposito.
 *  La mappa viaggia già codificata per l'indirizzo: il database confronta
 *  la coda dell'URL e basta, senza dover sapere niente di codifiche. */
export async function rinominaMedia(cartella, mappa) {
  if (!mappa?.length) return 0;
  const { data, error } = await supabase.rpc("rinomina_media", {
    p_cartella: cartella,
    p_mappa: mappa,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Carica i file scelti nel deposito condiviso, uno alla volta.
 *
 *  Uno alla volta e non tutti insieme: ottantacinque richieste in parallelo
 *  fanno arrabbiare qualunque server, e con `onAvanzamento` si vede a che
 *  punto siamo invece di guardare una rotella. `upsert` rende l'operazione
 *  ripetibile: se si interrompe a metà, si riparte senza duplicare. */
export async function caricaNelDeposito(files, cartella, filtro, onAvanzamento) {
  const esiti = { caricati: 0, saltati: 0, errori: [], rinominati: [] };
  const elenco = Array.from(files ?? []).filter((f) => filtro.test(f.name));
  for (const [i, file] of elenco.entries()) {
    const sicuro = nomeSicuro(file.name);
    try {
      const { error } = await supabase.storage
        .from(BUCKET_PRODOTTI)
        .upload(`${cartella}/${sicuro}`, file, {
          upsert: true,
          contentType: file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "image/webp"),
          // Un'ora, non un anno. Questi file si sostituiscono tenendo lo
          // stesso nome — è il modo in cui l'indirizzo nel catalogo resta
          // valido — quindi una cache lunga farebbe vedere per mesi la
          // versione vecchia a chi l'ha già aperta una volta. Su una scheda
          // di sicurezza non è un dettaglio estetico.
          cacheControl: "3600",
        });
      if (error) throw error;
      esiti.caricati++;
      if (sicuro !== file.name) {
        esiti.rinominati.push({
          da: encodeURIComponent(file.name),
          a: encodeURIComponent(sicuro),
          leggibile: `${file.name} → ${sicuro}`,
        });
      }
    } catch (e) {
      esiti.errori.push(`${file.name}: ${e?.message ?? e}`);
    }
    onAvanzamento?.(i + 1, elenco.length);
  }
  esiti.saltati = (files?.length ?? 0) - elenco.length;
  return esiti;
}

export const caricaEtichette = (files, onAvanzamento) =>
  caricaNelDeposito(files, "labels", /\.(webp|png|jpe?g|avif)$/i, onAvanzamento);

export const caricaDocumenti = (files, onAvanzamento) =>
  caricaNelDeposito(files, "chimico", /\.pdf$/i, onAvanzamento);

/** Riscrive i percorsi nel catalogo. Da fare DOPO il caricamento. */
export async function spostaEtichette() {
  const { data, error } = await supabase.rpc("sposta_etichette", { p_base: baseEtichette() });
  if (error) throw error;
  const r = data?.[0] ?? {};
  return { principali: Number(r.immagini_principali ?? 0), galleria: Number(r.in_galleria ?? 0) };
}

/* ============ Attività — chi entra, cosa guarda, cosa compra ============ */

const numericoAtt = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) =>
  [k, typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v]));

/** Tutto il pannello in una chiamata sola: sono sei letture piccole. */
export async function getAttivita({ dal = null, al = null, giorni = 60 } = {}) {
  const p = { p_dal: dal, p_al: al };
  const [riep, giorno, clienti, dormienti, prodotti, dipendenti] = await Promise.all([
    supabase.rpc("att_riepilogo", p),
    supabase.rpc("att_giornaliero", p),
    supabase.rpc("att_clienti", { ...p, p_limite: 300 }),
    supabase.rpc("att_dormienti", { p_giorni: giorni, p_limite: 300 }),
    supabase.rpc("att_prodotti", { ...p, p_limite: 300 }),
    supabase.rpc("att_dipendenti", p),
  ]);
  const err = riep.error || giorno.error || clienti.error || dormienti.error
    || prodotti.error || dipendenti.error;
  if (err) throw err;
  return {
    riepilogo: numericoAtt(riep.data?.[0] ?? {}),
    giorni: (giorno.data ?? []).map(numericoAtt),
    clienti: (clienti.data ?? []).map(numericoAtt),
    dormienti: (dormienti.data ?? []).map(numericoAtt),
    prodotti: (prodotti.data ?? []).map(numericoAtt),
    dipendenti: (dipendenti.data ?? []).map(numericoAtt),
  };
}

/** Avvia il download di un file (con BOM così Excel apre l'UTF-8 correttamente). */
export function downloadCsv(filename, csv) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
