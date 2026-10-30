'use client';
import {useSyncExternalStore} from 'react';
import {castManager} from '../lib/casting';
export function useCasting(){return useSyncExternalStore(castManager.subscribe,castManager.getSnapshot,castManager.getServerSnapshot);}
