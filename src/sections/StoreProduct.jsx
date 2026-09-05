import React from "react";
import { Container } from "../components/shared.jsx";
import { Button } from "../components/ds/Button.jsx";
import { Icon } from "../components/Icon.jsx";
import { useCart } from "../lib/cart.jsx";
import { useAuth } from "../lib/auth.jsx";
import { getProductByCodice, formatEuro, confezioneLitri, unitaLabel, prezzoVisibile, ivaNota, PLACEHOLDER_IMG, statoOfferta, adesso } from "../lib/craCatalog.js";
import { StoreHead, CartDrawer, StoreGate, NastroOfferta } from "./Store.jsx";
import { tracciaProdotto, tracciaCarrello } from "../lib/traccia.js";

const { useEffect, useState } = React;

/* Etichette leggibili per la scheda tecnica; chiavi gestite a parte o nascoste. */
const SPEC_LABELS = {
  tecnologia: "Tecnologia", ah: "Capacità", spunto: "Spunto", polo: "Polo positivo",
  box: "Box", dimensioni: "Dimensioni (LxPxH mm)", linea: "Linea", attacco: "Attacco",
  canbus: "CANBUS", potenza: "Potenza", voltaggio: "Voltaggio", chip: "Chip LED",
  specifica: "Resa luminosa", raffreddamento: "Raffreddamento", utilizzo: "Utilizzo",
  temperatura: "Temperatura colore", colore: "Colore", gradazione: "Gradazione SAE",
  categoria: "Specifica", confezione: "Confezione", omologazioni: "Omologazioni",
};
const SPEC_SUFFIX = { ah: " Ah", spunto: " A" };
const SPEC_SKIP = new Set(["caratteristiche", "specifiche", "unita_prezzo", "kelvin"]); // kelvin: doppione di "temperatura"

/** Righe della scheda tecnica: attributi primitivi + "caratteristiche" annidate. */
function specRows(attributi) {
  const a = attributi ?? {};
  const rows = [];
  for (const [k, v] of Object.entries(a)) {
    if (SPEC_SKIP.has(k) || v == null || v === "" || typeof v === "object") continue;
    rows.push([SPEC_LABELS[k] ?? k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()), String(v) + (SPEC_SUFFIX[k] ?? "")]);
  }
  if (a.caratteristiche && typeof a.caratteristiche === "object" && !Array.isArray(a.caratteristiche)) {
    for (const [k, v] of Object.entries(a.caratteristiche)) {
      if (v != null && v !== "") rows.push([k, String(v)]);
    }
  }
  if (Array.isArray(a.specifiche) && a.specifiche.length) {
    rows.push(["Specifiche", a.specifiche.join(" · ")]);
  }
  return rows;
}

/* Un documento da scaricare: angoli vivi e bordo netto, come il resto del CRA. */
const STILE_DOC = {
  display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 14px",
  border: "var(--border-w-2) solid var(--border-strong)", background: "var(--surface-card)",
  color: "var(--text-strong)", textDecoration: "none",
  fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)",
  textTransform: "uppercase", letterSpacing: "var(--ls-caps)",
};

/* Scheda prodotto del CRA Store — #/store/<codice> */
export function StoreProduct({ codice, onNavigate }) {
  return (
    <StoreGate onNavigate={onNavigate}>
      <StoreProductInner codice={codice} onNavigate={onNavigate} />
    </StoreGate>
  );
}

function StoreProductInner({ codice, onNavigate }) {
  const { add, open, ivaIncl } = useCart();
  const { puoProporre, isStaff } = useAuth();
  const [p, setP] = useState(undefined); // undefined = loading, null = non trovato
  const [qty, setQty] = useState(1);
  const [foto, setFoto] = useState(0);
  /** Formato scelto (id variante). Null per i prodotti senza formati. */
  const [varianteId, setVarianteId] = useState(null);

  useEffect(() => {
    setP(undefined);
    setFoto(0);
    setQty(1);
    getProductByCodice(codice)
      .then((r) => {
        setP(r ?? null);
        // Se l'URL era il codice di un formato, quello arriva già selezionato;
        // altrimenti si parte dal primo.
        setVarianteId(r?.conVarianti ? (r.variantePreselezionata ?? r.varianti[0]?.id ?? null) : null);
        if (r) tracciaProdotto(r.codice, r.nome);
      })
      .catch(() => setP(null));
  }, [codice]);

  /** La variante scelta, e il prezzo/codice effettivamente in vendita. */
  const variante = p?.conVarianti ? (p.varianti.find((v) => v.id === varianteId) ?? p.varianti[0]) : null;
  const prezzoCorrente = variante ? variante.prezzo : p?.prezzo ?? null;
  const codiceCorrente = variante ? variante.codice : p?.codice;

  const gallery = p ? [p.immagine, ...(p.immagini ?? [])].filter(Boolean) : [];
  const mainImg = gallery[foto] || PLACEHOLDER_IMG;

  return (
    <div style={{ background: "var(--surface-page)" }}>
      <StoreHead />
      <Container style={{ padding: "var(--space-5) var(--space-5) var(--space-9)" }}>
        <button onClick={() => onNavigate("store")} style={{
          display: "inline-flex", alignItems: "center", gap: "8px", background: "none", border: "none",
          cursor: "pointer", padding: "6px 0", marginBottom: "var(--space-4)",
          fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)",
          textTransform: "uppercase", letterSpacing: "var(--ls-caps)", color: "var(--text-muted)",
        }}>
          <Icon name="chevron-left" size={15} /> Torna al catalogo
        </button>

        {p === undefined && <p style={{ color: "var(--text-muted)" }}>Caricamento…</p>}

        {p === null && (
          <div style={{ textAlign: "center", padding: "var(--space-8) 0", color: "var(--text-muted)" }}>
            <Icon name="package-search" size={40} color="var(--cra-gold)" />
            <p style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", letterSpacing: "var(--ls-caps)", margin: "12px 0 4px" }}>
              Articolo non trovato
            </p>
            <p style={{ margin: 0, fontSize: "var(--fs-sm)" }}>Il codice {codice} non è (più) a catalogo.</p>
          </div>
        )}

        {p && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
            {/* galleria */}
            <div>
              <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle, #e2e0da)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "320px", padding: "18px" }}>
                <img src={mainImg} alt={p.nome} style={{ maxWidth: "100%", maxHeight: "360px", objectFit: "contain", display: "block" }} />
              </div>
              {gallery.length > 1 && (
                <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                  {gallery.map((src, i) => (
                    <button key={src + i} onClick={() => setFoto(i)} aria-label={`Foto ${i + 1}`} style={{
                      width: "62px", height: "62px", padding: "4px", cursor: "pointer", background: "var(--surface-card)",
                      border: `2px solid ${i === foto ? "var(--cra-charcoal)" : "var(--border-subtle, #e2e0da)"}`,
                    }}>
                      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* dati */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <span style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", fontSize: "var(--fs-2xs)", letterSpacing: "var(--ls-eyebrow)", color: "var(--cra-red)" }}>
                {p.categoria_nome ?? "catalogo"}
              </span>
              <h1 style={{ margin: 0, fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-2xl)", lineHeight: 1.15, color: "var(--text-strong)" }}>{p.nome}</h1>
              <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>Cod. {codiceCorrente}</span>

              {/* L'urgenza non deve sparire al clic: se il countdown c'era nel
                  catalogo, deve esserci anche qui. */}
              {(() => {
                const off = statoOfferta(p, null, adesso());
                return off
                  ? <NastroOfferta offerta={off} prodottoId={p.id} isoFine={p.cra_offerta_a} isoInizio={p.cra_offerta_da} />
                  : null;
              })()}

              {/* Formati disponibili: lo stesso articolo in imballi diversi.
                  Il codice, il prezzo e la confezione seguono la scelta. */}
              {p.conVarianti && (
                <div>
                  <span style={{ display: "block", marginBottom: "8px", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "var(--ls-caps)", color: "var(--text-strong)" }}>
                    Formato
                  </span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {p.varianti.map((v) => {
                      const scelta = v.id === variante?.id;
                      return (
                        <button key={v.id} onClick={() => setVarianteId(v.id)} aria-pressed={scelta}
                          style={{
                            cursor: "pointer", padding: "9px 14px",
                            fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)",
                            background: scelta ? "var(--cra-charcoal)" : "transparent",
                            color: scelta ? "var(--cra-white)" : "var(--text-strong)",
                            border: `var(--border-w-2) solid ${scelta ? "var(--cra-charcoal)" : "var(--border-strong)"}`,
                          }}>
                          {v.imballo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const conf = confezioneLitri(variante);
                const unita = unitaLabel(variante);
                return (
                  <div style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-black)", fontSize: "var(--fs-2xl)", color: "var(--text-strong)", fontVariantNumeric: "tabular-nums" }}>
                    {/* Il barrato appare solo se l'offerta abbassa davvero il
                        prezzo di questo cliente. Sulle varianti non c'è: un
                        prezzo solo non può valere per tutti gli imballi. */}
                    {!variante && p.prezzoPieno != null && (
                      <span style={{ fontSize: "0.5em", fontWeight: "var(--fw-bold)", color: "var(--text-muted)", textDecoration: "line-through", marginRight: "8px" }}>
                        {formatEuro(prezzoVisibile(p.prezzoPieno, ivaIncl))}
                      </span>
                    )}
                    <span style={!variante && p.prezzoPieno != null ? { color: "var(--cra-red)" } : undefined}>
                      {formatEuro(prezzoVisibile(prezzoCorrente, ivaIncl))}
                    </span>
                    {unita && <span style={{ fontSize: "0.5em", fontWeight: "var(--fw-bold)", color: "var(--text-muted)" }}> /litro</span>}
                    <small style={{ display: "block", fontFamily: "var(--font-body)", fontWeight: 400, fontSize: "var(--fs-2xs)", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{ivaNota(ivaIncl)} *</small>
                    {conf && (
                      <span style={{ display: "block", marginTop: "8px", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-md)", color: "var(--cra-red)" }}>
                        Confezione {conf.litri} L: {formatEuro(prezzoVisibile(conf.totale, ivaIncl))}
                        <span style={{ color: "var(--text-muted)", fontWeight: 400, fontFamily: "var(--font-body)", fontSize: "var(--fs-xs)" }}> ({ivaNota(ivaIncl)})</span>
                      </span>
                    )}
                  </div>
                );
              })()}

              {p.descrizione && (
                <p style={{ margin: 0, fontSize: "var(--fs-base)", lineHeight: "var(--lh-relaxed)", color: "var(--text-body)", whiteSpace: "pre-wrap", maxWidth: "62ch" }}>
                  {p.descrizione}
                </p>
              )}

              {specRows(p.attributi).length > 0 && (
                <div style={{ marginTop: "var(--space-2)" }}>
                  <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "var(--ls-caps)", color: "var(--text-strong)" }}>
                    Specifiche
                  </h2>
                  <div style={{ border: "1px solid var(--border-subtle, #e2e0da)", background: "var(--surface-card)" }}>
                    {specRows(p.attributi).map(([label, value], i) => (
                      <div key={label + i} style={{ display: "flex", gap: "14px", padding: "8px 12px", borderTop: i > 0 ? "1px solid var(--border-subtle, #e2e0da)" : "none", fontSize: "var(--fs-xs)" }}>
                        <span style={{ minWidth: "150px", color: "var(--text-muted)", fontWeight: "var(--fw-semibold)" }}>{label}</span>
                        <span style={{ color: "var(--text-strong)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per un prodotto chimico la scheda di sicurezza deve essere
                  raggiungibile: qui è a un clic, senza doverla chiedere. */}
              {(p.scheda_tecnica_url || p.scheda_sicurezza_url) && (
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "var(--space-2)" }}>
                  {p.scheda_tecnica_url && (
                    <a href={p.scheda_tecnica_url} target="_blank" rel="noopener noreferrer" style={STILE_DOC}>
                      <Icon name="file-text" size={16} /> Scheda tecnica
                    </a>
                  )}
                  {p.scheda_sicurezza_url && (
                    <a href={p.scheda_sicurezza_url} target="_blank" rel="noopener noreferrer" style={STILE_DOC}>
                      <Icon name="triangle-alert" size={16} /> Scheda di sicurezza
                    </a>
                  )}
                </div>
              )}

              {/* Quantità e carrello solo a chi può davvero mandare la
                  proposta. Agli altri il prezzo, le specifiche e i documenti
                  restano tutti: è per quelli che sono entrati. */}
              {!puoProporre ? (
                <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                  <Icon name="info" size={14} color="var(--cra-gold)" />{" "}
                  {isStaff
                    ? <React.Fragment>Stai consultando il catalogo. La proposta d'ordine per un cliente si manda dall'<b>area interna</b>, aprendo una promozione nel Card Center.</React.Fragment>
                    : "Per inviare una proposta d'ordine serve un account officina abilitato."}
                </p>
              ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", border: "var(--border-w-2) solid var(--border-strong)" }}>
                  <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Diminuisci quantità" style={{ background: "none", border: "none", cursor: "pointer", padding: "12px 14px", display: "inline-flex" }}><Icon name="minus" size={15} /></button>
                  <span style={{ minWidth: "36px", textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-base)" }}>{qty}</span>
                  <button onClick={() => setQty(qty + 1)} aria-label="Aumenta quantità" style={{ background: "none", border: "none", cursor: "pointer", padding: "12px 14px", display: "inline-flex" }}><Icon name="plus" size={15} /></button>
                </div>
                <Button variant="primary" iconLeft={<Icon name="shopping-cart" size={16} />} onClick={() => {
                  // Un fusto (20/60/200 L) entra come confezione intera al suo prezzo
                  // pieno; le scatole "12×1 L" al prezzo di riga.
                  const conf = confezioneLitri(variante);
                  add({
                    product_id: p.id,
                    variant_id: variante?.id ?? null,
                    codice: codiceCorrente,
                    nome: variante ? `${p.nome} · ${variante.imballo}` : p.nome,
                    imballo: variante?.imballo ?? null,
                    prezzo: conf ? conf.totale : prezzoCorrente,
                    immagine: p.immagine,
                    quantita: qty,
                  });
                  tracciaCarrello(codiceCorrente, qty);
                  open();
                }}>
                  Aggiungi alla proposta
                </Button>
              </div>
              )}

              {puoProporre && (
                <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
                  <Icon name="check" size={13} color="var(--cra-gold)" /> Nessun pagamento online: invii una proposta d'ordine
                  e ti confermiamo noi disponibilità e tempi via email.
                </p>
              )}
            </div>
          </div>
        )}
      </Container>
      <CartDrawer onNavigate={onNavigate} />
    </div>
  );
}
