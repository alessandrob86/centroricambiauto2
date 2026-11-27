import React from "react";

const { useState } = React;

/* Le specifiche di un olio, per confrontare i marchi e decidere i legami: prima le norme
   del listino, poi (se ci sono) quelle della scheda del produttore, salvate in
   «omologazioni». Chiuse su due righe ciascuna: un tocco le apre tutte. */

export default function Specifiche({ olio }) {
  const [aperte, setAperte] = useState(false);
  const righe = [olio?.norme, olio?.omologazioni].map((t) => (t ?? "").trim()).filter(Boolean);
  if (righe.length === 2 && righe[0] === righe[1]) righe.pop();
  if (!righe.length) return null;
  return (
    <button type="button" className={`mod-lub-spec${aperte ? " aperte" : ""}`} aria-expanded={aperte}
      title={aperte ? undefined : "Mostra tutte le specifiche"} onClick={() => setAperte((a) => !a)}>
      {righe.map((t, i) => <span key={i}>{t}</span>)}
    </button>
  );
}
