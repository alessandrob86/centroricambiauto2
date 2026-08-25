/* Prova della cifratura Web Push: qui facciamo la parte del browser.
 *
 * Se sbagliassimo una stringa di `info` o l'ordine delle chiavi nell'HKDF, il
 * risultato sarebbe comunque una sequenza di byte dall'aria innocente: il
 * servizio di push la accetterebbe e la notifica non arriverebbe mai, senza un
 * errore da nessuna parte. L'unico modo di accorgersene è rileggerla.
 *
 *   deno run --allow-net=/ prova-cifratura.ts
 */
import {
  aB64u, chiaviRecord, chiavePrivata, cifra, daB64u, gettoneVapid, testo,
} from "./cifratura.ts";

let falliti = 0;
function verifica(esito: boolean, cosa: string, dettaglio = "") {
  if (!esito) falliti++;
  console.log((esito ? "ok   " : "NO   ") + cosa + (dettaglio ? "  — " + dettaglio : ""));
}

/* ── 1. Il browser finto: una coppia di chiavi e un segreto `auth` ─────── */
const browser = await crypto.subtle.generateKey(
  { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const uaPub = new Uint8Array(await crypto.subtle.exportKey("raw", browser.publicKey));
const authSecret = crypto.getRandomValues(new Uint8Array(16));

const messaggio = JSON.stringify({
  titolo: "Nuova promozione", corpo: "Sconto 20% sui filtri — scade venerdì",
  url: "/#/interno",
});

/* ── 2. Cifriamo come farebbe la edge function ─────────────────────────── */
const pacchetto = await cifra(messaggio, aB64u(uaPub), aB64u(authSecret));

/* ── 3. Rileggiamo dal lato del browser ────────────────────────────────── */
const sale = pacchetto.slice(0, 16);
const idlen = pacchetto[20];
const asPub = pacchetto.slice(21, 21 + idlen);
const cifrato = pacchetto.slice(21 + idlen);

verifica(idlen === 65, "la chiave effimera è un punto non compresso da 65 byte", "trovati " + idlen);
verifica(new DataView(pacchetto.buffer, pacchetto.byteOffset, 20).getUint32(16, false) === 4096,
  "dimensione record dichiarata a 4096");

const asKey = await crypto.subtle.importKey(
  "raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
const condiviso = new Uint8Array(await crypto.subtle.deriveBits(
  { name: "ECDH", public: asKey }, browser.privateKey, 256));

const { cek, nonce } = await chiaviRecord(condiviso, authSecret, uaPub, asPub, sale);
const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);

let letto = "";
try {
  const chiaro = new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 }, k, cifrato));
  verifica(chiaro[chiaro.length - 1] === 2, "il record finisce col delimitatore 0x02");
  letto = new TextDecoder().decode(chiaro.slice(0, -1));
} catch (e) {
  verifica(false, "decifratura", String((e as Error).message));
}
verifica(letto === messaggio, "il messaggio riletto è identico a quello mandato");

/* ── 4. Due cifrature dello stesso testo non devono somigliarsi ────────── */
const b = await cifra(messaggio, aB64u(uaPub), aB64u(authSecret));
verifica(aB64u(pacchetto) !== aB64u(b), "due invii uguali danno byte diversi (sale casuale)");

/* ── 5. Il gettone VAPID: firma valida e destinatario giusto ───────────── */
const coppia = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwkPriv = await crypto.subtle.exportKey("jwk", coppia.privateKey);
const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", coppia.publicKey));

const priv = await chiavePrivata(jwkPriv.d as string, aB64u(rawPub));
const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";
const t = await gettoneVapid(endpoint, priv, "mailto:info@centroricambiautosrl.it");

const [testa, corpo, firma] = t.split(".");
const dati = JSON.parse(new TextDecoder().decode(daB64u(corpo)));
verifica(dati.aud === "https://fcm.googleapis.com", "il gettone è intestato all'origine giusta", dati.aud);
verifica(dati.exp > Math.floor(Date.now() / 1000), "non è già scaduto");
verifica(daB64u(firma).length === 64, "firma r||s da 64 byte", daB64u(firma).length + " byte");

const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" },
  coppia.publicKey, daB64u(firma), testo(testa + "." + corpo));
verifica(ok, "la firma si verifica con la chiave pubblica");

console.log("");
console.log(falliti === 0 ? "TUTTO A POSTO" : falliti + " PROVE FALLITE");
if (falliti) Deno.exit(1);
