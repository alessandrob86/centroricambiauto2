import { supabase } from "./supabase.js";

/* Notifiche push — il lato browser.
 *
 * Quattro pezzi devono combaciare: il service worker registrato, il permesso
 * dato dalla persona, un'iscrizione firmata con la chiave VAPID pubblica, e
 * la stessa iscrizione salvata nel database. Se ne manca uno la notifica non
 * arriva e nessuno se ne accorge, quindi qui ogni passo dice come è andato.
 *
 * Il permesso lo può chiedere solo un gesto vero della persona: chiamare
 * `attiva()` fuori da un clic viene ignorato dal browser.
 */

export const supportate = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const iOS = () => typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
   (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const installata = () => typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

/* «Non supportate» è vero ma inutile: quasi sempre il motivo è uno di due, e
   tutti e due si risolvono. Dirlo cambia un vicolo cieco in un'istruzione. */
export function perche() {
  if (typeof window === "undefined") return "non-supportate";
  // Senza contesto sicuro il service worker non esiste proprio: succede
  // aprendo il sito da un indirizzo di rete tipo http://192.168.1.24:5173
  if (!window.isSecureContext) return "non-sicuro";
  if (iOS() && !installata()) return "ios-da-installare";
  return "non-supportate";
}

/** Lo stato attuale, per disegnare l'interruttore senza indovinare. */
export async function statoPush() {
  if (!supportate()) return { stato: perche(), iscritto: false };
  if (Notification.permission === "denied") return { stato: "negato", iscritto: false };

  const reg = await navigator.serviceWorker.getRegistration("/");
  const sott = reg ? await reg.pushManager.getSubscription() : null;
  return {
    stato: Notification.permission === "granted" && sott ? "attive" : "spente",
    iscritto: !!sott,
    endpoint: sott?.endpoint ?? null,
  };
}

const daB64u = (s) => {
  const p = (s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};
const aB64u = (buf) => {
  const b = new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/* Un nome leggibile del dispositivo, per riconoscerlo nell'elenco. Non è
   un'impronta: solo browser e sistema, quanto basta a dire "questo è il
   telefono" invece di mostrare un endpoint di duecento caratteri. */
function nomeDispositivo() {
  const u = navigator.userAgent;
  const browser = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera"
    : /Chrome\//.test(u) ? "Chrome" : /Firefox\//.test(u) ? "Firefox"
      : /Safari\//.test(u) ? "Safari" : "Browser";
  const sistema = /Android/.test(u) ? "Android" : /iPhone|iPad/.test(u) ? "iOS"
    : /Windows/.test(u) ? "Windows" : /Mac OS/.test(u) ? "Mac" : /Linux/.test(u) ? "Linux" : "";
  return sistema ? `${browser} su ${sistema}` : browser;
}

/** Registra il service worker. Idempotente: il browser riusa quello che c'è. */
export async function registraWorker() {
  if (!supportate()) throw new Error("Questo browser non supporta le notifiche push.");
  return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Chiede il permesso e iscrive il dispositivo. Da chiamare dentro un clic. */
export async function attiva() {
  if (!supportate()) throw new Error("Questo browser non supporta le notifiche push.");

  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") {
    throw new Error(permesso === "denied"
      ? "Le notifiche sono bloccate per questo sito: si riattivano dal lucchetto nella barra dell'indirizzo."
      : "Permesso non concesso.");
  }

  const { data: chiave, error: errChiave } = await supabase.rpc("chiave_push");
  if (errChiave) throw errChiave;
  if (!chiave) throw new Error("Chiave VAPID non configurata sul server.");

  const reg = await registraWorker();
  await navigator.serviceWorker.ready;

  // Se c'è già un'iscrizione fatta con un'altra chiave va buttata, sennò
  // `subscribe` fallisce e non si capisce perché.
  const vecchia = await reg.pushManager.getSubscription();
  if (vecchia) {
    const attuale = aB64u(vecchia.options?.applicationServerKey ?? new ArrayBuffer(0));
    if (attuale !== chiave) await vecchia.unsubscribe();
  }

  const sott = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: daB64u(chiave),
  });

  const j = sott.toJSON();
  const { error } = await supabase.rpc("salva_iscrizione_push", {
    p_endpoint: sott.endpoint,
    p_p256dh: j.keys.p256dh,
    p_auth: j.keys.auth,
    p_dispositivo: nomeDispositivo(),
  });
  if (error) throw error;

  return { endpoint: sott.endpoint, dispositivo: nomeDispositivo() };
}

/** Disiscrive questo dispositivo. Il permesso del browser resta: si toglie
 *  solo dalle impostazioni del browser, non da qui. */
export async function disattiva() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sott = reg ? await reg.pushManager.getSubscription() : null;
  if (!sott) return false;

  // Prima il database, poi il browser: al contrario, se la seconda fallisse
  // resterebbe un'iscrizione registrata che non riceve più niente.
  await supabase.rpc("rimuovi_iscrizione_push", { p_endpoint: sott.endpoint });
  await sott.unsubscribe();
  return true;
}

/** Manda una notifica di prova solo a se stessi. */
export async function provaPush() {
  const { data, error } = await supabase.functions.invoke("invia-push", {
    body: {
      prova: true,
      titolo: "Notifiche attive",
      corpo: "Se leggi questo, funzionano.",
      url: "/#/interno",
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Manda una notifica vera. `zone` e `ruoli` filtrano i destinatari. */
export async function inviaPush({ titolo, corpo, url, zone, ruoli, utenti }) {
  const { data, error } = await supabase.functions.invoke("invia-push", {
    body: { titolo, corpo, url, zone, ruoli, utenti },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/** I dispositivi iscritti di chi sta guardando. */
export async function mieiDispositivi() {
  const { data, error } = await supabase
    .from("push_iscrizioni")
    .select("id, dispositivo, endpoint, created_at, ultimo_uso")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
