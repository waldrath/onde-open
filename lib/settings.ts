// Device settings: how Onde looks and behaves on this screen. They live in
// localStorage (not in the synced account preferences) because a phone and a
// TV-side laptop rarely want the same mini-player corner or motion level.
export const dockPositions=['right','left','top'] as const;
export type DockPosition=(typeof dockPositions)[number];
export const motionPreferences=['system','reduced'] as const;
export type MotionPreference=(typeof motionPreferences)[number];
export type DeviceSettings={dock:DockPosition;motion:MotionPreference;schedule:boolean};
export const defaultSettings:DeviceSettings={dock:'right',motion:'system',schedule:true};
export const SETTINGS_KEY='onde-settings';
// Written by earlier versions of the player before settings existed.
const LEGACY_SCHEDULE_KEY='onde-schedule-open';

const isOneOf=<T extends string>(values:readonly T[],value:unknown):value is T=>typeof value==='string'&&(values as readonly string[]).includes(value);

/** Validate stored settings field by field: unknown or malformed values fall back to the defaults. */
export function parseSettings(raw:unknown,legacySchedule:string|null=null):DeviceSettings{
 const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 return {
  dock:isOneOf(dockPositions,source.dock)?source.dock:defaultSettings.dock,
  motion:isOneOf(motionPreferences,source.motion)?source.motion:defaultSettings.motion,
  schedule:typeof source.schedule==='boolean'?source.schedule:legacySchedule==='0'?false:defaultSettings.schedule,
 };
}

export function readSettings(storage:Pick<Storage,'getItem'>):DeviceSettings{
 let raw:unknown=null;
 try{raw=JSON.parse(storage.getItem(SETTINGS_KEY)||'null');}catch{raw=null;}
 return parseSettings(raw,storage.getItem(LEGACY_SCHEDULE_KEY));
}

export function writeSettings(storage:Pick<Storage,'setItem'|'removeItem'>,settings:DeviceSettings){
 storage.setItem(SETTINGS_KEY,JSON.stringify(settings));
 storage.removeItem(LEGACY_SCHEDULE_KEY);
}
