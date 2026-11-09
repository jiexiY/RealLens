import {createClosureMonitor,CLOSURE_STALE_MS} from './closure-updates.js';
import {RTS_SOURCE,normalizeBusRoute,transitSnapshot,transitChanges,transitContent,transitSpeech} from './transit-model.js';
import {formatDate} from './journey-model.js';
import './transit.css';

const ROUTE_KEY='fieldlens.transit.route.v1';
export function mountTransitPanel({root,speak,stopSpeech,isSpeaking,canSpeak,onChanged=()=>{}}){
  const $=selector=>root.querySelector(selector);
  let snapshot=null,route='',state='active',lastChange='',storageAvailable=true;
  try{route=normalizeBusRoute(localStorage.getItem(ROUTE_KEY))||'';}catch{storageAvailable=false;}
  root.innerHTML=`<div class="transit-heading"><h2 id="transit-title">RTS rider alerts</h2><span class="badge neutral" id="transit-badge">Not checked yet</span></div>
    <div class="transit-controls"><button class="button button-primary" id="transit-listen" type="button">Listen to RTS updates</button><button class="button button-outline" id="transit-refresh" type="button">Check RTS now</button><a class="button button-outline" href="https://go-rts.com/rts-bus-prediction/" target="_blank" rel="noopener noreferrer">RTS arrival predictions <span class="sr-only">on the official RTS site (opens a new tab)</span><span aria-hidden="true">↗</span></a></div>
    <form id="transit-filter" class="transit-filter"><div><label for="transit-route">Filter by route number (optional)</label><input id="transit-route" type="text" inputmode="text" placeholder="For example, 11" maxlength="4" autocomplete="off" aria-describedby="transit-filter-error"></div><button class="button button-outline" type="submit">Apply route filter</button><button class="button button-outline" type="button" id="transit-all">Show all routes</button></form><p id="transit-filter-error" role="alert" hidden></p><p id="transit-filter-label" class="transit-filter-label"></p>
    <p class="micro">Published notices. Confirm travel dates with RTS.</p><p id="transit-status" class="transit-status" hidden></p><p id="transit-changes" class="transit-changes"></p><p id="transit-storage" hidden></p><div id="transit-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div><div id="transit-content">${transitContent(null)}</div>
    <details class="transit-help"><summary>How alerts work and update settings</summary><p>These are published RTS notices, not live bus positions or arrival estimates. Publication dates do not confirm that a notice applies to your trip.</p><p id="transit-route-help">The filter includes posts mentioning your route, plus general notices and posts whose route coverage is uncertain. Service-related posts may include all-route changes; other posts may be meetings or surveys.</p><p>Choose Listen to hear alerts, or ask <a href="/talk">RealLens by voice</a>: “bus alerts for route eleven”.</p><p>For nearby stop reminders, open Stop announcements and start only after boarding your selected bus. That page asks for location access.</p><label class="check-row transit-auto"><input id="transit-auto" type="checkbox" checked>Automatically check RTS posts</label><p>Checks run every 15 seconds while this page is visible and online. Published notices may be delayed. There are no background notifications.</p><p id="transit-freshness" class="transit-freshness"></p><a class="transit-source-link" href="${RTS_SOURCE}" target="_blank" rel="noopener noreferrer">All official RTS rider alerts <span class="sr-only">(opens a new tab)</span><span aria-hidden="true">↗</span></a></details>`;
  $('#transit-route').value=route;
  function announce(message){$('#transit-announcer').textContent=message;}
  function status(){
    const states={active:'Automatic RTS checks on · every 15 seconds.',checking:'Checking the RTS source…',retrying:'RTS check failed. Retrying with a longer interval, up to two minutes.',paused:'Automatic RTS checks paused. Check RTS now still works.',hidden:'Checks paused while this page is hidden.',offline:'Offline. RTS cannot be checked.'};
    $('#transit-status').textContent=states[state]||states.active;
    $('#transit-status').hidden=state==='active'||state==='hidden';
    $('#transit-refresh').setAttribute('aria-disabled',String(state==='checking'||state==='offline'));
    const stale=snapshot?.fetchedAt&&(snapshot.status!=='available'||Date.now()-Date.parse(snapshot.fetchedAt)>CLOSURE_STALE_MS);
    $('#transit-badge').textContent=!snapshot?.fetchedAt?'Unavailable':stale?'Stale · not current':'RTS source checked';
    $('#transit-badge').className=`badge ${snapshot?.fetchedAt&&!stale?'official':'unknown'}`;
    $('#transit-freshness').textContent=snapshot?.fetchedAt?`Last successful RTS source check: ${formatDate(snapshot.fetchedAt,{hour:'numeric',minute:'2-digit',second:'2-digit'})} Eastern. ${stale?'Earlier posts are stale, not current.':'This is a retrieval time, not when a post was published.'}`:'No successful RTS source check. Service status is unknown.';
    $('#transit-filter-label').textContent=route?`Route ${route} and general notices`:'All routes';
    $('#transit-changes').textContent=lastChange;
    $('#transit-storage').hidden=storageAvailable;$('#transit-storage').textContent='This browser could not save your route filter. It applies to this page only.';
  }
  function render(){
    const body=$('#transit-content'),focused=body.contains(document.activeElement),postId=focused?document.activeElement.closest('[data-transit-id]')?.dataset.transitId:null,href=focused?document.activeElement.getAttribute('href'):null;
    const openIds=new Set([...body.querySelectorAll('details[open]')].map(d=>d.dataset.transitId));
    body.innerHTML=transitContent(snapshot,route);
    for(const details of body.querySelectorAll('details'))if(openIds.has(details.dataset.transitId))details.open=true;
    if(focused){const target=href?[...body.querySelectorAll('a')].find(a=>a.getAttribute('href')===href):postId?[...body.querySelectorAll('details')].find(d=>d.dataset.transitId===postId)?.querySelector('summary'):null;(target||root).focus({preventScroll:true});}
  }
  function apply(incoming,{manual=false}={}){
    const previous=snapshot,next=transitSnapshot(previous,incoming),hadData=!!previous?.fetchedAt;
    const changed=JSON.stringify(previous?.notices)!==JSON.stringify(next.notices)||previous?.status!==next.status;
    let message='';
    if(hadData&&next.status==='available')message=transitChanges(previous,next,route);
    if(hadData&&previous.status!==next.status)message=(message?message+' ':'')+(next.status==='available'?'RTS source checks are available again.':'RTS could not be refreshed. Earlier posts are stale, not current.');
    snapshot=next;if(changed)render();
    if(message){lastChange=message;onChanged(message);announce(message);}
    else if(manual)announce(next.status==='available'?'RTS checked. No post changes for the selected filter.':'RTS could not be checked. Service status is unknown.');
    status();
  }
  const monitor=createClosureMonitor({endpoint:'/api/transit',onData:apply,onState:value=>{state=value;status();if(value==='offline'&&snapshot?.status==='available')apply({status:'unavailable'});}});
  function applyFilter(value){
    route=value;$('#transit-route').value=route;$('#transit-route').removeAttribute('aria-invalid');$('#transit-filter-error').hidden=true;lastChange='';
    try{localStorage.setItem(ROUTE_KEY,route);storageAvailable=true;}catch{storageAvailable=false;}
    onChanged('RTS route filter changed. Ask for bus alerts to hear the selected posts.');render();status();announce($('#transit-filter-label').textContent);
  }
  $('#transit-filter').addEventListener('submit',event=>{event.preventDefault();const value=$('#transit-route').value.trim(),normalized=normalizeBusRoute(value);if(value&&!normalized){$('#transit-filter-error').hidden=false;$('#transit-filter-error').textContent='Enter one route number, such as 11. Separate routes and ranges are not supported.';$('#transit-route').setAttribute('aria-invalid','true');return;}applyFilter(normalized||'');});
  $('#transit-all').addEventListener('click',()=>applyFilter(''));
  $('#transit-refresh').addEventListener('click',()=>void monitor.refresh());
  $('#transit-auto').addEventListener('change',event=>monitor.setEnabled(event.target.checked));
  $('#transit-listen').disabled=!canSpeak();
  $('#transit-listen').addEventListener('click',()=>{if(isSpeaking())stopSpeech();else speak(transitSpeech(snapshot,route));});
  const visibility=()=>monitor.setVisible(!document.hidden),online=()=>monitor.setOnline(true),offline=()=>monitor.setOnline(false),hide=()=>monitor.stop(),show=event=>{if(event.persisted){monitor.start();void monitor.refresh();}};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('online',online);window.addEventListener('offline',offline);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
  monitor.setVisible(!document.hidden);monitor.setOnline(navigator.onLine);monitor.start();void monitor.refresh();
  const freshnessTimer=setInterval(()=>{if(!document.hidden&&snapshot?.status==='available'&&Date.now()-Date.parse(snapshot.fetchedAt)>CLOSURE_STALE_MS)apply({status:'unavailable'});},5000);
  return {answer:requestedRoute=>transitSpeech(snapshot,requestedRoute||route),setSpeaking:active=>{$('#transit-listen').textContent=active?'Stop audio':'Listen to RTS updates';},destroy(){monitor.stop();clearInterval(freshnessTimer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',online);window.removeEventListener('offline',offline);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);}};
}
