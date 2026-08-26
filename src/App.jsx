import React from "react";
import { Header } from "./sections/Header.jsx";
import { Hero } from "./sections/Hero.jsx";
import { Services, Brands } from "./sections/Services.jsx";
import { StatsBand, Strengths } from "./sections/Stats.jsx";
import { L2FBrand } from "./sections/L2F.jsx";
import { Locations, Footer } from "./sections/Locations.jsx";
import { Contact } from "./sections/Contact.jsx";
import { About } from "./sections/About.jsx";
import { Privacy, Cookie } from "./sections/Legal.jsx";
import { Accedi } from "./sections/Accedi.jsx";
import { ScrollProgress, BackToTop, Container } from "./components/shared.jsx";
import { BarraAnnunci } from "./components/BarraAnnunci.jsx";
import { Campanella } from "./components/Campanella.jsx";
import { tracciaVisita } from "./lib/traccia.js";

/* Sezioni ecommerce e back-office: lazy per non appesantire la vetrina. */
const Store = React.lazy(() => import("./sections/Store.jsx").then((m) => ({ default: m.Store })));
const StoreProduct = React.lazy(() => import("./sections/StoreProduct.jsx").then((m) => ({ default: m.StoreProduct })));
const Admin = React.lazy(() => import("./sections/Admin.jsx").then((m) => ({ default: m.Admin })));
const Interno = React.lazy(() => import("./sections/Interno.jsx").then((m) => ({ default: m.Interno })));

const { useState, useEffect } = React;

const PAGES = ["home", "contatti", "chisiamo", "privacy", "cookie", "login", "store", "admin", "interno"];

/* Route = { page, param }: due pagine portano un segmento parametro.
   #/store/<codice> è il dettaglio prodotto; #/interno/<modulo> apre l'area
   interna già sulla scheda giusta — serve ai segnalibri, alle notifiche
   push e all'atterraggio scelto da ciascuno. Un hash non-rotta (es. il
   callback auth di Supabase "#access_token=…") ricade su home: innocuo,
   supabase-js consuma i token dal fragment per conto suo. */
function routeFromHash() {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [base, ...rest] = h.split("/");
  if ((base === "store" || base === "interno") && rest.length) {
    return { page: base, param: decodeURIComponent(rest.join("/")) };
  }
  return { page: PAGES.includes(base) ? base : "home", param: null };
}

const routeKey = (r) => r.page + (r.param ? "/" + r.param : "");

/* Placeholder: fallback dei lazy-load e sezioni non ancora costruite. */
function ComingSoon({ title, loading = false }) {
  return (
    <section style={{ padding: "var(--space-10) 0", minHeight: "40vh" }}>
      <Container>
        <h1 className="cra-h2">{title}</h1>
        <p className="cra-body" style={{ color: "var(--text-muted)" }}>
          {loading ? "Caricamento…" : "Sezione in costruzione."}
        </p>
      </Container>
    </section>
  );
}

function Home({ onNavigate }) {
  return (
    <React.Fragment>
      <Hero onNavigate={onNavigate} />
      <Brands />
      <Services />
      <StatsBand />
      <Strengths />
      <L2FBrand />
      <Locations />
    </React.Fragment>
  );
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [pendingAnchor, setPendingAnchor] = useState(null);
  const page = route.page;

  const scrollToAnchor = (id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    /* offset = altezza reale dell'header sticky, non un numero fisso */
    const header = document.querySelector("header");
    const offset = (header ? header.offsetHeight : 113) + 8;
    const top = window.scrollY + el.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    el.classList.add("anchor-flash");
    setTimeout(() => el.classList.remove("anchor-flash"), 1400);
    return true;
  };

  /* Posizioni di scroll per pagina: il tasto Indietro riporta dov'eri. */
  const scrollPos = React.useRef({});

  /* Traccia la pagina, ma solo per chi è loggato: la funzione sul database
     scarta chi non ha un token. Store, area interna e vetrina si distinguono,
     perché rispondono a domande diverse. */
  useEffect(() => {
    const dove = page === "store" ? "cra" : page === "interno" ? "interno" : "vetrina";
    tracciaVisita(dove, routeKey(route));
  }, [route, page]);

  /* Esegue lo scroll all'ancora SOLO dopo che la home è montata e impaginata. */
  useEffect(() => {
    if (page !== "home" || !pendingAnchor) return undefined;
    let raf;
    const tryScroll = (tries = 0) => {
      if (scrollToAnchor(pendingAnchor) || tries > 30) {
        setPendingAnchor(null);
      } else {
        raf = requestAnimationFrame(() => tryScroll(tries + 1));
      }
    };
    raf = requestAnimationFrame(() => tryScroll());
    return () => cancelAnimationFrame(raf);
  }, [page, pendingAnchor]);

  /* Back/forward del browser (popstate copre anche le voci create con pushState):
     ripristina la posizione di scroll salvata per la pagina di destinazione. */
  useEffect(() => {
    const onHash = () => {
      const target = routeFromHash();
      setRoute(target);
      const saved = scrollPos.current[routeKey(target)] || 0;
      requestAnimationFrame(() => requestAnimationFrame(() =>
        window.scrollTo({ top: saved, behavior: "auto" })
      ));
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => { window.removeEventListener("hashchange", onHash); window.removeEventListener("popstate", onHash); };
  }, []);

  /* Cambia hash creando una voce di cronologia: il tasto Indietro funziona
     (l'evento hashchange al ritorno fa il resto). */
  const setHash = (id) => {
    if (window.location.hash !== "#/" + id) window.history.pushState(null, "", "#/" + id);
  };

  const navigate = (id) => {
    scrollPos.current[routeKey(route)] = window.scrollY;
    const [base, ...rest] = id.split("/");
    if (!PAGES.includes(base)) {
      /* ancora sulla home: se siamo già in home scrolla subito, altrimenti
         passa in home e lascia che l'effetto esegua lo scroll dopo il mount */
      if (page === "home") {
        requestAnimationFrame(() => scrollToAnchor(id));
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
        setHash("home");
        setRoute({ page: "home", param: null });
        setPendingAnchor(id);
      }
      return;
    }
    setHash(id);
    setRoute({ page: base, param: rest.length ? decodeURIComponent(rest.join("/")) : null });
    setPendingAnchor(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <React.Fragment>
      <a href="#contenuto" className="skip-link">Salta al contenuto</a>
      <ScrollProgress />
      {/* Sopra l'header, su ogni pagina: gli avvisi al personale devono
          arrivare anche a chi in quel momento sta guardando la vetrina. */}
      <BarraAnnunci onNavigate={navigate} />
      <Header current={page === "contatti" ? "" : page} onNavigate={navigate} />
      <main id="contenuto">
        {page === "home" && <Home onNavigate={navigate} />}
        {page === "contatti" && <Contact />}
        {page === "chisiamo" && <About onNavigate={navigate} />}
        {page === "privacy" && <Privacy onNavigate={navigate} />}
        {page === "cookie" && <Cookie onNavigate={navigate} />}
        {page === "login" && <Accedi onNavigate={navigate} />}
        {page === "store" && (
          <React.Suspense fallback={<ComingSoon title="CRA Store" loading />}>
            {route.param
              ? <StoreProduct codice={route.param} onNavigate={navigate} />
              : <Store onNavigate={navigate} />}
          </React.Suspense>
        )}
        {page === "admin" && (
          <React.Suspense fallback={<ComingSoon title="Back-office" loading />}>
            <Admin onNavigate={navigate} />
          </React.Suspense>
        )}
        {page === "interno" && (
          <React.Suspense fallback={<ComingSoon title="Area interna" loading />}>
            <Interno onNavigate={navigate} tab={route.param} />
          </React.Suspense>
        )}
      </main>
      <Footer onNavigate={navigate} />
      {/* Campanella flottante, fuori dal menu: è uno strumento del personale
          e non deve sporcare la navigazione pubblica. Si nasconde da sola
          per chi non è staff. */}
      <Campanella onNavigate={navigate} />
      <BackToTop />
    </React.Fragment>
  );
}
