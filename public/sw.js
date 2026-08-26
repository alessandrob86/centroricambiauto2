/* Service worker: l'unico pezzo di codice che resta vivo quando il sito è
   chiuso. Serve solo alle notifiche — non mette niente in cache, così non
   può servire una versione vecchia del sito dopo una pubblicazione. */

/* L'indirizzo arriva dentro la notifica, cioè da chi l'ha composta: qui non ci
   si fida di nessuno, sennò un tocco su una notifica col logo CRA aprirebbe un
   sito civetta. Il controllo c'è già nella funzione che manda, ma il service
   worker resta vivo per mesi e deve difendersi da solo.
   Guardare le prime lettere non basta: prima di risolvere un indirizzo il
   browser cambia le barre rovesce in barre e butta via tabulazioni e a capo,
   così "/\dominio.it" e "/<tab>/dominio.it" cominciano per "/" ma finiscono
   fuori dal sito. Si lascia decidere allo stesso parser che poi naviga: si
   risolve contro l'origine nostra e passa solo ciò che ci è rimasto sopra. */
function percorsoInterno(v) {
  // La stringa vuota è un indirizzo mancante, non la pagina iniziale:
  // risolta com'è porterebbe alla vetrina invece che all'area interna.
  if (typeof v !== "string" || !v.trim()) return "/#/interno";
  try {
    const u = new URL(v, self.location.origin);
    return u.origin === self.location.origin ? u.pathname + u.search + u.hash : "/#/interno";
  } catch {
    return "/#/interno";
  }
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d;
  try { d = e.data ? e.data.json() : {}; } catch { d = { titolo: e.data && e.data.text() }; }

  const titolo = d.titolo || "Centro Ricambi Auto";
  e.waitUntil(self.registration.showNotification(titolo, {
    body: d.corpo || "",
    icon: "/cra-logo-light.png",
    badge: "/favicon.png",
    // Lo stesso `tag` fa sostituire la notifica precedente invece di
    // impilarne dieci uguali.
    tag: d.tag || "cra-interno",
    data: { url: d.url || "/#/interno" },
    requireInteraction: false,
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = percorsoInterno(e.notification.data && e.notification.data.url);

  e.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Se il sito è già aperto si porta in primo piano quella scheda: aprirne
    // una nuova ogni volta lascia l'utente con dieci copie del gestionale.
    for (const f of finestre) {
      if (new URL(f.url).origin === self.location.origin) {
        await f.focus();
        if ("navigate" in f) { try { await f.navigate(url); } catch { /* stessa pagina */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
