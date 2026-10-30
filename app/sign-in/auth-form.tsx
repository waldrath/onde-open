'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {authClient} from '../../lib/auth-client';
import {useLocale} from '../locale-provider';
type Mode='sign-in'|'sign-up'|'verify'|'forgot'|'reset';
const labels:Record<Mode,string>={'sign-in':'Se connecter','sign-up':'Créer mon compte',verify:'Valider mon courriel',forgot:'Envoyer le lien',reset:'Enregistrer le mot de passe'};
type AuthError={code?:string;message?:string;status?:number}|null;
type Translate=(fr:string,vars?:Record<string,string|number>)=>string;
function message(error:AuthError,t:Translate){
 if(error?.code==='PRIVATE_ACCOUNT')return t('Ce compte ne peut pas accéder à cet espace privé.');
 if(error?.code==='AUTH_NOT_CONFIGURED'||error?.status===503)return t('La connexion est en cours de configuration. Vos favoris restent conservés.');
 if(error?.status===429)return t('Trop de tentatives. Patientez un moment avant de réessayer.');
 if(error?.code==='INVALID_EMAIL_OR_PASSWORD'||error?.code==='INVALID_PASSWORD')return t('Courriel ou mot de passe incorrect.');
 if(error?.code==='OTP_EXPIRED'||error?.code==='INVALID_OTP')return t('Ce code est invalide ou expiré. Demandez un nouveau code.');
 return t('La connexion n’a pas pu être terminée. Vérifiez vos informations et réessayez.');
}
export default function AuthForm(){
 const {t}=useLocale();
 const [mode,setMode]=useState<Mode>('sign-in'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[code,setCode]=useState(''),[token,setToken]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{const q=new URLSearchParams(window.location.search);const value=q.get('token');if(value){setToken(value);setMode('reset');window.history.replaceState(null,'','/sign-in');}if(q.get('error'))setError(t('Ce lien est invalide ou expiré. Demandez un nouveau lien.'));},[]);
 function switchMode(next:Mode){setShowPassword(false);setMode(next);setError('');setNotice('');setPassword('');setCode('');}
 async function requestCode(){const r=await authClient.emailOtp.sendVerificationOtp({email,type:'email-verification'});if(r.error){setError(message(r.error,t));return false;}setNotice(t('Un code de vérification a été envoyé à votre courriel.'));return true;}
 async function sendCode(){setBusy(true);setError('');setNotice('');try{await requestCode();}catch{setError(t('Envoi indisponible. Réessayez dans un moment.'));}finally{setBusy(false);}}
 async function submit(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(mode==='sign-in'){
    const r=await authClient.signIn.email({email,password});
    if(r.error){if(r.error.code==='EMAIL_NOT_VERIFIED'){setMode('verify');setPassword('');await requestCode();return;}setError(message(r.error,t));return;}
    if(r.data?.user&&!r.data.user.emailVerified){setMode('verify');setPassword('');await requestCode();return;}
    window.location.assign('/');
   }else if(mode==='sign-up'){
    const r=await authClient.signUp.email({email,password,name:name.trim()||t('Mon compte Onde')});
    if(r.error){setError(message(r.error,t));return;}
    setPassword('');setMode('verify');await requestCode();
   }else if(mode==='verify'){
    const r=await authClient.emailOtp.verifyEmail({email,otp:code});
    if(r.error){setError(message(r.error,t));return;}
    setCode('');setMode('sign-in');setNotice(t('Votre courriel est validé. Connectez-vous pour retrouver votre Onde.'));
    const session=await authClient.getSession();if(session.data?.user?.emailVerified)window.location.assign('/');
   }else if(mode==='forgot'){
    const r=await authClient.requestPasswordReset({email,redirectTo:window.location.origin+'/sign-in'});
    if(r.error){setError(message(r.error,t));return;}
    setNotice(t('Si ce compte existe, un lien de réinitialisation a été envoyé à votre courriel.'));
   }else{
    const r=await authClient.resetPassword({token,newPassword:password});
    if(r.error){setError(message(r.error,t));return;}
    setToken('');setPassword('');setMode('sign-in');setNotice(t('Mot de passe enregistré. Vous pouvez vous connecter.'));
   }
  }catch{setError(t('Connexion momentanément indisponible. Réessayez dans un moment.'));}finally{setBusy(false);}
 }
 const title=mode==='verify'?t('Validez votre courriel'):mode==='forgot'?t('Mot de passe oublié'):mode==='reset'?t('Nouveau mot de passe'):mode==='sign-up'?t('Créer votre compte Onde'):t('Connexion à votre compte');
 return <div className="auth-form-wrap"><h2>{title}</h2><form className="auth-form" onSubmit={submit}>
  {mode==='sign-up'&&<label>{t('Votre prénom')}<input autoComplete="given-name" value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></label>}
  {mode!=='reset'&&<label>{t('Courriel')}<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required readOnly={mode==='verify'}/></label>}
  {(mode==='sign-in'||mode==='sign-up'||mode==='reset')&&<div className="auth-password"><label htmlFor="account-password">{t('Mot de passe')}</label><input id="account-password" type={showPassword?'text':'password'} autoComplete={mode==='sign-in'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={mode==='sign-in'?1:8} maxLength={128} required/><button className="password-toggle" type="button" aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?t('Masquer le mot de passe'):t('Afficher le mot de passe')}</button>{mode!=='sign-in'&&<small>{t('Au moins 8 caractères.')}</small>}</div>}
  {mode==='verify'&&<label>{t('Code reçu par courriel')}<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} minLength={4} maxLength={10} required autoFocus/></label>}
  {error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p className="auth-notice" role="status">{notice}</p>}
  <button className="primary" type="submit" disabled={busy}>{busy?t('Un instant…'):t(labels[mode])}</button>
 </form><div className="auth-links">{mode==='sign-in'?<><button type="button" onClick={()=>switchMode('sign-up')} disabled={busy}>{t('Créer mon compte Onde')}</button><button type="button" onClick={()=>switchMode('forgot')} disabled={busy}>{t('Mot de passe oublié ?')}</button></>:<button type="button" onClick={()=>switchMode('sign-in')} disabled={busy}>{t('Revenir à la connexion')}</button>}{mode==='verify'&&<button type="button" onClick={sendCode} disabled={busy}>{t('Recevoir un nouveau code')}</button>}</div></div>;
}
