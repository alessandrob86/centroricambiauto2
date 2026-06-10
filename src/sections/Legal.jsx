import React from "react";
import { Button } from "../components/ds/Button.jsx";
import { Container, Eyebrow } from "../components/shared.jsx";

/* ── Layout condiviso per le pagine legali ────────────────────────── */
function LegalPage({ eyebrow, title, children }) {
  return (
    <React.Fragment>
      <section style={{ background: "var(--surface-dark)", color: "var(--cra-white)" }}>
        <Container style={{ padding: "var(--space-10) 0 var(--space-9)" }}>
          <Eyebrow onDark>{eyebrow}</Eyebrow>
          <h1 className="cra-display" style={{ color: "var(--cra-white)", fontSize: "var(--fs-4xl)", margin: 0 }}>{title}</h1>
        </Container>
      </section>
      <section style={{ background: "var(--surface-page)", padding: "var(--space-10) 0 var(--space-11)" }}>
        <Container style={{ maxWidth: "860px" }}>
          <div className="legal-prose">{children}</div>
        </Container>
      </section>
    </React.Fragment>
  );
}

/* ── Embed iubenda ────────────────────────────────────────────────────
   La classe `iubenda-embed` + `iubenda-noiframe` fa sì che iubenda.js
   sostituisca il link con il testo completo della policy, direttamente
   nella pagina. Lo script viene (ri)caricato a ogni mount così l'embed
   funziona anche navigando tra le pagine della SPA. */
function IubendaPolicy({ url, title }) {
  React.useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://cdn.iubenda.com/iubenda.js";
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, []);
  return (
    <div style={{ minHeight: "320px" }}>
      <a href={url} className="iubenda-white no-brand iubenda-noiframe iubenda-embed iub-body-embed"
        title={title} target="_blank" rel="noopener noreferrer">{title}</a>
    </div>
  );
}

/* ── Privacy Policy (iubenda) ─────────────────────────────────────── */
export function Privacy({ onNavigate }) {
  return (
    <LegalPage eyebrow="Informativa" title="Privacy Policy">
      <IubendaPolicy url="https://www.iubenda.com/privacy-policy/86943908" title="Privacy Policy" />
      <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-6)", flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={() => onNavigate("cookie")}>Cookie Policy</Button>
        <Button variant="primary" onClick={() => onNavigate("home")}>Torna alla home</Button>
      </div>
    </LegalPage>
  );
}

/* ── Cookie Policy (iubenda) ──────────────────────────────────────── */
export function Cookie({ onNavigate }) {
  return (
    <LegalPage eyebrow="Informativa" title="Cookie Policy">
      <IubendaPolicy url="https://www.iubenda.com/privacy-policy/86943908/cookie-policy" title="Cookie Policy" />
      <div style={{ marginTop: "var(--space-6)" }}>
        {/* Apre il pannello preferenze della iubenda Cookie Solution */}
        <Button variant="secondary" onClick={() => { if (window._iub && window._iub.cs && window._iub.cs.api) window._iub.cs.api.openPreferences(); }}>
          Modifica le preferenze cookie
        </Button>
      </div>
      <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-6)", flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={() => onNavigate("privacy")}>Privacy Policy</Button>
        <Button variant="primary" onClick={() => onNavigate("home")}>Torna alla home</Button>
      </div>
    </LegalPage>
  );
}

/* Il banner di consenso è la iubenda Cookie Solution, caricata da index.html
   (siteId 3034015): gestisce consenso per finalità, prova del consenso e il
   bottone flottante per revocarlo. Nessun banner custom necessario. */
