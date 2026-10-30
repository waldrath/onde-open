/**
 * Backward-compatibility shim — do not add channel data here.
 *
 * The channels that used to be declared in this file now live in
 * `data/channels/base.json` (curated catalogue, see `lib/channels.ts`),
 * tagged with `source: "expanded"`. This module only re-derives the
 * legacy `expandedChannels` export for existing imports. New code should
 * prefer `expandedChannelIds` from `lib/channels.ts`, which avoids
 * materializing a second copy of this list.
 *
 * Historical note: the streams in this subset were free streams checked
 * on 2026-10-23. See docs/catalogue-deep-verification.json.
 */

import { channels, type Channel } from './channels';

/** Channels formerly declared in this file, in catalogue order. */
export const expandedChannels: Channel[] = channels.filter(
  (channel) => channel.source === 'expanded',
);
