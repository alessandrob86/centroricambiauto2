import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* Sync prezzi CRA Store ← Google Sheet pubblicato come CSV.
 *
 * POST (solo admin). Body opzionale: { csv_url } → salvato in app_config
 * ('cra_prezzi_csv_url') e riusato nelle sync successive.
 * Il foglio deve avere le colonne 'codice' e 'prezzo' (qualsiasi ordine,
 * separatore , o ; — virgola decimale gestita).
 * Ritorna { ok, aggiornati, non_trovati }.
 */

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }

/** Parser CSV minimale con supporto ai campi tra virgolette. */
function parseCsv(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(cell); cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

function parsePrezzo(raw: string): number | null {
  // "€ 1.234,50" / "12,50" / "12.50" → 1234.50 / 12.50
  let s = raw.replace(/[€\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "non autenticato" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: officina } = await admin.from("officine").select("is_admin").eq("user_id", user.id).maybeSingle();
    if (!officina?.is_admin) return json({ error: "riservato agli amministratori" }, 403);

    // URL del foglio: dal body (e lo persistiamo) o da app_config.
    let csvUrl = "";
    try {
      const body = await req.json();
      csvUrl = String(body?.csv_url ?? "").trim();
    } catch { /* body vuoto */ }
    if (csvUrl) {
      await admin.from("app_config").upsert({ key: "cra_prezzi_csv_url", value: csvUrl });
    } else {
      const { data: cfg } = await admin.from("app_config").select("value").eq("key", "cra_prezzi_csv_url").maybeSingle();
      csvUrl = String(cfg?.value ?? "").trim();
    }
    if (!csvUrl) return json({ error: "URL del foglio non configurato: incollalo nel campo e riprova" }, 400);

    const resp = await fetch(csvUrl, { redirect: "follow" });
    if (!resp.ok) return json({ error: `il foglio non risponde (HTTP ${resp.status}): verifica che sia pubblicato come CSV` }, 400);
    const text = await resp.text();
    if (text.trimStart().startsWith("<")) return json({ error: "l'URL restituisce una pagina web, non un CSV: usa 'Pubblica sul web → CSV'" }, 400);

    // separatore: quello più frequente nella riga d'intestazione
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
    const rows = parseCsv(text, sep);
    if (rows.length < 2) return json({ error: "foglio vuoto o senza righe dati" }, 400);

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const iCodice = header.findIndex((h) => h.includes("codice") || h === "cod" || h === "sku");
    const iPrezzo = header.findIndex((h) => h.includes("prezzo") || h.includes("price"));
    if (iCodice < 0 || iPrezzo < 0) {
      return json({ error: `intestazioni non trovate (servono 'codice' e 'prezzo'; lette: ${header.join(", ")})` }, 400);
    }

    // mappa prodotti per codice normalizzato (case-insensitive, trim)
    const { data: prodotti, error: pErr } = await admin.from("cra_products").select("id, codice");
    if (pErr) return json({ error: pErr.message }, 500);
    const byCodice = new Map<string, string>();
    for (const p of prodotti ?? []) byCodice.set(String(p.codice).trim().toUpperCase(), p.id);

    let aggiornati = 0;
    const non_trovati: string[] = [];
    for (const r of rows.slice(1)) {
      const codice = String(r[iCodice] ?? "").trim();
      if (!codice) continue;
      const prezzo = parsePrezzo(String(r[iPrezzo] ?? ""));
      if (prezzo == null) continue;
      const id = byCodice.get(codice.toUpperCase());
      if (!id) { non_trovati.push(codice); continue; }
      const { error: uErr } = await admin.from("cra_products").update({ prezzo }).eq("id", id);
      if (!uErr) aggiornati++;
    }

    return json({ ok: true, aggiornati, non_trovati });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
