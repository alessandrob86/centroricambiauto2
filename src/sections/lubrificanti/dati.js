import { costoLitro, TETTI_PARTENZA, GIORNI_PERIODO_ABC } from "./calcolo.js";

/* Dai dati letti dal database costruisce le tabelle di ricerca che usano le
   pagine. Niente rete qui: solo indici, così ogni pagina chiede «il costo di
   questo formato» o «le alternative di questo olio» senza rifare i conti. */

export function costruisciIndici(catalogo, acquisto) {
  const marchi = new Map(catalogo.marchi.map((m) => [m.id, m]));
  const famiglie = new Map(catalogo.famiglie.map((f) => [f.id, f]));
  const oli = new Map(catalogo.oli.map((o) => [o.id, o]));
  const formati = new Map();
  for (const o of catalogo.oli) for (const f of o.formati) formati.set(f.id, f);

  const famiglieDellOlio = new Map();
  const oliDellaFamiglia = new Map();
  for (const e of catalogo.equivalenze) {
    if (!famiglieDellOlio.has(e.olio_id)) famiglieDellOlio.set(e.olio_id, []);
    famiglieDellOlio.get(e.olio_id).push(e);
    if (!oliDellaFamiglia.has(e.famiglia_id)) oliDellaFamiglia.set(e.famiglia_id, []);
    oliDellaFamiglia.get(e.famiglia_id).push(e);
  }

  const prezzi = new Map(catalogo.prezzi.map((p) => [p.formato_id, Number(p.prezzo)]));

  /* La casa: prezzo dal catalogo (Foglio MASTER), legato al formato per codice. Al litro o al pezzo:
     nella mappa va sempre il prezzo al pezzo, come per gli altri marchi. */
  const dalCatalogo = new Map((catalogo.prezziCasa ?? []).map((p) => [p.codice, p]));
  const formatiCasa = new Set();
  for (const o of catalogo.oli) {
    if (!marchi.get(o.marchio_id)?.casa) continue;
    for (const f of o.formati) {
      const p = dalCatalogo.get(f.codice);
      const valore = Number(p?.prezzo);
      if (!(valore > 0)) continue;
      prezzi.set(f.id, p.unita === "litro" ? valore * f.litri : valore);
      formatiCasa.add(f.id);
    }
  }

  const costi = new Map();
  for (const c of acquisto?.costi ?? []) {
    if (!costi.has(c.formato_id)) costi.set(c.formato_id, {});
    costi.get(c.formato_id)[c.voce] = Number(c.prezzo);
  }
  const condizioni = new Map();
  for (const c of acquisto?.condizioni ?? []) {
    if (!c.valido_al && !condizioni.has(c.marchio_id)) condizioni.set(c.marchio_id, c);
  }
  const impostazioni = Object.fromEntries((acquisto?.impostazioni ?? []).map((i) => [i.chiave, i.valore]));
  const tetti = { ...TETTI_PARTENZA, ...(impostazioni.tetti_scorta ?? {}) };
  const giorniPeriodo = Number(impostazioni.abc_giorni_periodo) || GIORNI_PERIODO_ABC;
  const conouPartenza = Number(impostazioni.conou_per_litro) || 0;
  const zonaRiferimento = typeof impostazioni.abc_filiale_riferimento === "string" ? impostazioni.abc_filiale_riferimento : null;

  const rotazione = new Map();      // zona → formato → riga
  for (const r of acquisto?.rotazione ?? []) {
    if (!rotazione.has(r.zona_id)) rotazione.set(r.zona_id, new Map());
    rotazione.get(r.zona_id).set(r.formato_id, { ...r, prelievi: Number(r.prelievi), giacenza: Number(r.giacenza ?? 0) });
  }

  const regoleDi = (marchioId) => condizioni.get(marchioId)?.regole ?? {};

  return {
    marchi, famiglie, oli, formati, prezzi, costi, condizioni, impostazioni, tetti, giorniPeriodo, zonaRiferimento,
    /* vero se il prezzo di questo formato arriva dal catalogo (marchio della casa) */
    prezzoDalCatalogo: (formatoId) => formatiCasa.has(formatoId),
    casaCollegata: formatiCasa.size > 0,
    elencoMarchi: [...catalogo.marchi].sort((a, b) => a.sort_order - b.sort_order),
    famiglieDellOlio: (olio) => famiglieDellOlio.get(olio.id) ?? [],
    oliDellaFamiglia: (famigliaId) => oliDellaFamiglia.get(famigliaId) ?? [],
    regoleDi,
    /* La rotazione della filiale; se quella filiale non ha dati, quella di riferimento. */
    rotazioneDi: (formato, zonaId) =>
      rotazione.get(zonaId)?.get(formato.id) ?? (zonaRiferimento ? rotazione.get(zonaRiferimento)?.get(formato.id) : undefined) ?? null,
    /* Il costo al litro con le regole vigenti del marchio, o con quelle passate. */
    costoDi: ({ formato, olio }, regole, zonaId) => {
      const o = olio ?? oli.get(formato.olio_id);
      if (!o) return null;
      const r = regole ?? regoleDi(o.marchio_id);
      const rot = rotazione.get(zonaId)?.get(formato.id) ?? (zonaRiferimento ? rotazione.get(zonaRiferimento)?.get(formato.id) : null);
      return costoLitro(formato, o, r, costi.get(formato.id), { prelievi: rot?.prelievi ?? 0, conouPartenza });
    },
    /* Gli oli di un altro marchio che valgono come questo (stessa famiglia, non scartati). */
    equivalentiDi: (olio, marchioId) => {
      const visti = new Map();
      for (const e of famiglieDellOlio.get(olio.id) ?? []) {
        if (e.stato === "scartata") continue;
        for (const e2 of oliDellaFamiglia.get(e.famiglia_id) ?? []) {
          if (e2.stato === "scartata" || e2.olio_id === olio.id) continue;
          const o2 = oli.get(e2.olio_id);
          if (!o2 || (marchioId && o2.marchio_id !== marchioId)) continue;
          /* «confermata» solo se lo sono entrambi i lati del legame */
          const stato = e.stato === "confermata" && e2.stato === "confermata" ? "confermata" : "da_verificare";
          const prima = visti.get(o2.id);
          if (!prima || (prima.stato !== "confermata" && stato === "confermata")) visti.set(o2.id, { olio: o2, stato, equivalenza: e2 });
        }
      }
      return [...visti.values()];
    },
  };
}

/* Cerca negli oli: codice di un formato, nome, gradazione, famiglia. */
/* Nella ricerca contano solo lettere e cifre: «229.52» e «22952», «C2/C3» e «c2 c3»,
   «5W-30» e «5w30», «9.55535-S1» e «955535s1» trovano gli stessi oli. Gli accenti non contano. */
const essenziale = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "");

export function cerca(indici, testo, { marchioId } = {}) {
  const t = essenziale(testo);
  if (t.length < 2) return [];
  const parole = String(testo).split(/[\s,;]+/).map(essenziale).filter(Boolean);
  const trovati = [];
  for (const o of indici.oli.values()) {
    if (marchioId && o.marchio_id !== marchioId) continue;
    const fam = indici.famiglieDellOlio(o).map((e) => indici.famiglie.get(e.famiglia_id)).filter(Boolean);
    /* Un campo per pezzo, separati da «|»: una parola cercata non può cavalcare due campi. */
    const pagliaio = [
      o.nome, o.codice, o.sae, o.norme, o.omologazioni, indici.marchi.get(o.marchio_id)?.nome,
      ...o.formati.map((f) => f.codice), ...fam.map((f) => `${f.codice} ${f.titolo}`),
    ].filter(Boolean).map(essenziale).join("|");
    if (parole.every((p) => pagliaio.includes(p))) {
      const codiceEsatto = o.formati.some((f) => essenziale(f.codice) === t);
      trovati.push({ olio: o, punti: (codiceEsatto ? 10 : 0) + (essenziale(o.nome).includes(t) ? 3 : 0) });
    }
  }
  return trovati.sort((a, b) => b.punti - a.punti || a.olio.nome.localeCompare(b.olio.nome)).map((x) => x.olio);
}
