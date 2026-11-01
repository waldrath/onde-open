// Editorial selection: the channels Onde would recommend to a friend, by
// genre. It is a human choice, not an automated ranking — every pick points
// at a channel of the catalogue, plays inside Onde, and was checked from
// Canada so it is readable from Quebec. Each theme holds more picks than it
// shows: `curateSelection` decides which ones a viewer sees this week.
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
      { channelId: 'franceinfo', reason: 'L’actualité française en continu, celle du service public.' },
      { channelId: 'africanewsfrench', reason: 'L’Afrique racontée par ses propres rédactions, en français.' },
      { channelId: 'dw-news', reason: 'Le regard allemand sur le monde, posé et très international.' },
      { channelId: 'crtv-news', reason: 'L’information du Cameroun par sa télévision publique.' },
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
      { channelId: 'classic-arts', reason: 'Opéra, ballet et grands concerts, présentés sans interruption.' },
      { channelId: 'rmcdecouverte', reason: 'Histoire, ingénierie et grands récits documentaires en français.' },
      { channelId: 'uctv', reason: 'Des conférences de l’Université de Californie, pour apprendre en direct.' },
      { channelId: 'nasa-iss', reason: 'La Terre vue de la Station spatiale, en direct et sans commentaire.' },
      { channelId: 'arirangtv', reason: 'La Corée d’aujourd’hui : culture, société et cuisine.' },
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
      { channelId: 'cine-western', reason: 'Le western en version française, des classiques aux séries B.' },
      { channelId: 'midsomer-murders', reason: 'Les enquêtes de Barnaby, un classique du polar britannique.' },
      { channelId: 'doctor-who-classic', reason: 'Les premières aventures du Docteur, la science-fiction culte.' },
      { channelId: 'artflix-movie-classics', reason: 'Des films classiques du domaine public, restaurés et en continu.' },
    ],
  },
  {
    id: 'sport',
    title: 'Sport',
    intro: 'Le direct et les magazines, sans passer par un abonnement.',
    picks: [
      { channelId: 'lequipe', reason: 'Le sport français en direct, gratuit et sans compte.' },
      { channelId: 'nbc-sports-now', reason: 'Des magazines et des temps forts du sport américain.' },
      { channelId: 'tsntheocho', reason: 'Le sport américain décalé de TSN, en direct.' },
      { channelId: 'redbulltv', reason: 'Sports extrêmes et documents d’aventure.' },
      { channelId: 'fifa-plus-fr', reason: 'Le football du monde entier en français, matchs et magazines.' },
      { channelId: 'africa24sport', reason: 'Le sport africain, ses championnats et ses grandes figures.' },
      { channelId: 'kozoomtv', reason: 'Les sports qu’on voit peu ailleurs : handball, volley, glisse.' },
      { channelId: 'womenssportsnetwork', reason: 'Le sport féminin en direct, enfin mis en avant.' },
      { channelId: 'stadium', reason: 'Du sport universitaire et des retransmissions en continu.' },
    ],
  },
  {
    id: 'jeunesse',
    title: 'Jeunesse',
    intro: 'Des programmes calmes, sans pub, pour les plus jeunes.',
    picks: [
      { channelId: 'super-simple-songs', reason: 'Des comptines anglaises simples et joyeuses.' },
      { channelId: 'teletubbies', reason: 'Les Teletubbies, pour les plus jeunes.' },
      { channelId: 'mr-bean-fr', reason: 'Mr. Bean en dessin animé, drôle sans un mot de trop.' },
      { channelId: 'tvo-kids', reason: 'La chaîne jeunesse publique de l’Ontario, éducative et sans publicité criarde.' },
      { channelId: 'baby-sharktv', reason: 'Comptines et chansons pour les tout-petits, faciles à suivre.' },
      { channelId: 'ninjakidztv', reason: 'Des aventures et des défis pour les enfants d’âge scolaire.' },
      { channelId: 'adntvplus', reason: 'L’animation japonaise en français, pour les plus grands.' },
      { channelId: 'toongoggles', reason: 'Des dessins animés variés, choisis pour les enfants.' },
      { channelId: 'rainbowruby', reason: 'Une héroïne curieuse et des histoires douces pour les petits.' },
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
      { channelId: 'qwest-tv-jazz-beyond', reason: 'Concerts de jazz et de musiques du monde, bien filmés.' },
      { channelId: 'trace-urban', reason: 'Les musiques urbaines du moment, en clips non-stop.' },
      { channelId: 'lofi-girl', reason: 'La musique lo-fi en continu pour travailler ou se détendre.' },
      { channelId: 'qello-concerts', reason: 'De grands concerts rock et pop, en intégralité.' },
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
      { channelId: 'love-nature', reason: 'Des documentaires animaliers canadiens, d’une grande beauté.' },
      { channelId: 'waterbear', reason: 'Des films sur la planète et ceux qui la protègent.' },
      { channelId: 'monterey-kelp-cam', reason: 'La forêt de varech de l’aquarium de Monterey, en direct.' },
      { channelId: 'adventureearth', reason: 'Les paysages et l’aventure en plein air, sans bavardage.' },
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
      { channelId: 'bonappetit', reason: 'Des recettes du magazine Bon Appétit, simples et précises.' },
      { channelId: 'this-old-house', reason: 'La rénovation de maisons expliquée par de vrais artisans.' },
      { channelId: 'thejamieoliverchannel', reason: 'La cuisine de Jamie Oliver, rapide et généreuse.' },
      { channelId: 'gotraveler', reason: 'Des voyages filmés pour donner envie de partir.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Which picks are shown. Nothing here is random: the same week, moment of the
// day and viewing history always give the same selection.
//  - Every theme shows SHOWN picks out of its pool, and the window moves by
//    STEP positions each week: two picks give way to two others while three
//    stay, and the whole pool comes round in turn.
//  - Channels the viewer already favours or watched recently give way to ones
//    they have not met yet, without leaving the pool.
//  - Themes are ordered for the moment of the day (news in the morning,
//    films at night).
// ---------------------------------------------------------------------------
export const SHOWN = 5, STEP = 2;
export type SelectionMoment = 'morning' | 'day' | 'evening' | 'night';
export type CuratedPick = SelectionPick & { fresh: boolean };
export type CuratedTheme = Omit<SelectionTheme, 'picks'> & { picks: CuratedPick[] };
export type CurateContext = {
  now: Date;
  available: (channelId: string) => boolean;
  seen?: ReadonlySet<string>;
  favorites?: ReadonlySet<string>;
};

const MOMENT_ORDER: Record<SelectionMoment, string[]> = {
  morning: ['actualites', 'culture', 'art-de-vivre', 'nature', 'musique', 'jeunesse', 'sport', 'cinema'],
  day: ['nature', 'art-de-vivre', 'jeunesse', 'culture', 'musique', 'sport', 'actualites', 'cinema'],
  evening: ['actualites', 'cinema', 'sport', 'culture', 'nature', 'musique', 'art-de-vivre', 'jeunesse'],
  night: ['cinema', 'musique', 'culture', 'nature', 'sport', 'actualites', 'art-de-vivre', 'jeunesse'],
};

export function momentOf(hour: number): SelectionMoment {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/** Monday of the viewer's local week, as a calendar date. */
export function weekStart(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

/** Weeks since 1970 counted on local Mondays: the selection changes on Monday at midnight. */
export function weekNumber(date: Date): number {
  const monday = weekStart(date);
  return Math.round(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) / 604800000);
}

// Each theme starts its rotation at its own place, so themes do not all turn
// over the same picks in lockstep.
const phase = (id: string) => [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
function rotation(pool: SelectionPick[], themeId: string, week: number): SelectionPick[] {
  if (!pool.length) return pool;
  const start = (((week * STEP + phase(themeId)) % pool.length) + pool.length) % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)];
}

export function curateSelection(themes: SelectionTheme[], context: CurateContext): CuratedTheme[] {
  const week = weekNumber(context.now), order = MOMENT_ORDER[momentOf(context.now.getHours())];
  const known = (id: string) => !!context.seen?.has(id) || !!context.favorites?.has(id);
  const rank = (id: string) => { const index = order.indexOf(id); return index < 0 ? order.length : index; };
  return themes
    .map((theme, index) => ({ theme, index }))
    .sort((a, b) => rank(a.theme.id) - rank(b.theme.id) || a.index - b.index)
    .map(({ theme }) => {
      const pool = theme.picks.filter(pick => context.available(pick.channelId));
      const ordered = rotation(pool, theme.id, week);
      const lastWeek = new Set(rotation(pool, theme.id, week - 1).slice(0, SHOWN).map(pick => pick.channelId));
      const picks = [...ordered.filter(pick => !known(pick.channelId)), ...ordered.filter(pick => known(pick.channelId))]
        .slice(0, SHOWN)
        .map(pick => ({ ...pick, fresh: pool.length > SHOWN && !lastWeek.has(pick.channelId) }));
      return { ...theme, picks };
    })
    .filter(theme => theme.picks.length > 0);
}
