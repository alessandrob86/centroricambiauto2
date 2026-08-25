/* Service worker: l'unico pezzo di codice che resta vivo quando il sito è
   chiuso. Serve solo alle notifiche — non mette niente in cache, così non
   può servire una versione vecchia del sito dopo una pubblicazione. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
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
  const url = (e.notification.data && e.notification.data.url) || "/#/interno";

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
