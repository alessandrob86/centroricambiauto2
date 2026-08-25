import React from "react";

const { createContext, useContext, useEffect, useMemo, useState, useCallback } = React;

/**
 * Carrello CRA Store — port del pattern l2f.
 * Riga: { key, product_id, variant_id, codice, nome, imballo, prezzo, quantita, immagine }
 * La CHIAVE è la variante quando esiste, altrimenti il prodotto: due formati
 * dello stesso olio devono restare due righe distinte.
 * Persistito in localStorage: sopravvive a refresh e navigazione hash.
 *
 * v2: il catalogo è passato da cra_products a products+varianti, quindi le
 * righe vecchie (con cra_product_id) non sono più ordinabili. Cambiare chiave
 * di memorizzazione le lascia cadere invece di produrre ordini rotti.
 */
const STORAGE_KEY = "cra_cart_v2";
const CartContext = createContext(undefined);

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(load);
  const [isOpen, setIsOpen] = useState(false);
  // preferenza visualizzazione prezzi: con o senza IVA (persistita)
  const [ivaIncl, setIvaIncl] = useState(() => {
    try { return localStorage.getItem("cra_iva_incl") === "1"; } catch { return false; }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* quota / private mode: ignora */
    }
  }, [items]);

  useEffect(() => {
    try { localStorage.setItem("cra_iva_incl", ivaIncl ? "1" : "0"); } catch { /* ignora */ }
  }, [ivaIncl]);

  const add = useCallback((item) => {
    const key = item.variant_id ?? item.product_id;
    const qty = item.quantita ?? 1;
    setItems((prev) => {
      const i = prev.findIndex((x) => x.key === key);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantita: next[i].quantita + qty };
        return next;
      }
      return [...prev, { ...item, key, quantita: qty }];
    });
  }, []);

  const setQty = useCallback((key, qty) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((x) => x.key !== key)
        : prev.map((x) => (x.key === key ? { ...x, quantita: qty } : x)),
    );
  }, []);

  const remove = useCallback((key) => {
    setItems((prev) => prev.filter((x) => x.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => {
    const count = items.reduce((s, x) => s + x.quantita, 0);
    const totale = items.reduce((s, x) => s + (x.prezzo ?? 0) * x.quantita, 0);
    return { items, count, totale, add, setQty, remove, clear, isOpen, open, close, ivaIncl, setIvaIncl };
  }, [items, add, setQty, remove, clear, isOpen, open, close, ivaIncl]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve essere usato dentro <CartProvider>");
  return ctx;
};
