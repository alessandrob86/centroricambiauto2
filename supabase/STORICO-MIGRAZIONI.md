# Storico delle migrazioni

⚠️ **Lo schema del database non è versionato in questo repository.** In
`supabase/` c'è solo `functions/`. Tabelle, policy, trigger e funzioni vivono
soltanto dentro Supabase (progetto `cjvtynutpsatwauocrdf`).

Questo file è l'**indice** di ciò che esiste lassù, aggiornato al 25 agosto 2026:
106 migrazioni, 247.636 caratteri di SQL. Serve a sapere cosa cercare e in che
ordine, non a ricostruire niente.

## Per scaricare il contenuto vero

```bash
npx supabase login
npx supabase link --project-ref cjvtynutpsatwauocrdf
npx supabase db pull
```

Chiede la password del database (Supabase → Project Settings → Database; se
non la ricordi si può rigenerare da lì). Scrive un file in
`supabase/migrations/`. Da quel momento in poi lo schema sta anche nel
repository e ci resta.

## L'elenco

| # | Data | Nome | Caratteri |
|---|---|---|---|
| 1 | 2026-01-20 | init_pricing_schema | 1.103 |
| 2 | 2026-01-20 | populate_pricing_data | 1.664 |
| 3 | 2026-06-13 | b2b_ecommerce_schema | 7.030 |
| 4 | 2026-06-13 | b2b_schema_hardening | 706 |
| 5 | 2026-06-13 | oil_variants_and_chimica | 1.732 |
| 6 | 2026-06-13 | product_description_and_docs | 398 |
| 7 | 2026-06-15 | product_lines_showcase_fields | 140 |
| 8 | 2026-06-15 | products_immagini_gallery | 62 |
| 9 | 2026-06-15 | product_lines_diagram | 108 |
| 10 | 2026-06-15 | messaggi_contatto | 481 |
| 11 | 2026-06-17 | auto_create_officina_on_signup | 907 |
| 12 | 2026-06-17 | add_codice_cliente_to_officine | 428 |
| 13 | 2026-06-17 | admin_role_and_policies | 1.653 |
| 14 | 2026-06-17 | l2f_academy_corsi | 2.184 |
| 15 | 2026-06-17 | corsi_extended_fields_storage | 1.593 |
| 16 | 2026-06-17 | cron_infra_app_config | 483 |
| 17 | 2026-06-17 | schedule_course_reminders_cron | 733 |
| 18 | 2026-06-17 | officine_obiettivo_cashback | 263 |
| 19 | 2026-06-17 | corsi_crediti_prezzo_partecipanti | 1.617 |
| 20 | 2026-06-17 | enforce_crediti_corsi | 768 |
| 21 | 2026-06-17 | audit_officine_log | 2.606 |
| 22 | 2026-06-18 | officine_addon_flex_marketing_bancadati | 2.511 |
| 23 | 2026-07-04 | officine_dual_site_flags | 673 |
| 24 | 2026-07-04 | handle_new_officina_origine | 742 |
| 25 | 2026-07-04 | officine_guard_admin_bypass | 1.052 |
| 26 | 2026-07-04 | log_officina_update_flags | 2.629 |
| 27 | 2026-07-04 | officine_autoflag_on_activation | 844 |
| 28 | 2026-07-04 | l2f_flag_enforcement_rls | 1.604 |
| 29 | 2026-07-06 | cra_store_catalog | 1.909 |
| 30 | 2026-07-06 | cra_order_items_ref_and_numbering | 1.004 |
| 31 | 2026-07-06 | cra_storage_bucket_and_config | 840 |
| 32 | 2026-07-06 | cra_catalog_restricted_to_enabled | 820 |
| 33 | 2026-07-06 | is_cra_abilitata_helper | 746 |
| 34 | 2026-07-06 | officine_guard_protect_privileged_fields | 1.760 |
| 35 | 2026-07-06 | cra_categories_hierarchy_and_tags | 14.435 |
| 36 | 2026-07-06 | import_l2f_batterie_lampade_lubrificanti | 3.776 |
| 37 | 2026-07-06 | cra_products_attributi_backfill | 1.715 |
| 38 | 2026-07-11 | distinte_reference | 570 |
| 39 | 2026-07-11 | netto_per_distinta | 786 |
| 40 | 2026-07-11 | cra_product_netto | 915 |
| 41 | 2026-07-11 | listino_tag | 741 |
| 42 | 2026-07-11 | officine_distinte | 812 |
| 43 | 2026-07-23 | categorie_cliente | 1.056 |
| 44 | 2026-07-23 | listini_e_prezzi | 2.755 |
| 45 | 2026-07-23 | funzioni_risoluzione_prezzo | 3.009 |
| 46 | 2026-07-23 | rinomina_fonte_listino | 303 |
| 47 | 2026-07-25 | netto_chiave_singola | 739 |
| 48 | 2026-07-25 | app_config_lettura_admin | 421 |
| 49 | 2026-07-28 | catalogo_unico_colonne | 1.375 |
| 50 | 2026-07-28 | catalogo_unico_migrazione_dati | 899 |
| 51 | 2026-07-28 | reparti_prodotti_nuovi_su_cra | 663 |
| 52 | 2026-07-28 | rls_catalogo_per_vetrina | 1.082 |
| 53 | 2026-07-28 | cra_netto_utente | 1.874 |
| 54 | 2026-07-28 | ritiro_tabelle_cra_duplicate | 632 |
| 55 | 2026-08-01 | products_scrittura_admin | 472 |
| 56 | 2026-08-01 | netti_scrittura_admin | 1.251 |
| 57 | 2026-08-01 | cra_vetrina_taglia_offerte | 2.284 |
| 58 | 2026-08-01 | prezzi_dedicati_singolo_cliente | 955 |
| 59 | 2026-08-01 | netto_utente_prezzo_personale | 4.148 |
| 60 | 2026-08-04 | staff_zone_e_dipendenti | 1.954 |
| 61 | 2026-08-04 | staff_funzioni_e_rls | 2.552 |
| 62 | 2026-08-04 | officine_anagrafiche_senza_accesso | 2.030 |
| 63 | 2026-08-04 | officine_codice_cliente_unique_semplice | 432 |
| 64 | 2026-08-04 | aggancio_registrazione_anagrafica | 3.160 |
| 65 | 2026-08-04 | conta_officine_per_categoria | 1.129 |
| 66 | 2026-08-04 | officine_origine_manuale | 405 |
| 67 | 2026-08-04 | officine_province | 499 |
| 68 | 2026-08-04 | interno_annunci | 4.881 |
| 69 | 2026-08-04 | interno_card_center | 8.853 |
| 70 | 2026-08-04 | interno_moduli_permessi_dashboard | 7.020 |
| 71 | 2026-08-05 | interno_notifiche_e_foto | 5.986 |
| 72 | 2026-08-05 | avvisi_aspetto_e_countdown | 4.773 |
| 73 | 2026-08-05 | avvisi_colore_effetto | 3.860 |
| 74 | 2026-08-05 | dashboard_riquadri_nascondibili | 2.011 |
| 75 | 2026-08-05 | riquadri_taglie_ammesse | 2.932 |
| 76 | 2026-08-05 | clienti_del_rappresentante | 5.372 |
| 77 | 2026-08-05 | esito_accettata | 905 |
| 78 | 2026-08-05 | storico_proposte_e_prezzi_scheda | 4.153 |
| 79 | 2026-08-05 | statistiche_proposte | 5.514 |
| 80 | 2026-08-05 | officine_libere_per_agente | 1.542 |
| 81 | 2026-08-05 | prendi_lascia_cliente | 2.164 |
| 82 | 2026-08-05 | statistiche_complete | 11.578 |
| 83 | 2026-08-05 | modulo_profilo_e_traguardi | 3.983 |
| 84 | 2026-08-05 | avatar_caricabile_dal_personale | 774 |
| 85 | 2026-08-05 | tracce_uso_e_traguardi_per_ruolo | 6.134 |
| 86 | 2026-08-05 | taglia_4x1 | 455 |
| 87 | 2026-08-06 | tipi_scheda_conformi_a_projectb | 2.527 |
| 88 | 2026-08-06 | schede_utente_con_icona | 1.799 |
| 89 | 2026-08-06 | schede_utente_con_filiali | 2.379 |
| 90 | 2026-08-06 | tipi_scheda_colori_leggibili | 1.362 |
| 91 | 2026-08-06 | prezzo_ordine_deciso_dal_database | 5.083 |
| 92 | 2026-08-06 | totale_ordine_per_riga | 346 |
| 93 | 2026-08-06 | configurazione_per_riquadro | 2.647 |
| 94 | 2026-08-06 | traccia_attivita | 3.145 |
| 95 | 2026-08-06 | statistiche_attivita_admin | 8.372 |
| 96 | 2026-08-06 | traguardi_datati | 7.543 |
| 97 | 2026-08-06 | miei_traguardi_qualificata | 4.245 |
| 98 | 2026-08-06 | miei_traguardi_su_jsonb | 2.809 |
| 99 | 2026-08-07 | etichette_prodotto_nel_deposito | 2.727 |
| 100 | 2026-08-07 | documenti_prodotto_nel_deposito | 2.234 |
| 101 | 2026-08-07 | rinomina_media_nomi_non_ammessi | 3.082 |
| 102 | 2026-08-25 | notifiche_push_iscrizioni | 3.630 |
| 103 | 2026-08-25 | search_path_fisso_funzioni_ausiliarie | 467 |
| 104 | 2026-08-25 | prezzo_riga_l2f_a_contenitore | 3.765 |
| 105 | 2026-08-25 | prezzo_riga_imposto_anche_su_l2f | 1.269 |
| 106 | 2026-08-25 | totale_ordine_anche_su_l2f | 1.693 |

## Dove guardare per capire una cosa

| Se ti serve capire | Guarda |
|---|---|
| Come nascono i prezzi | 43-48, 53, 58-59 |
| Chi può vedere cosa (RLS) | 13, 25, 28, 32-34, 52 |
| Il catalogo condiviso fra i due siti | 49-54 |
| Il modulo interno | 60-61, 68-76, 83-86, 93 |
| Statistiche e traguardi | 79, 82, 94-98 |
| Foto e documenti nel deposito | 99-101 |
| Notifiche push | 102 |
| Prezzo degli ordini imposto dal database | 91-92, 104-106 |
