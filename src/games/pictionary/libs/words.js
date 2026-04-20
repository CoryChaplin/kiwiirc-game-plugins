export const WORDS = [
  'chat', 'chien', 'maison', 'arbre', 'soleil', 'lune', 'etoile', 'bateau',
  'voiture', 'velo', 'avion', 'pomme', 'banane', 'gateau', 'pizza', 'glace',
  'fleur', 'montagne', 'mer', 'poisson', 'oiseau', 'papillon', 'abeille',
  'livre', 'stylo', 'telephone', 'lunettes', 'chapeau', 'chaussure', 'cle',
  'guitare', 'piano', 'ballon', 'foot', 'tennis', 'neige', 'pluie', 'arc',
  'couronne', 'epee', 'bouclier', 'robot', 'fantome', 'sorciere', 'dragon',
  'licorne', 'ninja', 'pirate', 'cuisine', 'lit', 'lampe', 'porte', 'fenetre',
  'pont', 'train', 'bus', 'fusee', 'parapluie', 'sac', 'montre', 'cadenas',
  "télévision", "ordinateur", "clavier", "souris", "manette",
  "jeu vidéo", "caméra", "microphone", "casque",
  "batterie", "trompette", "violon", "tambour",
  "peinture", "dessin", "palette", "pinceau", "sculpture", "statue",
  "supermarché", "boulangerie", "restaurant", "école", "hôpital", "prison",
  "police", "pompier", "médecin", "infirmier", "professeur",
  "astronaute", "magicien", "clown", "zombie", "vampire", "alien",
  "super-héros", "monstre",
  "trésor", "carte", "boussole", "coffre",
  "clé usb", "horloge", "calendrier", "cadeau", "ruban",
  "bonbon", "sucette", "chocolat", "popcorn"
];

export function normalizeGuess(s) {
  if (typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}
