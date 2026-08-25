import { supabase } from "./supabase.js";

/* Catalogo del CRA Store.
 *
 * Legge il CATALOGO UNICO condiviso col sito L2F (`products` + `product_variants`),
 * filtrando i prodotti pubblicati su questa vetrina (`su_cra`). Non esiste più una
 * tabella `cra_products`: L2F è il private label di CRA, quindi lo stesso articolo
 * può comparire su entrambi i siti senza essere duplicato.
 *
 * Due tassonomie convivono: il sito L2F naviga per famiglia (`family_id`), il CRA
 * Store per reparto (`reparto_cra` → `cra_categories`, albero macro→sotto).
 *
 * I prezzi arrivano da `cra_netto_utente()`: risolve il listino della categoria
 * cliente e ricade sul prezzo base. Le tabelle prezzi sono admin-only, quindi il
 * cliente riceve solo il proprio prezzo.
 */

/** Campi del prodotto che servono alla vetrina. */
const CAMPI = "id, codice_l2f, nome, descrizione, reparto_cra, immagine, immagini, tags, attributi, sort_order, garanzia, scheda_tecnica_url, scheda_sicurezza_url, cra_taglia, cra_offerta_da, cra_offerta_a, cra_offerta_prezzo, cra_offerta_etichetta";
const CAMPI_VARIANTI = "product_variants(id, codice_l2f, imballo, unita_prezzo, sort_order, attivo)";

/* ---------- Vetrina: misura delle schede e offerte a tempo ---------- */

/** Orologio del SERVER. Nelle officine i PC hanno spesso l'ora sbagliata:
 *  senza correzione due clienti nella stessa stanza vedrebbero countdown
 *  diversi. Lo scarto si misura una volta sola, al caricamento del catalogo. */
let scartoOrologio = 0;
export const adesso = () => Date.now() + scartoOrologio;

/** Misure ammesse. È lo stesso elenco chiuso che il database fa rispettare. */
export const TAGLIE = new Set(["normale", "grande", "vetrina", "vetrina_xl"]);

/** Quante schede ingrandite mostra al massimo il catalogo. Le eccedenze
 *  tornano di misura normale ma conservano il nastro dell'offerta. */
export const MAX_HERO = 1;
export const MAX_GRANDE = 2;

/** L'unico posto dove vive la regola "quanto è grande questa scheda".
 *  Una misura senza finestra d'offerta è un ingrandimento permanente; con la
 *  finestra si spegne da sola a scadenza, senza che nessuno rientri a
 *  sistemarla. */
export function tagliaEffettiva(p, ora) {
  const t = TAGLIE.has(p?.cra_taglia) ? p.cra_taglia : "normale";
  if (t === "normale" || !p.cra_offerta_a) return t;
  if (p.cra_offerta_da && Date.parse(p.cra_offerta_da) > ora) return "normale";  // programmata
  if (Date.parse(p.cra_offerta_a) <= ora) return "normale";                       // scaduta
  return t;
}

/** Stato dell'offerta di un prodotto, o null se non ne ha una da mostrare.
 *  Sopravvive ai filtri: la misura è impaginazione, l'offerta è informazione. */
export function statoOfferta(p, scaduti, ora) {
  if (!p?.cra_offerta_a) return null;
  const inizio = p.cra_offerta_da ? Date.parse(p.cra_offerta_da) : null;
  if (inizio && inizio > ora) return null;            // programmata: non si annuncia
  const fine = Date.parse(p.cra_offerta_a);
  return {
    fine,
    etichetta: p.cra_offerta_etichetta || "Offerta a tempo",
    conclusa: fine <= ora || scaduti?.has(p.id),
  };
}

/** Indici { product_id → prezzo } e { variant_id → prezzo } dai netti risolti. */
function indicizzaPrezzi(righe) {
  const perProdotto = new Map();
  const perVariante = new Map();
  for (const r of righe ?? []) {
    if (r.product_id) perProdotto.set(r.product_id, r.prezzo_netto);
    else if (r.variant_id) perVariante.set(r.variant_id, r.prezzo_netto);
  }
  return { perProdotto, perVariante };
}

/** Riga del database → forma attesa dalla vetrina.
 *  `codice` e `categoria` mantengono i nomi storici del CRA Store. */
function normalizza(row, prezzi) {
  const varianti = (row.product_variants ?? [])
    .filter((v) => v.attivo !== false)
    .map((v) => ({
      id: v.id,
      codice: v.codice_l2f,
      imballo: v.imballo,
      unita_prezzo: v.unita_prezzo,
      sort_order: v.sort_order,
      prezzo: prezzi.perVariante.get(v.id) ?? null,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const conVarianti = varianti.length > 0;
  const prezziVarianti = varianti.map((v) => v.prezzo).filter((p) => p != null);

  const { product_variants: _drop, codice_l2f, reparto_cra, ...resto } = row;
  void _drop;

  const risolto = conVarianti ? null : (prezzi.perProdotto.get(row.id) ?? null);
  const scontato = prezzoOfferta(row, risolto);

  return {
    ...resto,
    codice: codice_l2f,
    categoria: reparto_cra,
    varianti,
    conVarianti,
    /** Prezzo del prodotto senza varianti; con varianti resta null. */
    prezzo: conVarianti ? null : (scontato ?? risolto),
    /** Il prezzo barrato, presente solo quando l'offerta lo abbassa davvero. */
    prezzoPieno: scontato != null ? risolto : null,
    /** Prezzo minimo tra le varianti: è il "da €" della card. */
    prezzoDa: conVarianti
      ? (prezziVarianti.length ? Math.min(...prezziVarianti) : null)
      : (scontato ?? risolto),
  };
}

/** Il prezzo dell'offerta a tempo, se c'è ed è davvero più basso.
 *
 *  Vale solo sui prodotti SENZA varianti: un prezzo solo non può valere per
 *  un fusto da 200 litri e per una latta da 1. E vale solo se migliora: un
 *  cliente con un prezzo dedicato più basso non deve peggiorare per una promo.
 *
 *  La stessa regola sta anche nel database (`cra_prezzo_riga`), che è quello
 *  che decide davvero quanto si paga: qui serve solo a farlo VEDERE. */
export function prezzoOfferta(row, risolto, ora = adesso()) {
  if (!row?.cra_offerta_prezzo || (row.product_variants ?? []).some((v) => v.attivo !== false)) return null;
  if (row.cra_offerta_da && Date.parse(row.cra_offerta_da) > ora) return null;
  if (!row.cra_offerta_a || Date.parse(row.cra_offerta_a) < ora) return null;
  const p = Number(row.cra_offerta_prezzo);
  if (!Number.isFinite(p)) return null;
  return risolto == null || p < risolto ? p : null;
}

/** Tassonomia (macro→sotto) + prodotti pubblicati sul CRA Store.
 *  RLS: visibile solo a officine attive+abilitate (o admin). */
export async function getCatalog() {
  const [cats, prods, prezzi, ora] = await Promise.all([
    supabase.from("cra_categories").select("id, nome, parent_id, sort_order").order("sort_order"),
    supabase
      .from("products")
      .select(`${CAMPI}, ${CAMPI_VARIANTI}`)
      .eq("attivo", true)
      .eq("su_cra", true)
      .order("sort_order")
      .order("nome"),
    supabase.rpc("cra_netto_utente"),
    supabase.rpc("cra_adesso"),
  ]);
  if (cats.error) throw cats.error;
  if (prods.error) throw prods.error;
  if (prezzi.error) throw prezzi.error;
  // L'orologio è un di più: se non risponde si resta sull'ora locale, il
  // catalogo non deve fallire per questo.
  if (ora?.data) scartoOrologio = Date.parse(ora.data) - Date.now();

  const idx = indicizzaPrezzi(prezzi.data);
  return {
    categorie: cats.data ?? [],
    prodotti: (prods.data ?? []).map((p) => normalizza(p, idx)),
  };
}

/** Tassonomia ad albero: [{...macro, subs: [...]}], ordinata per sort_order. */
export function buildTree(categorie) {
  const macros = categorie.filter((c) => !c.parent_id);
  return macros.map((m) => ({ ...m, subs: categorie.filter((c) => c.parent_id === m.id) }));
}

/** Ricerca client-side su nome, codice (prodotto e varianti), tag e attributi
 *  tecnici: case-insensitive, tutti i termini devono comparire. */
export function matchProduct(p, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const attrVals = Object.values(p.attributi ?? {})
    .filter((v) => v != null && typeof v !== "object")
    .map(String);
  const codiciVarianti = (p.varianti ?? []).map((v) => v.codice);
  const hay = [p.nome, p.codice, ...codiciVarianti, ...(p.tags ?? []), ...attrVals].join(" ").toLowerCase();
  return q.split(/\s+/).every((term) => hay.includes(term));
}

/** Singolo prodotto per codice (pagina dettaglio #/store/<codice>).
 *  Accetta anche il codice di una VARIANTE: risolve al prodotto padre e
 *  segnala quale imballo preselezionare, così i vecchi link continuano a
 *  funzionare dopo l'unificazione del catalogo. */
export async function getProductByCodice(codice) {
  const selezione = `${CAMPI}, ${CAMPI_VARIANTI}, cra_categories!products_reparto_cra_fkey(nome)`;

  const [diretto, prezzi] = await Promise.all([
    supabase.from("products").select(selezione)
      .eq("codice_l2f", codice).eq("attivo", true).eq("su_cra", true).maybeSingle(),
    supabase.rpc("cra_netto_utente"),
  ]);
  if (diretto.error) throw diretto.error;
  if (prezzi.error) throw prezzi.error;

  let row = diretto.data;
  let variantePreselezionata = null;

  if (!row) {
    // Non è un codice prodotto: potrebbe essere una variante (es. un imballo d'olio).
    const v = await supabase.from("product_variants").select("id, product_id").eq("codice_l2f", codice).maybeSingle();
    if (v.error) throw v.error;
    if (!v.data) return null;
    const padre = await supabase.from("products").select(selezione)
      .eq("id", v.data.product_id).eq("attivo", true).eq("su_cra", true).maybeSingle();
    if (padre.error) throw padre.error;
    if (!padre.data) return null;
    row = padre.data;
    variantePreselezionata = v.data.id;
  }

  const cat = row.cra_categories;
  const categoria_nome = Array.isArray(cat) ? (cat[0]?.nome ?? null) : (cat?.nome ?? null);
  const { cra_categories: _drop, ...resto } = row;
  void _drop;

  return {
    ...normalizza(resto, indicizzaPrezzi(prezzi.data)),
    categoria_nome,
    variantePreselezionata,
  };
}

export function formatEuro(n) {
  if (n == null) return "su richiesta";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(n));
}

/* ---- IVA: i prezzi a DB sono netti; il toggle applica l'IVA solo a schermo ---- */
export const IVA_RATE = 0.22;
export function prezzoVisibile(net, ivaIncl) {
  if (net == null) return null;
  return ivaIncl ? Number(net) * (1 + IVA_RATE) : Number(net);
}
export function ivaNota(ivaIncl) {
  return ivaIncl ? "IVA 22% inclusa" : "IVA esclusa";
}

/** Confezione di una variante venduta AL LITRO (es. "200 L"): oltre al prezzo
 *  al litro serve il totale della confezione. Le scatole "12×1 L" (segno ×)
 *  restituiscono null: lì si mostra solo il prezzo al litro.
 *  Sostituisce il vecchio litreDrum(), che deduceva l'imballo da un attributo
 *  testuale; ora imballo e unità di prezzo sono colonne vere della variante. */
export function confezioneLitri(variante) {
  if (!variante || variante.unita_prezzo !== "litro") return null;
  const imballo = String(variante.imballo ?? "").trim();
  if (!imballo || /[x×]/i.test(imballo)) return null;
  const m = imballo.match(/^(\d+)\s*l/i);
  if (!m) return null;
  const litri = Number(m[1]);
  if (!(litri > 1) || variante.prezzo == null) return null;
  return { litri, totale: Number(variante.prezzo) * litri };
}

/** Etichetta d'unità da mostrare accanto al prezzo ("/L" oppure ""). */
export function unitaLabel(variante) {
  return variante?.unita_prezzo === "litro" ? "/L" : "";
}

/* Placeholder neutro per prodotti senza foto (data URI: nessuna richiesta di rete). */
export const PLACEHOLDER_IMG =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect width="200" height="150" fill="#f2f1ed"/><g fill="none" stroke="#c9c7c0" stroke-width="4"><circle cx="100" cy="68" r="26"/><path d="M100 46v22l14-10"/></g><text x="100" y="126" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#8a918f">Foto in arrivo</text></svg>',
  );
