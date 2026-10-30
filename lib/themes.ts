// Every skin Onde ships. The menu reads this list, the app writes the id on
// <html data-theme> and the CSS owns the visual identity of each one.
export const themes = [
  { id: 'dark', label: 'Sombre', swatch: '#0b1b35', accent: '#64c8d1' },
  { id: 'light', label: 'Clair', swatch: '#f6f3eb', accent: '#194f40' },
  { id: 'retro', label: 'Rétro 90', swatch: '#1a0b3d', accent: '#ff3fc8' },
  { id: 'matrix', label: 'Matrix', swatch: '#02120a', accent: '#3dff8a' },
  { id: 'anime', label: 'Manga', swatch: '#ffe3ee', accent: '#e0568a' },
  { id: 'blueprint', label: 'Blueprint', swatch: '#061a33', accent: '#ffd166' },
  { id: 'noir', label: 'Noir', swatch: '#0d0b08', accent: '#d9b45b' },
  { id: 'ocean', label: 'Marée', swatch: '#03202b', accent: '#3fe0c8' },
  { id: 'cosmos', label: 'Orbite', swatch: '#0c0820', accent: '#a06bff' },
  { id: 'arcade', label: 'Arcade', swatch: '#0c0f22', accent: '#ff6b35' },
  { id: 'sumi', label: 'Encre', swatch: '#f4f1e8', accent: '#c8452f' },
  { id: 'ember', label: 'Braise', swatch: '#1a0c05', accent: '#ff7a2f' },
] as const;

export type Theme = (typeof themes)[number]['id'];

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && themes.some(theme => theme.id === value);
}
