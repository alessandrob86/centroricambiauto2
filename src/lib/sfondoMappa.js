/* Lo sfondo della mappa delle sedi: lo stile Positron di OpenFreeMap.
   Prima lo serviva CARTO («light_all»), che dal 2026 vuole una chiave e al
   posto delle tessere mostra la scritta «API KEY REQUIRED». OpenFreeMap è
   gratuito, non chiede chiave né registrazione e ammette l'uso commerciale;
   Positron è lo stesso disegno chiaro di prima.

   Le sue tessere sono vettoriali: le disegna MapLibre dentro Leaflet, così
   marcatori, popup e voli della mappa restano quelli di sempre. MapLibre pesa:
   questo file si carica a parte (import dinamico da Locations.jsx) e solo
   quando la mappa sta per entrare nello schermo. */
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
/* MapLibre cerca il suo lavoratore accanto a sé, ma dopo il pacchetto di Vite
   non c'è più: gli si dice dove l'ha copiato Vite. */
import indirizzoLavoratore from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";

setWorkerUrl(indirizzoLavoratore);

const STILE = "https://tiles.openfreemap.org/styles/positron";

/* Il testo che OpenFreeMap chiede di mostrare (MapLibre lo mette da sé, con
   Leaflet va scritto). Si fissa qui per vederlo da subito, non solo a stile caricato. */
const ATTRIBUZIONE =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

/* Lo stile scrive i nomi in inglese («Italy», «Ligurian Sea»): per un sito
   italiano si chiede il nome italiano, poi quello in alfabeto latino, poi
   quello locale. Le tessere di OpenFreeMap hanno tutti e tre i campi. */
const NOME_IN_ITALIANO = ["coalesce", ["get", "name:it"], ["get", "name:latin"], ["get", "name"]];

/* Asincrona perché lo stile si scarica e si ritocca prima di darlo a MapLibre:
   se il download fallisce, chi chiama ripiega sulle tessere di riserva. */
export async function sfondoVettoriale() {
  const risposta = await fetch(STILE);
  if (!risposta.ok) throw new Error(`Stile della mappa non disponibile (${risposta.status})`);
  const stile = await risposta.json();
  for (const livello of stile.layers ?? []) {
    const testo = livello.layout?.["text-field"];
    if (testo && JSON.stringify(testo).includes("name_en")) livello.layout["text-field"] = NOME_IN_ITALIANO;
  }
  return maplibreGL({ style: stile, attributionControl: { customAttribution: ATTRIBUZIONE } });
}
