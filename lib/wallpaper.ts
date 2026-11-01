// A personal background image per skin, chosen by the viewer from their own
// device. It never leaves the device (see app/use-wallpaper.ts): Onde only
// checks the file, shrinks it, and keeps it in the browser's storage.
export type WallpaperStrength = 'soft' | 'vivid';
export const WALLPAPER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const;
export const WALLPAPER_MAX_BYTES = 15 * 1024 * 1024;
/** Longest side kept after shrinking: sharp on a large screen, light on a weak GPU. */
export const WALLPAPER_MAX_SIDE = 2560;

export function wallpaperProblem(file: { type: string; size: number }): string | null {
  if (!(WALLPAPER_TYPES as readonly string[]).includes(file.type)) return 'Choisissez une image JPEG, PNG, WebP, GIF ou AVIF.';
  if (file.size <= 0) return 'Cette image est vide.';
  if (file.size > WALLPAPER_MAX_BYTES) return 'Cette image est trop lourde (15 Mo au maximum).';
  return null;
}

/** Size to draw the image at: never enlarged, the longest side capped at WALLPAPER_MAX_SIDE. */
export function wallpaperSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, WALLPAPER_MAX_SIDE / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** A GIF is kept as chosen so it stays animated (drawing it again would keep its first frame only). */
export const keepsAnimation = (type: string) => type === 'image/gif';
/** An animated GIF cannot be shrunk, and every frame is decoded at full size: its longest side is capped instead. */
export const GIF_MAX_SIDE = 1920;
export function gifProblem(width: number, height: number): string | null {
  return Math.max(width, height) > GIF_MAX_SIDE ? 'Ce GIF est trop grand : 1920 pixels de côté au maximum.' : null;
}

export const isWallpaperStrength = (value: unknown): value is WallpaperStrength => value === 'soft' || value === 'vivid';
