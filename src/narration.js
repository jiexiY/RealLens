import {createHybridSpeechPlayer} from './eleven-output.js';
import './narration.css';

export const NARRATION_KEY='reallens.narration.v1';
let enabled=true,remembered=true,introTimer=null,toolbar,notice,retry,toggle,introduced=false;
try{enabled=localStorage.getItem(NARRATION_KEY)!=='off';}catch{remembered=false;}
const players=new Set();
export const voiceEnabled=()=>enabled;
const status=message=>{if(notice)notice.textContent=message;};
function sync(){
  if(!toggle)return;
  toggle.textContent=enabled?'Voice on · turn off':'Voice off · turn on';
  toggle.setAttribute('aria-label',enabled?'Turn voice off':'Turn voice on');
  toggle.setAttribute('aria-pressed',String(enabled));
  retry.hidden=!enabled||![...players].some(p=>p.waiting||p.failed);
}
export function stopAllSpeech(){
  clearTimeout(introTimer);introTimer=null;
  for(const player of players)player.cancel();sync();
}
export function setVoiceEnabled(value){
  enabled=!!value;stopAllSpeech();
  try{localStorage.setItem(NARRATION_KEY,enabled?'on':'off');}catch{remembered=false;}
  sync();status((enabled?'Voice on.':'Voice off.')+(remembered?'':' This browser could not save your choice.'));
  window.dispatchEvent(new CustomEvent('reallens:voice-change',{detail:{enabled}}));
}
// All app speech shares one cancellation/mute boundary. A late response can
// never restart a cancelled player; no microphone permission is requested here.
export function createManagedSpeech({onState=()=>{},onError=status,onNotice=onError}={}){
  let failed=false,lastText='',lastRate=1,expiry=null,deadline=0;
  const player=createHybridSpeechPlayer({onState:active=>{onState(active);sync();},onError:message=>{failed=true;onError(message);status('Speech could not play. Choose Play voice to retry, or use your screen reader.');sync();},onNotice:message=>{status(message);onNotice(message);},onBlocked:message=>{status(message);sync();}});
  const original=player.speak,cancel=player.cancel;
  player.cancel=()=>{clearTimeout(expiry);expiry=null;failed=false;cancel();};
  Object.defineProperty(player,'failed',{get:()=>failed});
  player.speak=(text,rate=1,{expiresMs}={})=>{
    if(!enabled){status('Voice is off. Choose Turn voice on to hear speech.');return false;}
    stopAllSpeech();lastText=text;lastRate=rate;deadline=expiresMs?Date.now()+expiresMs:0;const started=original(text,rate);
    if(expiresMs)expiry=setTimeout(()=>{const pending=player.active||player.waiting||failed;player.cancel();sync();if(pending)status('The location reminder expired before speech finished. Read the current journey status.');},expiresMs);
    return started;
  };
  player.retry=()=>{
    if(deadline&&Date.now()>=deadline){player.cancel();status('That location reminder is no longer current. Read the current journey status.');sync();return false;}
    return player.waiting?player.resume():player.speak(lastText,lastRate,deadline?{expiresMs:deadline-Date.now()}:{});
  };
  player.setProvider('elevenlabs');players.add(player);
  player.destroy=()=>{player.cancel();players.delete(player);sync();};
  return player;
}
const summaries={
  '/':'Welcome to RealLens. Environmental context for your journey. Choose Try it out to open the app. Voice is on. The Turn voice off button is at the top.',
  '/project':'Welcome to RealLens. Choose Try it out to open the app. Voice is on. You can turn it off at the top.',
  '/demo':'RealLens.',
  '/welcome':'RealLens home. Four choices: Plan a trip. Talk to RealLens. Check conditions. Bus alerts, including stop announcements. Voice is on. Turn it off with the button at the top. The microphone is off.',
  '/plan':'Plan a trip. Choose your starting place, destination, departure time and walking duration. Then choose Check conditions. This is environmental preparation, not navigation.',
  '/talk':'Talk to RealLens. Choose Talk to use the microphone for one request, or type a request. Confirm a proposed trip before conditions are checked. The microphone is off.',
  '/conditions':'Check conditions. Review your trip, then choose Check conditions. After the briefing loads, choose Listen to briefing. Unknown conditions stay unknown.',
  '/bus':'Bus alerts. Choose Stop announcements for your bus journey, or review published RTS rider alerts below. These alerts are not live bus positions or arrival times.',
  '/ride':'Bus stop announcements. Choose your route, direction, boarding stop and destination. Then choose Start journey to allow location access. Keep this page visible. Announcements estimate your phone’s proximity, not bus arrivals. Confirm stops with the bus operator.',
  '/settings':'Reading preferences. Adjust text size, contrast, detail and speech speed. The voice on or off button is at the top.',
  '/sources':'Sources and privacy. Open a section for details about your data, voice, or journey information.'
};
const pathname=location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/';
const summary=summaries[pathname]||'RealLens. Voice controls are at the top.';
toolbar=document.createElement('div');toolbar.className='narration-toolbar';toolbar.setAttribute('role','region');toolbar.setAttribute('aria-label','Voice controls');
toolbar.innerHTML='<div class="narration-actions"><button type="button" id="narration-toggle"></button><button type="button" id="narration-retry" hidden>Play voice</button></div><div id="narration-status" class="narration-status" role="status" aria-live="polite"></div>';
document.body.prepend(toolbar);
toggle=toolbar.querySelector('#narration-toggle');retry=toolbar.querySelector('#narration-retry');notice=toolbar.querySelector('#narration-status');
const narrator=createManagedSpeech();
const rate=()=>{try{const value=JSON.parse(localStorage.getItem('fieldlens.journey.preferences.v1'));return [.85,1,1.15].includes(value?.rate)?value.rate:1;}catch{return 1;}};
export const narrate=text=>narrator.speak(text,rate());
toggle.addEventListener('click',()=>{setVoiceEnabled(!enabled);if(enabled)narrate(summary);});
retry.addEventListener('click',()=>{const pending=[...players].find(p=>p.waiting||p.failed);status('');if(pending)pending.retry();else narrate(summary);sync();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){stopAllSpeech();status('Speech stopped. Voice remains '+(enabled?'on.':'off.'));}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAllSpeech();else startIntroduction();});
window.addEventListener('pagehide',stopAllSpeech);
window.addEventListener('storage',event=>{if(event.key===NARRATION_KEY){enabled=event.newValue!=='off';stopAllSpeech();sync();window.dispatchEvent(new CustomEvent('reallens:voice-change',{detail:{enabled}}));}});
// Cancel an outstanding page introduction when someone starts interacting.
document.addEventListener('click',event=>{if(!toolbar.contains(event.target)){clearTimeout(introTimer);introTimer=null;narrator.cancel();sync();}},true);
sync();
function startIntroduction(){if(enabled&&!document.hidden&&!introduced){introduced=true;introTimer=setTimeout(()=>narrate(summary),150);}}
startIntroduction();
