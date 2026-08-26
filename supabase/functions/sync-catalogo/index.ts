import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* Sync catalogo ← Foglio Google MASTER "Listini L2F — MASTER" (privato).
 *
 * Fonte di verità unica: un solo spreadsheet con un tab per listino, schema
 * fisso in riga 1. Il foglio NON è pubblicato: si legge via Google Sheets API
 * autenticandosi con un SERVICE ACCOUNT (JWT RS256 → access token).
 *
 * Aggiorna il CATALOGO UNICO (products + product_variants), che alimenta sia il
 * sito L2F sia il CRA Store: L2F è il private label di CRA, quindi lo stesso
 * articolo non va duplicato. Quali linee compaiano sul CRA Store lo decide la
 * colonna `su_cra`, impostata dal pannello admin — il sync non la tocca.
 *
 * ── COLONNE PREZZO (dinamiche) ────────────────────────────────────────────
 *   `netto`  (alias storico: `netto_nord`)  → PREZZO BASE
 *   una colonna con il NOME DI UNA CATEGORIA CLIENTE (es. "STRONG", "SUD")
 *            → prezzi riservati a quella categoria. Il match è
 *              case-insensitive e accetta anche la forma `netto_strong`.
 *   Per ogni categoria trovata il sync crea da solo il listino omonimo e lo
 *   assegna a quella categoria (se non esiste già).
 *
 * ── CHI VINCE ─────────────────────────────────────────────────────────────
 *   Il foglio vince su ciò che contiene:
 *     · cella valorizzata → sovrascrive sempre il prezzo
 *     · cella VUOTA in una colonna categoria → il prodotto esce da quel
 *       listino (torna al prezzo universale)
 *   Ma NON tocca ciò che non contiene:
 *     · prodotti assenti dal foglio (es. inseriti a mano nell'admin)
 *     · categorie/listini che non hanno una colonna nel foglio
 *   Così i prezzi gestiti a schermo per i prodotti fuori foglio restano al
 *   sicuro: il foglio è la verità solo dove parla.
 *
 * SCOPE: aggiorna record già esistenti, agganciandoli per codice; NON crea
 * prodotti nuovi (creare un prodotto L2F richiede famiglia e variante-padre
 * corrette). I codici senza corrispondenza finiscono in `non_trovati`.
 *
 * Secret richiesti:
 *   GOOGLE_SA_KEY            JSON integrale della chiave del service account
 *   CATALOGO_SPREADSHEET_ID  id del foglio (fallback: app_config.catalogo_spreadsheet_id)
 *
 * POST (solo admin).
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

/* ---------- Config dei tab del MASTER ---------- */
type TabCfg = {
  tab: string;
  /** valore di `fonte_listino` sui prodotti: da quale listino provengono */
  fonte: string;
  /** colonne codice da provare, in ordine (le batterie hanno anche il codice EX) */
  codici: string[];
};
const TABS: TabCfg[] = [
  { tab: "batterie", fonte: "batterie", codici: ["codice_l2f", "codice_ex"] },
  { tab: "lampade", fonte: "lampade", codici: ["codice_l2f"] },
  { tab: "lubrificanti", fonte: "lubrificanti", codici: ["codice_l2f"] },
  { tab: "filtri", fonte: "filtri", codici: ["codice_l2f"] },
  { tab: "pastiglie", fonte: "pastiglie", codici: ["codice_l2f"] },
];

/** Colonne descrittive: non sono mai prezzi di categoria. */
const COLONNE_STRUTTURALI = new Set([
  "gamma", "codice_l2f", "codice_ex", "box", "ah", "spunto", "polo", "dimensioni",
  "sezione", "nome", "imballo", "specifiche", "ece", "tipologia", "lumen",
  "applicazione", "oe", "rif_brembo", "lato",
  "listino",              // prezzo di listino pubblico
  "netto", "netto_nord",  // prezzo universale (netto_nord = alias storico)
]);

/* ---------- Prezzi: "€ 1.234,50" / "44,00 €" / 12.5 → number ---------- */
function parsePrezzo(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : null;
  let s = String(raw).replace(/[€\s]/g, "");
  if (!s) return null;
  // virgola decimale italiana: "1.234,50" → "1234.50"
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* ---------- JWT RS256 per il service account Google ---------- */
function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToPkcs8(pem: string): Uint8Array {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Scambia un JWT firmato con un access token OAuth2 (scope sola lettura Sheets). */
async function getAccessToken(saRaw: string): Promise<string> {
  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(saRaw);
  } catch {
    throw new Error("GOOGLE_SA_KEY non è un JSON valido");
  }
  if (!sa.client_email || !sa.private_key) throw new Error("GOOGLE_SA_KEY senza client_email/private_key");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const unsigned = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(claim)))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned)));
  const assertion = `${unsigned}.${b64url(sig)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(`token Google rifiutato: ${data.error_description ?? data.error ?? resp.status}`);
  }
  return data.access_token as string;
}

/* ---------- Lettura dei tab ---------- */
async function fetchTabs(spreadsheetId: string, token: string): Promise<Record<string, string[][]>> {
  const params = TABS.map((t) => `ranges=${encodeURIComponent(t.tab)}`).join("&");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params}&valueRenderOption=UNFORMATTED_VALUE`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Sheets API: ${data?.error?.message ?? resp.status} — verifica che il foglio sia condiviso col service account`);
  }
  const out: Record<string, string[][]> = {};
  for (let i = 0; i < TABS.length; i++) {
    out[TABS[i].tab] = (data.valueRanges?.[i]?.values ?? []) as string[][];
  }
  return out;
}

/** Righe → oggetti, mappando per NOME di colonna (non per posizione). */
function toObjects(values: string[][]): { header: string[]; righe: Record<string, unknown>[] } {
  if (!values.length) return { header: [], righe: [] };
  const header = values[0].map((h) => String(h ?? "").trim());
  const righe = values.slice(1).map((row) => {
    const o: Record<string, unknown> = {};
    header.forEach((h, i) => { if (h) o[h.toLowerCase()] = row[i]; });
    return o;
  });
  return { header, righe };
}

/** Accetta l'id puro, "id/edit?gid=…" o l'URL intero del foglio. */
function estraiSpreadsheetId(v: string): string {
  const s = v.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/);
  if (m) return m[1];
  return s.split(/[/?#]/)[0];   // taglia via /edit, ?gid=…, #gid=…
}

const norm = (v: unknown) => String(v ?? "").trim().toUpperCase();
/** Confronto nomi categoria: case-insensitive, senza il prefisso opzionale "netto_". */
const chiaveCat = (s: string) =>
  s.trim().toLowerCase().replace(/^netto[_\s-]+/, "").replace(/[\s_-]+/g, "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;

    /* --- solo admin --- */
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "non autenticato" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: officina } = await admin.from("officine").select("is_admin").eq("user_id", user.id).maybeSingle();
    if (!officina?.is_admin) return json({ error: "riservato agli amministratori" }, 403);

    /* --- config --- */
    const saRaw = Deno.env.get("GOOGLE_SA_KEY");
    if (!saRaw) return json({ error: "secret GOOGLE_SA_KEY non configurato" }, 400);

    let spreadsheetId = Deno.env.get("CATALOGO_SPREADSHEET_ID") ?? "";
    if (!spreadsheetId) {
      const { data: cfg } = await admin.from("app_config").select("value").eq("key", "catalogo_spreadsheet_id").maybeSingle();
      spreadsheetId = String(cfg?.value ?? "").trim();
    }
    if (!spreadsheetId) return json({ error: "id del foglio non configurato (CATALOGO_SPREADSHEET_ID o app_config.catalogo_spreadsheet_id)" }, 400);
    spreadsheetId = estraiSpreadsheetId(spreadsheetId);

    /* --- lettura foglio --- */
    const token = await getAccessToken(saRaw);
    const raw = await fetchTabs(spreadsheetId, token);

    /* --- indici: cataloghi + categorie cliente --- */
    // Catalogo UNICO: products + product_variants alimentano entrambe le vetrine
    // (L2F è il private label di CRA). Non esiste più una tabella cra_products.
    const [pRes, vRes, catRes] = await Promise.all([
      admin.from("products").select("id, codice_l2f"),
      admin.from("product_variants").select("id, codice_l2f"),
      admin.from("categorie_cliente").select("id, nome"),
    ]);
    for (const r of [pRes, vRes, catRes]) if (r.error) return json({ error: r.error.message }, 500);

    const byProduct = new Map<string, string>();
    for (const p of pRes.data ?? []) byProduct.set(norm(p.codice_l2f), p.id);
    const byVariant = new Map<string, string>();
    for (const v of vRes.data ?? []) byVariant.set(norm(v.codice_l2f), v.id);

    /** chiave normalizzata → { id, nome } della categoria cliente */
    const catByKey = new Map<string, { id: string; nome: string }>();
    for (const c of catRes.data ?? []) {
      catByKey.set(chiaveCat(c.nome), { id: c.id, nome: c.nome });
      catByKey.set(chiaveCat(c.id), { id: c.id, nome: c.nome });
    }

    /* --- listino per categoria: creato al volo e agganciato, se manca --- */
    const listinoDiCat = new Map<string, string>();   // categoria id → listino id
    async function idListino(cat: { id: string; nome: string }): Promise<string> {
      const gia = listinoDiCat.get(cat.id);
      if (gia) return gia;
      // Si cerca PRIMA il contenitore già agganciato a questa categoria, e solo
      // come ripiego quello omonimo: cercare per nome soltanto significava che
      // rinominare la categoria lasciava orfani tutti i suoi prezzi e ne creava
      // un secondo dal nulla.
      const { data: link } = await admin
        .from("listino_categorie").select("listino_id").eq("categoria_id", cat.id).limit(1).maybeSingle();
      let lid = link?.listino_id as string | undefined;
      if (!lid) {
        const { data: omonimo } = await admin.from("listini").select("id").eq("nome", cat.nome).maybeSingle();
        lid = omonimo?.id as string | undefined;
      }
      if (!lid) {
        const { data: creato, error } = await admin
          .from("listini")
          .insert({ nome: cat.nome, descrizione: `Prezzi ${cat.nome} (dal foglio MASTER)` })
          .select("id").single();
        if (error) throw new Error(`creazione listino ${cat.nome}: ${error.message}`);
        lid = creato.id;
      }
      // aggancio alla categoria, idempotente
      const { error: eLink } = await admin
        .from("listino_categorie").upsert({ listino_id: lid, categoria_id: cat.id }, { onConflict: "listino_id,categoria_id" });
      if (eLink) throw new Error(`aggancio listino ${cat.nome}: ${eLink.message}`);
      listinoDiCat.set(cat.id, lid!);
      return lid!;
    }

    /* --- accumulatori --- */
    const nettoProd: { product_id: string; prezzo_netto: number }[] = [];
    const nettoVar: { variant_id: string; prezzo_netto: number }[] = [];
    const updProd: { id: string; prezzo_listino: number | null; fonte: string }[] = [];
    const updVar: { id: string; prezzo_listino: number | null }[] = [];
    /** categoria id → prezzi da scrivere / da rimuovere */
    type Bucket = {
      prod: { id: string; prezzo: number }[]; var: { id: string; prezzo: number }[];
      delProd: string[]; delVar: string[];
    };
    const perCat = new Map<string, Bucket>();
    const bucket = (catId: string): Bucket => {
      let b = perCat.get(catId);
      if (!b) { b = { prod: [], var: [], delProd: [], delVar: [] }; perCat.set(catId, b); }
      return b;
    };

    const non_trovati: { codice: string; scheda: string; riga: Record<string, string> }[] = [];
    const tabs: Record<string, number> = {};
    const colonne_categoria = new Set<string>();
    const colonne_ignorate = new Set<string>();
    /** categoria id → schede del foglio che la alimentano */
    const dalFoglio = new Map<string, { id: string; nome: string; schede: string[] }>();

    for (const cfg of TABS) {
      const { header, righe } = toObjects(raw[cfg.tab] ?? []);
      tabs[cfg.tab] = righe.length;

      // quali intestazioni sono colonne-prezzo di una categoria cliente?
      const colCat: { col: string; cat: { id: string; nome: string } }[] = [];
      for (const h of header) {
        const low = h.toLowerCase();
        if (!low || COLONNE_STRUTTURALI.has(low)) continue;
        const cat = catByKey.get(chiaveCat(h));
        if (cat) {
          colCat.push({ col: low, cat });
          colonne_categoria.add(`${cfg.tab}.${h} → ${cat.nome}`);
          // Elenco pulito per il pannello: sa quali categorie comanda il
          // foglio senza dover fare parsing di stringhe.
          const g = dalFoglio.get(cat.id) ?? { id: cat.id, nome: cat.nome, schede: [] as string[] };
          if (!g.schede.includes(cfg.tab)) g.schede.push(cfg.tab);
          dalFoglio.set(cat.id, g);
        } else colonne_ignorate.add(`${cfg.tab}.${h}`);
      }

      for (const r of righe) {
        // codice: prima colonna valorizzata tra quelle previste dal tab
        const codici = cfg.codici.map((k) => norm(r[k])).filter(Boolean);
        if (!codici.length) continue;

        const listinoPubblico = parsePrezzo(r["listino"]);
        const universale = parsePrezzo(r["netto"] ?? r["netto_nord"]);

        let pid: string | undefined, vid: string | undefined;
        for (const cod of codici) {
          pid ??= byProduct.get(cod);
          if (!pid) vid ??= byVariant.get(cod);
        }
        if (!pid && !vid) {
          /* Il codice da solo non dice niente: «manca L2F22291» costringe ad
             andare a cercare nel foglio cosa sia. Riportiamo le colonne
             descrittive della riga, così dal pannello si vede il prodotto e
             lo si può creare senza indovinare. Prezzi compresi: sono quelli
             che il sync applicherà da solo appena il codice esiste. */
          const riga: Record<string, string> = {};
          for (const k of ["nome", "gamma", "imballo", "specifiche", "applicazione", "listino", "netto", "netto_nord"]) {
            const v = r[k];
            if (v != null && String(v).trim() !== "") riga[k] = String(v).trim();
          }
          non_trovati.push({ codice: codici[0], scheda: cfg.tab, riga });
          continue;
        }

        // ---- prezzo base ----
        if (pid) {
          updProd.push({ id: pid, prezzo_listino: listinoPubblico, fonte: cfg.fonte });
          if (universale != null) nettoProd.push({ product_id: pid, prezzo_netto: universale });
        } else if (vid) {
          updVar.push({ id: vid, prezzo_listino: listinoPubblico });
          if (universale != null) nettoVar.push({ variant_id: vid, prezzo_netto: universale });
        }

        // ---- prezzi per categoria ----
        for (const { col, cat } of colCat) {
          const p = parsePrezzo(r[col]);
          const b = bucket(cat.id);
          if (p != null) {
            if (pid) b.prod.push({ id: pid, prezzo: p });
            else if (vid) b.var.push({ id: vid, prezzo: p });
          } else {
            // cella vuota → il prodotto esce dal listino (torna al prezzo base)
            if (pid) b.delProd.push(pid);
            else if (vid) b.delVar.push(vid);
          }
        }
      }
    }

    /* --- scritture: prezzo base --- */
    let aggiornati_l2f = 0;
    for (const u of updProd) {
      const patch: Record<string, unknown> = { fonte_listino: u.fonte };
      if (u.prezzo_listino != null) patch.prezzo_listino = u.prezzo_listino;
      const { error } = await admin.from("products").update(patch).eq("id", u.id);
      if (!error) aggiornati_l2f++;
    }
    for (const u of updVar) {
      if (u.prezzo_listino == null) continue;
      const { error } = await admin.from("product_variants").update({ prezzo_listino: u.prezzo_listino }).eq("id", u.id);
      if (!error) aggiornati_l2f++;
    }

    let netti_universali = 0;
    if (nettoProd.length) {
      const { error } = await admin.from("product_netto").upsert(nettoProd, { onConflict: "product_id" });
      if (error) return json({ error: `product_netto: ${error.message}` }, 500);
      netti_universali += nettoProd.length;
    }
    if (nettoVar.length) {
      const { error } = await admin.from("product_variant_netto").upsert(nettoVar, { onConflict: "variant_id" });
      if (error) return json({ error: `product_variant_netto: ${error.message}` }, 500);
      netti_universali += nettoVar.length;
    }

    /* --- scritture: prezzi per categoria (listini auto-gestiti) --- */
    const listini_scritti: Record<string, { prezzi: number; rimossi: number }> = {};
    for (const [catId, b] of perCat) {
      const cat = (catRes.data ?? []).find((c) => c.id === catId)!;
      const lid = await idListino({ id: cat.id, nome: cat.nome });
      let prezzi = 0, rimossi = 0;

      const scrivi = async (tab: string, key: string, rows: { id: string; prezzo: number }[], campo: string) => {
        if (!rows.length) return;
        const payload = rows.map((r) => ({ listino_id: lid, [key]: r.id, [campo]: r.prezzo }));
        const { error } = await admin.from(tab).upsert(payload, { onConflict: `listino_id,${key}` });
        if (error) throw new Error(`${tab}: ${error.message}`);
        prezzi += rows.length;
      };
      const togli = async (tab: string, key: string, ids: string[]) => {
        if (!ids.length) return;
        const { error, count } = await admin.from(tab).delete({ count: "exact" })
          .eq("listino_id", lid).in(key, ids);
        if (error) throw new Error(`${tab} (rimozione): ${error.message}`);
        rimossi += count ?? 0;
      };

      await scrivi("listino_prezzi_prod", "product_id", b.prod, "prezzo_netto");
      await scrivi("listino_prezzi_var", "variant_id", b.var, "prezzo_netto");
      await togli("listino_prezzi_prod", "product_id", b.delProd);
      await togli("listino_prezzi_var", "variant_id", b.delVar);

      listini_scritti[cat.nome] = { prezzi, rimossi };
    }

    const esito = {
      quando: new Date().toISOString(),
      tabs,
      aggiornati_l2f,
      netti_universali,
      listini: listini_scritti,
      /** Verità esatta su quali categorie comanda il foglio: il pannello la usa
       *  per decidere quali celle bloccare, senza doverla indovinare. */
      categorie_dal_foglio: [...dalFoglio.values()],
      colonne_categoria: [...colonne_categoria],
      colonne_ignorate: [...colonne_ignorate],
      non_trovati,
    };
    // Persistito: così il pannello sa lo stato anche dopo un ricaricamento.
    await admin.from("app_config").upsert(
      { key: "sync_catalogo_ultimo", value: JSON.stringify(esito) },
      { onConflict: "key" },
    );

    return json({ ok: true, ...esito });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
