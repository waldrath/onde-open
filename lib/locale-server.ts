import {cookies} from 'next/headers';
import {isLocale,type Locale} from './i18n';

export async function getInitialLocale():Promise<Locale>{
 const store=await cookies();
 const value=store.get('onde-locale')?.value;
 return isLocale(value)?value:'fr';
}
