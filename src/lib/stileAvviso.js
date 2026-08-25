/* Aspetto degli avvisi — icona, animazione, effetto.
 *
 * Le scelte le fa CHI SCRIVE l'annuncio, non chi scrive il CSS: un avviso
 * di chiusura straordinaria e un promemoria di servizio non devono avere
 * lo stesso peso visivo, e solo chi pubblica sa quale dei due sta scrivendo.
 *
 * Un posto solo, letto da tre punti: la striscia in testa al sito, la
 * campanella nell'header e la bacheca. Aggiungere una voce qui la fa
 * comparire in tutti e tre.
 */

/** Icone proponibili. Sono nomi già presenti in components/Icon.jsx. */
export const ICONE_AVVISO = [
  { id: "megaphone", nome: "Megafono" },
  { id: "triangle-alert", nome: "Attenzione" },
  { id: "info", nome: "Informazione" },
  { id: "bell", nome: "Campanella" },
  { id: "clock", nome: "Orario" },
  { id: "timer", nome: "Scadenza" },
  { id: "tag", nome: "Promozione" },
  { id: "truck", nome: "Consegne" },
  { id: "users", nome: "Personale" },
  { id: "building-2", nome: "Filiale" },
  { id: "shield-check", nome: "Sicurezza" },
  { id: "check-circle-2", nome: "Conferma" },
  { id: "cookie", nome: "Pausa" },
  { id: "wrench", nome: "Officina" },
];

/* ---- Animazioni ----
   Solo transform e opacity: sono le uniche due proprietà che il browser
   anima senza rifare il layout. Durate fra 150 e 900 ms, come vuole
   qualunque linea guida seria sul movimento nelle interfacce. */
export const ANIMAZIONI = [
  { id: "nessuna", nome: "Ferma", nota: "nessun movimento" },
  { id: "pulsa", nome: "Pulsa", nota: "alone che respira, discreto" },
  { id: "scuoti", nome: "Scuoti", nota: "scossa ogni tanto: attira l'occhio" },
  { id: "lampeggia", nome: "Lampeggia", nota: "per gli avvisi che non si possono ignorare" },
  { id: "scorri", nome: "Scorri", nota: "entra da sinistra a ogni cambio" },
];

/** Movimento dell'ICONA. `null` = ferma. */
export function motoIcona(animazione) {
  switch (animazione) {
    case "pulsa":
      return { animate: { scale: [1, 1.12, 1] }, transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } };
    case "scuoti":
      return { animate: { rotate: [0, -14, 12, -7, 0] }, transition: { duration: 0.7, repeat: Infinity, repeatDelay: 3.4 } };
    case "lampeggia":
      return { animate: { opacity: [1, 0.25, 1] }, transition: { duration: 1.1, repeat: Infinity, ease: "easeInOut" } };
    case "scorri":
      return { initial: { x: -14, opacity: 0 }, animate: { x: 0, opacity: 1 }, transition: { type: "spring", stiffness: 300, damping: 24 } };
    default:
      return null;
  }
}

/** L'alone dietro l'icona: solo per "pulsa". */
export const haAlone = (animazione) => animazione === "pulsa";

/* ---- Effetti ---- */
export const EFFETTI = [
  { id: "nessuno", nome: "Piatto", nota: "solo il colore di fondo" },
  { id: "neon", nome: "Neon", nota: "bordo e bagliore nel colore scelto" },
  { id: "alone", nome: "Alone", nota: "ombra colorata sotto la barra" },
  { id: "bordo", nome: "Bordo marcato", nota: "riga spessa sopra e sotto" },
  { id: "sfumatura", nome: "Sfumatura", nota: "gradiente verso il rosso CRA" },
];

/** Gli effetti che hanno un secondo colore: per gli altri il selettore
 *  non si mostra nemmeno, invece di restare lì a non fare niente. */
export const EFFETTI_CON_COLORE = new Set(["neon", "alone", "bordo", "sfumatura"]);

/** Colore di serie del secondo colore, per effetto. */
export function coloreEffettoDiSerie(effetto, colore) {
  if (effetto === "sfumatura") return "#BD3432";     // rosso CRA
  if (effetto === "bordo") return "#272D2B";          // antracite
  return colore || "#FDC543";                          // neon e alone: lo stesso colore
}

/** Stile in linea da applicare al contenitore della barra.
 *  `colore` è il fondo, `colore2` il colore dell'effetto: bordo, bagliore
 *  e arrivo della sfumatura li sceglie chi scrive, non il CSS. */
export function stileEffetto(effetto, colore, colore2) {
  const c = colore || "#FDC543";
  const e = colore2 || coloreEffettoDiSerie(effetto, c);
  switch (effetto) {
    case "neon":
      return {
        boxShadow: `0 0 0 2px ${e}, 0 0 18px ${e}aa, 0 0 34px ${e}55`,
        borderBottom: `3px solid ${e}`,
      };
    case "alone":
      return { boxShadow: `0 6px 26px ${e}88` };
    case "bordo":
      // Sotto più spesso che sopra: la barra deve staccarsi da ciò che ha
      // sotto, non incorniciarsi come un quadro.
      return { borderTop: `2px solid ${e}`, borderBottom: `5px solid ${e}` };
    case "sfumatura":
      return { background: `linear-gradient(100deg, ${c} 0%, ${c} 40%, ${e} 100%)` };
    default:
      return {};
  }
}

/* ---- Countdown ----
   Un avviso con una scadenza senza il tempo che manca è mezzo avviso:
   "chiuso fino a venerdì" si legge diverso se mancano due ore o due giorni. */

/** Millisecondi → "2g 04:12:33" oppure null se è già passato. */
export function restante(fineIso, ora = Date.now()) {
  if (!fineIso) return null;
  const ms = new Date(fineIso).getTime() - ora;
  if (!(ms > 0)) return null;
  const s = Math.floor(ms / 1000);
  const g = Math.floor(s / 86400);
  const due = (n) => String(n).padStart(2, "0");
  const hh = due(Math.floor((s % 86400) / 3600));
  const mm = due(Math.floor((s % 3600) / 60));
  const ss = due(s % 60);
  return { giorni: g, testo: g > 0 ? `${g}g ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`, ms };
}

/** true quando manca meno di un'ora: è il momento di insistere. */
export const agliSgoccioli = (r) => !!r && r.ms < 3600_000;
