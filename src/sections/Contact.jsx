import React from "react";
import { Card } from "../components/ds/Card.jsx";
import { Input } from "../components/ds/Input.jsx";
import { Select } from "../components/ds/Select.jsx";
import { Button } from "../components/ds/Button.jsx";
import { StatBlock } from "../components/ds/StatBlock.jsx";
import { Icon } from "../components/Icon.jsx";
import { Container, Eyebrow } from "../components/shared.jsx";

export function Contact() {
  const [sent, setSent] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  /* "server" = inviata via Resend; "mailto" = fallback al programma di posta */
  const [mode, setMode] = React.useState("server");
  const [hp, setHp] = React.useState(""); // honeypot anti-spam
  const [form, setForm] = React.useState({ nome: "", officina: "", email: "", tel: "", cat: "", msg: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const openMailto = () => {
    const subject = encodeURIComponent("Richiesta preventivo — " + (form.officina || form.nome || "officina"));
    const body = encodeURIComponent(
      "Nome: " + form.nome + "\nOfficina: " + form.officina + "\nEmail: " + form.email +
      "\nTelefono: " + form.tel + "\nCategoria: " + form.cat + "\n\nDettagli:\n" + form.msg
    );
    window.location.href = "mailto:ordini@centroricambiautosrl.it?subject=" + subject + "&body=" + body;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/.netlify/functions/send-preventivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website: hp }),
      });
      if (res.ok) {
        setMode("server");
      } else {
        openMailto(); setMode("mailto");
      }
    } catch {
      /* function non raggiungibile (es. dominio non ancora verificato): fallback */
      openMailto(); setMode("mailto");
    } finally {
      setSending(false);
      setSent(true);
    }
  };

  return (
    <div style={{ background: "var(--surface-subtle)" }}>
      <div style={{ background: "var(--surface-dark)", color: "var(--cra-white)", padding: "var(--space-8) 0" }}>
        <Container>
          <Eyebrow onDark>Richiedi un preventivo</Eyebrow>
          <h1 className="cra-h1" style={{ color: "var(--cra-white)", margin: 0 }}>Ti rispondiamo in &lt; 10 minuti</h1>
        </Container>
      </div>
      <Container style={{ padding: "var(--space-9) var(--space-5)" }}>
        <div className="contact-grid" style={{ display: "grid", gap: "var(--space-8)", alignItems: "start" }}>
          <Card keyline elevation="md" padding="var(--space-7)">
            {sent ? (
              <div style={{ textAlign: "center", padding: "var(--space-7) 0" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "64px", height: "64px", borderRadius: "999px", background: "var(--red-50)", color: "var(--cra-red)", marginBottom: "var(--space-4)" }}>
                  <Icon name="check" size={32} color="var(--cra-red)" />
                </span>
                {mode === "server" ? (
                  <React.Fragment>
                    <h2 className="cra-h2" style={{ margin: 0 }}>Richiesta inviata!</h2>
                    <p className="cra-lead" style={{ marginTop: "var(--space-3)" }}>Grazie! Ti rispondiamo in <b>meno di 10 minuti</b> negli orari di apertura. Una conferma è stata inviata a <b>{form.email}</b>.</p>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <h2 className="cra-h2" style={{ margin: 0 }}>Richiesta pronta</h2>
                    <p className="cra-lead" style={{ marginTop: "var(--space-3)" }}>Si aprirà il tuo programma di posta: la richiesta è indirizzata a <b>ordini@centroricambiautosrl.it</b>.</p>
                  </React.Fragment>
                )}
                <Button variant="secondary" style={{ marginTop: "var(--space-5)" }} onClick={() => setSent(false)}>Invia un&rsquo;altra richiesta</Button>
              </div>
            ) : (
              <form onSubmit={submit}>
                {/* honeypot anti-spam: invisibile agli utenti, i bot lo compilano */}
                <input type="text" name="website" value={hp} onChange={(e) => setHp(e.target.value)}
                  tabIndex={-1} autoComplete="off" aria-hidden="true"
                  style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0 }} />
                <div className="form-grid" style={{ display: "grid", gap: "var(--space-4)" }}>
                  <Input label="Nome e cognome" placeholder="Mario Rossi" value={form.nome} onChange={set("nome")} />
                  <Input label="Officina / azienda" placeholder="Autofficina Rossi" value={form.officina} onChange={set("officina")} />
                  <Input label="Email" type="email" placeholder="info@officina.it" value={form.email} onChange={set("email")} />
                  <Input label="Telefono" placeholder="333 123 4567" value={form.tel} onChange={set("tel")} />
                </div>
                <div style={{ marginTop: "var(--space-4)" }}>
                  <Select label="Categoria ricambio" placeholder="Scegli una categoria…" value={form.cat} onChange={set("cat")}
                    options={["Freni", "Filtri", "Sospensioni", "Motore", "Elettrico", "Carrozzeria", "Altro"]} />
                </div>
                <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: "var(--ls-eyebrow)", color: "var(--text-muted)" }}>Dettagli richiesta</label>
                  <textarea value={form.msg} onChange={set("msg")} rows={4} placeholder="Marca, modello, targa o codice OE del ricambio…"
                    style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-base)", color: "var(--text-strong)", border: "var(--border-w-2) solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: "11px 14px", resize: "vertical", outline: "none" }} />
                </div>
                <Button type="submit" variant="primary" size="lg" fullWidth disabled={sending} style={{ marginTop: "var(--space-5)" }}
                  iconRight={sending ? null : <Icon name="arrow-right" size={18} />}>{sending ? "Invio in corso…" : "Invia richiesta"}</Button>
              </form>
            )}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <Card padding="var(--space-5)">
              <h3 className="cra-h3" style={{ margin: "0 0 var(--space-4)" }}>Contatti diretti</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <CRow icon="message-circle" label="WhatsApp Business · priorità Milano" value="+39 02 846 3035" href="https://wa.me/39028463035" />
                <CRow icon="phone" label="Centralino — tutte le filiali" value="+39 081 281732" href="tel:+39081281732" />
                <CRow icon="file-text" label="Ordini e preventivi" value="ordini@centroricambiautosrl.it" href="mailto:ordini@centroricambiautosrl.it" />
                <CRow icon="mail" label="Info generali" value="info@centroricambiautosrl.it" href="mailto:info@centroricambiautosrl.it" />
              </div>
            </Card>
            <div style={{ background: "var(--surface-dark)", borderRadius: "var(--radius-md)", padding: "var(--space-6)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)", alignItems: "start" }}>
              <StatBlock value="<10" unit="min" label="Tempi di risposta" tone="gold" onDark />
              <StatBlock value="700" label="Preventivi al giorno" tone="red" onDark />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

function CRow({ icon, label, value, href }) {
  const ext = href && /^https?:/.test(href);
  const valueEl = href
    ? <a href={href} target={ext ? "_blank" : undefined} rel={ext ? "noopener noreferrer" : undefined} style={{ color: "var(--text-strong)", fontWeight: "var(--fw-semibold)", fontSize: "var(--fs-md)", whiteSpace: "nowrap", textDecoration: "none" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--cra-red)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-strong)"; }}>{value}</a>
    : <div style={{ color: "var(--text-strong)", fontWeight: "var(--fw-semibold)", fontSize: "var(--fs-md)", whiteSpace: "nowrap" }}>{value}</div>;
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "var(--radius-sm)", background: "var(--char-900)", color: "var(--cra-gold)", flex: "none" }}>
        <Icon name={icon} size={18} color="var(--cra-gold)" />
      </span>
      <div>
        <div style={{ fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", fontWeight: "var(--fw-bold)" }}>{label}</div>
        {valueEl}
      </div>
    </div>
  );
}
