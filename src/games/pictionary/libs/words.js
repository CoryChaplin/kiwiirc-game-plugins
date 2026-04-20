export const WORDS = [
  'lèvres','chenille','fourmis','arc-en-ciel','méduse','cupcake','coquillage','herbe',
  'île','manteau','abeille','œil','lion','voiture','bus','piscine',
  'garçon','genou','salle de bain','ballon','veste','drapeau','océan','flocon de neige',
  'football','raisins','bourdon','musique','livre','citron','dragon','rêve',
  'yeux','triangle','lunettes de soleil','zèbre','pieds','fourmi','lit','fusée',
  'rivière','bougie','sourire','alligator','lapin','plante','serpent','oiseau',
  'canard','chaton','Terre','étoile de mer','oreille','singe','sucette','soleil',
  'branche','couverture','orange','carotte','cube','dinosaure','hippopotame','bonbon',
  'prison','vache','tambour','hamburger','chapeau','lumière','escargot','chat',
  'chemise','nez','vivant','personne','bocal','queue','moto','baleine',
  'zigzag','valise','sac à dos','plume','ligne','moufle','femme','robot',
  'fromage','cheminée','peigne','œuf','ver','zoo','pizza','mouche',
  'stylo','pièce','pomme','baseball','ovale','skateboard','grenouille','cuillère',
  'cheval','plage','toboggan','coccinelle','Mickey Mouse','fenêtre','hélicoptère','bureau',
  'tête','jambe','crayon','horloge','chaussettes','pantalon','bateau','diamant',
  'insecte','boîte','visage','nuit','carré','tarte','ours','doigt',
  'banane','bouche','ongle','cerise','vélo','balai','feu','mer',
  'bec','bébé','bol','glace','lampe','blocs','écorce','éléphant',
  'araignée','lit superposé','rocher','sac à main','feuille','navire','toile d’araignée','chaussure',
  'cerf-volant','montagnes','lune','table','pluie','mouton','boucle','marguerite',
  'bonhomme de neige','train','jambes','balançoire','montagne','tasse','camion','fleur',
  'lunettes','crabe','hibou','bague','amour','lézard','porte','cœur',
  'bouton','girafe','poulet','chaise','pont','clé','cou','fantôme',
  'ordinateur','nœud','pain','maïs','cornet de glace','eau','ange','fourchette',
  'os','toit','sous-vêtements','poupée','poubelle','triste','papillon','citrouille d’Halloween',
  'maison','chien','étoile','biscuit','poisson','télévision','téléphone','avion',
  'sandwich','bulle','neige','arbre','etoile','gateau','arc','couronne',
  'epee','bouclier','sorciere','licorne','ninja','cuisine','parapluie','cadenas',
  'clavier','souris','manette','jeu vidéo','caméra','microphone','casque','trompette',
  'violon','peinture','dessin','palette','pinceau','sculpture','statue','supermarché',
  'boulangerie','restaurant','école','hôpital','police','pompier','médecin','infirmier',
  'professeur','astronaute','magicien','clown','zombie','vampire','alien','super-héros',
  'monstre','trésor','carte','boussole','coffre','clé usb','calendrier','cadeau',
  'chocolat','popcorn','guitare','piano','foot','tennis','sac','montre',
  'batterie','ruban','arpenteuse','falaise','raie','bus scolaire','montgolfière','pépites de chocolat',
  'papier','pilon','théière','prise','grotte','miette','enfants',
  'bavoir','panda','jean bleu','t-shirt','anguille','cocon','cuisinier','ville',
  'cuisinière','labyrinthe','coucher de soleil','pas','orgue','pop','ruban adhésif','iPad',
  'sifflement','pot','étang','lionceau','écureuil','lettre','noix de coco',
  'serviette','héros','niche','dinde','guépard','acolyte','concombre','croûte',
  'cicatrice','bâton','cloporte','grill','rat','ferme','défense','moisissure',
  'poumon','serrure','réfrigérateur','ambulance','harmonica','soda','aigle','orage',
  'sabot','tarte aux pommes','fougère','insecticide','ornithorynque','fourche','pomme de pin',
  'milieu','fossette','flaque','bretzel','évier','jouet','trampoline','minuteur',
  'toast','perceuse','cheeseburger','gomme','volcan','heureux','brindille','cheveux',
  'champignon','clé à molette','crêpe','frites','poisson rouge','chèvre','portefeuille','ouragan',
  'racine','cigogne','pyjama','champ','phoque','cire','paille','voilier',
  'orteil','sel et poivre','ping-pong','chaise à bascule','flamant rose','université','couverts','camion poubelle',
  'cadre','bois','masque','miel','impasse','machine à laver','ficelle','tournesol',
  'chauve-souris','épave','flûte','écart','mouchoir','équateur','désert','photographie',
  'fruit','golf','météore','castor','taxi','canne à pêche','violoncelle','temps',
  'ordures','papa','trombone','algues','infirmière','sifflet','barbe à papa','shampoing',
  'sable','page','tiroir','pile','tondeuse','poêle','canoë','facteur',
  'côte','art','panier','parachutisme','cacahuète','cape'
];

const SEP_RE = new RegExp(
  [
    '[\\s\\u00A0\\u1680\\u2000-\\u200B\\u202F\\u205F\\u3000',
    '\\u002D\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212',
    '_·]+',
  ].join(''),
  'g',
);

export function normalizeGuess(s) {
  if (typeof s !== 'string') return '';
  return s
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(SEP_RE, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export function dedupeWordsUsedList(arr) {
  const out = [];
  const seen = new Set();
  if (!Array.isArray(arr)) return out;
  for (const entry of arr) {
    if (typeof entry !== 'string' || !entry) continue;
    const sig = normalizeGuess(entry);
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    out.push(entry);
  }
  return out;
}

/**
 * Indique si tout le dictionnaire `WORDS` est couvert par `usedStrings` (après normalisation),
 * donc plus aucun tirage « hors déjà utilisé » possible sans réinitialiser l’historique.
 */
export function isDictionaryPoolExhausted(usedStrings) {
  const blocked = new Set();
  for (const u of usedStrings || []) {
    const sig = normalizeGuess(u);
    if (sig) blocked.add(sig);
  }
  if (!blocked.size) return false;
  return !WORDS.some((w) => !blocked.has(normalizeGuess(w)));
}

/** Jusqu’à `count` entrées distinctes (après normalisation), tirées hors des mots déjà dans `usedStrings`. */
export function pickUnusedWords(count, usedStrings) {
  const n = Math.max(0, Math.floor(count));
  if (!n) return [];
  const blocked = new Set();
  for (const u of usedStrings || []) {
    const sig = normalizeGuess(u);
    if (sig) blocked.add(sig);
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const pool = WORDS.filter((w) => !blocked.has(normalizeGuess(w)));
    if (!pool.length) break;
    const i = Math.floor(Math.random() * pool.length);
    const w = pool[i];
    out.push(w);
    const sig = normalizeGuess(w);
    if (sig) blocked.add(sig);
  }
  return out;
}
