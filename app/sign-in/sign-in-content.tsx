'use client';
import AuthForm from './auth-form';
import Logo from '../onde-logo';
import {useLocale} from '../locale-provider';

export default function SignInContent({ready}:{ready:boolean}){
 const {t,locale,setLocale}=useLocale();
 return <div className="access-card">
  <div className="access-card-glow" aria-hidden="true"/>
  <div className="access-locale" role="group" aria-label={t('Changer la langue')}>
   <button type="button" className={locale==='fr'?'is-active':''} aria-pressed={locale==='fr'} onClick={()=>setLocale('fr')}>FR</button>
   <button type="button" className={locale==='en'?'is-active':''} aria-pressed={locale==='en'} onClick={()=>setLocale('en')}>EN</button>
  </div>
  <Logo/>
  <span className="access-kicker">{t('VOTRE ESPACE, PARTOUT')}</span>
  <h1>{t('Votre Onde, partout.')}</h1>
  <p>{t('Un compte est optionnel. Il synchronise vos favoris et vos listes entre vos appareils.')}</p>
  {ready?<AuthForm/>:<div className="auth-setup" role="status"><h2>{t('Connexion en cours de configuration')}</h2><p>{t('Vous pouvez continuer à regarder et garder vos favoris sur cet appareil. La connexion sera disponible une fois la configuration terminée.')}</p></div>}
  <a className="secondary" href="/">{t('Continuer sans compte')}</a>
 </div>;
}
