/* ==========================================================================
   Fleurs de Cel — réglages du site (le seul fichier à modifier pour changer
   un téléphone, un horaire ou un tarif).
   Site 100 % statique : aucune base de données, aucun service tiers payant.
   La réservation génère un SMS pré-rempli, un appel ou un fichier agenda (.ics).
   ========================================================================== */
window.FDC = {
  nom: "Fleurs de Cel",
  proprietaire: "Céline",
  telephone: "+33621882786",
  telephoneAffiche: "06 21 88 27 86",
  adresse: "1 avenue Frédéric Mistral, 13650 Meyrargues",

  /* Horaires en minutes depuis minuit. 0 = dimanche … 6 = samedi.
     Source : fiche Google de la boutique (novembre 2026), à confirmer avec Céline. */
  horaires: {
    0: [[570, 750]],               // dimanche 9h30–12h30
    1: [[540, 750], [960, 1080]],  // lundi 9h–12h30 / 16h–18h
    2: [[540, 750], [960, 1140]],  // mardi 9h–12h30 / 16h–19h
    3: [],                         // mercredi : fermé
    4: [[570, 750], [900, 1140]],  // jeudi 9h30–12h30 / 15h–19h
    5: [[570, 750], [900, 1140]],  // vendredi 9h30–12h30 / 15h–19h
    6: [[570, 750], [960, 1140]]   // samedi 9h30–12h30 / 16h–19h
  },

  /* Tarifs : aucun prix n'est publié par la boutique. Pour afficher un prix,
     remplacez null par un texte, par exemple "dès 35 €". Le site l'affichera
     automatiquement sur la carte correspondante. */
  prix: {
    bouquets: null,
    sur_mesure: null,
    mariage: null,
    fetes: null,
    deuil: null,
    seche: null,
    plantes: null
  },

  /* Libellés utilisés dans le SMS pré-rempli */
  prestations: {
    bouquets: "un bouquet à retirer en boutique",
    sur_mesure: "une composition sur mesure",
    mariage: "un rendez-vous pour un mariage ou une cérémonie",
    fetes: "une décoration baptême / fête de famille",
    deuil: "une composition de deuil",
    seche: "une création en fleurs séchées ou stabilisées",
    plantes: "des plantes ou un fleurissement extérieur"
  }
};
