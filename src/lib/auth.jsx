import React from "react";
import { supabase } from "./supabase.js";

const { createContext, useContext, useEffect, useState, useCallback } = React;

/**
 * Contesto auth CRA — port del pattern l2f sull'anagrafica condivisa.
 *
 * Un account può essere DUE cose, e non sono la stessa:
 *
 *   `officine`   — il CLIENTE. stato ('in_attesa'|'attiva'|'sospesa'),
 *                  origine ('cra'|'l2f'), cra_abilitata / l2f_abilitata,
 *                  is_admin.
 *   `dipendenti` — il PERSONALE CRA. ruolo (admin, manager, rappresentante,
 *                  centralino, dipendente) e filiale (`zona_id`).
 *
 * Un dipendente non ha una riga officine: senza questa distinzione finirebbe
 * nel cancello "account in attesa di attivazione", che è pensato per i
 * clienti non ancora approvati.
 *
 * "Attiva su CRA" = stato 'attiva' E cra_abilitata (la RLS applica lo
 * stesso cancello lato database: qui serve solo a far combaciare la UI).
 */
const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [officina, setOfficina] = useState(null);
  const [dipendente, setDipendente] = useState(null);
  const [avvio, setAvvio] = useState(null);
  const [loading, setLoading] = useState(true);

  /** Carica in parallelo le due identità possibili dell'utente e il posto
   *  dove vuole atterrare. Le tre domande partono insieme: in fila
   *  costerebbero tre giri di rete a ogni apertura di pagina. */
  const loadProfilo = useCallback(async (userId) => {
    if (!userId) {
      setOfficina(null);
      setDipendente(null);
      setAvvio(null);
      return null;
    }
    const [off, dip, av] = await Promise.all([
      supabase.from("officine").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("dipendenti").select("*, zone(id, nome)").eq("user_id", userId).eq("attivo", true).maybeSingle(),
      supabase.rpc("avvio_utente"),
    ]);
    setOfficina(off.data ?? null);
    setDipendente(dip.data ?? null);
    const dove = av.data ?? null;
    setAvvio(dove);
    return dove;
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfilo(data.session?.user?.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      loadProfilo(s?.user?.id);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfilo]);

  /* Restituisce anche dove atterrare. Il profilo si ricarica comunque da
     solo al cambio di sessione, ma arriva un attimo dopo: la pagina di
     accesso deve sapere subito dove mandare la persona, altrimenti la
     manda in home e basta. */
  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { avvio: await loadProfilo(data.user?.id) };
  }, [loadProfilo]);

  const signUp = useCallback(async (d) => {
    // I dati officina viaggiano nei user_metadata: un trigger DB crea la riga
    // officine (stato 'in_attesa') alla creazione utente, senza problemi di RLS.
    // origine:'cra' fa sì che all'attivazione si accenda cra_abilitata.
    const { data, error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        emailRedirectTo: `${window.location.origin}/#/login`,
        data: {
          ragione_sociale: d.ragione_sociale,
          piva: d.piva ?? "",
          telefono: d.telefono ?? "",
          citta: d.citta ?? "",
          origine: "cra",
        },
      },
    });
    if (error) return { error: error.message };
    if (data.session?.user?.id) {
      await loadProfilo(data.session.user.id);
      return {};
    }
    // Nessuna sessione → è richiesta la conferma email prima del login.
    return { needsConfirm: true };
  }, [loadProfilo]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setOfficina(null);
    setDipendente(null);
  }, []);

  const refreshOfficina = useCallback(
    () => loadProfilo(session?.user?.id),
    [loadProfilo, session],
  );

  const craActive = officina?.stato === "attiva" && officina?.cra_abilitata === true;
  const isStaff = !!dipendente;

  const value = {
    session,
    user: session?.user ?? null,
    officina,
    /** Riga `dipendenti` con la filiale agganciata, o null se non è personale CRA. */
    dipendente,
    loading,
    /** Officina approvata E abilitata a CRA: può inviare proposte d'ordine. */
    isActive: craActive,
    /** Loggato ma non ancora operativo su CRA. Il personale NON ci finisce:
     *  quel cancello è per i clienti in attesa di approvazione. */
    isPending: !!session && !craActive && !isStaff,
    /** Personale CRA: ha accesso al modulo interno. */
    isStaff,
    /** admin | manager | rappresentante | centralino | dipendente | null */
    ruolo: dipendente?.ruolo ?? null,
    /** Filiale di appartenenza: è il filtro dei contenuti interni. */
    zona: dipendente?.zone ?? null,
    /** Dove atterra dopo il login: codice di una scheda dell'area interna,
     *  'sito' per la home pubblica, null per chi non è personale. */
    avvio,
    /** Back-office CRA e L2F: l'admin cliente storico o un dipendente admin. */
    isAdmin: officina?.is_admin === true || dipendente?.ruolo === "admin",
    signIn,
    signUp,
    signOut,
    refreshOfficina,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** Dalla preferenza alla rotta vera. Sta fuori dal contesto perché serve a
 *  chi decide la navigazione, non solo a chi legge lo stato. */
export const rottaDiAvvio = (avvio) =>
  (!avvio || avvio === "sito" ? "home" : `interno/${avvio}`);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro <AuthProvider>");
  return ctx;
};
