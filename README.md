# Centro Ricambi Auto — Sito web

Sito marketing di Centro Ricambi Auto srl, implementato in React + Vite dal design system
"Centro Ricambi Auto Design System" (Claude Design).

## Comandi

```bash
npm install      # prima volta
npm run dev      # sviluppo → http://localhost:5173
npm run build    # produzione → cartella dist/
npm run preview  # anteprima della build
```

**Per pubblicare online**: esegui `npm run build` e carica il **contenuto della cartella `dist/`**
su qualsiasi hosting (Aruba, Netlify, Vercel, GitHub Pages…). Nessun server richiesto: è un sito statico.

## Struttura

- `src/styles/` — token del design system (colori, font Spartan MB, tipografia, spaziature) + animazioni globali
- `src/components/ds/` — componenti del design system (Logo, Button, Badge, Card, Input, Select, StatBlock)
- `src/components/` — `Icon` (wrapper lucide-react), `shared.jsx` (Container, Eyebrow, Reveal, CountUp, ChromeButton)
- `src/sections/` — le sezioni/pagine: Header, Hero (video-scrub a 4 tappe), Services, Stats, Locations (mappa Leaflet), Contact, About (slider foto), Legal (privacy/cookie + banner)
- `src/App.jsx` — router a hash (`#/home`, `#/chisiamo`, `#/contatti`, `#/privacy`, `#/cookie`)
- `src/assets/` — frame della hero (48), loghi, sfondi, foto sedi, font

## Note

- **Sedi**: 5 attive (Rozzano, Collecchio, Fiorenzuola d'Arda, Napoli Poggioreale, Napoli Vomero) — Via Stadera esclusa.
- **Form preventivo**: compone una email `mailto:` verso ordini@centroricambiautosrl.it.
- **Testi legali**: Privacy e Cookie Policy sono incorporate da **iubenda** (policy 86943908) con embed diretto nel corpo pagina (`iub-body-embed`); si aggiornano da sole quando le modifichi sul portale iubenda.
- **Banner cookie**: **iubenda Cookie Solution** (siteId 3034015), caricata da `index.html` — consenso per finalità, prova del consenso, bottone flottante di revoca. Il bottone "Modifica le preferenze cookie" nella Cookie Policy apre il pannello via `_iub.cs.api.openPreferences()`.
- **Mappa**: tile CARTO light, nessuna API key.
- Tutte le animazioni rispettano `prefers-reduced-motion`.
- `node_modules` deve restare su disco locale: `npm install` fallisce nelle cartelle sincronizzate Google Drive.
