// The catalogue mixes the curated French categories with the English
// group-title categories stored verbatim by the iptv-org import; both must
// land in the same discovery groups so imported channels stay browsable.
const groups:Record<string,string[]>={
 'Actualités':['Actualités','Économie','Météo','Enquêtes','News','Business','Weather','Legislative'],
 'Films et séries':['Films','Séries','Animation','Movies','Series','Classic'],
 'Culture et savoir':['Culture','Découvertes','Documentaires','Histoire','Science','Documentary','Education'],
 'Divertissement':['Divertissement','Humour','Jeux TV','Généraliste','Entertainment','Comedy','General','Family'],
 'Jeunesse':['Jeunesse','Kids'], 'Musique':['Musique','Music'],
 'Nature et plein air':['Nature','Plein air','Détente','Outdoor','Relax'],
 'Art de vivre':['Art de vivre','Cuisine','Maison','Mode','Lifestyle','Cooking'],
 'Voyages':['Voyages','Travel'],'Sport':['Sport','Sports'],'Auto et moteurs':['Auto'],
 'Autres chaînes':['Religion','Téléachat','Paranormal','Religious','Shop']
};
export function categoryGroup(category:string){return Object.keys(groups).find(group=>groups[group].includes(category))||'Autres chaînes';}
export function discoveryCategories(channels:{category:string}[]){const present=new Set(channels.map(c=>categoryGroup(c.category)));return Object.keys(groups).filter(group=>present.has(group));}
