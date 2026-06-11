# Design

Sistema visivo del sito Centro Ricambi Auto — catturato dai token reali in `src/styles/` (fonte di verità: la guida logo ufficiale `cra-logo-guida.pdf`).

## Theme

Industriale/meccanico, ad alto contrasto. Sezioni chiare (bianco / `--char-50`) alternate a bande scure charcoal (`--char-800/900`) per i momenti scenografici: hero video-scrub, "I nostri numeri", footer. La firma del brand è la **keyline rosso→oro** (`--keyline`: gradiente 60% rosso / 40% oro) usata su eyebrow, top-stripe delle card e sottolineature animate.

## Colors

Palette ufficiale dal logo (usare le CSS custom properties, mai gli hex diretti):

- **Gold** `--cra-gold` #fdc543 — accento primario, la "C" dell'ingranaggio. Scala `--gold-50…700`.
- **Red** `--cra-red` #bd3432 — azione/CTA, energia. Scala `--red-50…700`.
- **Charcoal** `--cra-charcoal` #272d2b — inchiostro e superfici scure. Scala neutra `--char-50…900` (grigio-verde caldo).
- Alias semantici: `--text-strong/body/muted`, `--surface-page/subtle/card/dark/darker`, `--action-primary(-hover/-press)`, `--action-accent…`, `--border-subtle/strong/dark`, `--focus-ring` (oro al 70%).
- Su oro il testo è sempre scuro (`--text-on-gold` = char-900). Su scuro, testo bianco o `--char-200/300`.

## Typography

Una sola famiglia: **Spartan MB** (7 pesi, 100–900, self-hosted in `src/assets/fonts/`).

- Display/headline: ALL-CAPS, pesi heavy (`--fw-black` 900, `--fw-extrabold` 800), tracking `--ls-caps` 0.04em, line-height tight 1.02.
- Eyebrow: bold 700, 12px, tracking largo `--ls-eyebrow` 0.16em, uppercase, preceduto dal trattino keyline.
- Body: regular 400, 16px, line-height 1.55.
- Scala: `--fs-2xs` 11px → `--fs-5xl` 76px (major third). Classi pronte: `.cra-display`, `.cra-h1/h2/h3`, `.cra-lead`, `.cra-body`, `.cra-meta`.

## Components

Da `src/components/ds/` — riusare, non reinventare:

- **Button** — squadrato (radius 4px), uppercase bold; varianti `primary` (rosso), `accent` (oro), `dark`, `secondary` (outline), `ghost`; press = translateY(1px) scale(0.99).
- **Badge** — pill uppercase 11px; toni neutral/red/gold/success, solid o soft.
- **Card** — bianca, bordo hairline, radius 6px; opzione `keyline` (stripe 4px rosso→oro in alto); elevazioni sm/md/lg.
- **Input / Select** — bordo 2px, focus ring oro 3px, label uppercase 11px.
- **StatBlock** — cifra heavy oro/rossa + label uppercase ("I nostri numeri").
- **Logo** — lockup orizzontale (light su scuro), mark ingranaggio per watermark e pin mappa.
- Helpers in `src/components/shared.jsx`: `Container` (max 1200px), `Eyebrow`, `Reveal` (fade-up), `CountUp` (separatori it-IT), `ChromeButton` (bordo metallico rotante), `ScrollProgress`, `Magnetic`.

## Layout

- Container max 1200px, padding orizzontale 24px; sezioni con padding verticale 80–96px (`--space-10/11`).
- Spaziatura su griglia 4px (`--space-1…12`). Raggi contenuti (2–10px): il brand è squadrato, niente angoli morbidi.
- Header sticky a doppia barra (utility 36px + nav 76px), trasparente-vetro sopra la hero, solido charcoal allo scroll.
- Ombre neutre tinte charcoal (`--shadow-xs…xl`), mai blu.

## Motion

Meccanico e intenzionale, mai elastico: easing `--ease-standard` cubic-bezier(0.2,0,0,1) e `--ease-out` (0.16,1,0.3,1); durate 120/200/320ms.

- Hero: video-scrub 48 frame su canvas legato allo scroll (binario 520vh, 4 tappe in dissolvenza).
- Reveal fade-up con stagger ~110-140ms; count-up cubico ~1.4s; keyline che si disegnano scaleX.
- Marquee marchi 32s lineare; ingranaggi che ruotano con lo scroll; tilt 3D max 5-6° sulle card; CTA magnetica ±22%.
- Tutto con fallback `prefers-reduced-motion: reduce` (contenuto visibile di default, mai gated dall'animazione).
