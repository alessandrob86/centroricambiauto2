import React from "react";
import { Logo } from "../components/ds/Logo.jsx";
import { Button } from "../components/ds/Button.jsx";
import { Icon } from "../components/Icon.jsx";
import { Container, ChromeButton } from "../components/shared.jsx";

const NAV = [
  { id: "home", label: "Home" },
  { id: "chisiamo", label: "Chi siamo" },
  { id: "servizi", label: "Cosa facciamo" },
  { id: "sedi", label: "Dove siamo" },
];

export function Header({ current, onNavigate }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Trasparente sopra la hero (solo in home, in cima); solido altrove, scrollando o a menu aperto */
  const solid = scrolled || current !== "home" || menuOpen;

  const go = (id) => { setMenuOpen(false); onNavigate(id); };

  const navBtnStyle = (active) => ({
    background: "none", border: "none", cursor: "pointer", padding: "4px 0",
    fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-sm)",
    textTransform: "uppercase", letterSpacing: "var(--ls-caps)",
    color: active ? "var(--cra-gold)" : "var(--char-200)",
    borderBottom: active ? "2px solid var(--cra-gold)" : "2px solid transparent",
    transition: "color var(--dur-base) var(--ease-standard)",
  });

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: solid ? "rgba(27, 32, 31, 0.96)" : "linear-gradient(180deg, rgba(15,18,17,0.62), rgba(15,18,17,0.18))",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      borderBottom: solid ? "1px solid var(--char-700)" : "1px solid rgba(255,255,255,0.08)",
      boxShadow: solid && scrolled ? "var(--shadow-md)" : "none",
      transition: "background var(--dur-slow) var(--ease-standard), border-color var(--dur-slow) var(--ease-standard), box-shadow var(--dur-slow) var(--ease-standard)",
    }}>
      {/* top utility bar */}
      <div style={{ background: "transparent", color: "var(--char-300)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Container style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "var(--header-utility-h)", fontSize: "var(--fs-xs)" }}>
          <span className="hdr-utility-left" style={{ display: "inline-flex", alignItems: "center", gap: "16px", fontWeight: "var(--fw-semibold)", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            <a href="tel:+39081281732" title="Chiama il centralino" style={{ display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", color: "inherit", textDecoration: "none", transition: "color var(--dur-base) var(--ease-standard)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--cra-gold)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "inherit"; }}>
              <Icon name="phone" size={13} color="var(--cra-gold)" /> <span className="hdr-label">Centralino&nbsp;</span>+39 081 281732
            </a>
            <a href="https://wa.me/39028463035" target="_blank" rel="noopener noreferrer" title="Scrivici su WhatsApp" style={{ display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", color: "inherit", textDecoration: "none", transition: "color var(--dur-base) var(--ease-standard)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--cra-gold)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "inherit"; }}>
              <Icon name="message-circle" size={13} color="var(--cra-gold)" /> <span className="hdr-label">WhatsApp&nbsp;</span>+39 02 846 3035
            </a>
          </span>
          <span className="hdr-utility-extra" style={{ display: "inline-flex", alignItems: "center", gap: "16px", whiteSpace: "nowrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}><Icon name="clock" size={13} color="var(--cra-gold)" /> Risposta &lt; 10 min</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}><Icon name="mail" size={13} color="var(--cra-gold)" /> info@centroricambiautosrl.it</span>
          </span>
        </Container>
      </div>
      {/* main bar */}
      <Container style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "var(--header-h)" }}>
        <button onClick={() => go("home")} aria-label="Centro Ricambi Auto — Home" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
          <Logo variant="horizontal" onDark height={46} className="hdr-logo" />
        </button>

        {/* nav desktop */}
        <nav className="hdr-nav" style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} style={navBtnStyle(current === n.id)}
            onMouseEnter={(e) => { if (current !== n.id) e.currentTarget.style.color = "var(--cra-white)"; }}
            onMouseLeave={(e) => { if (current !== n.id) e.currentTarget.style.color = "var(--char-200)"; }}>
              {n.label}
            </button>
          ))}
          <Button variant="primary" size="sm" iconLeft={<Icon name="file-text" size={15} />} onClick={() => go("contatti")}>
            Preventivo
          </Button>
          <ChromeButton href="https://centroricambiautosrl.blusys.it/" size="sm">
            <Icon name="cog" size={15} color="var(--cra-gold)" /> E-Com
          </ChromeButton>
        </nav>

        {/* controlli mobile: CTA primaria sempre visibile + hamburger */}
        <div className="hdr-mobile-controls">
          <Button variant="primary" size="sm" onClick={() => go("contatti")}>Preventivo</Button>
          <button onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Chiudi menu" : "Apri menu"} aria-expanded={menuOpen}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "var(--radius-sm)", cursor: "pointer", padding: "9px 10px", display: "inline-flex", color: "var(--cra-white)" }}>
            <Icon name={menuOpen ? "x" : "menu"} size={20} color="var(--cra-white)" />
          </button>
        </div>
      </Container>

      {/* pannello menu mobile */}
      {menuOpen && (
        <nav style={{ background: "var(--surface-darker)", borderTop: "1px solid var(--char-700)", padding: "var(--space-3) 0 var(--space-5)" }}>
          <Container style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {NAV.map((n) => (
              <button key={n.id} onClick={() => go(n.id)} style={{
                background: "none", border: "none", cursor: "pointer", textAlign: "left",
                padding: "14px 4px", borderBottom: "1px solid var(--char-800)",
                fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-base)",
                textTransform: "uppercase", letterSpacing: "var(--ls-caps)",
                color: current === n.id ? "var(--cra-gold)" : "var(--char-200)",
              }}>
                {n.label}
              </button>
            ))}
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
              <ChromeButton href="https://centroricambiautosrl.blusys.it/" size="sm">
                <Icon name="cog" size={15} color="var(--cra-gold)" /> E-Com
              </ChromeButton>
              <a href="tel:+39081281732" style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "var(--char-200)", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "var(--ls-caps)", padding: "10px 14px", border: "1px solid var(--char-700)", borderRadius: "var(--radius-sm)" }}>
                <Icon name="phone" size={15} color="var(--cra-gold)" /> Chiama
              </a>
            </div>
          </Container>
        </nav>
      )}
    </header>
  );
}
