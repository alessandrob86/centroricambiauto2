import { confezione, numero, litriTesto } from "./calcolo.js";

/* Il documento dell'ordine per il fornitore: un file HTML da aprire, stampare o
   allegare a una mail, e un CSV per chi lo vuole caricare nel suo gestionale.
   Ci vanno codici, quantità, omaggi, filiale di consegna e note per il
   fornitore. NON ci vanno le note interne, i costi né il paragone. */

/* Senza dichiarare la codifica, le lettere accentate si scrivono come &#…; e si leggono ovunque. */
const soloAscii = (s) => s.replace(/[^ -~\s]/g, (c) => `&#${c.codePointAt(0)};`);
const BOM = String.fromCharCode(0xfeff);   // serve a Excel per leggere gli accenti del CSV
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function scarica(nomeFile, contenuto, tipo) {
  const blob = new Blob([contenuto], { type: tipo });
  const indirizzo = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = indirizzo;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(indirizzo), 1000);
}

const nomeSicuro = (s) => String(s).normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function righeDocumento(conto) {
  return conto.righe.filter((r) => r.pz > 0).map((r) => ({
    codice: r.formato.codice,
    descrizione: `${r.olio.nome}${r.formato.descrizione ? ` · ${r.formato.descrizione}` : ""}`,
    confezione: confezione(r.formato),
    cartoni: r.formato.pezzi_cartone > 1 ? r.cartoni : 0,
    pezzi: r.formato.pezzi_cartone > 1 ? r.pezzi : r.pz,
    omaggi: r.omaggiCartoni,
    litri: r.litri,
  }));
}

export function scaricaHtml({ marchio, filiale, data, riferimento, noteFornitore, conto }) {
  const righe = righeDocumento(conto);
  const tot = righe.reduce((a, r) => ({ cartoni: a.cartoni + r.cartoni, omaggi: a.omaggi + r.omaggi, litri: a.litri + r.litri }), { cartoni: 0, omaggi: 0, litri: 0 });
  const td = 'style="border-bottom:1px solid #ddd;padding:7px 6px;text-align:left"';
  const tdn = 'style="border-bottom:1px solid #ddd;padding:7px 6px;text-align:right"';
  const th = 'style="background:#f2f1ed;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:7px 6px;text-align:left"';
  const thn = 'style="background:#f2f1ed;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:7px 6px;text-align:right"';
  const piede = 'style="font-weight:bold;border-top:2px solid #272D2B;padding:7px 6px"';
  const html = `<!doctype html>
<html lang="it"><head><title>Ordine ${esc(marchio.nome)} - ${esc(data)}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#272D2B;margin:32px;font-size:13px">
<div style="display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #C32327;padding-bottom:12px;margin-bottom:18px">
  <div><h1 style="font-size:20px;margin:0 0 4px">Centro Ricambi Auto</h1><div>Ordine lubrificanti a <strong style="color:#C32327">${esc(marchio.nome)}</strong></div></div>
  <div><div><strong>Data:</strong> ${esc(data)}</div>${riferimento ? `<div><strong>Riferimento:</strong> ${esc(riferimento)}</div>` : ""}
  <div><strong>Consegna a:</strong> ${esc(filiale?.nome ?? "")}${filiale?.indirizzo ? `<br>${esc(filiale.indirizzo)}` : ""}</div></div>
</div>
<table style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr><th ${th}>Codice</th><th ${th}>Descrizione</th><th ${th}>Confezione</th><th ${thn}>Cartoni</th><th ${thn}>Pezzi</th><th ${thn}>Cartoni omaggio</th></tr></thead>
<tbody>${righe.map((r) => `<tr><td ${td}>${esc(r.codice)}</td><td ${td}>${esc(r.descrizione)}</td><td ${td}>${esc(r.confezione)}</td><td ${tdn}>${r.cartoni || ""}</td><td ${tdn}>${r.pezzi || ""}</td><td ${tdn}>${r.omaggi || ""}</td></tr>`).join("")}</tbody>
<tfoot><tr><td ${piede} colspan="3">${righe.length} righe - ${esc(litriTesto(tot.litri))}</td><td ${piede} align="right">${tot.cartoni}</td><td ${piede}></td><td ${piede} align="right">${tot.omaggi || ""}</td></tr></tfoot></table>
${conto.omaggiOrdine ? `<p><strong>Cartoni omaggio sull'ordine:</strong> ${numero(conto.omaggiOrdine)}</p>` : ""}
${noteFornitore ? `<div style="margin-top:18px;padding:10px 12px;background:#f7f6f2;white-space:pre-wrap"><strong>Note</strong><br>${esc(noteFornitore)}</div>` : ""}
</body></html>`;
  scarica(`ordine-${nomeSicuro(marchio.nome)}-${nomeSicuro(filiale?.nome ?? "")}-${data}.html`, soloAscii(html), "text/html;charset=utf-8");
}

export function scaricaCsv({ marchio, filiale, data, conto }) {
  const campo = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const righe = righeDocumento(conto);
  const testo = ["codice;descrizione;confezione;cartoni;pezzi;cartoni_omaggio",
    ...righe.map((r) => [r.codice, r.descrizione, r.confezione, r.cartoni, r.pezzi, r.omaggi].map(campo).join(";"))].join("\r\n");
  scarica(`ordine-${nomeSicuro(marchio.nome)}-${nomeSicuro(filiale?.nome ?? "")}-${data}.csv`, BOM + testo, "text/csv;charset=utf-8");
}
