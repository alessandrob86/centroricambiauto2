import { supabase } from "../../lib/supabase.js";

/* Lo strato dati del modulo «lub»: tutte le chiamate al database, in un posto solo.

   «Chi vede cosa» NON si decide qui: lo decidono le policy (vedi la migrazione).
   A un dipendente il database non manda costi, condizioni, ordini né giacenze:
   le letture del lato acquisto, per lui, tornano semplicemente vuote. */

/* 42501 = una policy ha detto no; 23505 = esiste già; 23514 = un controllo del
   database (per esempio: il marchio della casa non ha prezzi qui). */
function errore(e, quandoVaMale) {
  if (e?.code === "42501") return new Error("Non hai i permessi per farlo.");
  if (e?.code === "23514" && /catalogo/.test(e.message ?? "")) return new Error(e.message);
  if (e?.code === "23505") return new Error("Elemento già esistente: aggiorna la pagina e riprova.");
  return new Error(quandoVaMale);
}

/* Il database dà al massimo 1000 righe per volta: si legge a pagine. */
async function tutte(costruisci, quandoVaMale) {
  const passo = 1000;
  const righe = [];
  for (let da = 0; ; da += passo) {
    const { data, error } = await costruisci().range(da, da + passo - 1);
    if (error) throw errore(error, quandoVaMale);
    righe.push(...(data ?? []));
    if (!data || data.length < passo) return righe;
  }
}

const oggi = () => new Date().toISOString().slice(0, 10);

/* ---------- il catalogo d'acquisto (lo legge tutto il personale) ---------- */

/* I prezzi del marchio della casa non stanno nel modulo: li scrive il Foglio MASTER nel catalogo del
   sito, e il nucleo li passa in sola lettura (codice, prezzo, unità «litro» o «pezzo»). Se la funzione
   non risponde, il modulo funziona lo stesso: la casa resta senza prezzo. */
async function prezziCasa() {
  const { data, error } = await supabase.rpc("catalogo_prezzi_base_l2f");
  if (error) return [];
  return data ?? [];
}

export async function caricaCatalogo() {
  const [marchi, famiglie, oli, equivalenze, prezzi, casa] = await Promise.all([
    tutte(() => supabase.from("mod_lub_marchi").select("id, codice, nome, casa, attivo, sort_order").order("sort_order"), "Impossibile caricare i marchi."),
    tutte(() => supabase.from("mod_lub_famiglie").select("id, codice, titolo, sae, categoria, specifiche, note").order("codice"), "Impossibile caricare le famiglie."),
    tutte(() => supabase.from("mod_lub_oli")
      .select("id, marchio_id, codice, nome, sae, norme, omologazioni, sezione, soggetto_conou, attivo, formati:mod_lub_formati(id, olio_id, codice, descrizione, litri, pezzi_cartone, catalogo_variante_id, attivo)")
      .order("nome"), "Impossibile caricare gli oli."),
    tutte(() => supabase.from("mod_lub_equivalenze").select("id, olio_id, famiglia_id, principale, stato, nota, deciso_il").order("id"), "Non riesco a leggere le alternative."),
    tutte(() => supabase.from("mod_lub_prezzi_vendita").select("id, formato_id, prezzo, nota, aggiornato_il").order("id"), "Non riesco a leggere i prezzi di vendita."),
    prezziCasa(),
  ]);
  for (const o of oli) {
    o.formati = (o.formati ?? []).map((f) => ({ ...f, litri: Number(f.litri) })).sort((a, b) => a.litri - b.litri || a.codice.localeCompare(b.codice));
  }
  return { marchi, famiglie, oli, equivalenze, prezzi, prezziCasa: casa };
}

/* ---------- il lato acquisto (arriva solo a chi comanda) ---------- */

export async function caricaAcquisto() {
  const [costi, condizioni, rotazione, impostazioni, segnalazioni, listini] = await Promise.all([
    tutte(() => supabase.from("mod_lub_costi").select("id, formato_id, voce, unita, prezzo, valido_dal").is("valido_al", null).order("id"), "Non riesco a leggere i costi."),
    tutte(() => supabase.from("mod_lub_condizioni").select("id, marchio_id, regole, note, valido_dal, valido_al, creato_il").order("valido_dal", { ascending: false }), "Impossibile caricare le condizioni."),
    tutte(() => supabase.from("mod_lub_rotazione").select("id, zona_id, formato_id, prelievi, giacenza, classe, periodo").order("id"), "Non riesco a leggere la rotazione."),
    tutte(() => supabase.from("mod_lub_impostazioni").select("id, chiave, valore").order("chiave"), "Impossibile caricare le impostazioni."),
    tutte(() => supabase.from("mod_lub_segnalazioni").select("id, equivalenza_id, motivo, stato, risposta, creato_il, deciso_il, autore:dipendenti!creato_da(nome, cognome)").order("creato_il", { ascending: false }), "Impossibile caricare le segnalazioni."),
    tutte(() => supabase.from("mod_lub_import").select("id, marchio_id, nome_file, fonte, valido_dal, stato, riepilogo, creato_il").order("valido_dal", { ascending: false }), "Impossibile caricare i listini."),
  ]);
  return { costi, condizioni, rotazione, impostazioni, segnalazioni, listini };
}

/* ---------- prezzi di vendita (li scrive l'amministratore) ---------- */

export async function salvaPrezzoVendita(formatoId, prezzo) {
  /* `aggiornato_da` non si manda: lo scrive il database. */
  const { error } = await supabase.from("mod_lub_prezzi_vendita")
    .upsert({ formato_id: formatoId, prezzo }, { onConflict: "formato_id" });
  if (error) throw errore(error, "Impossibile salvare il prezzo.");
}

export async function salvaPrezziVendita(voci) {
  if (!voci.length) return;
  const { error } = await supabase.from("mod_lub_prezzi_vendita")
    .upsert(voci.map((v) => ({ formato_id: v.formatoId, prezzo: v.prezzo })), { onConflict: "formato_id" });
  if (error) throw errore(error, "Impossibile salvare i prezzi.");
}

export async function eliminaPrezzoVendita(formatoId) {
  const { error } = await supabase.from("mod_lub_prezzi_vendita").delete().eq("formato_id", formatoId);
  if (error) throw errore(error, "Impossibile rimuovere il prezzo.");
}

/* ---------- alternative e segnalazioni ---------- */

export async function decidiEquivalenze(ids, stato) {
  if (!ids.length) return;
  const { error } = await supabase.from("mod_lub_equivalenze").update({ stato }).in("id", ids);
  if (error) throw errore(error, "Impossibile salvare la decisione.");
}

export async function segnala(equivalenzaId, motivo) {
  const { error } = await supabase.from("mod_lub_segnalazioni").insert({ equivalenza_id: equivalenzaId, motivo });
  if (error) throw errore(error, "Impossibile inviare la segnalazione.");
}

export async function chiudiSegnalazione(id, risposta) {
  const { error } = await supabase.from("mod_lub_segnalazioni").update({ stato: "chiusa", risposta: risposta || null }).eq("id", id);
  if (error) throw errore(error, "Impossibile chiudere la segnalazione.");
}

/* ---------- condizioni: non si cambiano, se ne apre una versione nuova ---------- */

export async function nuoveCondizioni(marchioId, regole, note, vecchiaId) {
  if (vecchiaId) {
    const { error } = await supabase.from("mod_lub_condizioni").update({ valido_al: oggi() }).eq("id", vecchiaId);
    if (error) throw errore(error, "Impossibile chiudere le condizioni precedenti.");
  }
  const { error } = await supabase.from("mod_lub_condizioni").insert({ marchio_id: marchioId, regole, note: note || null });
  if (error) {
    /* Se la nuova non entra, la vecchia torna valida: un marchio non resta senza condizioni. */
    if (vecchiaId) await supabase.from("mod_lub_condizioni").update({ valido_al: null }).eq("id", vecchiaId);
    throw errore(error, "Impossibile salvare le nuove condizioni.");
  }
}

export async function salvaImpostazione(chiave, valore) {
  const { error } = await supabase.from("mod_lub_impostazioni").upsert({ chiave, valore }, { onConflict: "chiave" });
  if (error) throw errore(error, "Impossibile salvare l'impostazione.");
}

/* ---------- ordini ---------- */

export async function elencaOrdini() {
  return tutte(() => supabase.from("mod_lub_ordini")
    .select("id, marchio_id, zona_id, stato, riferimento, creato_il, aggiornato_il, autore:dipendenti!creato_da(nome, cognome), righe:mod_lub_ordini_righe(count)")
    .order("creato_il", { ascending: false }), "Impossibile caricare gli ordini.");
}

export async function caricaOrdine(id) {
  const { data, error } = await supabase.from("mod_lub_ordini")
    .select("id, marchio_id, zona_id, stato, riferimento, condizioni, note_fornitore, note_interne, creato_il, righe:mod_lub_ordini_righe(id, formato_id, codice, descrizione, cartoni, pezzi, omaggi, costo_unitario, costo_netto, classe_abc, nota)")
    .eq("id", id).single();
  if (error) throw errore(error, "Impossibile aprire l'ordine.");
  return data;
}

/* Salva testata e righe. Le righe si riscrivono tutte: un ordine ne ha poche
   decine, e così non resta mai una riga vecchia dimenticata. */
export async function salvaOrdine(testata, righe) {
  const campi = {
    marchio_id: testata.marchio_id, zona_id: testata.zona_id, stato: testata.stato || "bozza",
    riferimento: testata.riferimento || null, condizioni: testata.condizioni ?? {},
    note_fornitore: testata.note_fornitore || null, note_interne: testata.note_interne || null,
  };
  let id = testata.id;
  if (id) {
    const { error } = await supabase.from("mod_lub_ordini").update(campi).eq("id", id);
    if (error) throw errore(error, "Impossibile salvare l'ordine.");
    const { error: e2 } = await supabase.from("mod_lub_ordini_righe").delete().eq("ordine_id", id);
    if (e2) throw errore(e2, "Impossibile aggiornare le righe dell'ordine.");
  } else {
    const { data, error } = await supabase.from("mod_lub_ordini").insert(campi).select("id").single();
    if (error) throw errore(error, "Impossibile salvare l'ordine.");
    id = data.id;
  }
  if (righe.length) {
    const { error } = await supabase.from("mod_lub_ordini_righe").insert(righe.map((r) => ({ ...r, ordine_id: id })));
    if (error) throw errore(error, "Ordine salvato, ma le righe no: riprova.");
  }
  return id;
}

export async function cambiaStatoOrdine(id, stato) {
  const { error } = await supabase.from("mod_lub_ordini").update({ stato }).eq("id", id);
  if (error) throw errore(error, "Impossibile aggiornare lo stato dell'ordine.");
}
