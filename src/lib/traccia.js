import { supabase } from "./supabase.js";

/**
 * Traccia l'attività di chi è LOGGATO. Dei visitatori anonimi non si tiene
 * nulla: per quelli servono strumenti fatti apposta, e questo database non è
 * il posto giusto.
 *
 * Tre regole che valgono per tutte le chiamate:
 *
 *   1. L'identità non parte mai da qui. La funzione `traccia()` sul database
 *      la ricava dal token: un cliente non può registrare attività a nome di
 *      un altro nemmeno provandoci.
 *   2. Non blocca mai niente. Nessun `await` sulla pagina, nessun errore che
 *      risale: un evento perso non vale una pagina rotta.
 *   3. Non si registra due volte la stessa cosa di fila. Aprire e chiudere
 *      lo stesso prodotto cinque volte in un minuto è una persona indecisa,
 *      non cinque visualizzazioni.
 *
 * Chi non ha fatto l'accesso non manda nemmeno la richiesta: sul database la
 * funzione `traccia()` è chiamabile solo da `authenticated` (ad `anon` è tolta
 * apposta), quindi per un visitatore anonimo la risposta sarebbe un 401 a ogni
 * pagina, rumore in console e una chiamata di rete inutile.
 */

const RIPETIZIONE_MS = 60_000;
const ultime = new Map();

function troppoPresto(chiave) {
  const ora = Date.now();
  const prima = ultime.get(chiave);
  if (prima && ora - prima < RIPETIZIONE_MS) return true;
  ultime.set(chiave, ora);
  /* La mappa non deve crescere all'infinito su una sessione lunga. */
  if (ultime.size > 200) {
    for (const [k, t] of ultime) if (ora - t > RIPETIZIONE_MS) ultime.delete(k);
  }
  return false;
}

/** Registra un fatto. Non attende, non solleva. */
export function traccia(sito, evento, oggetto = null, dettaglio = {}) {
  /* La sessione si legge dalla memoria del browser: nessuna chiamata di rete
     in più (la stessa lettura la fa comunque supabase prima di ogni rpc). */
  supabase.auth
    .getSession()
    .then(({ data }) => {
      const utente = data?.session?.user?.id;
      if (!utente) return;
      /* Nella chiave c'è anche chi: se nello stesso minuto si esce e rientra
         con un altro account, la visita del secondo non va scartata. */
      if (troppoPresto(`${utente}|${sito}|${evento}|${oggetto ?? ""}`)) return;
      return supabase.rpc("traccia", {
        p_sito: sito, p_evento: evento, p_oggetto: oggetto, p_dettaglio: dettaglio,
      });
    })
    .then(() => {}, () => {});
}

export const tracciaVisita = (sito, rotta) => traccia(sito, "visita", rotta);
export const tracciaProdotto = (codice, nome) => traccia("cra", "prodotto", codice, { nome });
export const tracciaCarrello = (codice, quantita) => traccia("cra", "carrello", codice, { quantita });
export const tracciaOrdine = (numero, totale) => traccia("cra", "ordine", numero, { totale });
export const tracciaRicerca = (testo, risultati) =>
  traccia("cra", "ricerca", String(testo ?? "").slice(0, 60), { risultati });
