/* Testo leggibile su qualunque sfondo.
 *
 * Serve dove il colore lo sceglie chi usa il pannello e non chi scrive il
 * CSS: le etichette dei tipi scheda e la barra annunci. Un testo bianco
 * fisso su un colore libero prima o poi finisce su un giallo e sparisce.
 *
 * Niente soglia da indovinare: fra bianco e antracite si prende quello che
 * dà PIÙ contrasto, misurato con la formula della WCAG.
 */

const LUM_ANTRACITE = 0.0246;   // #272D2B

export function luminanza(hex) {
  const h = String(hex ?? "").replace("#", "").trim();
  if (h.length !== 6) return null;
  const canali = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  if (canali.some(Number.isNaN)) return null;
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = canali.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Colore di testo da usare sopra `sfondo`: "var(--cra-white)" o antracite. */
export function testoSu(sfondo) {
  const L = luminanza(sfondo);
  if (L == null) return "var(--cra-white)";
  const conBianco = 1.05 / (L + 0.05);
  const conScuro = (L + 0.05) / (LUM_ANTRACITE + 0.05);
  return conScuro > conBianco ? "var(--cra-charcoal)" : "var(--cra-white)";
}

/** true se sopra quello sfondo ci va testo scuro: serve per bordi e velature. */
export const sfondoChiaro = (sfondo) => testoSu(sfondo) === "var(--cra-charcoal)";
