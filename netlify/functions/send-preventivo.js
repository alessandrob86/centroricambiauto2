/* Netlify Function (v2) — invia la richiesta di preventivo via Resend.
 *
 * Riceve il POST dal form Contatti e manda due mail:
 *   1) la richiesta a ordini@centroricambiautosrl.it (reply-to = cliente)
 *   2) una conferma brandizzata al cliente (best-effort, non blocca)
 *
 * La API key vive solo qui (env var Netlify RESEND_API_KEY), mai nel browser.
 * Richiede che il dominio centroricambiautosrl.it sia verificato su Resend.
 */

const TO_ORG = "ordini@centroricambiautosrl.it";
const FROM = "Centro Ricambi Auto <noreply@centroricambiautosrl.it>";

const RED = "#bd3432";
const GOLD = "#fdc543";
const CHARCOAL = "#272d2b";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );

function internalEmail(d) {
  const row = (label, val) =>
    val
      ? `<tr><td style="padding:6px 14px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600">${esc(val)}</td></tr>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:${CHARCOAL};border-top:4px solid ${RED};border-radius:10px 10px 0 0;padding:20px 24px">
      <div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.04em">CENTRO RICAMBI AUTO</div>
      <div style="color:${GOLD};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-top:4px">Nuova richiesta di preventivo</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:22px 24px">
      <table style="width:100%;border-collapse:collapse">
        ${row("Nome", d.nome)}
        ${row("Officina / azienda", d.officina)}
        ${row("Email", d.email)}
        ${row("Telefono", d.tel)}
        ${row("Categoria", d.cat)}
      </table>
      ${
        d.msg
          ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb">
               <div style="color:#6b7280;font-size:13px;margin-bottom:6px">Dettagli richiesta</div>
               <div style="color:#111827;font-size:14px;line-height:1.55;white-space:pre-wrap">${esc(d.msg)}</div>
             </div>`
          : ""
      }
      <div style="margin-top:18px;font-size:12px;color:#9ca3af">Rispondi direttamente a questa email per ricontattare il cliente.</div>
    </div>
  </div></body></html>`;
}

function replyEmail(d) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:${CHARCOAL};border-top:4px solid ${RED};border-radius:10px 10px 0 0;padding:22px 24px">
      <div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.04em">CENTRO RICAMBI AUTO</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <h1 style="margin:0 0 12px;color:#111827;font-size:20px">Abbiamo ricevuto la tua richiesta${d.nome ? ", " + esc(d.nome) : ""}!</h1>
      <p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.6">
        Grazie per averci contattato. Il nostro team sta gi&agrave; preparando il tuo preventivo:
        di norma rispondiamo in <b>meno di 10 minuti</b> negli orari di apertura.
      </p>
      <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6">
        Se hai bisogno subito, puoi chiamarci al
        <a href="tel:+39081281732" style="color:${RED};font-weight:700;text-decoration:none">+39 081 281732</a>
        o scriverci su <a href="https://wa.me/39028463035" style="color:${RED};font-weight:700;text-decoration:none">WhatsApp</a>.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;color:#6b7280;font-size:13px;line-height:1.5">
        Questa &egrave; una conferma automatica. La tua richiesta &egrave; stata inoltrata al nostro ufficio preventivi.
      </div>
      <p style="margin:20px 0 0;color:#9ca3af;font-size:12px">Centro Ricambi Auto srl — il vero specialista dei ricambi</p>
    </div>
  </div></body></html>`;
}

async function sendEmail(key, payload) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return Response.json({ error: "config", message: "RESEND_API_KEY non configurata" }, { status: 500 });
  }

  let d;
  try {
    d = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // honeypot anti-spam: i bot compilano il campo nascosto "website"
  if (d.website) return Response.json({ ok: true });

  const email = String(d.email || "").trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "email" }, { status: 400 });
  }

  const clean = {
    nome: String(d.nome || "").trim().slice(0, 200),
    officina: String(d.officina || "").trim().slice(0, 200),
    email,
    tel: String(d.tel || "").trim().slice(0, 60),
    cat: String(d.cat || "").trim().slice(0, 80),
    msg: String(d.msg || "").trim().slice(0, 4000),
  };

  try {
    const r = await sendEmail(key, {
      from: FROM,
      to: [TO_ORG],
      reply_to: clean.email,
      subject: `Richiesta preventivo — ${clean.officina || clean.nome || "officina"}`,
      html: internalEmail(clean),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return Response.json({ error: "send", detail }, { status: 502 });
    }

    // conferma al cliente: best-effort, un eventuale errore non fa fallire la richiesta
    await sendEmail(key, {
      from: FROM,
      to: [clean.email],
      subject: "Abbiamo ricevuto la tua richiesta — Centro Ricambi Auto",
      html: replyEmail(clean),
    }).catch(() => {});

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: "network" }, { status: 502 });
  }
};
