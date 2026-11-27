# La scheda «Lubrificanti» dell'area interna (`lub`)

> Questo documento dice **cosa** deve fare il modulo, non come. Stato: **bozza** (26/11/2026).
> Le schermate sono disegnate nel Design del CRA (proposta C «Ognuno il suo banco», scelta il 26/11).

## 1. A cosa serve

Il comparatore dei lubrificanti, portato nell'area interna. Al banco chiunque trova un olio, i suoi
formati, il prezzo di vendita e le alternative di altri marchi. Chi compra (manager, finanza,
amministratore) vede anche costi e margini, prepara l'ordine a un fornitore con le condizioni del
marchio e la rotazione ABC, e lo stampa per la filiale. L'amministratore carica listini e
condizioni, conferma le alternative e imposta a mano i prezzi di vendita.

## 2. Chi fa cosa

Manager e finanza vanno insieme (`is_manager()`): il modulo non sa distinguerli, ed è voluto.

| Azione | admin | manager | finanza | rappresentante | centralino | dipendente |
|---|---|---|---|---|---|---|
| Vedere catalogo, formati, alternative | sì | sì | sì | sì | sì | sì |
| Vedere i prezzi di vendita | sì | sì | sì | sì | sì | sì |
| Impostare i prezzi di vendita (non della casa) | sì | no | no | no | no | no |
| Vedere costi, listini caricati, condizioni | sì | sì | sì | no | no | no |
| Caricare listini, scrivere costi e condizioni | sì | no | no | no | no | no |
| Vedere rotazione, giacenze, impostazioni | sì | sì | sì | no | no | no |
| Vedere gli ordini | tutte le filiali | tutte le filiali | tutte le filiali | no | no | no |
| Creare e modificare ordini | tutte le filiali | solo la sua filiale | solo la sua filiale | no | no | no |
| Confermare o scartare un'alternativa | sì | no | no | no | no | no |
| Segnalare un dubbio su un'alternativa | sì | sì | sì | no (vedi punto 7) | no | no |
| Chiudere una segnalazione | sì | no | no | no | no | no |

«No» sulla lettura vuol dire che **le righe non partono nemmeno**: i costi stanno in tabelle a parte,
che il database dà solo a chi può vederle (policy delle tabelle `mod_lub_…`, provate ruolo per
ruolo: 70 controlli, il 26/11/2026).

## 3. I dati

Tutto nel database (mai nel repository, che è pubblico). Tabelle `mod_lub_…`, tutte nuove.

| Tabella | Cosa tiene | Chi legge |
|---|---|---|
| `marchi` | i marchi (fornitori + il marchio della casa, uno solo) | personale |
| `famiglie` | famiglie di equivalenza: gradazione, norme, omologazioni | personale |
| `oli` | ogni linea di ogni marchio | personale |
| `formati` | codice articolo, litri, pezzi per cartone; per la casa il legame al catalogo | personale |
| `equivalenze` | olio ↔ famiglia, stato da verificare / confermata / scartata, chi e quando | personale |
| `prezzi_vendita` | prezzo al pezzo impostato a mano, chi e quando | personale |
| `import` | ogni listino caricato (bozza, confermato, annullato) | chi comanda |
| `costi` | costo per formato e voce (listino, netto…), con storico | chi comanda |
| `condizioni` | condizioni del marchio, a versioni (una sola vigente) | chi comanda |
| `segnalazioni` | dubbi sulle alternative | chi comanda |
| `rotazione` | prelievi, giacenza, classe ABC per filiale e formato | chi comanda |
| `impostazioni` | tetti di scorta (A 60 · B 45 · C 20 giorni), CONOU di partenza | chi comanda |
| `ordini`, `ordini_righe` | ordini per filiale, condizioni del giorno congelate, righe con omaggi | chi comanda |

**Le regole di un marchio** (`condizioni.regole`, un oggetto JSON):

```json
{
  "voci_costo": ["netto", "listino"],
  "sconto_listino_pct": 0,
  "sconti_extra_pct": [0, 0],
  "modalita_prezzo": "facoltativa",
  "prezzi_ivati": false,
  "conou_per_litro": 0.12,
  "etichetta_conou": "CONOU",
  "aggiungi_conou": true,
  "promo":  { "attiva": false, "compra": 10, "omaggio": 1, "solo_cartoni": true, "ambito": "per_codice" },
  "soglia": { "attiva": false, "tipo": "euro", "valore": 0, "sconto_extra_pct": 0 }
}
```

- I costi sono tutti **al litro** (`costi.unita = 'litro'`); il pezzo si ricava dai litri del formato.
- `voci_costo`: le voci di `costi` da usare, in ordine di preferenza (la prima che il formato ha).
- `sconto_listino_pct`: si applica solo quando la voce usata è `listino` (il prezzo di listino lordo).
- `sconti_extra_pct`: sconti a cascata dopo, su qualunque voce.
- `modalita_prezzo`: per un fornitore con più modi di calcolo (per esempio «10+1 sempre» o «10+1 solo
  sull'alta rotazione»), il modo scelto. Facoltativa.
- `prezzi_ivati`: il listino è IVA compresa (il costo si divide per 1,22).
- `promo`: ogni `compra` pezzi (o cartoni, se `solo_cartoni`) `omaggio` gratis, per codice o sull'ordine.
- `soglia`: vale sul **singolo ordine** (euro o cartoni), non è un obiettivo annuo.
- `conou_per_litro` ed `etichetta_conou`: il contributo al litro aggiunto al costo e il suo nome (CONOU 0,12 €/L di regola; per un fornitore può essere «Tasse» con un altro valore). Si accende e si spegne per ogni ordine e nel paragone.
- Un olio con `soggetto_conou = false` non aggiunge il CONOU al costo finito.

**I prezzi del marchio della casa non stanno qui**: li scrive il Foglio MASTER nel catalogo, e il
modulo li legge soltanto, con la funzione `catalogo_prezzi_base_l2f()`. Il database rifiuta un prezzo di vendita per un
formato della casa.

## 4. Le schermate (proposta C «Ognuno il suo banco»)

Si arriva sempre su «Trova l'olio», qualunque sia il ruolo (scelta del 27/11); il ruolo decide
quali altre schermate ci sono:

- **Trova l'olio** (tutti, si atterra qui): cerca per codice, nome o gradazione; per ogni olio i formati, il prezzo
  di vendita e le alternative degli altri marchi. Le alternative «da verificare» hanno il prezzo in
  grigio. Chi comanda vede anche costo e margine e può segnalare un dubbio.
- **Ordine** (manager, finanza, admin): l'elenco a cascata del marchio (famiglia →
  olio → formati) con le caselle, filtro per formato (tutti, uno o due), pannello con Suggeritore
  (dalle condizioni e dall'ABC, tetti 60 · 45 · 20), Alternative e Paragone facoltativo con un altro
  marchio sulle stesse righe; barra in basso con totale, omaggi, soglia; stampa per la filiale.
- **Prezzi di vendita** (admin; manager e finanza in sola lettura, se si decide così): i prezzi a
  mano per marchio, con la barra che mostra dove sta la casa rispetto agli altri.
- **Listini e condizioni** (admin): listini caricati con le differenze, condizioni del marchio,
  coda delle alternative da confermare, segnalazioni, tetti di scorta, «chi vede cosa».

## 5. Cosa NON fa (per ora)

- Non legge i file dei listini (CSV/Excel) né l'export ABC del gestionale: arriva dopo. I dati di
  partenza si caricano una volta nel database, da chi cura il sito.
- Non manda l'ordine per email al fornitore: si stampa o si scarica.
- Non cambia i prezzi del marchio della casa né il catalogo del sito.
- Niente prezzi per categoria o per cliente: solo il prezzo di vendita base.

## 6. Quando è finito

- [x] I permessi sono provati per ogni ruolo della tabella al punto 2 (70 controlli, e 14 rotture
      deliberate vengono prese).
- [ ] Ogni ruolo atterra su «Trova l'olio» e non vede ciò che il punto 2 gli nega.
- [ ] Funziona sul telefono (larghezza 390 px).
- [ ] I tre stati — caricamento, errore, vuoto — sono scritti in italiano.

## 7. Decisioni ancora aperte

1. La pagina dei prezzi di vendita per manager e finanza: sola lettura o niente? (Il database
   gliela lascia leggere comunque: i prezzi di vendita li vede tutto il personale.)
2. Il rappresentante può segnalare dubbi? Oggi no: il modulo non sa distinguerlo da un dipendente
   (servirebbe una funzione nel database che lo dica).
3. La finanza deve poter impostare i prezzi di vendita? Oggi no, per lo stesso motivo.
