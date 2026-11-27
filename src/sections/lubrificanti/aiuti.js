import { useState, useEffect } from "react";

/* Due aiuti dell'area interna, gli stessi di Interno.jsx: la data all'italiana
   e «sono sul telefono?». Copiati qui perché la scheda Lubrificanti si carica
   a parte (React.lazy) e non deve importare dall'area interna che la contiene. */

export const dataIt = (s) => (s ? new Date(s).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const SOGLIA_MOBILE = "(max-width: 760px)";

export function useMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(SOGLIA_MOBILE).matches);
  useEffect(() => {
    const mq = window.matchMedia(SOGLIA_MOBILE);
    const cambia = (e) => setMobile(e.matches);
    mq.addEventListener("change", cambia);
    setMobile(mq.matches);
    return () => mq.removeEventListener("change", cambia);
  }, []);
  return mobile;
}
