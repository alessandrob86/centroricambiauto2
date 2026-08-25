import { supabase } from "./supabase.js";
import { tracciaOrdine } from "./traccia.js";

/**
 * Invia la proposta d'ordine del CRA Store.
 * Modello RFQ: nessun pagamento — l'ordine nasce 'inviato' e l'azienda
 * conferma disponibilità via email. sito='cra' fa scattare la numerazione
 * CRA-YYYY-NNNNN e le policy RLS per-sito (serve officina attiva+abilitata).
 */
export async function submitOrder({ officinaId, items, note, totale }) {
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      officina_id: officinaId,
      sito: "cra",
      note: note?.trim() || null,
      totale_listino: totale,
      totale_netto: totale,
    })
    .select("id, numero")
    .single();
  if (error) throw error;

  // Catalogo unico: si riferiscono prodotto e variante, come fanno gli ordini
  // L2F. `codice_l2f` resta lo snapshot del codice al momento dell'ordine.
  const rows = items.map((it) => ({
    order_id: order.id,
    product_id: it.product_id ?? null,
    variant_id: it.variant_id ?? null,
    imballo: it.imballo ?? null,
    codice_l2f: it.codice,
    nome: it.nome,
    prezzo_unitario: it.prezzo ?? 0,
    quantita: it.quantita,
  }));
  const { error: e2 } = await supabase.from("order_items").insert(rows);
  if (e2) throw e2;

  tracciaOrdine(order.numero, totale);

  // Notifica email (best-effort): non blocca la conferma se fallisce.
  try {
    await supabase.functions.invoke("send-order-cra", { body: { order_id: order.id } });
  } catch {
    /* la proposta è comunque registrata a DB */
  }

  return order;
}

/** Proposte d'ordine dell'officina loggata sul CRA Store (RLS: solo le proprie). */
export async function getMyOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, numero, stato, totale_listino, note, created_at, order_items(id, codice_l2f, nome, prezzo_unitario, quantita)")
    .eq("sito", "cra")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const STATO_LABEL = {
  inviato: "Inviata",
  in_lavorazione: "In lavorazione",
  evaso: "Evasa",
  annullato: "Annullata",
};
export const statoLabel = (s) => STATO_LABEL[s] ?? s;
