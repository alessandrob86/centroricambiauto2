# Da provare quando pubblichiamo

Tutto quello che è stato costruito o corretto **dopo** l'ultima pubblicazione,
e che quindi sul sito online non c'è ancora. Le correzioni al database e alle
edge function invece sono già in produzione: quelle si possono provare anche
adesso.

Ordine: prima le cose che si rompono in faccia a un cliente, poi il resto.

---

## 0. Le sei cose del 29 agosto

### Il pulsante dei suggerimenti
Tondo, sopra la campanella, in basso a destra. Lo vede solo il personale.

- [ ] **C'è e si apre**, e il riquadro non esce dallo schermo sul telefono.
- [ ] **Mandi un messaggio** e arriva a `alessandro@centroricambiautosrl.it`,
      col nome di chi scrive e la pagina da cui l'ha scritto.
- [ ] **Rispondendo all'email** si risponde a chi l'ha mandata, non a noreply.
- [ ] **Ctrl+Invio** manda senza toccare il mouse.
- [ ] **Chiudendo senza mandare**, il testo scritto è ancora lì quando riapri.
- [ ] **Aprendo la campanella**, il pulsante dei suggerimenti finisce sotto il
      pannello delle notifiche e non ci si sovrappone.

### Il cliente che «non esisteva»
- [ ] Cerca **MP AUTO** (o `001183`, o `02528380344`) in Area interna →
      I miei clienti → *Prendi in carico un cliente*. Deve **uscire**, con
      scritto **in carico a Lorena Colla**. Prima diceva «nessun cliente
      trovato», che era falso.
- [ ] Da **amministratore o manager** compare *Prendilo tu*, e prima di
      spostarlo chiede conferma col nome del collega.
- [ ] Da **rappresentante** il pulsante non c'è: si vede solo di chi è.

### Education al centralino
- [ ] Entra con un account **centralino**: nel Card Center compare
      **Nuova scheda Education**, e il tipo non si può cambiare.
- [ ] **Crea, salva, riapri**: la bozza si ritrova (usa il filtro
      *Scadute / Tutte*, che ora vede anche lui).
- [ ] **Carica un'immagine e un allegato**: il deposito lo lascia scrivere.
- [ ] **Su una promozione** di qualcun altro non ha né Modifica né il cestino.
- [ ] Le sue Education **si vedono anche dagli altri**, con le filiali scelte.

### I clienti anche al manager
- [ ] Un **manager** apre `#/admin`: vede il titolo **Clienti** e **una sola
      linguetta**, Officine. Niente Prezzi, Prodotti, Proposte, Attività,
      Impostazioni, Personale.
- [ ] **Elenco, ricerca, filtri e contatori** funzionano (non «tutti a zero»).
- [ ] **Nuova officina** crea davvero la scheda. ⚠️ Prima non funzionava per
      nessuno, nemmeno per te: la regola d'inserimento pretendeva un account
      che un'anagrafica non ha. È il motivo per cui il pannello ne mostrava una.
- [ ] **Anagrafica, stato, categoria e agente** si salvano.
- [ ] **Non** vede il pulsante *Prezzi* sulla scheda del cliente, e **non**
      vede la casella *Admin back-office*.
- [ ] Un **rappresentante** su `#/admin` continua a leggere «Area riservata».

### Il ruolo Finanza
- [ ] In Back-office → Personale, **Finanza** compare nell'elenco dei ruoli,
      subito dopo Manager.
- [ ] Crei una persona con ruolo Finanza, la inviti, entra: deve trovare
      **quello che trova un manager** — bacheca di tutte le filiali, Card
      Center completo, clienti, statistiche, e `#/admin` sulla sola scheda
      Officine.
- [ ] **Chi vede cosa** (Personale → matrice) ha la sua colonna.

### Il B2B Store nel footer
- [ ] **Da sloggato**, in fondo alla home, colonna *Cosa facciamo*, sotto
      *Auto di cortesia*: **B2B Store**, in grassetto, con la freccina.
- [ ] Apre `centroricambiautosrl.blusys.it` in una **scheda nuova**.

### E gli inviti ai clienti, che non erano mai partiti
- [ ] Back-office → Officine → una scheda → **Genera il codice d'invito**.
      ⚠️ Prima falliva sempre: la funzione scriveva su una tabella che non
      esiste. Non se n'era accorto nessuno perché l'unico invito mai generato
      è stato a un collega, che passa da un'altra funzione.
- [ ] **Fondi qui** (aggancio a un'anagrafica) aveva lo stesso difetto: va
      riprovato dopo aver creato una registrazione di prova.

### I clienti si possono seguire in due
⚠️ Gli affidi sono stati **azzerati**: restano solo i 3 dell'amministratore.
Gli altri 113 sono salvati in `affidi_prima_del_reset` — se qualcuno reclama
un elenco sparito, è lì.

- [ ] **Un rappresentante prende un cliente libero**: gli arriva la notifica
      «Nuovo cliente in carico» e lo trova in *I miei clienti*.
- [ ] **Un secondo lo prende pure**: nessun blocco, una domanda che nomina chi
      c'era già, e poi lo vedono **tutti e due**.
- [ ] **Sulla riga** di entrambi compare «anche …» con il nome dell'altro.
- [ ] **Ad Alessandro** arrivano due cose: la notifica sulla campanella e
      **un'email** con il cliente e l'elenco di chi lo segue.
- [ ] **L'email parte una volta sola**: ripremendo o ricaricando non se ne
      mandano altre.
- [ ] **Chi lascia esce solo lui**: l'altro se lo tiene, e il messaggio di
      conferma lo dice.
- [ ] **La proposta d'ordine** funziona per entrambi (era legata all'unico
      agente della vecchia colonna).
- [ ] **Statistiche e profilo**: il numero di clienti in portafoglio torna, e
      un cliente seguito in due non ne conta due.

### Il centralino vede tutto il Card Center
- [ ] Entra con un account **centralino**: vede le schede di **tutte le
      filiali**, con scritto per quali valgono, e può filtrare per filiale.
      ⚠️ Oggi la differenza è di **una scheda sola**: solo 2 delle 141 sono
      assegnate a una filiale, tutte le altre valgono per l'azienda intera.
- [ ] **Continua a non poter modificare** niente che non sia Education.

### Il CRA Store aperto a un dipendente
- [ ] Back-office → Personale → Modifica una persona: c'è la casella
      **Può entrare nel CRA Store**. Spenta, il negozio gli resta chiuso come
      prima.
- [ ] Accesa, quella persona entra nel CRA Store e vede i **prezzi base** —
      gli stessi di un'officina senza categoria. ⚠️ Prova che non veda quelli
      di una categoria: 24,04 € è il primo prezzo base del catalogo.
- [ ] **Non può ordinare**: sulla scheda prodotto non c'è il carrello, e al
      suo posto c'è la riga che rimanda al Card Center. Nel catalogo il
      pulsante della card apre la scheda invece di aggiungere.
- [ ] **Un cliente vero non cambia niente**: entra, vede i suoi prezzi,
      aggiunge e manda la proposta come sempre.
- [ ] **Tu** (che hai sia l'officina sia la scheda dipendente) continui a
      vedere i tuoi prezzi e a poter ordinare.

### L'area manager
Non è un ruolo: è chi ha qualcuno che gli risponde.

- [ ] Personale → Modifica un rappresentante → **Risponde a**: scegli il capo.
      Nell'elenco, sotto il nome del capo, compare «segue N persone».
- [ ] Entrando come **capo**: in Statistiche il menu Agente dice
      **«Io e la mia squadra»** e contiene lui più i suoi. I numeri comprendono
      le proposte dei suoi.
- [ ] Scegliendo sé stesso nel menu, vede solo le proprie.
- [ ] Entrando come **rappresentante senza squadra**: niente menu Agente,
      solo i propri numeri. Come prima.
- [ ] **La copertura torna**: il portafoglio al denominatore è quello della
      stessa platea dei numeri, non di una persona sola.

### Assegnare un cliente a una persona
- [ ] Officine → una scheda → **Anagrafica**: sotto «Accesso» c'è
      **Chi lo segue**, con l'elenco e un menù per affidarlo.
- [ ] Affidandolo a chi non ce l'ha, alla persona arriva la notifica
      «Nuovo cliente in carico».
- [ ] Affidandolo a una seconda persona, chiede conferma nominando chi c'era
      già, e ad Alessandro arriva l'email della condivisione.
- [ ] La **X** toglie una persona sola, non tutte.
- [ ] ⚠️ Da area interna → I miei clienti → **Lascia**: adesso esce **solo
      chi preme**. Prima, se a premere era un amministratore, il database
      toglieva anche tutti gli altri mentre il messaggio prometteva il
      contrario. Provalo su un cliente seguito in due.

### Le schede in PDF dei prodotti
Prima non c'era modo di attaccarne una dal sito: le 26 esistenti arrivarono
tutte insieme con una migrazione. Il primo prodotto nuovo con un PDF da
appendere — lo 0W-20 Hybrid — ha fatto vedere il buco.

- [ ] Back-office → Prodotti → **Olio motore 0W-20 Hybrid** → Modifica:
      sotto la descrizione ci sono **Scheda tecnica** e **Scheda di sicurezza**.
- [ ] Carica i due PDF da `C:\Progetti lavoro\l2f\_sources\chimico\`:
      `T-1612-L2F_0W20 Hybrid` → tecnica, `S-R2FOV1612-IT_0W20 Hybrid` → sicurezza.
- [ ] **Il file si rinomina da solo** col nome del prodotto: nel deposito deve
      comparire `chimico/Olio motore 0W-20 Hybrid - Scheda tecnica.pdf`.
- [ ] **Si aggancia subito**, senza premere Salva (su un prodotto già esistente).
- [ ] **Sulla pagina del prodotto** nel CRA Store compaiono i due pulsanti e
      i PDF si aprono.
- [ ] **Ricaricando la stessa scheda** si sostituisce, non se ne crea una seconda.
- [ ] **La X** stacca la scheda dal prodotto ma **non cancella** il PDF.
- [ ] Senza nome prodotto scritto, il caricamento si rifiuta e lo dice.

### L2F — i prezzi dei pacchetti
⚠️ Questi si vedono **subito**, anche senza pubblicare: i prezzi arrivano da
Supabase a ogni caricamento della pagina.

- [ ] Servizi: HOME **590**, Flex Tech **890**, Flex Marketing **1.350**,
      Flex All Included **1.650**. Prima Marketing diceva 130 e Tech 990.

### L2F — il cambio di pacchetto
⚠️ Invisibile finché `l2f.it` non punta su Vercel.

- [ ] **Da sloggato**: i pacchetti si comportano come prima, la spunta dice
      «Vuoi richiedere l'attivazione di …» e il pulsante resta spento finché
      non la metti.
- [ ] **Da officina con un pacchetto**: i pacchetti che non sono una salita
      sono **grigi**; il proprio porta l'etichetta *IL TUO*, quelli superiori
      *UPGRADE*.
- [ ] **Cliccando un grigio** compare *Richiedi la retrocessione*, con la
      riga che spiega che è meno completo.
- [ ] **La richiesta arriva su info@l2f.it** col nome dell'officina, il piano
      di adesso e quello chiesto — e resta scritta in `richieste_piano`.
- [ ] **Il pacchetto non cambia da solo**: si cambia a mano dopo.

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

## 1-bis. Il giro di presentazione

Parte da solo al **primo** ingresso nell'area interna di ogni persona.

- [ ] **Parte** appena il primo collega entra, e non prima che la pagina sia
      pronta (nessun faro sul vuoto).
- [ ] **Illumina la cosa giusta**: il filo d'oro sta attorno all'elemento, non
      dentro. Guarda soprattutto i passi che cambiano scheda — Bacheca, Card
      Center, clienti, profilo — che sono quelli dove il faro si posava storto.
- [ ] **Salta le tappe che non riguardano quella persona**: un magazziniere non
      ha «I miei clienti» e non deve vedersi illuminare una linguetta che non ha.
- [ ] **Si esce sempre**: Esc, «Salta la presentazione», e — se un passo tarda —
      il pulsante di fuga che compare sul nero dopo mezzo secondo.
- [ ] **Non riparte**: chiudi, esci e rientra. Non deve ricomparire.
- [ ] **Il computer del banco**: se dopo il primo collega ne entra un altro
      senza ricaricare la pagina, il giro deve ripartire per lui.
- [ ] **Rivedi la presentazione** dal Profilo lo fa ripartire; e se lo abbandoni
      a metà, al prossimo accesso **non** deve ricomparire da solo.
- [ ] **Sul telefono**: le vignette non escono dallo schermo e non coprono
      quello che stanno indicando.

## 2. I prezzi

- [ ] **Un prodotto che viene dal foglio è bloccato in tutta la riga**, anche
      nelle colonne che il foglio non alimenta (NORD). Cliccando il lucchetto
      la spiegazione dice la cosa giusta nei due casi.
- [ ] **Il prezzo dedicato a un singolo cliente** resta modificabile anche sui
      prodotti del foglio, dalla scheda del cliente in Officine → Prezzi.

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

## 3-bis. Chi entra e dove atterra

- [ ] **Un collega** dopo il login si trova sul **Desk**, non sulla vetrina.
      *(già attivo nel database)*
- [ ] **Tu** resti sulla home del sito.
- [ ] **La pagina d'accesso non rimbalza più via chi è già dentro**: mostra a
      che punto sei. Provale tutte e cinque — collega, cliente attivo, cliente
      in attesa, cliente non abilitato al CRA Store, cliente sospeso.
- [ ] **Il cliente in attesa** legge perché non riesce a fare niente e che lo
      abilitate voi.

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
