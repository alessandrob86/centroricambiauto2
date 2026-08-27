import React from "react";
import { Logo } from "../components/ds/Logo.jsx";
import { Button } from "../components/ds/Button.jsx";
import { Icon } from "../components/Icon.jsx";
import { Container, ChromeButton } from "../components/shared.jsx";
import { useAuth } from "../lib/auth.jsx";
import l2fLogo from "../assets/brands/l2f.webp";

const B2B_URL = "https://centroricambiautosrl.blusys.it/";

/* Voce del dropdown Ecom: <a> per link esterni, <button> per rotte interne. */
function EcomItem({ href, onClick, icon, iconColor = "var(--cra-gold)", children, danger = false }) {
  const [hover, setHover] = React.useState(false);
  const style = {
    display: "flex", alignItems: "center", gap: "10px", width: "100%",
    padding: "12px 16px", background: hover ? "rgba(255,255,255,0.07)" : "none",
    border: "none", cursor: "pointer", textAlign: "left", textDecoration: "none",
    fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)",
    textTransform: "uppercase", letterSpacing: "var(--ls-caps)",
    color: danger ? "#e88a88" : hover ? "var(--cra-white)" : "var(--char-200)",
    transition: "background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)",
  };
  const content = (
    <React.Fragment>
      <Icon name={icon} size={15} color={danger ? "#e88a88" : iconColor} />
      {children}
      {href && <Icon name="external-link" size={12} color="var(--char-500, #6e7678)" />}
    </React.Fragment>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" role="menuitem" style={style}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" role="menuitem" onClick={onClick} style={style}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {content}
    </button>
  );
}

/* Versione mobile del menu Ecom: righe piene nel pannello hamburger
   (niente dropdown annidato sotto i 1024px). */
function MobileEcomRows({ go }) {
  const { session, isActive, isAdmin, isStaff, signOut } = useAuth();
  const row = (active = false) => ({
    display: "flex", alignItems: "center", gap: "10px", width: "100%",
    background: "none", border: "none", cursor: "pointer", textAlign: "left",
    padding: "14px 4px", borderBottom: "1px solid var(--char-800)",
    fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-base)",
    textTransform: "uppercase", letterSpacing: "var(--ls-caps)",
    color: active ? "var(--cra-gold)" : "var(--char-200)", textDecoration: "none",
  });

  if (!session) {
    return (
      <button onClick={() => go("login")} style={row()}>
        <Icon name="log-in" size={17} color="var(--cra-gold)" /> Login
      </button>
    );
  }
  return (
    <React.Fragment>
      <a href={B2B_URL} target="_blank" rel="noopener noreferrer" style={row()}>
        <Icon name="cog" size={17} color="var(--cra-gold)" /> B2B Ricambi
        <Icon name="external-link" size={13} color="var(--char-500, #6e7678)" />
      </a>
      {isActive && (
        <button onClick={() => go("store")} style={row()}>
          <Icon name="store" size={17} color="var(--cra-gold)" /> CRA Store
        </button>
      )}
      {isStaff && (
        <button onClick={() => go("interno")} style={row()}>
          <Icon name="users" size={17} color="var(--cra-gold)" /> Area interna
        </button>
      )}
      {isAdmin && (
        <button onClick={() => go("admin")} style={row()}>
          <Icon name="shield-check" size={17} color="var(--cra-gold)" /> Admin
        </button>
      )}
      <button onClick={async () => { await signOut(); go("home"); }} style={{ ...row(), color: "#e88a88" }}>
        <Icon name="log-out" size={17} color="#e88a88" /> Logout
      </button>
    </React.Fragment>
  );
}

/* Bottone Ecom dell'header: sloggato → Login; loggato → dropdown con
   B2B, CRA Store, Admin (solo admin) e Logout. */
function EcomMenu({ go }) {
  const { session, isActive, isAdmin, isStaff, signOut } = useAuth();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef(null);

  /* chiusura su click fuori + Escape */
  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!session) {
    return (
      <ChromeButton onClick={() => go("login")} size="sm" aria-label="Accedi all'area officine">
        <Icon name="log-in" size={15} color="var(--cra-gold)" /> Login
      </ChromeButton>
    );
  }

  const pick = (id) => { setOpen(false); go(id); };
  const onLogout = async () => {
    setOpen(false);
    await signOut();
    go("home");
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <ChromeButton onClick={() => setOpen(!open)} size="sm"
        aria-haspopup="menu" aria-expanded={open}>
        <Icon name="cog" size={15} color="var(--cra-gold)" /> Ecom
        <span style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "none", transition: "transform var(--dur-base) var(--ease-standard)" }}>
          <Icon name="chevron-down" size={14} color="var(--char-300, #aab3b2)" />
        </span>
      </ChromeButton>
      {open && (
        <div role="menu" style={{
          position: "absolute", top: "calc(100% + 10px)", right: 0, minWidth: "235px",
          background: "var(--surface-darker)", border: "1px solid var(--char-700)",
          boxShadow: "var(--shadow-lg)", zIndex: 60, padding: "6px 0",
        }}>
          <EcomItem href={B2B_URL} icon="cog">B2B Ricambi</EcomItem>
          {isActive && <EcomItem onClick={() => pick("store")} icon="store">CRA Store</EcomItem>}
          {isStaff && <EcomItem onClick={() => pick("interno")} icon="users">Area interna</EcomItem>}
          {isAdmin && <EcomItem onClick={() => pick("admin")} icon="shield-check">Admin</EcomItem>}
          <div style={{ height: "1px", background: "var(--char-800)", margin: "6px 0" }} />
          <EcomItem onClick={onLogout} icon="log-out" danger>Logout</EcomItem>
        </div>
      )}
    </div>
  );
}

/* Bottone L2F dedicato: logo del marchio su fondo trasparente (l'argento + il
   rosso si leggono bene sull'header scuro), con bagliore rosso sul logo al
   passaggio. Volutamente diverso dal cromato "E-Com". */
function L2FNavButton({ logoHeight = 24 }) {
  const [hover, setHover] = React.useState(false);
  return (
    <a href="https://www.l2f.it" target="_blank" rel="noopener noreferrer" title="Scopri L2F — la nostra linea premium"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: hover ? "rgba(255,255,255,0.07)" : "transparent",
        borderRadius: "var(--radius-sm)", padding: "8px 14px", textDecoration: "none",
        transform: hover ? "translateY(-1px)" : "none",
        transition: "background var(--dur-base) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)",
      }}>
      <img src={l2fLogo} alt="L2F" style={{
        height: `${logoHeight}px`, width: "auto", display: "block",
        filter: hover ? "drop-shadow(0 0 9px rgba(195,35,39,0.75))" : "none",
        transition: "filter var(--dur-base) var(--ease-standard)",
      }} />
    </a>
  );
}

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

  /* Esc chiude il menu mobile */
  React.useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
            {/* padding + margine negativo: area di tocco ≥44px senza alzare la barra */}
            <a href="tel:+39081281732" title="Chiama il centralino" style={{ display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", color: "inherit", textDecoration: "none", transition: "color var(--dur-base) var(--ease-standard)", padding: "14px 6px", margin: "-14px -6px" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--cra-gold)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "inherit"; }}>
              <Icon name="phone" size={13} color="var(--cra-gold)" /> <span className="hdr-label">Centralino&nbsp;</span>+39 081 281732
            </a>
            <a href="https://wa.me/39028463035" target="_blank" rel="noopener noreferrer" title="Scrivici su WhatsApp" style={{ display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", color: "inherit", textDecoration: "none", transition: "color var(--dur-base) var(--ease-standard)", padding: "14px 6px", margin: "-14px -6px" }}
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
          <L2FNavButton logoHeight={24} />
          <EcomMenu go={go} />
        </nav>

        {/* controlli mobile: CTA primaria sempre visibile + hamburger */}
        <div className="hdr-mobile-controls">
          <Button variant="primary" size="sm" style={{ minHeight: "44px" }} onClick={() => go("contatti")}>Preventivo</Button>
          <button onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Chiudi menu" : "Apri menu"} aria-expanded={menuOpen}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "var(--radius-sm)", cursor: "pointer", minWidth: "44px", minHeight: "44px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--cra-white)" }}>
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
            <MobileEcomRows go={go} />
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
              <L2FNavButton logoHeight={26} />
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
