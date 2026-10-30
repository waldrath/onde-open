import {cookies} from 'next/headers';
import {isTheme,type Theme} from './themes';

// The theme lives in localStorage for instant client switching, but a cookie
// mirror lets the server render the right skin on the sign-in page (and avoids
// a dark flash when the account page opens).
export async function getInitialTheme():Promise<Theme>{
 const store=await cookies();
 const value=store.get('onde-theme')?.value;
 return isTheme(value)?value:'dark';
}
