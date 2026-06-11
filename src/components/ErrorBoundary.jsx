import React from "react";

/* Un errore di runtime non deve mai lasciare la pagina bianca:
   mostra i contatti essenziali e un bottone per ricaricare. */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("CRA site error:", error, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", background: "var(--char-800, #272d2b)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "var(--font-body, system-ui, sans-serif)", textAlign: "center" }}>
        <div style={{ maxWidth: "480px" }}>
          <div style={{ height: "4px", width: "60px", margin: "0 auto 24px", background: "linear-gradient(90deg, #bd3432 0 60%, #fdc543 60% 100%)", borderRadius: "999px" }} />
          <h1 style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "1.5rem", margin: 0 }}>Qualcosa è andato storto</h1>
          <p style={{ color: "#c2c8c5", marginTop: "12px" }}>
            Ricarica la pagina, oppure contattaci direttamente: siamo sempre raggiungibili.
          </p>
          <p style={{ marginTop: "16px" }}>
            <a href="tel:+39081281732" style={{ color: "#fdc543", fontWeight: 700, textDecoration: "none" }}>Centralino +39 081 281732</a>
            <br />
            <a href="mailto:info@centroricambiautosrl.it" style={{ color: "#fdc543", fontWeight: 700, textDecoration: "none" }}>info@centroricambiautosrl.it</a>
          </p>
          <button onClick={() => window.location.reload()} style={{ marginTop: "24px", background: "#bd3432", color: "#fff", border: "none", borderRadius: "4px", padding: "14px 28px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer", fontSize: "0.9rem" }}>
            Ricarica la pagina
          </button>
        </div>
      </div>
    );
  }
}
