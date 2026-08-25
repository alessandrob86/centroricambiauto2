/* Il Web Push, senza librerie.
 *
 *   RFC 8291 — il messaggio va cifrato per QUEL dispositivo (aes128gcm), con
 *              una chiave che nasce da uno scambio ECDH fra noi e il browser.
 *              Il servizio di push (Google, Mozilla, Apple) inoltra e basta:
 *              il contenuto non lo può leggere.
 *   RFC 8292 — VAPID: si firma un gettone con la chiave privata per dire al
 *              servizio di push chi siamo.
 *
 * Sta in un file a parte da `index.ts` per una ragione precisa: così si può
 * provare senza avviare il server. Vedi `prova-cifratura.ts`, che si finge il
 * browser e rilegge quello che scriviamo.
 */

/* ── base64url ─────────────────────────────────────────────────────────── */
export function daB64u(s: string): Uint8Array {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}

export function aB64u(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const testo = (s: string) => new TextEncoder().encode(s);

export function unisci(...parti: Uint8Array[]): Uint8Array {
  const n = parti.reduce((t, p) => t + p.length, 0);
  const out = new Uint8Array(n);
  let i = 0;
  for (const p of parti) { out.set(p, i); i += p.length; }
  return out;
}

/* WebCrypto fa extract+expand in un colpo solo: è esattamente ciò che chiede
   la RFC, dove il "sale" è la chiave di estrazione. */
export async function hkdf(sale: Uint8Array, ikm: Uint8Array, info: Uint8Array, byte: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: sale, info }, k, byte * 8);
  return new Uint8Array(bits);
}

/** Le due chiavi che derivano da uno scambio ECDH più il segreto `auth`. */
export async function chiaviRecord(
  condiviso: Uint8Array, authSecret: Uint8Array,
  uaPub: Uint8Array, asPub: Uint8Array, sale: Uint8Array,
) {
  // Il segreto `auth` del browser entra come sale: senza quello la chiave non
  // si ricostruisce nemmeno conoscendo lo scambio ECDH.
  const ikm = await hkdf(authSecret, condiviso,
    unisci(testo("WebPush: info\0"), uaPub, asPub), 32);
  const cek = await hkdf(sale, ikm, testo("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sale, ikm, testo("Content-Encoding: nonce\0"), 12);
  return { cek, nonce };
}

/* ── VAPID: il gettone che ci identifica al servizio di push ───────────── */

/** Ricostruisce la chiave privata dallo scalare + il punto pubblico.
 *  WebCrypto vuole x e y, il formato VAPID standard porta solo `d`. */
export async function chiavePrivata(d: string, pubblica: string) {
  const p = daB64u(pubblica);              // 0x04 || x(32) || y(32)
  if (p.length !== 65 || p[0] !== 4) throw new Error("chiave pubblica VAPID malformata");
  return await crypto.subtle.importKey("jwk", {
    kty: "EC", crv: "P-256", d,
    x: aB64u(p.slice(1, 33)), y: aB64u(p.slice(33, 65)),
    ext: false,
  }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function gettoneVapid(endpoint: string, priv: CryptoKey, sub: string) {
  const aud = new URL(endpoint).origin;
  const testa = aB64u(testo(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = aB64u(testo(JSON.stringify({
    aud, sub, exp: Math.floor(Date.now() / 1000) + 12 * 3600,
  })));
  const firma = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, priv, testo(testa + "." + corpo));
  // ECDSA in WebCrypto esce già come r||s grezzi: è la forma che vuole ES256.
  return testa + "." + corpo + "." + aB64u(firma);
}

/* ── RFC 8291: cifra il messaggio per un solo dispositivo ──────────────── */
export async function cifra(payload: string, p256dhB64: string, authB64: string) {
  const uaPub = daB64u(p256dhB64);
  const authSecret = daB64u(authB64);

  const effimera = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", effimera.publicKey));

  const uaKey = await crypto.subtle.importKey(
    "raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const condiviso = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaKey }, effimera.privateKey, 256));

  const sale = crypto.getRandomValues(new Uint8Array(16));
  const { cek, nonce } = await chiaviRecord(condiviso, authSecret, uaPub, asPub, sale);

  const chiave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 0x02 chiude l'ultimo (e unico) record: è il delimitatore previsto.
  const chiaro = unisci(testo(payload), new Uint8Array([2]));
  const cifrato = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 }, chiave, chiaro));

  // Intestazione: sale(16) | dimensione record(4) | lunghezza chiave(1) | chiave(65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  return unisci(sale, rs, new Uint8Array([asPub.length]), asPub, cifrato);
}
