import {parseVoiceIntent,draftStatus,VOICE_HELP} from './voice-model.js';
import {createElevenInput,canCapture} from './eleven-input.js';
import './voice-assistant.css';

export function mountVoiceAssistant({root,getDuration,onConfirm,onCancel=()=>{},getAnswer,speak,stopSpeech,isSpeechSupported,isSpeaking,setProvider=()=>{},host=window}){
  const $=s=>root.querySelector(s);
  const Recognition=host.SpeechRecognition||host.webkitSpeechRecognition;
  let pending=null,lastReply='',recognition=null,micToken=0,timer=null,version=0,busy=false,audioRequested=false,proposalAudio=false;
  let provider='browser',configured=false,providerChosen=false,answerVersion=0;
  root.innerHTML=`<div class="voice-intro"><h2 id="voice-title" class="sr-only">Speak or type a request</h2><div class="voice-actions"><button type="button" class="button button-primary" id="voice-talk" aria-describedby="voice-consent"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg><span>Talk · microphone off</span></button><button type="button" class="button button-outline" id="voice-stop">Stop audio / microphone</button></div></div>
    <p class="voice-consent" id="voice-consent">Tap Talk to record one request. Your voice service processes the audio. No background listening.</p>
    <details class="voice-settings"><summary>Voice settings and privacy</summary><p>Pause or press Finish speaking when you’re done. Confirm a proposed trip before checking conditions.</p><div class="voice-provider-row"><label for="voice-provider">Voice service</label><select id="voice-provider" aria-describedby="voice-privacy voice-support"><option value="browser">Browser voice · fallback</option><option value="elevenlabs" disabled>ElevenLabs · checking connection</option></select></div>
    <p id="voice-privacy" class="voice-small">Recordings last up to 20 seconds. ElevenLabs processes recordings and reply text; browser voice may also process audio remotely. <a href="/sources">Privacy details</a>.</p>
    </details>
    <p id="voice-support" class="voice-small"></p><p id="voice-status" class="voice-status" role="status" aria-live="polite" aria-atomic="true">Microphone off. Speak or type a request.</p>
    <div id="voice-conversation" class="voice-conversation" hidden><p class="voice-transcript" id="voice-transcript"></p><h3 id="voice-reply-title">RealLens reply</h3><div id="voice-reply" role="region" aria-labelledby="voice-reply-title" tabindex="0"></div><div class="voice-actions"><button type="button" class="button button-primary" id="voice-confirm" hidden>Confirm trip</button><button type="button" class="button button-outline" id="voice-cancel" hidden>Cancel proposed trip</button><button type="button" class="button button-outline" id="voice-read">Read reply aloud</button></div></div>
    <div class="voice-entry"><form id="voice-text-form"><label for="voice-text">Trip or briefing question</label><div class="voice-text-row"><input id="voice-text" name="request" type="text" maxlength="1000" autocomplete="off" placeholder="From Reitz to Marston tomorrow at 8 AM"><button class="button button-outline" type="submit">Send request</button></div></form><details class="voice-details app-help"><summary>What can I ask?</summary><p>Try “From Reitz Union to Marston tomorrow at eight A M.”</p><p class="voice-small">Choose Reitz Union, Marston, Smathers, Turlington, the Hub, or Newell. Include a day and time. Say “for 30 minutes” to set your walking time. Confirm to check conditions.</p><div class="voice-chips" role="group" aria-label="Briefing questions"><button type="button" data-question="help">What can I say?</button><button type="button" data-question="rain">Explain rain</button><button type="button" data-question="wind">Wind</button><button type="button" data-question="closures">Closures</button><button type="button" data-question="surroundings">Surroundings</button><button type="button" data-question="unknowns">What’s unknown?</button><button type="button" data-question="briefing">Read briefing</button></div><p class="voice-small">Ask about your briefing or bus alerts. You can type instead of using the microphone.</p></details></div>`;
  const settings=$('.voice-settings');root.append(settings);
  const entry=$('.voice-entry');$('.voice-conversation').before(entry);
  root.append($('.voice-details'));
  $('.voice-chips').insertAdjacentHTML('beforeend','<button type="button" data-question="bus alerts">Bus alerts</button>');
  $('.voice-details>.voice-small:last-child').textContent='Ask about your briefing, or say “bus alerts for route eleven”. For directions, use your usual navigation tools.';
  const cloud=createElevenInput({host,onStatus:status,onResult:text=>accept(text,true),onError:message=>show(message,{audio:true}),onRecording(active){$('#voice-talk').querySelector('span').textContent=active?'Finish speaking':'Talk · microphone off';$('#voice-talk').setAttribute('aria-pressed',String(active));}});
  const inputSupported=()=>provider==='elevenlabs'?canCapture(host):!!Recognition;
  function providerUI(){
    $('#voice-support').textContent=provider==='elevenlabs'?(canCapture(host)?'Pause or press Finish speaking when you’re done. Confirm your trip before checking conditions.':'Recording is unavailable. Choose Browser voice or type a request.'):(Recognition?'Speak one request. Confirm your trip before checking conditions.':'Voice input is unavailable. Type a request or use Plan a trip.');
    $('#voice-support').hidden=inputSupported();
    $('#voice-talk').disabled=busy||!inputSupported();$('#voice-read').disabled=!isSpeechSupported();
  }
  providerUI();
  $('#voice-provider').addEventListener('change',()=>{providerChosen=true;stop();provider=$('#voice-provider').value==='elevenlabs'&&configured?'elevenlabs':'browser';setProvider(provider);providerUI();status(`${provider==='elevenlabs'?'ElevenLabs':'Browser voice'} selected. Microphone off.`);});
  void (async()=>{try{const response=await host.fetch('/api/voice',{signal:AbortSignal.timeout(6000)});const data=await response.json();configured=response.ok&&data.configured===true;}catch{}
    const option=$('#voice-provider option[value="elevenlabs"]');option.disabled=!configured;option.textContent=configured?'ElevenLabs':'ElevenLabs · unavailable';
    if(configured&&!providerChosen){provider='elevenlabs';$('#voice-provider').value=provider;setProvider(provider);}providerUI();
  })();
  $('#voice-read').disabled=!isSpeechSupported();
  function status(text){$('#voice-status').textContent=text;}
  function show(message,{audio=false,spoken=message}={}){
    lastReply=spoken;$('#voice-conversation').hidden=false;$('#voice-reply').textContent=message;
    if(audio){status('Reply ready. Microphone off.');speak(spoken);}else{status('Reply ready. Microphone off; choose Read reply aloud if you want audio.');$('#voice-reply').focus({preventScroll:true});}
  }
  function updateDraft(){const result=pending?draftStatus(pending):null;$('#voice-confirm').hidden=!result?.ready;$('#voice-confirm').disabled=busy;$('#voice-talk').disabled=busy||!inputSupported();$('#voice-cancel').hidden=!pending;}
  function endMicrophone(){micToken++;cloud.cancel();clearTimeout(timer);timer=null;const old=recognition;recognition=null;if(old){old.onresult=null;old.onerror=null;old.onend=null;try{old.abort();}catch{}}$('#voice-talk').querySelector('span').textContent='Talk · microphone off';$('#voice-talk').setAttribute('aria-pressed','false');}
  function stop(){answerVersion++;endMicrophone();stopSpeech();audioRequested=false;status('Audio and microphone stopped. Tap Talk for another request.');}
  function invalidate(){version++;pending=null;busy=false;audioRequested=false;endMicrophone();stopSpeech();updateDraft();lastReply='';$('#voice-conversation').hidden=true;status('Journey details changed. Start a new voice request or use the form.');}
  async function confirm(audio){
    if(busy)return;
    if(!pending){show('There is no proposed trip to confirm. Describe a trip first.',{audio});return;}
    const result=draftStatus(pending);if(!result.ready){updateDraft();show(result.prompt,{audio});return;}
    endMicrophone();stopSpeech();busy=true;const thisVersion=++version;const draft={...pending,departure:result.departure};audioRequested=audio;updateDraft();status('Trip confirmed. Preparing the environmental briefing. Microphone off.');
    const response=await onConfirm(draft).catch(()=>({error:'The briefing could not be prepared. Try again using the form.'}));
    if(thisVersion!==version)return;
    busy=false;pending=null;updateDraft();
    if(response?.cancelled){status('Request cancelled because the journey changed.');return;}
    show(response?.error||response?.message||'Your briefing is ready.',{audio:audioRequested&&!document.hidden,spoken:response?.speech||response?.error||response?.message});
  }
  function accept(text,audio=false,confidence=1){
    const answerToken=++answerVersion;
    endMicrophone();stopSpeech();
    $('#voice-transcript').textContent=`${audio?'You said':'You typed'}: ${String(text).slice(0,1000)}`;
    const intent=parseVoiceIntent(text,{pending,duration:getDuration()});
    if(intent.kind==='command'&&intent.command==='stop'){stop();return;}
    if(busy&&intent.kind==='command'&&intent.command==='cancel'){version++;pending=null;busy=false;onCancel();stop();updateDraft();show('Voice follow-up cancelled. No further reply will be read. Describe a new trip when ready.');return;}
    if(busy){show('A briefing is being prepared. Wait for it, or type “cancel”.',{audio});return;}
    if(confidence>0&&confidence<.55&&!(intent.kind==='command'&&['stop','cancel'].includes(intent.command))){show('The speech service was uncertain. I did not act on that request. Please try again or type it.',{audio});return;}
    if(intent.kind==='trip'){pending=intent.draft;proposalAudio=audio;version++;updateDraft();show(intent.prompt,{audio});return;}
    if(intent.kind==='unknown'){pending=null;version++;updateDraft();show(intent.message,{audio});return;}
    const command=intent.command;
    if(command==='stop'){stop();return;}
    if(command==='cancel'){pending=null;version++;updateDraft();show('Proposed trip cancelled. No journey conditions were requested.',{audio});return;}
    if(command==='confirm'){void confirm(audio);return;}
    if(command==='repeat'){show(lastReply||VOICE_HELP,{audio});return;}
    if(command==='help'){show(VOICE_HELP,{audio});return;}
    // A pending proposal never silently becomes the context of a weather answer.
    if(pending){show('Please confirm or cancel the proposed trip before asking about its conditions.',{audio});return;}
    status(command==='transit'?'Checking published RTS information. Microphone off.':'Preparing reply. Microphone off.');
    Promise.resolve().then(()=>getAnswer(command,intent)).then(message=>{
      if(answerToken===answerVersion)show(message,{audio:!document.hidden&&(audio||command==='briefing'||intent.readAloud===true)});
    }).catch(()=>{if(answerToken===answerVersion)show('That information could not be checked. Try again.',{audio:audio&&!document.hidden});});
  }
  function start(){
    providerChosen=true;
    if(provider==='elevenlabs'){
      if(cloud.recording){void cloud.finish();return;}
      if(cloud.active){endMicrophone();status('Voice request cancelled. Microphone off.');return;}
      if(busy)return;endMicrophone();stopSpeech();void cloud.start();return;
    }
    if(recognition){endMicrophone();status('Microphone stopped. Tap Talk to try again.');return;}
    if(!Recognition||busy)return;
    stopSpeech();const token=++micToken;let gotResult=false;
    try{
      const engine=new Recognition();recognition=engine;engine.lang='en-US';engine.continuous=false;engine.interimResults=false;engine.maxAlternatives=1;
      $('#voice-talk').querySelector('span').textContent='Stop microphone';$('#voice-talk').setAttribute('aria-pressed','true');status('Requesting microphone access. Allow it in your browser to speak, or use the form.');
      engine.onstart=()=>{if(token===micToken)status('Listening for one request. Speak now. You can stop with the Stop button or Escape.');};
      engine.onresult=event=>{if(token!==micToken)return;const result=event.results[event.resultIndex??0];if(!result?.isFinal||!result[0]?.transcript)return;gotResult=true;accept(result[0].transcript,true,result[0].confidence);};
      engine.onerror=event=>{if(token!==micToken)return;endMicrophone();const errors={'not-allowed':'Microphone permission was denied. You can allow it in your browser settings, or type your request below.','service-not-allowed':'This browser has blocked speech recognition. Use the typed request or journey form.','audio-capture':'No microphone was available. Check your device, or use the typed request.','network':'The speech service could not connect. Try again later, or type the same request.','no-speech':'No speech was detected. Tap Talk to try again, or type your request.','language-not-supported':'This browser could not recognize English. Use the typed request or journey form.'};show(errors[event.error]||'Speech recognition stopped. You can try again or use the form.',{audio:true});};
      engine.onend=()=>{if(token!==micToken)return;endMicrophone();if(!gotResult)show('No complete request was received. Tap Talk to try again or type your request.',{audio:true});};
      engine.start();timer=setTimeout(()=>{if(token!==micToken)return;endMicrophone();show('The microphone timed out and is now off. Tap Talk for another attempt, or type your request.',{audio:true});},20000);
    }catch{endMicrophone();show('Speech input could not start in this browser. Use the typed request or journey form.',{audio:true});}
  }
  $('#voice-talk').addEventListener('click',start);$('#voice-stop').addEventListener('click',stop);
  $('#voice-confirm').addEventListener('click',()=>confirm(proposalAudio));
  $('#voice-cancel').addEventListener('click',()=>accept('cancel'));
  $('#voice-read').addEventListener('click',()=>{endMicrophone();if(isSpeaking())stopSpeech();else speak(lastReply||VOICE_HELP);});
  $('#voice-text-form').addEventListener('submit',event=>{event.preventDefault();accept($('#voice-text').value);$('#voice-text').value='';});
  root.querySelectorAll('[data-question]').forEach(button=>button.addEventListener('click',()=>accept(button.dataset.question)));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(recognition||cloud.active||isSpeaking()))stop();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});host.addEventListener('pagehide',stop);
  return {invalidate,stop,speechError:status,conditionsChanged(message){if(pending||busy)return;lastReply='';$('#voice-conversation').hidden=true;status(message);},updateSpeechState(active){$('#voice-read').textContent=active?'Stop audio':'Read reply aloud';},pauseMicrophone:endMicrophone};
}
