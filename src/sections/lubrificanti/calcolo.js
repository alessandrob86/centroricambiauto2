/* ============================================================
   Il motore dei conti del modulo «lub»: funzioni pure, niente database,
   niente interfaccia. Le pagine gli passano i dati e lui risponde.

   Rifà i conti del comparatore di Gestione:
     costo al litro = voce di costo scelta (netto, listino, …)
                      − sconto sul listino (solo se la voce è «listino»)
                      ÷ 1,22 se il listino è IVA compresa
                      − sconti extra a cascata
                      + CONOU (se il marchio lo aggiunge e l'olio lo paga)
   Tutti i costi sono AL LITRO; il pezzo è litri × costo al litro.
   ============================================================ */

export const TETTI_PARTENZA = { A: 60, B: 45, C: 20 };
export const GIORNI_PERIODO_ABC = 365;

const n = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);
const pct = (x) => Math.max(0, Math.min(95, n(x)));

/* I gruppi di formato, per le colonne di «Trova l'olio» e per il filtro dell'ordine. */
export const GRUPPI = [
  { chiave: "1", nome: "1 L", fino: 1.5 },
  { chiave: "5", nome: "2-5 L", fino: 10 },
  { chiave: "20", nome: "20 L", fino: 40 },
  { chiave: "60", nome: "60 L", fino: 150 },
  { chiave: "200", nome: "Fusti", fino: Infinity },
];
export const gruppo = (litri) => GRUPPI.find((g) => n(litri) < g.fino)?.chiave ?? "200";

export const euro = (x, cifre = 2) =>
  x == null || !Number.isFinite(x) ? "—" : x.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: cifre, maximumFractionDigits: cifre });
export const numero = (x, cifre = 0) =>
  x == null || !Number.isFinite(x) ? "—" : x.toLocaleString("it-IT", { minimumFractionDigits: cifre, maximumFractionDigits: cifre });
export const litriTesto = (l) => `${numero(n(l), n(l) % 1 ? 2 : 0)} L`;
export const confezione = (f) => (f.pezzi_cartone > 1 ? `${f.pezzi_cartone} × ${litriTesto(f.litri)}` : litriTesto(f.litri));

/* Quale voce di costo usare, nell'ordine voluto dalle regole del marchio. */
function scegliVoce(regole, costi, { prelievi = 0, litri = 0 } = {}) {
  let ordine = Array.isArray(regole.voci_costo) && regole.voci_costo.length ? [...regole.voci_costo] : ["netto", "listino"];
  const davanti = (v) => { ordine = [v, ...ordine.filter((x) => x !== v)]; };
  let fattore10p1 = 1;
  switch (regole.modalita_prezzo) {
    case "lug26_base": davanti("netto_base"); break;
    case "giacenza": davanti("giacenza_finito"); break;
    case "lug26_extra10p1": fattore10p1 = 10 / 11; break;
    case "lug26_realistico": if (!(prelievi >= 10 && litri < 200)) davanti("netto_base"); break;
    default: break;
  }
  for (const voce of ordine) {
    const p = n(costi?.[voce]);
    if (p > 0) return { voce, prezzo: voce === "netto_10p1" ? p * fattore10p1 : p };
  }
  return null;
}

/* Il costo al litro di un formato con le regole del suo marchio.
   null = il formato non ha un costo utilizzabile. */
export function costoLitro(formato, olio, regole = {}, costi = {}, contesto = {}) {
  const scelta = scegliVoce(regole, costi, { ...contesto, litri: formato.litri });
  if (!scelta) return null;
  const conou = regole.aggiungi_conou !== false && olio?.soggetto_conou !== false
    ? n(regole.conou_per_litro, n(contesto.conouPartenza, 0)) : 0;
  let netto = scelta.prezzo;
  const note = [];
  if (scelta.voce === "listino" && pct(regole.sconto_listino_pct) > 0) {
    netto *= 1 - pct(regole.sconto_listino_pct) / 100;
    note.push(`listino −${numero(pct(regole.sconto_listino_pct))}%`);
  } else note.push(scelta.voce.replaceAll("_", " "));
  if (regole.prezzi_ivati) { netto /= 1.22; note.push("IVA esclusa"); }
  if (scelta.voce === "giacenza_finito") netto = Math.max(0, netto - conou);
  for (const d of regole.sconti_extra_pct ?? []) {
    if (pct(d) > 0) { netto *= 1 - pct(d) / 100; note.push(`−${numero(pct(d))}%`); }
  }
  const promo = promoPerCodice(regole, formato);
  const nettoPromo = promo ? netto * (promo.compra / (promo.compra + promo.omaggio)) : netto;
  return { voce: scelta.voce, netto, nettoPromo, conou, finito: netto + conou, finitoPromo: nettoPromo + conou, note, promo };
}

/* La promo «ogni N cartoni M omaggio» vale per questo formato? */
export function promoPerCodice(regole, formato) {
  const p = regole?.promo;
  if (!p?.attiva || p.ambito === "ordine") return null;
  const compra = Math.max(0, Math.trunc(n(p.compra)));
  const omaggio = Math.max(0, Math.trunc(n(p.omaggio)));
  if (!compra || !omaggio) return null;
  if (p.solo_cartoni !== false && !(formato.pezzi_cartone > 1)) return null;
  return { compra, omaggio };
}

export const venditaLitro = (prezzoPezzo, formato) => (prezzoPezzo > 0 && formato.litri > 0 ? prezzoPezzo / formato.litri : null);
export function margine(prezzoPezzo, formato, costo) {
  const vl = venditaLitro(prezzoPezzo, formato);
  if (!vl || !costo) return null;
  return (vl - costo.finito) / vl;
}

/* Giorni di scorta: giacenza (pezzi) diviso il consumo al giorno. */
export function giorniScorta(rot, pezziInPiu = 0, giorniPeriodo = GIORNI_PERIODO_ABC) {
  if (!rot || !(n(rot.prelievi) > 0)) return null;
  const alGiorno = n(rot.prelievi) / Math.max(1, n(giorniPeriodo, GIORNI_PERIODO_ABC));
  return (n(rot.giacenza) + pezziInPiu) / alGiorno;
}

/* ------------------------------------------------------------
   L'ordine: righe = [{ formato, olio, cartoni, pezzi }]
   ------------------------------------------------------------ */
export function calcolaOrdine(righe, regole = {}, costoDi) {
  let merce = 0, conou = 0, cartoniTot = 0, litriTot = 0;
  const dettaglio = righe.map((r) => {
    const costo = costoDi(r);
    const pz = n(r.cartoni) * r.formato.pezzi_cartone + n(r.pezzi);
    const promo = promoPerCodice(regole, r.formato);
    const omaggiCartoni = promo ? Math.floor(n(r.cartoni) / promo.compra) * promo.omaggio : 0;
    const omaggiPz = omaggiCartoni * r.formato.pezzi_cartone;
    const litri = pz * r.formato.litri;
    const rigaMerce = costo ? litri * costo.netto : 0;
    const rigaConou = costo ? (pz + omaggiPz) * r.formato.litri * costo.conou : 0;
    merce += rigaMerce; conou += rigaConou; litriTot += litri;
    if (r.formato.pezzi_cartone > 1) cartoniTot += n(r.cartoni);
    return { ...r, costo, pz, omaggiCartoni, omaggiPz, litri, merce: rigaMerce, conou: rigaConou, totale: rigaMerce + rigaConou };
  });
  /* Promo sull'ordine intero: i cartoni omaggio si contano sul totale. */
  const p = regole.promo;
  const omaggiOrdine = p?.attiva && p.ambito === "ordine" && n(p.compra) > 0
    ? Math.floor(cartoniTot / n(p.compra)) * Math.trunc(n(p.omaggio)) : 0;
  /* La soglia vale sul singolo ordine: euro di merce o cartoni. */
  const s = regole.soglia;
  let soglia = null;
  if (s?.attiva && n(s.valore) > 0) {
    const attuale = s.tipo === "cartoni" ? cartoniTot : merce;
    const raggiunta = attuale >= n(s.valore);
    soglia = {
      tipo: s.tipo === "cartoni" ? "cartoni" : "euro", valore: n(s.valore), attuale, raggiunta,
      mancano: Math.max(0, n(s.valore) - attuale), scontoPct: pct(s.sconto_extra_pct),
      sconto: raggiunta ? merce * pct(s.sconto_extra_pct) / 100 : 0,
    };
  }
  const scontoSoglia = soglia?.sconto ?? 0;
  return {
    righe: dettaglio, merce, conou, scontoSoglia, totale: merce - scontoSoglia + conou,
    cartoni: cartoniTot, litri: litriTot, omaggiOrdine, soglia,
    omaggiCartoni: dettaglio.reduce((a, r) => a + r.omaggiCartoni, 0),
  };
}

/* ------------------------------------------------------------
   Il suggeritore: al massimo 5 mosse, ognuna con la sua «Applica».
   Non propone niente che porti la scorta oltre il tetto della classe.
   ------------------------------------------------------------ */
export function suggerisci({ conto, regole = {}, rotazioneDi, tetti = TETTI_PARTENZA, giorniPeriodo, formatiDellOlio, costoDi, candidatiScorta = [] }) {
  const mosse = [];
  const tetto = (cl) => n(tetti?.[cl], TETTI_PARTENZA[cl] ?? 30);

  for (const r of conto.righe) {
    if (!r.costo) continue;
    const rot = rotazioneDi(r.formato);
    const promo = promoPerCodice(regole, r.formato);
    /* 1. Omaggio a portata di mano */
    if (promo && n(r.cartoni) > 0) {
      const resto = n(r.cartoni) % promo.compra;
      const servono = resto ? promo.compra - resto : 0;
      if (servono > 0 && servono <= 2) {
        const extraPz = (servono + promo.omaggio) * r.formato.pezzi_cartone;
        const prima = giorniScorta(rot, r.pz, giorniPeriodo);
        const dopo = giorniScorta(rot, r.pz + extraPz, giorniPeriodo);
        const troppo = rot?.classe && dopo != null && dopo > tetto(rot.classe);
        const spesa = servono * r.formato.pezzi_cartone * r.formato.litri * r.costo.netto;
        mosse.push({
          tipo: troppo ? "Omaggio · non consigliato" : "Omaggio",
          testo: `+${servono} ${servono === 1 ? "cartone" : "cartoni"} di ${r.olio.nome} ${confezione(r.formato)}: scatta il ${promo.compra}+${promo.omaggio}.`,
          effetto: troppo
            ? `la scorta salirebbe a ${numero(dopo)} giorni, oltre il limite di ${tetto(rot.classe)} per la classe ${rot.classe}`
            : `spendi ${euro(spesa, 0)} in più · ${promo.omaggio} ${promo.omaggio === 1 ? "cartone" : "cartoni"} gratis${prima != null ? ` · scorta ${numero(prima)} → ${numero(dopo)} gg` : ""}`,
          consigliato: !troppo, peso: troppo ? 0 : promo.omaggio * r.formato.pezzi_cartone * r.formato.litri * r.costo.netto - spesa * 0.01,
          applica: troppo ? null : { formatoId: r.formato.id, cartoni: n(r.cartoni) + servono },
        });
      }
    }
    /* 2. Un formato più grande dello stesso olio che costa meno al litro */
    if (r.litri > 0) {
      let meglio = null;
      for (const f2 of formatiDellOlio(r.olio) ?? []) {
        if (f2.id === r.formato.id || !(f2.litri > r.formato.litri) || r.litri < f2.litri) continue;
        const c2 = costoDi({ formato: f2, olio: r.olio });
        if (!c2) continue;
        const pezzi2 = Math.round(r.litri / f2.litri);
        if (pezzi2 < 1 || Math.abs(pezzi2 * f2.litri - r.litri) > 0.01 * r.litri + 0.001) continue;
        const risparmio = r.litri * (r.costo.finito - c2.finito);
        if (risparmio > 10 && (!meglio || risparmio > meglio.risparmio)) meglio = { f2, c2, pezzi2, risparmio };
      }
      if (meglio) {
        const { f2, c2, pezzi2, risparmio } = meglio;
        mosse.push({
          tipo: "Formato",
          testo: `${r.olio.nome}: ${litriTesto(r.litri)} nel formato ${pezzi2} × ${litriTesto(f2.litri)} costano ${euro(r.costo.finito - c2.finito)}/L in meno.`,
          effetto: `risparmi ${euro(risparmio, 0)} a parità di litri`, consigliato: true, peso: risparmio,
          applica: { sostituisci: r.formato.id, formatoId: f2.id, cartoni: f2.pezzi_cartone > 1 ? Math.ceil(pezzi2 / f2.pezzi_cartone) : 0, pezzi: f2.pezzi_cartone > 1 ? 0 : pezzi2 },
        });
      }
    }
  }

  /* 3. La soglia dell'ordine è vicina */
  const s = conto.soglia;
  if (s && !s.raggiunta && s.mancano <= s.valore * 0.2) {
    const guadagno = (conto.merce + (s.tipo === "euro" ? s.mancano : 0)) * s.scontoPct / 100;
    mosse.push({
      tipo: "Soglia",
      testo: s.tipo === "euro"
        ? `Mancano ${euro(s.mancano, 0)} di merce per lo sconto extra del ${numero(s.scontoPct)}%.`
        : `Mancano ${numero(s.mancano)} cartoni per lo sconto extra del ${numero(s.scontoPct)}%.`,
      effetto: `sconto di circa ${euro(guadagno, 0)} su tutto l'ordine`, consigliato: guadagno > (s.tipo === "euro" ? s.mancano * 0.1 : 0),
      peso: guadagno, applica: null,
    });
  }

  /* 4. Classe A sotto scorta e non ancora nell'ordine */
  const nellOrdine = new Set(conto.righe.map((r) => r.formato.id));
  for (const c of candidatiScorta) {
    if (nellOrdine.has(c.formato.id)) continue;
    const rot = rotazioneDi(c.formato);
    if (rot?.classe !== "A") continue;
    const g = giorniScorta(rot, 0, giorniPeriodo);
    if (g == null || g >= 15) continue;
    const alGiorno = n(rot.prelievi) / Math.max(1, n(giorniPeriodo, GIORNI_PERIODO_ABC));
    const pezziVoluti = Math.max(0, alGiorno * tetto("A") / 2 - n(rot.giacenza));
    const cartoni = c.formato.pezzi_cartone > 1 ? Math.max(1, Math.ceil(pezziVoluti / c.formato.pezzi_cartone)) : 0;
    const pezzi = c.formato.pezzi_cartone > 1 ? 0 : Math.max(1, Math.ceil(pezziVoluti));
    mosse.push({
      tipo: "Scorta",
      testo: `${c.olio.nome} ${confezione(c.formato)} è in classe A con ${numero(g)} giorni di scorta.`,
      effetto: `aggiungi ${cartoni ? `${cartoni} ${cartoni === 1 ? "cartone" : "cartoni"}` : `${pezzi} pezzi`} per arrivare a circa ${tetto("A") / 2} giorni`,
      consigliato: true, peso: 50 - g, applica: { formatoId: c.formato.id, cartoni, pezzi },
    });
  }

  return mosse.sort((a, b) => Number(b.consigliato) - Number(a.consigliato) || b.peso - a.peso).slice(0, 5);
}

/* ------------------------------------------------------------
   Il paragone: le stesse righe con un altro marchio, a parità di litri.
   equivalentiDi(olio) → [{ olio, stato }] dell'altro marchio.
   ------------------------------------------------------------ */
export function paragona({ conto, equivalentiDi, costoB, includiDaVerificare = false }) {
  let totA = 0, totB = 0, reale = 0, coperte = 0;
  const dettagli = [];
  for (const r of conto.righe) {
    if (!r.costo || !(r.litri > 0)) continue;
    const valoreA = r.litri * r.costo.finito;
    const candidati = (equivalentiDi(r.olio) ?? []).filter((e) => e.stato === "confermata" || (includiDaVerificare && e.stato === "da_verificare"));
    let scelto = null;
    for (const e of candidati) {
      for (const f of e.olio.formati ?? []) {
        const c = costoB({ formato: f, olio: e.olio });
        if (!c) continue;
        const distanza = Math.abs(Math.log(f.litri / r.formato.litri));
        if (!scelto || distanza < scelto.distanza - 1e-9 || (Math.abs(distanza - scelto.distanza) < 1e-9 && c.finito < scelto.c.finito)) {
          scelto = { e, f, c, distanza };
        }
      }
    }
    if (!scelto) { dettagli.push({ riga: r, equiv: null, valoreA, valoreB: null }); continue; }
    coperte += 1;
    const valoreB = r.litri * scelto.c.finito;
    const pezziB = Math.ceil(r.litri / scelto.f.litri - 1e-9);
    const pezziPieni = scelto.f.pezzi_cartone > 1 ? Math.ceil(pezziB / scelto.f.pezzi_cartone) * scelto.f.pezzi_cartone : pezziB;
    totA += valoreA; totB += valoreB; reale += pezziPieni * scelto.f.litri * scelto.c.finito;
    dettagli.push({ riga: r, equiv: { olio: scelto.e.olio, formato: scelto.f, stato: scelto.e.stato, costo: scelto.c }, valoreA, valoreB });
  }
  return { totA, totB, diff: totB - totA, reale, coperte, totali: conto.righe.filter((r) => r.costo && r.litri > 0).length, dettagli };
}
