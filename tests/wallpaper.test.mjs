import test from 'node:test';
import assert from 'node:assert/strict';
import {wallpaperProblem,wallpaperSize,isWallpaperStrength,WALLPAPER_MAX_BYTES,WALLPAPER_MAX_SIDE} from '../lib/wallpaper.ts';

test('only reasonable image files are accepted', () => {
  assert.equal(wallpaperProblem({type: 'image/jpeg', size: 400000}), null);
  assert.equal(wallpaperProblem({type: 'image/webp', size: WALLPAPER_MAX_BYTES}), null);
  assert.match(wallpaperProblem({type: 'image/svg+xml', size: 2000}), /JPEG/);
  assert.match(wallpaperProblem({type: 'application/pdf', size: 2000}), /JPEG/);
  assert.match(wallpaperProblem({type: 'image/png', size: 0}), /vide/);
  assert.match(wallpaperProblem({type: 'image/png', size: WALLPAPER_MAX_BYTES + 1}), /lourde/);
});

test('large images are shrunk to the cap, small ones are kept as they are', () => {
  assert.deepEqual(wallpaperSize(5120, 2880), {width: WALLPAPER_MAX_SIDE, height: 1440});
  assert.deepEqual(wallpaperSize(1200, 4000), {width: 768, height: WALLPAPER_MAX_SIDE});
  assert.deepEqual(wallpaperSize(1280, 720), {width: 1280, height: 720});
  assert.deepEqual(wallpaperSize(0, 0), {width: 1, height: 1});
});

test('the strength is one of two known values', () => {
  assert.equal(isWallpaperStrength('soft'), true);
  assert.equal(isWallpaperStrength('vivid'), true);
  assert.equal(isWallpaperStrength('loud'), false);
});

test('only a GIF is kept as chosen, so it stays animated', async () => {
  const {keepsAnimation} = await import('../lib/wallpaper.ts');
  assert.equal(keepsAnimation('image/gif'), true);
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(keepsAnimation(type), false);
});

test('an animated GIF is refused beyond the size it can be shown at cheaply', async () => {
  const {gifProblem, GIF_MAX_SIDE} = await import('../lib/wallpaper.ts');
  assert.equal(gifProblem(GIF_MAX_SIDE, 1080), null);
  assert.match(gifProblem(GIF_MAX_SIDE + 1, 600), /trop grand/);
  assert.match(gifProblem(480, 2400), /trop grand/);
});
