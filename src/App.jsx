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
import { ScrollProgress, BackToTop } from "./components/shared.jsx";

const { useState, useEffect } = React;

const PAGES = ["home", "contatti", "chisiamo", "privacy", "cookie"];

function pageFromHash() {
  const h = window.location.hash.replace(/^#\/?/, "");
  return PAGES.includes(h) ? h : "home";
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
  const [page, setPage] = useState(pageFromHash);
  const [pendingAnchor, setPendingAnchor] = useState(null);

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
      const target = pageFromHash();
      setPage(target);
      const saved = scrollPos.current[target] || 0;
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
    scrollPos.current[page] = window.scrollY;
    if (!PAGES.includes(id)) {
      /* ancora sulla home: se siamo già in home scrolla subito, altrimenti
         passa in home e lascia che l'effetto esegua lo scroll dopo il mount */
      if (page === "home") {
        requestAnimationFrame(() => scrollToAnchor(id));
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
        setHash("home");
        setPage("home");
        setPendingAnchor(id);
      }
      return;
    }
    setHash(id);
    setPage(id);
    setPendingAnchor(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <React.Fragment>
      <a href="#contenuto" className="skip-link">Salta al contenuto</a>
      <ScrollProgress />
      <Header current={page === "contatti" ? "" : page} onNavigate={navigate} />
      <main id="contenuto">
        {page === "home" && <Home onNavigate={navigate} />}
        {page === "contatti" && <Contact />}
        {page === "chisiamo" && <About onNavigate={navigate} />}
        {page === "privacy" && <Privacy onNavigate={navigate} />}
        {page === "cookie" && <Cookie onNavigate={navigate} />}
      </main>
      <Footer onNavigate={navigate} />
      <BackToTop />
    </React.Fragment>
  );
}
