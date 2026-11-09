import {prefs,createPageSpeech} from './app-shell.js';
import {mountTransitPanel} from './transit-panel.js';
document.querySelector('.page-heading').insertAdjacentHTML('beforeend','<div class="page-actions"><a class="button button-primary" href="/ride">Stop announcements </a></div>');
let speaking=false,panel=null;
const player=createPageSpeech({onState(active){speaking=active;panel?.setSpeaking(active);}});
panel=mountTransitPanel({root:document.getElementById('transit'),speak:text=>player.speak(text,prefs.rate),stopSpeech:()=>player.cancel(),isSpeaking:()=>speaking,canSpeak:()=>player.supported,onChanged:()=>player.cancel()});
