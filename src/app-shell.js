import {PREFERENCES_KEY,readingPreferences} from './home-model.js';
import {readJson,writeJson} from './trip-state.js';
import {createManagedSpeech,stopAllSpeech} from './narration.js';
import {mountPageReader} from './page-reader.js';
import './journey.css';
import './journey-reading.css';
import './app-pages.css';

// Storage can be denied by the browser. No account or server persistence is used.
export const session={getItem:key=>window.sessionStorage.getItem(key),setItem:(key,value)=>window.sessionStorage.setItem(key,value),removeItem:key=>window.sessionStorage.removeItem(key)};
export const local={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
export let prefs=readingPreferences(readJson(local,PREFERENCES_KEY));
export function applyPreferences(value=prefs){
  prefs=readingPreferences(value);
  document.documentElement.dataset.contrast=prefs.contrast?'high':'normal';
  document.documentElement.dataset.reading=prefs.large?'large':'normal';
  document.documentElement.dataset.detail=prefs.detail;
}
export function savePreferences(value){applyPreferences(value);return writeJson(local,PREFERENCES_KEY,prefs);}
export function announce(message){const node=document.querySelector('#announcer');if(node)node.textContent=message;}
export function createPageSpeech({onState=()=>{},onError=announce}={}){
  const player=createManagedSpeech({onState,onError,onNotice:onError});
  const destroy=player.destroy;
  const stop=()=>stopAllSpeech();
  const hidden=()=>{if(document.hidden)stop();},escape=event=>{if(event.key==='Escape')stop();};
  window.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',hidden);
  document.addEventListener('keydown',escape);
  player.destroy=()=>{destroy();window.removeEventListener('pagehide',stop);document.removeEventListener('visibilitychange',hidden);document.removeEventListener('keydown',escape);};
  return player;
}
applyPreferences();
const main=document.querySelector('main'),toolbar=document.querySelector('.narration-actions');
if(main&&toolbar){
  let reader;
  const player=createPageSpeech({onState:active=>reader?.sync(active)});
  reader=mountPageReader({main,toolbar,player,rate:()=>prefs.rate,announce});
}
