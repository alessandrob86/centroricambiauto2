import React from "react";
import { Container, Eyebrow, Reveal } from "../components/shared.jsx";
import { Button } from "../components/ds/Button.jsx";
import { Input } from "../components/ds/Input.jsx";
import { Icon } from "../components/Icon.jsx";
import { useAuth, rottaDiAvvio } from "../lib/auth.jsx";

const { useState, useEffect } = React;

/** Traduce i messaggi più comuni di Supabase Auth in italiano. */
function traduciErrore(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login")) return "Email o password non corretti.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Questa email è già registrata. Prova ad accedere.";
  if (m.includes("email not confirmed")) return "Devi prima confermare la tua email.";
  if (m.includes("password")) return "Password non valida (minimo 8 caratteri).";
  if (m.includes("rate limit")) return "Troppi tentativi. Riprova tra qualche minuto.";
  return msg;
}

const card = {
  maxWidth: "520px",
  margin: "0 auto",
  background: "var(--surface-card)",
  border: "var(--border-w-2) solid var(--border-strong)",
  boxShadow: "var(--shadow-lg)",
  padding: "var(--space-7) var(--space-6)",
};

const tabBase = {
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "12px 10px",
  cursor: "pointer",
  fontFamily: "var(--font-brand)",
  fontWeight: "var(--fw-bold)",
  fontSize: "var(--fs-xs)",
  textTransform: "uppercase",
  letterSpacing: "var(--ls-caps)",
  border: "var(--border-w-2) solid var(--border-strong)",
  background: "transparent",
  color: "var(--text-muted)",
  transition: "background var(--dur-base) var(--ease-standard), color var(--dur-base) var(--ease-standard)",
};

const StatusBox = ({ icon, iconColor, title, children }) => (
  <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "center" }}>
    <Icon name={icon} size={42} color={iconColor} />
    <h2 className="cra-h3" style={{ margin: 0 }}>{title}</h2>
    {children}
  </div>
);

export function Accedi({ onNavigate }) {
  const { session, officina, loading, isActive, isAdmin, avvio, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirmSent, setConfirmSent] = useState(false);

  // campi
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [piva, setPiva] = useState("");
  const [telefono, setTelefono] = useState("");
  const [citta, setCitta] = useState("");

  /* Chi è già dentro non ha niente da fare qui. Serve soprattutto a chi è
     interno: senza una riga officine finirebbe nel ramo che ridisegna il
     modulo di accesso, con l'impressione che il login non abbia funzionato. */
  useEffect(() => {
    if (!loading && session && !confirmSent) onNavigate(rottaDiAvvio(avvio));
  }, [loading, session, confirmSent, avvio, onNavigate]);

  const onLogin = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error, avvio: dove } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) { setErr(traduciErrore(error)); return; }
    /* Ognuno dove gli serve: il cliente in home, dove trova lo Store; chi è
       interno dove ha scelto lui o il suo ruolo — di solito il Cruscotto o
       il Card Center, che è la prima cosa che apre la mattina. Restare qui
       non è mai giusto: un dipendente non ha una riga officine e si vedeva
       ricomparire il modulo di accesso come se il login fosse fallito. */
    onNavigate(rottaDiAvvio(dove));
  };

  const onRegister = async (e) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr("La password deve avere almeno 8 caratteri.");
      return;
    }
    setBusy(true);
    const { error, needsConfirm } = await signUp({
      email: email.trim(),
      password,
      ragione_sociale: ragioneSociale.trim(),
      piva: piva.trim(),
      telefono: telefono.trim(),
      citta: citta.trim(),
    });
    setBusy(false);
    if (error) {
      setErr(traduciErrore(error));
      return;
    }
    if (needsConfirm) setConfirmSent(true);
  };

  /* ---- stati schermata ---- */
  let body;

  if (loading) {
    body = <p className="cra-body" style={{ textAlign: "center" }}>Caricamento…</p>;
  } else if (confirmSent && !session) {
    body = (
      <StatusBox icon="mail" iconColor="var(--cra-gold)" title="Conferma la tua email">
        <p className="cra-body">
          Ti abbiamo inviato un link di conferma a <strong>{email}</strong>.
          Confermala, poi attendi l'attivazione dell'account da parte nostra.
        </p>
        <Button variant="secondary" onClick={() => { setConfirmSent(false); setMode("login"); }}>
          Torna al login
        </Button>
      </StatusBox>
    );
  } else if (session && officina) {
    if (isActive) {
      body = (
        <StatusBox icon="check-circle-2" iconColor="#2e7d4f" title={`Bentornato, ${officina.ragione_sociale}`}>
          <p className="cra-body">
            Il tuo account è <strong>attivo</strong>: puoi consultare il catalogo e inviare proposte d'ordine.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <Button variant="accent" iconRight={<Icon name="arrow-right" size={16} />} onClick={() => onNavigate("store")}>
              Vai al CRA Store
            </Button>
            {isAdmin && (
              <Button variant="dark" iconLeft={<Icon name="shield-check" size={16} color="var(--cra-gold)" />} onClick={() => onNavigate("admin")}>
                Back-office
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" iconLeft={<Icon name="log-out" size={14} />} onClick={signOut}>
            Esci
          </Button>
        </StatusBox>
      );
    } else if (officina.stato === "attiva" && !officina.cra_abilitata) {
      body = (
        <StatusBox icon="lock" iconColor="var(--cra-gold)" title="Account non ancora abilitato al CRA Store">
          <p className="cra-body">
            Il tuo account <strong>{officina.ragione_sociale}</strong> è attivo ma non è ancora
            abilitato agli ordini su CRA Store. Contattaci per richiedere l'abilitazione.
          </p>
          <Button variant="ghost" size="sm" iconLeft={<Icon name="log-out" size={14} />} onClick={signOut}>
            Esci
          </Button>
        </StatusBox>
      );
    } else if (officina.stato === "sospesa") {
      body = (
        <StatusBox icon="alert-circle" iconColor="var(--cra-red)" title="Account sospeso">
          <p className="cra-body">
            L'accesso di <strong>{officina.ragione_sociale}</strong> è momentaneamente sospeso.
            Contattaci per maggiori informazioni.
          </p>
          <Button variant="ghost" size="sm" iconLeft={<Icon name="log-out" size={14} />} onClick={signOut}>
            Esci
          </Button>
        </StatusBox>
      );
    } else {
      body = (
        <StatusBox icon="clock" iconColor="var(--cra-gold)" title="Account in attesa di attivazione">
          <p className="cra-body">
            Grazie <strong>{officina.ragione_sociale}</strong>. La tua richiesta è stata registrata:
            verificheremo i dati e attiveremo l'accesso alle proposte d'ordine.
            Ti avviseremo via email.
          </p>
          <Button variant="ghost" size="sm" iconLeft={<Icon name="log-out" size={14} />} onClick={signOut}>
            Esci
          </Button>
        </StatusBox>
      );
    }
  } else {
    body = (
      <React.Fragment>
        <div role="tablist" style={{ display: "flex", marginBottom: "var(--space-4)" }}>
          <button
            role="tab"
            aria-selected={mode === "login"}
            style={{
              ...tabBase,
              background: mode === "login" ? "var(--cra-charcoal)" : "transparent",
              color: mode === "login" ? "var(--cra-white)" : "var(--text-muted)",
              borderRight: "none",
            }}
            onClick={() => { setMode("login"); setErr(null); }}
          >
            <Icon name="log-in" size={15} /> Accedi
          </button>
          <button
            role="tab"
            aria-selected={mode === "register"}
            style={{
              ...tabBase,
              background: mode === "register" ? "var(--cra-charcoal)" : "transparent",
              color: mode === "register" ? "var(--cra-white)" : "var(--text-muted)",
            }}
            onClick={() => { setMode("register"); setErr(null); }}
          >
            <Icon name="user-plus" size={15} /> Registra officina
          </button>
        </div>

        {err && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--red-50)",
              color: "var(--cra-red)",
              border: "1px solid var(--red-100, #f3d5d4)",
              padding: "10px 14px",
              marginBottom: "var(--space-4)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--fs-sm)",
              fontWeight: "var(--fw-semibold)",
            }}
          >
            <Icon name="alert-circle" size={16} /> {err}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={onLogin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Input label="Email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="officina@email.it" />
            <Input label="Password" type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <Button type="submit" variant="primary" fullWidth disabled={busy}
              iconRight={<Icon name="log-in" size={16} />}>
              {busy ? "Accesso…" : "Accedi"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onRegister} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Input label="Ragione sociale *" required value={ragioneSociale}
              onChange={(e) => setRagioneSociale(e.target.value)} placeholder="Officina Rossi S.r.l." />
            <Input label="Email *" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="officina@email.it" />
            <Input label="Password * (min 8 caratteri)" type="password" autoComplete="new-password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
              <Input label="Partita IVA" value={piva}
                onChange={(e) => setPiva(e.target.value)} placeholder="IT01234567890" />
              <Input label="Telefono" type="tel" value={telefono}
                onChange={(e) => setTelefono(e.target.value)} placeholder="081 …" />
            </div>
            <Input label="Città" value={citta}
              onChange={(e) => setCitta(e.target.value)} placeholder="Napoli" />
            <Button type="submit" variant="primary" fullWidth disabled={busy}
              iconRight={<Icon name="user-plus" size={16} />}>
              {busy ? "Invio…" : "Registra officina"}
            </Button>
            <p className="cra-meta" style={{ margin: 0 }}>
              La registrazione è soggetta ad approvazione: dopo la verifica dei dati
              attiveremo l'invio delle <strong>proposte d'ordine</strong> sul CRA Store.
            </p>
          </form>
        )}
      </React.Fragment>
    );
  }

  return (
    <section style={{ background: "var(--surface-page)", padding: "var(--space-9) 0 var(--space-10)", minHeight: "60vh" }}>
      <Container>
        <Reveal>
          <div style={card}>
            <header style={{ marginBottom: "var(--space-5)" }}>
              <Eyebrow>Area Officine</Eyebrow>
              <h1 className="cra-h2" style={{ margin: 0 }}>Accedi o registrati</h1>
              <p className="cra-body" style={{ marginTop: "8px", color: "var(--text-muted)" }}>
                Un unico account per il CRA Store e i servizi riservati alle officine.
              </p>
            </header>
            {body}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
