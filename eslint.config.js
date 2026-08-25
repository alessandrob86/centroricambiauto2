import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/* Controllo del codice, tenuto stretto a ciò che serve davvero.
 *
 * La regola che conta è `rules-of-hooks`: il 25 agosto 2026 un `useMobile()`
 * scritto dopo un `return` anticipato ha fatto morire tutta l'area interna,
 * e la compilazione non se n'era accorta — è codice validissimo, sbagliato
 * solo nell'ordine. Un controllo così lo prende prima ancora di compilare.
 *
 * Niente regole di stile: il progetto non ha un formattatore automatico e
 * riscrivere migliaia di righe per le virgolette non serve a nessuno.
 */
export default [
  { ignores: ["dist/**", "node_modules/**", "supabase/functions/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.serviceworker },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      /* Solo le due regole che trovano difetti veri.
         Il pacchetto ne porta anche altre, nate col compilatore React
         (purezza durante il disegno, setState dentro un effetto): sono
         consigli di prestazione, non errori, e ne uscirebbero decine. Un
         controllo che segnala trentatré cose viene spento il giorno dopo.
         `rules-of-hooks` invece prende esattamente l'errore che il 25 agosto
         ha fatto morire l'area interna. */
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Il JSX usa le variabili senza che il parser lo veda: senza questo,
      // ogni componente importato risulterebbe "mai usato".
      "no-unused-vars": ["warn", {
        varsIgnorePattern: "^[A-Z_]",
        argsIgnorePattern: "^_",
        caughtErrors: "none",
      }],
      "no-undef": "off",        // lo copre già il bundler, e JSX lo confonde
    },
  },
];
