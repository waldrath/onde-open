// Editorial selection: the channels Onde would recommend to a friend, by
// genre. It is a human choice, not an automated ranking — every pick points
// at a channel of the catalogue, plays inside Onde, and was checked from
// Canada so it is readable from Quebec.
export type SelectionPick = { channelId: string; reason: string };
export type SelectionTheme = { id: string; title: string; intro: string; picks: SelectionPick[] };

export const selection: SelectionTheme[] = [
  {
    id: 'actualites',
    title: 'Actualités',
    intro: 'Pour comprendre le monde sans s’abonner à rien.',
    picks: [
      { channelId: 'france24', reason: 'Le direct international en français, réactif et sans abonnement.' },
      { channelId: 'euronews-french', reason: 'Une information européenne continue, sobre et multilingue.' },
      { channelId: 'cpac', reason: 'La politique canadienne en direct, sans montage.' },
      { channelId: 'cbc-news', reason: 'L’information publique canadienne, en direct.' },
      { channelId: 'aljazeera-en', reason: 'Une couverture internationale qui change des grands réseaux occidentaux.' },
    ],
  },
  {
    id: 'culture',
    title: 'Culture et savoir',
    intro: 'Documentaires, sciences et culture, sans le bruit autour.',
    picks: [
      { channelId: 'telequebec', reason: 'La culture et la vie d’ici, avec une vraie exigence de service public.' },
      { channelId: 'savoir', reason: 'Sciences, histoire et société expliquées sans jargon.' },
      { channelId: 'pbs-kqed', reason: 'Documentaires et débats publics de la baie de San Francisco.' },
      { channelId: 'nhk-world', reason: 'Le Japon en direct : culture, sciences et société.' },
      { channelId: 'en-ted', reason: 'Des idées qui font avancer, en conférences courtes.' },
    ],
  },
  {
    id: 'cinema',
    title: 'Cinéma et séries',
    intro: 'Des classiques et des pépites, gratuits et légaux.',
    picks: [
      { channelId: 'filmriseclassictv', reason: 'Les grandes séries télé américaines des années 50 à 80.' },
      { channelId: 'maverick-black-cinema', reason: 'Un cinéma noir américain rarement diffusé ailleurs.' },
      { channelId: 'filmrisewestern', reason: 'Le western classique, sans abonnement ni compte.' },
      { channelId: 'cine-nanar', reason: 'Le nanar assumé et le cinéma de genre français.' },
      { channelId: 'emotionl', reason: 'Des films sentimentaux en boucle, en français.' },
    ],
  },
  {
    id: 'sport',
    title: 'Sport',
    intro: 'Le direct et les magazines, sans passer par un abonnement.',
    picks: [
      { channelId: 'lequipe', reason: 'Le sport français en direct, gratuit et sans compte.' },
      { channelId: 'bein-sports-xtra', reason: 'Le sport international gratuit de beIN, hors droits payants.' },
      { channelId: 'nbc-sports-now', reason: 'Des magazines et des temps forts du sport américain.' },
      { channelId: 'tsntheocho', reason: 'Le sport américain décalé de TSN, en direct.' },
      { channelId: 'redbulltv', reason: 'Sports extrêmes et documents d’aventure.' },
    ],
  },
  {
    id: 'jeunesse',
    title: 'Jeunesse',
    intro: 'Des programmes calmes, sans pub, pour les plus jeunes.',
    picks: [
      { channelId: 'happy-kids', reason: 'Dessins animés et comptines pour les tout-petits.' },
      { channelId: 'super-simple-songs', reason: 'Des comptines anglaises simples et joyeuses.' },
      { channelId: 'teletubbies', reason: 'Les Teletubbies, pour les plus jeunes.' },
      { channelId: 'en-zoomoo', reason: 'La découverte de la nature expliquée aux enfants.' },
    ],
  },
  {
    id: 'musique',
    title: 'Musique',
    intro: 'Des chaînes qui jouent de la musique, pas des clips coupés.',
    picks: [
      { channelId: 'stingrayclassica', reason: 'Le classique en HD : concerts, opéras et récitals.' },
      { channelId: 'stingraydjazz', reason: 'Le jazz sous toutes ses formes, sans interruption.' },
      { channelId: 'stingraysmoothjazz', reason: 'Une bulle de jazz doux pour travailler ou lire.' },
      { channelId: 'stingrayclassicrock', reason: 'Les classiques du rock, en continu.' },
      { channelId: 'stingrayeverything80s', reason: 'Toute une décennie en clips.' },
    ],
  },
  {
    id: 'nature',
    title: 'Nature et découvertes',
    intro: 'Des images qui prennent leur temps.',
    picks: [
      { channelId: 'bbcearth', reason: 'Des documentaires nature parmi les plus beaux, en anglais.' },
      { channelId: 'wildearth', reason: 'Des safaris en direct depuis l’Afrique du Sud.' },
      { channelId: 'naturetime', reason: 'La nature en français, pour souffler.' },
      { channelId: 'lovepets', reason: 'Des animaux et des humains, en douceur.' },
      { channelId: 'inwild', reason: 'L’aventure sauvage en continu.' },
    ],
  },
  {
    id: 'art-de-vivre',
    title: 'Art de vivre',
    intro: 'Cuisine, maison et voyages : le plaisir sans la télé-réalité.',
    picks: [
      { channelId: 'tv5mondechefs', reason: 'La gastronomie francophone, en direct.' },
      { channelId: 'gustotv', reason: 'La cuisine canadienne, en continu.' },
      { channelId: 'homeful', reason: 'Maison et décoration, sans jargon.' },
      { channelId: 'pbsantiquesroadshow', reason: 'Objets et histoire : une valeur sûre.' },
      { channelId: 'tastemade', reason: 'Des voyages gourmands et inspirants.' },
    ],
  },
];
