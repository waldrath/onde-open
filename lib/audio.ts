export function matchesAudioLanguage(track:{name:string;lang:string},language:string){
 if(language==='fr')return /^fr(?:a|e|[-_]|$)/i.test(track.lang)||/fran[çc]ais|french/i.test(track.name);
 if(language==='en')return /^en(?:g|[-_]|$)/i.test(track.lang)||/english|anglais/i.test(track.name);
 return track.lang===language||track.name===language;
}
