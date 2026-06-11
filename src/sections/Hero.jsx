import React from "react";
import { Button } from "../components/ds/Button.jsx";
import { Badge } from "../components/ds/Badge.jsx";
import { Container, Eyebrow, CountUp, Magnetic } from "../components/shared.jsx";

/* ============================================================
   HERO video-scrub "scrollytelling": 48 frame (assets/hero-seq/)
   su canvas. Desktop: binario 520vh con quattro tappe.
   Mobile (≤820px): binario 260vh, solo tappa 1 + tappa finale —
   l'utente raggiunge i contenuti reali molto prima.
   ============================================================ */
const FRAME_URLS = Object.entries(
  import.meta.glob("../assets/hero-seq/frame-*.jpg", { eager: true, query: "?url", import: "default" })
).sort(([a], [b]) => a.localeCompare(b)).map(([, url]) => url);
const FRAME_COUNT = FRAME_URLS.length;

const MOBILE_MQ = "(max-width: 820px)";

export function Hero({ onNavigate }) {
  const wrapRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const s1Ref = React.useRef(null);
  const s2Ref = React.useRef(null);
  const s3Ref = React.useRef(null);
  const s4Ref = React.useRef(null);
  const cueRef = React.useRef(null);
  const imagesRef = React.useRef([]);
  const stateRef = React.useRef({ frame: -1 });
  const [play, setPlay] = React.useState(false);

  /* Entrance solo a documento visibile (hidden docs congelano le animazioni) */
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.visibilityState === "visible") { setPlay(true); return; }
    const onVis = () => { if (document.visibilityState === "visible") setPlay(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* Disegna un frame sul canvas con fit "cover" */
  const draw = React.useCallback((idx) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[idx];
    if (!canvas || !img || !img.complete || !img.naturalWidth) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    const ctx = canvas.getContext("2d");
    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    stateRef.current.frame = idx;
  }, []);

  /* Caricamento frame: il primo subito, il resto dopo il load della pagina
     (non compete con font/foto su connessioni lente). Ogni frame, appena
     pronto, ridisegna se è quello corrente — così un refresh a metà binario
     non lascia mai il canvas vuoto. */
  React.useEffect(() => {
    let alive = true;
    const imgs = new Array(FRAME_COUNT);
    imagesRef.current = imgs;

    const load = (i) => {
      const im = new Image();
      im.onload = () => {
        if (!alive) return;
        const cur = stateRef.current.frame;
        if (cur === i || (cur === -1 && i === 0)) { stateRef.current.frame = -1; draw(i); }
      };
      im.src = FRAME_URLS[i];
      imgs[i] = im;
    };

    load(0);
    const loadRest = () => { if (!alive) return; for (let i = 1; i < FRAME_COUNT; i++) load(i); };
    if (document.readyState === "complete") {
      loadRest();
    } else {
      window.addEventListener("load", loadRest, { once: true });
    }

    const onResize = () => { const cur = Math.max(0, stateRef.current.frame); stateRef.current.frame = -1; draw(cur); };
    window.addEventListener("resize", onResize);
    return () => { alive = false; window.removeEventListener("resize", onResize); window.removeEventListener("load", loadRest); };
  }, [draw]);

  /* Scrub con lo scroll + regia delle tappe di contenuto */
  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobileMq = window.matchMedia(MOBILE_MQ);
    /* opacità a campana: sale tra a→b, piena tra b→c, scende tra c→d */
    const stage = (el, p, a, b, c, d) => {
      if (!el) return;
      let op;
      if (p < a) op = 0; else if (p < b) op = (p - a) / (b - a); else if (p < c) op = 1; else if (p < d) op = 1 - (p - c) / (d - c); else op = 0;
      el.style.opacity = String(op);
      el.style.pointerEvents = op > 0.5 ? "auto" : "none";
      /* le tappe invisibili escono dal tab order e dall'albero accessibilità */
      el.style.visibility = op === 0 ? "hidden" : "visible";
      el.setAttribute("aria-hidden", op === 0 ? "true" : "false");
      if (!reduced) {
        const dir = p < b ? 1 : -1;
        el.style.transform = "translateY(" + ((1 - op) * 46 * dir) + "px)";
      }
    };
    const compute = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const vh = window.innerHeight;
      const total = wrap.offsetHeight - vh;
      const passed = Math.min(Math.max(-wrap.getBoundingClientRect().top, 0), total);
      const progress = total > 0 ? passed / total : 0;
      if (!reduced) {
        const idx = Math.min(FRAME_COUNT - 1, Math.round(progress * (FRAME_COUNT - 1)));
        if (idx !== stateRef.current.frame) draw(idx);
      }
      if (mobileMq.matches) {
        /* binario corto: tappa 1 → video → tappa finale */
        stage(s1Ref.current, progress, -1, 0, 0.3, 0.45);
        stage(s4Ref.current, progress, 0.55, 0.7, 2, 3);
      } else {
        stage(s1Ref.current, progress, -1, 0, 0.16, 0.24);
        stage(s2Ref.current, progress, 0.28, 0.37, 0.47, 0.55);
        stage(s3Ref.current, progress, 0.57, 0.65, 0.72, 0.79);
        stage(s4Ref.current, progress, 0.81, 0.89, 2, 3); /* Chi siamo — resta fino alla fine */
      }
      if (cueRef.current) cueRef.current.style.opacity = progress < 0.04 ? "1" : "0";
    };
    const onScroll = () => compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    compute();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [draw]);

  return (
    <section ref={wrapRef} className={"hero-rail" + (play ? " hero-play" : "")}
      style={{ position: "relative", background: "var(--surface-dark)", color: "var(--cra-white)", marginTop: "calc(-1 * var(--header-total))" }}>
      {/* pannello sticky: canvas + contenuto */}
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        <canvas ref={canvasRef} aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
        {/* overlay di leggibilità */}
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(90deg, rgba(20,24,23,0.92) 0%, rgba(20,24,23,0.72) 42%, rgba(20,24,23,0.28) 100%), linear-gradient(0deg, rgba(20,24,23,0.8) 0%, rgba(20,24,23,0) 26%)",
        }}></div>

        {/* —— Tappa 1: Il vero specialista —— */}
        <div ref={s1Ref} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", willChange: "transform, opacity" }}>
          <Container style={{ width: "100%" }}>
            <div style={{ maxWidth: "640px", paddingTop: "56px" }}>
              <div className="hero-line" style={{ animationDelay: "60ms" }}>
                <Eyebrow onDark>Da oltre 30 anni al tuo fianco</Eyebrow>
              </div>
              <h1 className="cra-display" aria-label="Il vero specialista dei ricambi" style={{ color: "var(--cra-white)", fontSize: "var(--fs-5xl)", margin: 0, textShadow: "0 2px 24px rgba(0,0,0,0.45)" }}>
                <span className="hero-line" style={{ display: "block", animationDelay: "140ms" }}>Il vero</span>
                <span className="hero-line" style={{ display: "block", animationDelay: "240ms" }}>specialista</span>
                <span className="hero-line" style={{ display: "block", animationDelay: "340ms", color: "var(--cra-gold)" }}>dei ricambi</span>
              </h1>
              <div className="hero-line" style={{ animationDelay: "460ms" }}>
                <p className="cra-lead" style={{ color: "var(--char-200)", maxWidth: "46ch", marginTop: "var(--space-5)", textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}>
                  Un assortimento senza paragoni per auto, microcar e moto. Al fianco di centinaia di
                  officine e carrozzerie con i principali brand dell&rsquo;aftermarket.
                </p>
              </div>
              <div className="hero-line" style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginTop: "var(--space-7)", flexWrap: "wrap", animationDelay: "580ms" }}>
                <Magnetic><Button variant="primary" size="lg" onClick={() => onNavigate("contatti")}>Richiedi un preventivo</Button></Magnetic>
                <Badge tone="gold" variant="solid" style={{ fontSize: "var(--fs-xs)", padding: "8px 14px" }}>
                  Auto · Moto · Microcar · Elettrico
                </Badge>
              </div>
              <div className="hero-line hero-ministats" style={{ display: "flex", gap: "var(--space-6)", marginTop: "var(--space-8)", flexWrap: "wrap", animationDelay: "700ms" }}>
                <MiniStat n="65.000" l="Prodotti codificati" />
                <Divider />
                <MiniStat n="5" l="Sedi in Italia" />
                <Divider />
                <MiniStat n="450" l="Ordini evasi / giorno" />
              </div>
            </div>
          </Container>
        </div>

        {/* —— Tappa 2: Solo grandi marchi (solo desktop) —— */}
        <div ref={s2Ref} className="hero-stage-desktop" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", opacity: 0, visibility: "hidden", pointerEvents: "none", willChange: "transform, opacity" }}>
          <Container style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ maxWidth: "560px", paddingTop: "56px" }}>
              <h2 className="cra-display" style={{ color: "var(--cra-white)", fontSize: "var(--fs-4xl)", margin: 0, textShadow: "0 2px 24px rgba(0,0,0,0.45)" }}>
                65.000 prodotti<br /><span style={{ color: "var(--cra-gold)" }}>codificati</span>
              </h2>
              <p className="cra-lead" style={{ color: "var(--char-200)", marginTop: "var(--space-5)", textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}>
                La più ampia offerta e la migliore convenienza, solo dai leader dell&rsquo;aftermarket.
              </p>
            </div>
          </Container>
        </div>

        {/* —— Tappa 3: Le sedi / arrivo (solo desktop) —— */}
        <div ref={s3Ref} className="hero-stage-desktop" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, visibility: "hidden", pointerEvents: "none", willChange: "transform, opacity" }}>
          <div style={{ maxWidth: "680px", textAlign: "center", paddingTop: "56px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h2 className="cra-display" style={{ color: "var(--cra-white)", fontSize: "var(--fs-4xl)", margin: 0, textShadow: "0 2px 24px rgba(0,0,0,0.45)" }}>
              5 sedi <span style={{ color: "var(--cra-gold)" }}>al tuo fianco</span>
            </h2>
            <p className="cra-lead" style={{ color: "var(--char-200)", marginTop: "var(--space-5)", maxWidth: "52ch", textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}>
              Rozzano, Collecchio, Fiorenzuola d&rsquo;Arda, Napoli Poggioreale e Vomero.
              Spedizioni precise e affidabili, risposta in meno di 10 minuti.
            </p>
            <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-7)", justifyContent: "center", flexWrap: "wrap" }}>
              <Button variant="light" size="lg" onClick={() => onNavigate("sedi")}>Scopri le sedi</Button>
            </div>
          </div>
        </div>

        {/* —— Tappa finale: Chi siamo —— */}
        <div ref={s4Ref} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", opacity: 0, visibility: "hidden", pointerEvents: "none", willChange: "transform, opacity" }}>
          <Container style={{ width: "100%" }}>
            <div style={{ maxWidth: "600px", paddingTop: "56px" }}>
              <h2 className="cra-display" style={{ color: "var(--cra-white)", fontSize: "var(--fs-4xl)", margin: 0, textShadow: "0 2px 24px rgba(0,0,0,0.45)" }}>
                Insieme a te <span style={{ color: "var(--cra-gold)" }}>con i fatti</span>
              </h2>
              <p className="cra-lead" style={{ color: "var(--char-200)", marginTop: "var(--space-5)", maxWidth: "48ch", textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}>
                Nati a Napoli oltre 30 anni fa, siamo diventati un punto di riferimento dell&rsquo;aftermarket
                italiano: un magazzino enorme, consegne rapide e persone che conoscono il mestiere.
              </p>
              <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-7)", flexWrap: "wrap" }}>
                <Magnetic><Button variant="primary" size="lg" onClick={() => onNavigate("chisiamo")}>Scopri la nostra storia</Button></Magnetic>
                <Magnetic><Button variant="light" size="lg" onClick={() => onNavigate("contatti")}>Richiedi un preventivo</Button></Magnetic>
              </div>
            </div>
          </Container>
        </div>

        {/* scroll cue */}
        <div ref={cueRef} className="hero-scroll-cue" aria-hidden="true" style={{ transition: "opacity 400ms var(--ease-standard)" }}>
          <span className="hero-scroll-track"><span className="hero-scroll-dot" /></span>
          <span style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-2xs)", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--char-400)" }}>Scorri</span>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ n, l }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-2xl)", color: "var(--cra-gold)", lineHeight: 1, textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}>
        <CountUp value={n} duration={1600} />
      </div>
      <div style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-2xs)", letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--char-300)", marginTop: "6px" }}>{l}</div>
    </div>
  );
}
function Divider() { return <span style={{ width: "1px", background: "rgba(255,255,255,0.22)", alignSelf: "stretch" }} />; }
