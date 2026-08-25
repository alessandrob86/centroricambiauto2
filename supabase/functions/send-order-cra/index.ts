import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

/* Proposta d'ordine CRA Store: notifica al magazzino (con Excel) + conferma
 * al cliente. Clone del flusso send-order di l2f con template CRA (chiaro).
 *
 * Mittente: dominio centroricambiautosrl.it → serve la API key del Resend CRA
 * nel secret RESEND_API_KEY_CRA (account separato da quello l2f).
 */

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }

const RED = "#bd3432";
const GOLD = "#fdc543";
const CHARCOAL = "#272d2b";
const ORDINE_NOTIFY_TO = "ordini@centroricambiautosrl.it";

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));

function craEmail(o: { pre: string; heading: string; sub?: string; body: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">${o.pre}</div>
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:${CHARCOAL};border-top:4px solid ${RED};border-radius:10px 10px 0 0;padding:20px 24px">
      <div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.04em">CENTRO RICAMBI AUTO</div>
      <div style="color:${GOLD};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-top:4px">${o.sub ?? "CRA Store"}</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:22px 24px">
      <h1 style="margin:0 0 14px;color:#111827;font-size:20px">${o.heading}</h1>
      ${o.body}
      <p style="margin:22px 0 0;color:#9ca3af;font-size:12px">Centro Ricambi Auto srl — il vero specialista dei ricambi · ordini@centroricambiautosrl.it</p>
    </div>
  </div></body></html>`;
}

interface OrderItem { codice_l2f: string | null; nome: string | null; prezzo_unitario: number | string; quantita: number; }

/** Excel per il riporto in gestionale: Articolo | Quantità | Prezzo unitario. */
function buildOrderXlsx(items: OrderItem[]): string {
  const header = ["Articolo", "Quantità", "Prezzo unitario"];
  const rows = items.map((it) => [it.codice_l2f ?? "", Number(it.quantita), Number(it.prezzo_unitario)]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Proposta");
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
}

function itemsTableHtml(items: OrderItem[]): string {
  const rows = items.map((it) =>
    `<tr><td style="padding:7px 8px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;white-space:nowrap">${esc(it.codice_l2f)}</td><td style="padding:7px 8px;border-top:1px solid #e5e7eb;color:#111827;font-size:14px">${esc(it.nome)}</td><td align="center" style="padding:7px 8px;border-top:1px solid #e5e7eb;color:#111827">${it.quantita}</td><td align="right" style="padding:7px 8px;border-top:1px solid #e5e7eb;color:#111827;white-space:nowrap">€ ${(Number(it.prezzo_unitario) * it.quantita).toFixed(2)}</td></tr>`,
  ).join("");
  return `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px"><thead><tr style="color:#6b7280;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.04em"><th style="padding:0 8px 6px">Cod.</th><th style="padding:0 8px 6px">Articolo</th><th style="padding:0 8px 6px" align="center">Q.tà</th><th style="padding:0 8px 6px" align="right">Totale</th></tr></thead><tbody>${rows}</tbody></table>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id mancante" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "non autenticato" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order, error } = await admin
      .from("orders")
      .select("numero, sito, note, totale_listino, created_at, officine(ragione_sociale, email, telefono, citta, piva, codice_cliente, user_id), order_items(codice_l2f, nome, prezzo_unitario, quantita)")
      .eq("id", order_id)
      .single();
    if (error || !order) return json({ error: "ordine non trovato" }, 404);
    if ((order as any).sito !== "cra") return json({ error: "non è una proposta CRA" }, 400);
    const off = (order as any).officine;
    if (!off || off.user_id !== user.id) return json({ error: "non autorizzato" }, 403);

    const RESEND = Deno.env.get("RESEND_API_KEY_CRA");
    const FROM = Deno.env.get("CRA_ORDER_FROM") ?? "Centro Ricambi Auto <noreply@centroricambiautosrl.it>";
    if (!RESEND) return json({ ok: true, emailed: false, reason: "RESEND_API_KEY_CRA non configurata" });

    const items = ((order as any).order_items ?? []) as OrderItem[];
    const numero = (order as any).numero as string;
    const totale = Number((order as any).totale_listino);
    const note = (order as any).note as string | null;
    const tableHtml = itemsTableHtml(items);
    const totaliHtml =
      `<p style="margin:16px 0 0;font-size:17px;color:#111827"><strong>Totale indicativo: € ${totale.toFixed(2)}</strong> <span style="color:#6b7280;font-size:13px">(prezzi netti, IVA 22% esclusa — da aggiungere)</span></p>` +
      (note ? `<p style="margin:12px 0 0;font-style:italic;color:#6b7280">Note: ${esc(note)}</p>` : "");

    async function sendEmail(payload: Record<string, unknown>): Promise<boolean> {
      const resp = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return resp.ok;
    }

    // 1) Notifica magazzino con Excel di riporto.
    const intestazione = `<p style="margin:0 0 16px;color:#111827"><strong>${esc(off.ragione_sociale)}</strong>${off.codice_cliente ? " · " + esc(off.codice_cliente) : ""}${off.citta ? " — " + esc(off.citta) : ""}<br/>${esc(off.email)}${off.telefono ? " · " + esc(off.telefono) : ""}${off.piva ? "<br/>P.IVA " + esc(off.piva) : ""}</p>`;
    let xlsxB64: string | null = null;
    try {
      xlsxB64 = buildOrderXlsx(items);
    } catch (e) {
      console.error("Generazione Excel fallita:", e);
    }
    const sanitize = (s: unknown) => String(s ?? "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    const dataOrdine = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" })
      .format(new Date((order as any).created_at)).replace(/\//g, "-");
    const fileParts = [sanitize(off.ragione_sociale), sanitize(off.codice_cliente), dataOrdine].filter(Boolean);
    const internalOk = await sendEmail({
      from: FROM,
      to: [ORDINE_NOTIFY_TO],
      reply_to: off.email ? [off.email] : undefined,
      subject: `Proposta d'ordine ${numero} — ${off.ragione_sociale}`,
      html: craEmail({
        pre: `Proposta d'ordine ${numero}`,
        sub: "CRA Store · Nuova proposta d'ordine",
        heading: `Proposta ${numero}`,
        body: intestazione + tableHtml + totaliHtml + `<p style="margin:16px 0 0;font-size:13px;color:#6b7280">Verifica la disponibilità e rispondi al cliente (reply-to già impostato). In allegato l'Excel di riporto.</p>`,
      }),
      attachments: xlsxB64 ? [{ filename: `${fileParts.join(" - ") || `proposta-${numero}`}.xlsx`, content: xlsxB64 }] : undefined,
    });

    // 2) Conferma al cliente: la proposta è ricevuta, disponibilità da confermare.
    let customerOk = false;
    if (off.email) {
      customerOk = await sendEmail({
        from: FROM,
        to: [off.email],
        reply_to: [ORDINE_NOTIFY_TO],
        subject: `Proposta d'ordine ${numero} ricevuta — CRA Store`,
        html: craEmail({
          pre: `Proposta ${numero} ricevuta`,
          sub: "CRA Store · Proposta ricevuta",
          heading: `Abbiamo ricevuto la tua proposta ${numero}`,
          body:
            `<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.6">Ciao <strong>${esc(off.ragione_sociale)}</strong>, grazie per la tua proposta d'ordine. <strong>Non è ancora una conferma</strong>: stiamo verificando la disponibilità degli articoli e ti risponderemo via email con conferma e tempi.</p>` +
            tableHtml + totaliHtml +
            `<p style="margin:18px 0 0;color:#374151;font-size:14px;line-height:1.6">Per modifiche o urgenze rispondi a questa email o chiamaci al <a href="tel:+39081281732" style="color:${RED};font-weight:700;text-decoration:none">+39 081 281732</a>.</p>`,
        }),
      });
    }

    return json({ ok: true, emailed: internalOk, customer_emailed: customerOk });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
