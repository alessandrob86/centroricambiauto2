# Da provare quando pubblichiamo

Tutto quello che è stato costruito o corretto **dopo** l'ultima pubblicazione,
e che quindi sul sito online non c'è ancora. Le correzioni al database e alle
edge function invece sono già in produzione: quelle si possono provare anche
adesso.

Ordine: prima le cose che si rompono in faccia a un cliente, poi il resto.

---

## 1. Il giro dell'invito, da capo alla fine

È la cosa nuova più grossa, e finora non si è mai potuta provare per intero
perché la pagina d'arrivo era quella vecchia.

- [ ] **Codice a un collega.** Back-office → Personale → Persone → una riga
      «da invitare» → *Genera il codice*. Compare il codice con **email** e
      **copia**.
- [ ] **L'email arriva** dal mittente aziendale, in italiano, col codice
      grande e il pulsante. *(già provato: funziona)*
- [ ] **Il link porta al modulo giusto**: dev'esserci il campo *Codice invito*
      in cima. ⚠️ È esattamente quello che mancava online.
- [ ] **Il modulo si accorge che è un collega**: scrivendo il codice compare
      «Stai attivando l'accesso di … — ruolo», spariscono ragione sociale,
      P.IVA, telefono e città, e l'email è **compilata e bloccata**.
- [ ] **La registrazione va a buon fine** e arriva l'email di conferma.
- [ ] **Il clic sulla conferma collega la scheda**: la persona entra e si
      ritrova ruolo, filiale e permessi già suoi. In Personale la riga passa
      da «da invitare» a «collegato».
- [ ] **Il codice non si può riusare**: riaprendo lo stesso link dice che è
      già stato usato.
- [ ] **Copia** mette negli appunti l'invito intero, non il solo codice.
- [ ] **Codice a un cliente.** Back-office → Officine → una scheda senza
      accesso → Accesso → *Genera il codice d'invito*. Stessa trafila, ma il
      modulo resta quello dell'officina e la ragione sociale si compila da
      sola col nome dell'anagrafica.
- [ ] **Aggancio a mano.** Registrarsi **senza** codice, poi in Officine
      aprire la scheda nuova → *Fondi qui* su un'anagrafica: l'accesso si
      sposta, codice cliente e fascia di prezzo restano quelli
      dell'anagrafica, il doppione sparisce.

## 2. I prezzi

- [ ] **Il fusto da 200 L** del 0W-20 Hybrid: la pagina dice 1.380,00 € e la
      proposta d'ordine deve dire **1.380,00 €**, non 6,90. *(corretto nel
      database, quindi provabile già adesso)*
- [ ] **Il formato 12×1 L** con quantità 1 resta **una bottiglia**: 7,40 €.
- [ ] **L'email al magazzino** riporta codice e nome presi dal catalogo. Se
      una riga non combacia arriva con l'asterisco e la nota in fondo.

## 3. Il telefono

- [ ] **La barra in basso** dice **Desk · Bacheca · Card · Clienti · Altro**,
      senza puntini di sospensione. ⚠️ Se resta come prima, è l'app salvata
      sulla schermata Home che tiene la copia vecchia: chiudila dallo
      switcher e riaprila, o toglila e rimettila.
- [ ] **Il pannello di una promozione**: in cima solo la **X**, senza la
      parola «Chiudi», e tutto su una riga sola.
- [ ] **Si chiude scorrendolo via** verso destra.
- [ ] **Lo scorrimento verticale dentro il pannello** continua a funzionare.
- [ ] **I clienti spariscono** dalla barra per centralino e dipendente, e
      restano per rappresentante e manager. *(già attivo nel database)*

## 4. Gli indirizzi e l'atterraggio

- [ ] `#/interno/schede`, `#/interno/bacheca`, `#/interno/clienti` aprono la
      scheda giusta.
- [ ] **Il tasto Indietro** torna alla scheda precedente, non fuori dall'area.
- [ ] **La campanella**: toccando una notifica si arriva dove dice, non in
      home. *(corretto nel database: provabile adesso)*
- [ ] **L'atterraggio**: Back-office → Personale → Chi vede cosa →
      scegliere una destinazione per il ruolo *rappresentante*, poi entrare
      con un account di quel ruolo e verificare che si apra lì.
- [ ] **La scelta personale batte quella del ruolo**: Profilo → «Quando
      entro, portami a…».

## 5. Le notifiche push

- [ ] **Un rappresentante non può mandare a tutti**, nemmeno passando un
      filtro. *(già in produzione)*
- [ ] **L'indirizzo della notifica**: toccandola si resta dentro il sito.
- [ ] **Annuncio nuovo** → la notifica porta alla Bacheca; **scheda nuova** →
      al Card Center.

## 6. L2F

- [ ] **Le intestazioni di sicurezza**: dopo la pubblicazione, controllare che
      il sito non sia più incorniciabile e che **non si sia scolorito** — la
      CSP e framer-motion sono la cosa che più facilmente si rompe.
- [ ] **L'area clienti** non mostra più gli ordini fatti sul CRA.
- [ ] **Il pannello Officine** mostra solo i clienti con un accesso: il
      contatore passa da 1.000 a 1, ed è il numero vero.
- [ ] **Un ordine L2F** parte e arriva col suo Excel.

## 7. Che non si sia rotto niente

- [ ] **Il catalogo pubblico** si apre a chi non ha fatto l'accesso.
- [ ] **Una proposta d'ordine dal CRA Store**, dal carrello all'email.
- [ ] **Il back-office**: prezzi, prodotti, officine, proposte.
- [ ] **L'invio di una promozione a un cliente** dall'area interna.

---

## Da fare a mano, fuori dal sito

- [ ] **Cancellare le tre funzioni morte** — Supabase → Edge Functions →
      `send-preview`, `sync-prezzi-cra`, `migra-media` → ⋯ → Delete.
      *(non posso farlo io: la CLI qui è collegata a un altro account)*
- [ ] **Togliere le utenze di prova** da Authentication → Users, altrimenti
      quegli indirizzi restano occupati.
- [ ] **Alzare il Rate Limit** delle email in Authentication → Emails, prima
      di invitare i clienti a gruppi.
