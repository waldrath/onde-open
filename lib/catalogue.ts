/**
 * Backward-compatibility shim — do not add channel data here.
 *
 * The channels that used to be declared in this file now live in
 * `data/channels/base.json` (curated catalogue, see `lib/channels.ts`),
 * tagged with `source: "additional"`. This module only re-derives the
 * legacy `additionalChannels` export for existing imports.
 */

import { channels, type Channel } from './channels';

/** Channels formerly declared in this file, in catalogue order. */
export const additionalChannels: Channel[] = channels.filter(
  (channel) => channel.source === 'additional',
);
