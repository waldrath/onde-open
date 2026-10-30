import test from 'node:test';
import assert from 'node:assert/strict';
import {countryForRegion,detectViewerCountry,isLikelyGeoBlocked} from '../lib/geo.ts';

test('viewer country detection prefers the time zone and falls back to locale', () => {
  assert.equal(detectViewerCountry({locale:'fr-CA',timeZone:'Europe/Paris'}),'FR');
  assert.equal(detectViewerCountry({locale:'fr-FR',timeZone:'America/Toronto'}),'CA');
  assert.equal(detectViewerCountry({locale:'en-US',timeZone:'America/Toronto'}),'CA');
  assert.equal(detectViewerCountry({locale:'fr',timeZone:'America/Montreal'}),'CA');
  assert.equal(detectViewerCountry({locale:'fr',timeZone:'Europe/Paris'}),'FR');
  assert.equal(detectViewerCountry({locale:'en',timeZone:'America/New_York'}),'US');
  assert.equal(detectViewerCountry({locale:'ja-JP',timeZone:'Asia/Tokyo'}),'XX');
  assert.equal(detectViewerCountry({locale:'fr-CA',timeZone:'Unknown/Zone'}),'CA');
  assert.equal(detectViewerCountry({locale:'en-US',timeZone:'Unknown/Zone'}),'US');
});

test('catalogue regions map to viewer countries', () => {
  assert.equal(countryForRegion('Québec'),'CA');
  assert.equal(countryForRegion('Canada'),'CA');
  assert.equal(countryForRegion('France'),'FR');
  assert.equal(countryForRegion('USA'),'US');
  assert.equal(countryForRegion('International'),'XX');
});

test('only foreign geo-limited channels are hidden', () => {
  const france = {region:'France',limited:true};
  const quebec = {region:'Québec',limited:true};
  const international = {region:'International',limited:true};
  const open = {region:'France',limited:false};
  assert.equal(isLikelyGeoBlocked(france,'CA'),true);
  assert.equal(isLikelyGeoBlocked(quebec,'CA'),false);
  assert.equal(isLikelyGeoBlocked(international,'CA'),false);
  assert.equal(isLikelyGeoBlocked(open,'CA'),false);
  assert.equal(isLikelyGeoBlocked(quebec,'FR'),true);
  assert.equal(isLikelyGeoBlocked(france,'FR'),false);
  assert.equal(isLikelyGeoBlocked(france,'XX'),false);
});
