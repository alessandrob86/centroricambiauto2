import React from "react";
import L from "leaflet";
import { Logo, craMark } from "../components/ds/Logo.jsx";
import { Button } from "../components/ds/Button.jsx";
import { Icon } from "../components/Icon.jsx";
import { Container, Eyebrow, Reveal } from "../components/shared.jsx";

/* Le 5 sedi attive (Via Stadera, Milano — chiusa: trasferita a Rozzano).
   Coordinate e link Google Maps ufficiali forniti dall'azienda. */
const SEDI = [
  { id: "rozzano",     name: "Rozzano (MI)",            region: "Lombardia",      addr: "Via Cassino Scanasio 61/a, 20089 Rozzano MI", coords: [45.3856362, 9.1466778], badge: "Nuova sede",
    gmaps: "https://www.google.com/maps/dir//Centro+ricambi+auto+srl+-+Rozzano,+Via+Cassino+Scanasio,+61%2Fa,+20089+Rozzano+MI/@40.8597649,14.2737408,15z/data=!4m8!4m7!1m0!1m5!1m1!1s0x4786c3ce8ab3f2b1:0x76b578b185446ce2!2m2!1d9.1466778!2d45.3856362?hl=it&authuser=0&entry=ttu&g_ep=EgoyMDI2MDYwMy4xIKXMDSoASAFQAw%3D%3D" },
  { id: "collecchio",  name: "Collecchio (PR)",         region: "Emilia-Romagna", addr: "Str. Nazionale Ovest 1, 43044 Collecchio PR",  coords: [44.7486985, 10.2086375],
    gmaps: "https://www.google.com/maps/dir//Centro+Ricambi+Auto+-+Collecchio,+Str.+Nazionale+Ovest,+1,+43044+Collecchio+PR/@40.8597649,14.2737408,15z/data=!4m8!4m7!1m0!1m5!1m1!1s0x47806f3fc97939db:0x5d6ee41b0ad2cfb1!2m2!1d10.2086375!2d44.7486985?hl=it&authuser=0&entry=ttu&g_ep=EgoyMDI2MDYwMy4xIKXMDSoASAFQAw%3D%3D" },
  { id: "fiorenzuola", name: "Fiorenzuola d'Arda (PC)", region: "Emilia-Romagna", addr: "Via Benefial 1, 29017 Fiorenzuola d'Arda PC", coords: [44.918044, 9.9160475],
    gmaps: "https://www.google.com/maps/dir//Centro+Ricambi+Auto+srl,+Via+Benefial,+1,+29017+Fiorenzuola+d'Arda+PC/@40.8597649,14.2737408,15z/data=!4m8!4m7!1m0!1m5!1m1!1s0x4780f3b439dec703:0x301717bce1f21113!2m2!1d9.9160475!2d44.918044?hl=it&authuser=0&entry=ttu&g_ep=EgoyMDI2MDYwMy4xIKXMDSoASAFQAw%3D%3D" },
  { id: "poggioreale", name: "Napoli — Poggioreale",    region: "Campania",       addr: "Via Nuova Poggioreale 48, 80143 Napoli NA",   coords: [40.8637852, 14.2832043],
    gmaps: "https://www.google.com/maps/dir//Centro+Ricambi+Auto+-+Poggioreale,+Via+Nuova+Poggioreale,+48,+80143+Napoli+NA/@40.8597649,14.2737408,15z/data=!4m8!4m7!1m0!1m5!1m1!1s0x133b081aa14e1e2b:0xa6ccf2ebf23fd970!2m2!1d14.2832043!2d40.8637852?hl=it&authuser=0&entry=ttu&g_ep=EgoyMDI2MDYwMy4xIKXMDSoASAFQAw%3D%3D" },
  { id: "vomero",      name: "Napoli — Vomero",         region: "Campania",       addr: "Via Luigi Caldieri 146, 80128 Napoli NA",     coords: [40.845652, 14.220629],
    gmaps: "https://www.google.com/maps/dir//Centro+Ricambi+-+Vomero,+Via+Luigi+Caldieri,+146,+80128+Napoli+NA/@40.8597649,14.2737408,15z/data=!4m8!4m7!1m0!1m5!1m1!1s0x133b08e63e3a0a5d:0x7cf96ab4dea09a5a!2m2!1d14.220629!2d40.845652?hl=it&authuser=0&entry=ttu&g_ep=EgoyMDI2MDYwMy4xIKXMDSoASAFQAw%3D%3D" },
];

const ORARI = {
  rozzano:     [["Lun–Ven", "08:00–12:00 · 14:00–18:00"], ["Sabato", "08:30–12:00"], ["Domenica", "Chiuso"]],
  collecchio:  [["Lun–Ven", "08:30–12:30 · 14:30–18:30"], ["Sabato", "08:30–12:00"], ["Domenica", "Chiuso"]],
  fiorenzuola: [["Lun–Ven", "08:30–12:30 · 14:30–18:30"], ["Sabato", "08:30–12:00"], ["Domenica", "Chiuso"]],
  poggioreale: [["Lun–Ven", "08:30–13:30 · 14:30–19:00"], ["Sabato", "08:30–12:00"], ["Domenica", "Chiuso"]],
  vomero:      [["Lun–Ven", "08:30–13:30 · 15:00–19:30"], ["Sabato", "08:30–13:30"], ["Domenica", "Chiuso"]],
};

/* Telefoni per sede. Il numero WhatsApp Business dà priorità ai clienti di Milano;
   lo 081 squilla per tutte le filiali; Fiorenzuola e Collecchio hanno numeri propri. */
const CONTATTI = {
  rozzano: [
    { icon: "message-circle", label: "WhatsApp Business", value: "+39 02 846 3035", href: "https://wa.me/39028463035" },
    { icon: "phone", label: "Centralino", value: "+39 081 281732", href: "tel:+39081281732" },
  ],
  collecchio: [
    { icon: "phone", label: "Telefono", value: "+39 0521 179 4079", href: "tel:+3905211794079" },
  ],
  fiorenzuola: [
    { icon: "phone", label: "Telefono", value: "+39 0523 155 9993", href: "tel:+3905231559993" },
  ],
  poggioreale: [
    { icon: "phone", label: "Centralino", value: "+39 081 281732", href: "tel:+39081281732" },
  ],
  vomero: [
    { icon: "phone", label: "Centralino", value: "+39 081 281732", href: "tel:+39081281732" },
  ],
};

export function Locations() {
  const mapRef = React.useRef(null);
  const mapObj = React.useRef(null);
  const markers = React.useRef({});
  const [active, setActive] = React.useState(null);

  React.useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current, { scrollWheelZoom: false, zoomControl: true });
    mapObj.current = map;
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: `<div class="cra-pin"><img src="${craMark}" alt=""></div>`,
      iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -24],
    });

    SEDI.forEach((s) => {
      const m = L.marker(s.coords, { icon }).addTo(map);
      m.bindPopup(
        `<div style="font-family: var(--font-brand); min-width: 200px">
           <div style="font-weight:800; text-transform:uppercase; letter-spacing:0.03em; color:var(--char-800)">${s.name}</div>
           <div style="font-size:12px; color:var(--char-500); margin-top:4px">${s.addr}</div>
           <a href="${s.gmaps}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:10px; font-weight:800; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#fff; background:var(--cra-red); padding:7px 12px; border-radius:4px; text-decoration:none">Apri in Google Maps ↗</a>
         </div>`
      );
      /* Click sul pin → apre direttamente Google Maps (nuova scheda) */
      m.on("click", () => {
        setActive(s.id);
        window.open(s.gmaps, "_blank", "noopener");
      });
      markers.current[s.id] = m;
    });

    const bounds = L.latLngBounds(SEDI.map((s) => s.coords));
    map.fitBounds(bounds, { padding: [46, 46] });

    return () => { map.remove(); mapObj.current = null; };
  }, []);

  const select = (s) => {
    setActive(s.id);
    const map = mapObj.current;
    if (!map) return;
    map.flyTo(s.coords, 14, { duration: 1.1 });
    const mk = markers.current[s.id];
    if (mk) setTimeout(() => mk.openPopup(), 1150);
  };

  const reset = () => {
    setActive(null);
    const map = mapObj.current;
    if (!map) return;
    map.closePopup();
    map.flyToBounds(L.latLngBounds(SEDI.map((s) => s.coords)), { padding: [46, 46], duration: 1.0 });
  };

  return (
    <section id="sedi" style={{ background: "var(--surface-subtle)", padding: "var(--space-11) 0", borderTop: "1px solid var(--border-subtle)" }}>
      <Container>
        <Reveal>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)", marginBottom: "var(--space-7)" }}>
            <div style={{ maxWidth: "560px" }}>
              <Eyebrow>Dove siamo</Eyebrow>
              <h2 className="cra-h1" style={{ margin: 0 }}>5 sedi al tuo fianco</h2>
              <p className="cra-lead" style={{ marginTop: "var(--space-3)", marginBottom: 0 }}>
                Dalla Lombardia alla Campania: seleziona una sede sulla mappa.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={reset}>Vedi tutte</Button>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div style={{ display: "grid", gridTemplateColumns: "0.42fr 0.58fr", gap: "var(--space-5)", alignItems: "stretch" }}>
            {/* sede selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {SEDI.map((s) => {
                const on = active === s.id;
                return (
                  <div key={s.id} role="button" tabIndex={0} onClick={() => select(s)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") select(s); }}
                    style={{
                    textAlign: "left", cursor: "pointer", padding: "var(--space-3) var(--space-4)",
                    background: on ? "var(--surface-dark)" : "var(--surface-card)",
                    border: "1px solid " + (on ? "var(--surface-dark)" : "var(--border-subtle)"),
                    borderLeft: "var(--border-w-bold) solid " + (on ? "var(--cra-gold)" : "var(--cra-red)"),
                    borderRadius: "var(--radius-sm)",
                    transition: "background var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard)",
                    display: "flex", flexDirection: "column", gap: "2px", flex: 1, justifyContent: "center",
                  }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--char-100)"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "var(--surface-card)"; }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <span style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-extrabold)", fontSize: "var(--fs-sm)", textTransform: "uppercase", letterSpacing: "var(--ls-caps)", color: on ? "var(--cra-white)" : "var(--text-strong)" }}>
                        {s.name}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        {s.badge && (
                          <span style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--cra-gold)", color: "var(--char-900)", padding: "3px 8px", borderRadius: "999px" }}>{s.badge}</span>
                        )}
                      </span>
                    </span>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-xs)", color: on ? "var(--char-300)" : "var(--text-muted)" }}>
                      {s.region} · {s.addr}
                    </span>
                    {on && (
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--char-700)", display: "grid", gap: "5px" }}>
                        {ORARI[s.id].map(([giorno, ore]) => (
                          <div key={giorno} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline" }}>
                            <span style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--cra-gold)" }}>{giorno}</span>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-xs)", color: ore === "Chiuso" ? "var(--red-300)" : "var(--char-200)", fontWeight: "var(--fw-semibold)" }}>{ore}</span>
                          </div>
                        ))}
                        <div style={{ marginTop: "6px", paddingTop: "8px", borderTop: "1px solid var(--char-700)", display: "flex", flexDirection: "column", gap: "6px" }}>
                          {(CONTATTI[s.id] || []).map((c) => (
                            <a key={c.value} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
                              <Icon name={c.icon} size={14} color="var(--cra-gold)" />
                              <span style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--char-400)" }}>{c.label}</span>
                              <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)", color: "var(--cra-white)", whiteSpace: "nowrap" }}>{c.value}</span>
                            </a>
                          ))}
                          <a href={s.gmaps} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            style={{ alignSelf: "flex-start", marginTop: "4px", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-extrabold)", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", color: "var(--cra-white)", background: "var(--cra-red)", padding: "7px 12px", borderRadius: "var(--radius-sm)", whiteSpace: "nowrap" }}>
                            Apri in Google Maps ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* map — zIndex:0 creates a stacking context that caps Leaflet's
                internal z-indexes (400–800) so it never covers the sticky header */}
            <div style={{ position: "relative", zIndex: 0, isolation: "isolate", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)", minHeight: "460px" }}>
              <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export function Footer({ onNavigate }) {
  const cols = [
    { h: "Cosa facciamo", items: [
      { t: "Ricambi auto", go: "srv-auto" },
      { t: "Ricambi moto", go: "srv-moto" },
      { t: "Ricambi microcar", go: "srv-auto" },
      { t: "Noleggio messa in fase", go: "srv-noleggio" },
      { t: "Auto di cortesia", go: "srv-cortesia" },
    ] },
    { h: "Azienda", items: [
      { t: "Chi siamo", go: "chisiamo" },
      { t: "I nostri numeri", go: "chisiamo" },
      { t: "Dove siamo", go: "sedi" },
      { t: "Privacy Policy", go: "privacy" },
      { t: "Cookie Policy", go: "cookie" },
    ] },
  ];
  return (
    <footer style={{ background: "var(--surface-darker)", color: "var(--char-300)", paddingTop: "var(--space-10)" }}>
      <Container>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr", gap: "var(--space-7)", paddingBottom: "var(--space-9)" }}>
          <div>
            <Logo variant="horizontal" onDark height={48} />
            <p className="cra-body" style={{ color: "var(--char-400)", marginTop: "var(--space-4)", maxWidth: "32ch" }}>
              Da oltre 30 anni al tuo fianco. Il vero specialista dei ricambi per auto e moto.
            </p>
            <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "10px" }}>
              {[
                { label: "FB", name: "Facebook", href: "https://www.facebook.com/centroricambiauto/?locale=it_IT" },
                { label: "IG", name: "Instagram", href: "https://www.instagram.com/centro_ricambi_auto/" },
                { label: "IN", name: "LinkedIn", href: "https://www.linkedin.com/company/centro-ricambi-auto-srl" },
              ].map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.name} title={s.name}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "var(--radius-sm)", background: "var(--char-800)", color: "var(--char-200)", textDecoration: "none", fontFamily: "var(--font-brand)", fontWeight: "var(--fw-extrabold)", fontSize: "11px", letterSpacing: "0.06em", transition: "background var(--dur-base) var(--ease-standard), color var(--dur-base) var(--ease-standard)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--cra-gold)"; e.currentTarget.style.color = "var(--char-900)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--char-800)"; e.currentTarget.style.color = "var(--char-200)"; }}>
                  {s.label}
                </a>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.h}>
              <div className="cra-meta" style={{ color: "var(--cra-gold)", marginBottom: "var(--space-3)" }}>{c.h}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {c.items.map((i) => (
                  <li key={i.t}>
                    <a href="#" onClick={(e) => { e.preventDefault(); if (i.go) onNavigate(i.go); }}
                      style={{ color: "var(--char-300)", textDecoration: "none", fontSize: "var(--fs-sm)" }}>{i.t}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <div className="cra-meta" style={{ color: "var(--cra-gold)", marginBottom: "var(--space-3)" }}>Contatti</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "var(--fs-sm)" }}>
              <Row icon="message-circle" label="WhatsApp Business" value="+39 02 846 3035" href="https://wa.me/39028463035" />
              <Row icon="phone" label="Centralino — tutte le filiali" value="+39 081 281732" href="tel:+39081281732" />
              <Row icon="file-text" label="Ordini e preventivi" value="ordini@centroricambiautosrl.it" href="mailto:ordini@centroricambiautosrl.it" />
              <Row icon="mail" label="Info generali" value="info@centroricambiautosrl.it" href="mailto:info@centroricambiautosrl.it" />
            </div>
            <Button variant="primary" size="sm" style={{ marginTop: "var(--space-4)" }} onClick={() => onNavigate("contatti")}>Richiedi preventivo</Button>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--char-800)", padding: "var(--space-4) 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap", fontSize: "var(--fs-xs)", color: "var(--char-500)" }}>
          <span>© {new Date().getFullYear()} Centro Ricambi Auto srl — centroricambiautosrl.it</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-4)" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate("privacy"); }} style={{ color: "var(--char-400)", textDecoration: "none" }}>Privacy Policy</a>
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate("cookie"); }} style={{ color: "var(--char-400)", textDecoration: "none" }}>Cookie Policy</a>
            <span style={{ fontFamily: "var(--font-brand)", fontWeight: "var(--fw-bold)", letterSpacing: "0.06em", color: "var(--char-400)" }}>#AndiamoInsiemeOltre</span>
          </span>
        </div>
      </Container>
    </footer>
  );
}

function Row({ icon, label, value, href }) {
  const ext = href && /^https?:/.test(href);
  const valueEl = href
    ? <a href={href} target={ext ? "_blank" : undefined} rel={ext ? "noopener noreferrer" : undefined} style={{ color: "var(--char-100)", fontWeight: "var(--fw-semibold)", textDecoration: "none" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--cra-gold)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--char-100)"; }}>{value}</a>
    : <div style={{ color: "var(--char-100)", fontWeight: "var(--fw-semibold)" }}>{value}</div>;
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <span style={{ display: "inline-flex", color: "var(--cra-gold)", marginTop: "2px" }}><Icon name={icon} size={15} color="var(--cra-gold)" /></span>
      <div>
        <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--char-500)" }}>{label}</div>
        {valueEl}
      </div>
    </div>
  );
}
