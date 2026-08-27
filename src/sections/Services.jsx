import React from "react";
import { Card } from "../components/ds/Card.jsx";
import { Badge } from "../components/ds/Badge.jsx";
import { Icon } from "../components/Icon.jsx";
import { Container, Reveal } from "../components/shared.jsx";

const SERVICES = [
  { id: "srv-auto", icon: "car", title: "Ricambi auto", desc: "L'assortimento più ampio per ogni marca e modello, microcar comprese.", tag: null },
  { id: "srv-moto", icon: "bike", title: "Ricambi moto", desc: "Componentistica e consumabili per le due ruote, sempre disponibili.", tag: null },
  { id: "srv-noleggio", icon: "wrench", title: "Noleggio messa in fase", desc: "Strumenti professionali per le officine, quando e dove ti servono.", tag: null },
  { id: "srv-cortesia", icon: "key-round", title: "Auto di cortesia", desc: "La mobilità dei tuoi clienti garantita durante ogni intervento.", tag: null },
  { id: "srv-elettrica", icon: "plug-zap", title: "Divisione elettrica", desc: "Una divisione dedicata ai ricambi per auto elettriche.", tag: "In arrivo" },
  { id: "srv-centralino", icon: "headset", title: "Centralino dedicato", desc: "Oltre 2.000 conversazioni gestite al mese, risposta in meno di 10 minuti.", tag: null },
];

export function Services() {
  return (
    <section id="servizi" style={{ background: "var(--surface-page)", padding: "var(--space-11) 0" }}>
      <Container>
        <Reveal>
          <div style={{ maxWidth: "640px", marginBottom: "var(--space-8)" }}>
            <h2 className="cra-h1" style={{ margin: 0 }}>Cosa facciamo</h2>
            <p className="cra-lead" style={{ marginTop: "var(--space-4)" }}>
              Dai ricambi auto e moto ai servizi pensati per le autofficine: un partner unico,
              serio e attento alle tue esigenze.
            </p>
          </div>
        </Reveal>
        <div className="grid-services" style={{ display: "grid", gap: "var(--space-5)" }}>
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={(i % 3) * 110}>
              <div id={s.id} style={{ scrollMarginTop: "120px", height: "100%" }}>
                <ServiceCard {...s} />
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

function ServiceCard({ icon, title, desc, tag }) {
  const [hover, setHover] = React.useState(false);
  const tiltRef = React.useRef(null);

  /* Tilt 3D sobrio: la card si inclina seguendo il cursore (max ~5°). */
  const onTilt = (e) => {
    const el = tiltRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-4px)`;
  };
  const resetTilt = () => { if (tiltRef.current) tiltRef.current.style.transform = "none"; };

  return (
    <div ref={tiltRef}
      onMouseMove={onTilt}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); resetTilt(); }}
      style={{ height: "100%", transition: "transform 180ms var(--ease-out)", willChange: "transform" }}>
    <Card
      elevation={hover ? "lg" : "sm"}
      style={{
        transition: "box-shadow var(--dur-base) var(--ease-standard)",
        cursor: "default",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "52px", height: "52px", borderRadius: "var(--radius-sm)",
          background: "var(--char-900)", color: "var(--cra-gold)",
          transform: hover ? "rotate(-8deg) scale(1.06)" : "none",
          transition: "transform var(--dur-slow) var(--ease-out)",
        }}>
          <Icon name={icon} size={24} color="var(--cra-gold)" />
        </span>
        {tag && <Badge tone="red" variant="solid">{tag}</Badge>}
      </div>
      <h3 className="cra-h3" style={{ margin: 0 }}>{title}</h3>
      <p className="cra-body" style={{ marginTop: "var(--space-2)", marginBottom: 0 }}>{desc}</p>
    </Card>
    </div>
  );
}

/* "Solo grandi marchi" — marquee continuo con i loghi ufficiali dei marchi
   trattati (lista fornita dall'azienda, giugno 2026). I file vivono in
   assets/brands/<slug>.svg|png: per i marchi senza logo pubblicato il chip
   ricade automaticamente sul wordmark testuale — basta aggiungere il file
   con lo slug giusto perché il logo compaia. */
const BRANDS = [
  /* L2F è il nostro marchio: l'unico chip cliccabile della fascia → www.l2f.it */
  { name: "L2F", slug: "l2f", href: "https://www.l2f.it" },
  { name: "Bosch", slug: "bosch" },
  /* dark: true → chip charcoal, per i loghi pubblicati solo in versione bianca */
  { name: "Xenergy", slug: "xenergy", dark: true },
  { name: "Valeo", slug: "valeo" },
  { name: "LuK", slug: "luk" },
  { name: "Sachs", slug: "sachs" },
  { name: "Brembo", slug: "brembo" },
  { name: "TRW", slug: "trw" },
  { name: "Kühner", slug: "kuhner" },
  { name: "INA", slug: "ina" },
  { name: "Liqui Moly", slug: "liqui-moly" },
  { name: "Japanparts", slug: "japanparts" },
  { name: "Varta", slug: "varta" },
  { name: "Purflux", slug: "purflux" },
  { name: "NGK", slug: "ngk" },
  { name: "MANN-FILTER", slug: "mann-filter" },
  { name: "Exide", slug: "exide" },
  { name: "febi", slug: "febi", dark: true },
  { name: "Gates", slug: "gates" },
  { name: "Unigom", slug: "unigom" },
  { name: "Akron Malò", slug: "akron-malo" },
  { name: "OCAP", slug: "ocap" },
  { name: "Graf", slug: "graf" },
  { name: "Saleri", slug: "saleri" },
  { name: "ContiTech", slug: "contitech" },
  { name: "MOOG", slug: "moog" },
  { name: "Meat & Doria", slug: "meat-doria" },
  { name: "Blue Print", slug: "blue-print", dark: true },
  { name: "Monroe", slug: "monroe" },
  { name: "Denso", slug: "denso" },
  { name: "UFI", slug: "ufi" },
  { name: "Jrone", slug: "jrone" },
  { name: "KYB", slug: "kyb" },
  { name: "Dayco", slug: "dayco" },
  { name: "Elring", slug: "elring" },
  { name: "Fasano", slug: "fasano" },
  { name: "Osram", slug: "osram" },
  { name: "Philips", slug: "philips" },
  { name: "Ecotechnics", slug: "ecotechnics" },
  { name: "Metelli", slug: "metelli" },
  { name: "Pierburg", slug: "pierburg" },
  { name: "WIX Filters", slug: "wix" },
  { name: "Castrol", slug: "castrol" },
  { name: "FAG", slug: "fag" },
  { name: "Miraglio", slug: "miraglio" },
  { name: "Corteco", slug: "corteco" },
  { name: "FAI", slug: "fai" },
  { name: "Victor Reinz", slug: "victor-reinz" },
  { name: "Repsol", slug: "repsol" },
  { name: "GSP", slug: "gsp" },
  { name: "Asso Marmitte", slug: "asso-marmitte" },
  { name: "MTS", slug: "mts" },
  { name: "Imasaf", slug: "imasaf" },
  { name: "SNR", slug: "snr" },
  { name: "Krios", slug: "krios" },
  { name: "CTR", slug: "ctr" },
  { name: "Selenia", slug: "selenia" },
  { name: "Wynn's", slug: "wynns" },
  { name: "Beru", slug: "beru" },
  { name: "Textar", slug: "textar" },
  { name: "LPR", slug: "lpr" },
  { name: "Errecom", slug: "errecom", dark: true },
  { name: "Yuasa", slug: "yuasa", dark: true },
];

const BRAND_LOGOS = Object.fromEntries(
  Object.entries(import.meta.glob("../assets/brands/*.{svg,png,webp}", { eager: true, query: "?url", import: "default" }))
    /* L'elenco delle estensioni sta in due posti — il glob qui sopra e questa
       espressione — e devono dire la stessa cosa. Aggiungendo webp al primo e
       dimenticando il secondo, il nome del marchio veniva `null` e la fascia
       dei loghi portava giù l'intera home. Meglio non elencarle affatto: si
       taglia l'ultima estensione, qualunque sia. */
    .map(([path, url]) => [path.split("/").pop().replace(/\.[^.]+$/, ""), url])
);

function BrandChip({ b }) {
  const src = BRAND_LOGOS[b.slug];
  const linked = !!b.href;
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: "56px", padding: "10px 20px", marginRight: "14px",
    background: b.dark ? "var(--char-800)" : "var(--surface-card)",
    /* il chip cliccabile (L2F) si distingue con bordo oro */
    border: linked ? "1px solid var(--cra-gold)" : "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)", whiteSpace: "nowrap",
  };
  const content = src
    ? <img src={src} alt={b.name} title={b.name} loading="lazy"
        style={{ height: "30px", width: "auto", maxWidth: "130px", objectFit: "contain", display: "block" }} />
    : <span style={{
        fontFamily: "var(--font-brand)", fontWeight: "var(--fw-extrabold)", fontSize: "var(--fs-md)",
        letterSpacing: "0.06em", color: "var(--char-500)", textTransform: "uppercase",
      }}>{b.name}</span>;

  if (linked) {
    return (
      <a href={b.href} target="_blank" rel="noopener noreferrer" title={`${b.name} — scopri il marchio`}
        style={{ ...base, cursor: "pointer", textDecoration: "none", transition: "box-shadow var(--dur-base) var(--ease-standard)" }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 18px rgba(253,197,67,0.45)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
        {content}
      </a>
    );
  }
  return <span style={base}>{content}</span>;
}

export function Brands() {
  const trackRef = React.useRef(null);
  /* hover: posizione del mouse nella fascia, da -1 (bordo sinistro) a +1
     (bordo destro); null quando il mouse è fuori. */
  const stateRef = React.useRef({ offset: 0, hover: null, last: 0 });

  /* Marquee guidato da rAF invece che da animazione CSS: così il mouse può
     accelerare e invertire la corsa. Verso il bordo destro i loghi corrono
     a destra, verso il sinistro a sinistra; al centro (o senza mouse) flusso
     base verso sinistra. */
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const track = trackRef.current;
    if (!track) return;
    const st = stateRef.current;
    const BASE = -38;  /* px/s — corsa naturale */
    const MAX = 480;   /* px/s — a fondo scala sul bordo */
    let raf;
    const step = (t) => {
      if (!st.last) st.last = t;
      const dt = Math.min(0.05, (t - st.last) / 1000); /* clamp: niente salti dopo un tab in background */
      st.last = t;
      let v = BASE;
      if (st.hover != null) {
        const f = st.hover;
        v = BASE * (1 - Math.abs(f)) + f * MAX;
      }
      st.offset += v * dt;
      const half = track.scrollWidth / 2; /* la lista è duplicata ×2: il loop avviene a metà */
      if (half > 0) st.offset = ((st.offset % half) + half) % half - half;
      track.style.transform = `translate3d(${st.offset.toFixed(1)}px, 0, 0)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    stateRef.current.hover = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
  };
  const onLeave = () => { stateRef.current.hover = null; };

  return (
    <section style={{ background: "var(--surface-subtle)", padding: "var(--space-8) 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
      <Container>
        <div style={{ textAlign: "center", marginBottom: "var(--space-5)" }}>
          <span className="cra-meta">Solo grandi marchi — i principali brand dell&rsquo;aftermarket</span>
        </div>
      </Container>
      <div className="brand-marquee" onMouseMove={onMove} onMouseLeave={onLeave}>
        <div ref={trackRef} className="brand-track">
          {[...BRANDS, ...BRANDS].map((b, i) => <BrandChip key={b.slug + i} b={b} />)}
        </div>
      </div>
    </section>
  );
}
