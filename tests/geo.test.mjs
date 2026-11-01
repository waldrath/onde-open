import test from 'node:test';
import assert from 'node:assert/strict';
import {countryForRegion,detectViewerCountry,isLikelyGeoBlocked,viewerCountryLabel} from '../lib/geo.ts';

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
  assert.equal(detectViewerCountry({locale:'en',timeZone:'Europe/Stockholm'}),'SE');
  assert.equal(detectViewerCountry({locale:'fr',timeZone:'Africa/Douala'}),'CM');
  assert.equal(detectViewerCountry({locale:'fr-CM',timeZone:'Unknown/Zone'}),'CM');
  for (const [timeZone,country] of [['Europe/Brussels','BE'],['Europe/Zurich','CH'],['Europe/Luxembourg','LU'],['Africa/Dakar','SN'],['Africa/Abidjan','CI'],['Africa/Kinshasa','CD'],['Africa/Lubumbashi','CD'],['America/Port-au-Prince','HT']])
    assert.equal(detectViewerCountry({locale:'fr',timeZone}),country,timeZone);
  for (const [locale,country] of [['fr-BE','BE'],['nl-BE','BE'],['de-CH','CH'],['fr-LU','LU'],['fr-SN','SN'],['fr-CI','CI'],['fr-CD','CD'],['ht-HT','HT']])
    assert.equal(detectViewerCountry({locale,timeZone:'Unknown/Zone'}),country,locale);
  // Prototype keys are not countries.
  assert.equal(detectViewerCountry({locale:'constructor',timeZone:'toString'}),'XX');
});

test('catalogue regions map to viewer countries', () => {
  assert.equal(countryForRegion('Québec'),'CA');
  assert.equal(countryForRegion('Canada'),'CA');
  assert.equal(countryForRegion('France'),'FR');
  assert.equal(countryForRegion('USA'),'US');
  assert.equal(countryForRegion('Suède'),'SE');
  assert.equal(countryForRegion('Cameroun'),'CM');
  for (const [region,country] of [['Belgique','BE'],['Suisse','CH'],['Luxembourg','LU'],['Sénégal','SN'],["Côte d'Ivoire",'CI'],['RD Congo','CD'],['Haïti','HT']])
    assert.equal(countryForRegion(region),country,region);
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
  // Swedish and Cameroonian limited channels follow the same rule.
  const sweden = {region:'Suède',limited:true}, cameroon = {region:'Cameroun',limited:true};
  assert.equal(isLikelyGeoBlocked(sweden,'CA'),true);
  assert.equal(isLikelyGeoBlocked(sweden,'SE'),false);
  assert.equal(isLikelyGeoBlocked(cameroon,'FR'),true);
  assert.equal(isLikelyGeoBlocked(cameroon,'CM'),false);
  assert.equal(isLikelyGeoBlocked(france,'SE'),true);
  const belgium = {region:'Belgique',limited:true};
  assert.equal(isLikelyGeoBlocked(belgium,'BE'),false);
  assert.equal(isLikelyGeoBlocked(belgium,'FR'),true);
  assert.equal(isLikelyGeoBlocked(france,'BE'),true);
});

test('viewer countries are labelled with their catalogue region name', () => {
  assert.equal(viewerCountryLabel('US'),'États-Unis');
  assert.equal(viewerCountryLabel('CI'),"Côte d'Ivoire");
  assert.equal(viewerCountryLabel('HT'),'Haïti');
  assert.equal(viewerCountryLabel('XX'),'International');
});
