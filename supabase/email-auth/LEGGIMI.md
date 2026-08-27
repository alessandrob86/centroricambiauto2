# Le email che manda Supabase da solo

Non sono le nostre. Le email degli ordini, delle proposte e degli inviti le
scriviamo noi dentro le edge function; queste invece le compone **Supabase
Auth** quando qualcuno si registra, dimentica la password o cambia
indirizzo. Di serie arrivano **in inglese**, da un mittente che si chiama
*Supabase Auth* — che a un cliente non dice niente, e a un filtro antispam
dice anche meno.

Si sistemano in due passaggi distinti, che non si sostituiscono a vicenda:
il primo cambia **chi** le manda, il secondo **cosa** dicono.

---

## 1. Chi le manda — SMTP proprio

Finché resta il mittente di serie, l'email arriva da
`noreply@mail.app.supabase.io` con nome *Supabase Auth*, e non c'è modo di
cambiarlo dai template: il mittente è una cosa del server di posta, non del
testo.

C'è anche un motivo pratico più urgente dell'estetica: **il mittente di serie
ha un tetto di poche email all'ora**, pensato per lo sviluppo. Con
tremilatrecento clienti da invitare non regge.

Usiamo Resend, che già ci manda gli ordini e ha il dominio verificato.

**Dove:** Supabase → Authentication → Emails → **SMTP Settings** → *Enable
Custom SMTP*.

| Campo | Valore |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la API key Resend del dominio centroricambiautosrl.it |
| Sender email | `noreply@centroricambiautosrl.it` |
| Sender name | `Centro Ricambi Auto srl` |

La password è la stessa chiave che sta nei secret delle edge function
(`RESEND_API_KEY_CRA`). Va incollata lì e basta: **non deve passare per
nessun'altra parte**.

Sotto, nella stessa pagina, c'è *Rate limits*: alzalo quando comincerai a
invitare i clienti a gruppi, altrimenti Supabase strozza gli invii.

---

## 2. Cosa dicono — i template

**Dove:** Supabase → Authentication → Emails → **Templates**. Una linguetta
per tipo. Per ciascuna si incolla l'**oggetto** in *Subject heading* e il
contenuto del file `.html` corrispondente nel riquadro del messaggio.

| Template Supabase | File | Oggetto da mettere |
|---|---|---|
| Confirm signup | `conferma-registrazione.html` | Conferma il tuo indirizzo — Centro Ricambi Auto |
| Reset Password | `reimposta-password.html` | Reimposta la tua password — Centro Ricambi Auto |
| Invite user | `invito.html` | Il tuo accesso — Centro Ricambi Auto |
| Change Email Address | `cambio-email.html` | Conferma il nuovo indirizzo — Centro Ricambi Auto |

### Le variabili

Il testo fra doppie graffe lo riempie Supabase al momento dell'invio. Nei
modelli qui dentro ce ne sono tre, non una di più:

- `{{ .ConfirmationURL }}` — il link che fa la cosa. **Non toccarlo.**
- `{{ .Email }}` — l'indirizzo a cui sta scrivendo.
- `{{ .NewEmail }}` — solo nel cambio indirizzo: quello nuovo.

⚠️ **Il dominio non sta nei modelli.** `{{ .ConfirmationURL }}` se lo
costruisce Supabase a partire dal *Site URL*, che oggi è l'indirizzo
`netlify.app`. Il giorno che punterai `centroricambiautosrl.it` va cambiato
in **Authentication → URL Configuration**, e questi file non si toccano.
Se te ne dimentichi, le email continueranno a portare i clienti sul vecchio
indirizzo anche dopo il passaggio al dominio nuovo.

---

## Prima di considerarlo fatto

Supabase non ha un pulsante «manda una prova». Il modo onesto di verificare
è registrare un'utenza finta con un tuo indirizzo (va bene un alias, tipo
`tuonome+prova@gmail.com`) e guardare che cosa arriva: mittente, oggetto,
aspetto, e soprattutto **che il link funzioni**. Poi si cancella l'utenza da
Authentication → Users.

Le tre cose da guardare, in ordine di quanto fanno danno se sbagliate:

1. il link porta al sito giusto (se no: *Site URL* sbagliato);
2. il mittente dice *Centro Ricambi Auto srl* (se no: SMTP non attivo);
3. il testo è quello nuovo (se no: hai salvato in una linguetta diversa).

## Perché i colori sono quelli

Rosso `#BD3432`, oro `#FDC543`, antracite `#272D2B`: gli stessi del sito e
delle email degli ordini. Un cliente che riceve la conferma di registrazione
e poi la proposta d'ordine deve vedere due messaggi della stessa azienda,
non due software diversi.

Il codice HTML è volutamente antiquato — tabelle, stili in linea, niente
classi — perché i programmi di posta sono fermi a vent'anni fa e tutto il
resto lo buttano via.
