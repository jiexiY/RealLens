import {mergeClosureSnapshot,compareClosureNotices,CLOSURE_STALE_MS} from './closure-updates.js';
import {escapeHtml as esc} from './notebook.js';
import {formatDate} from './journey-model.js';

export const RTS_SOURCE='https://go-rts.com/category/rider-alerts/';
export function normalizeBusRoute(value){
  const route=String(value??'').trim();
  return /^\d{1,3}[a-z]?$/i.test(route)?route.replace(/^0+(?=\d)/,'').toUpperCase():null;
}
export function transitSnapshot(previous,incoming,now=Date.now()){
  const valid=Array.isArray(incoming?.notices)&&incoming.notices.length<=500&&incoming.notices.every(n=>n&&/^\d+$/.test(n.id)&&typeof n.title==='string'&&typeof n.body==='string'&&Array.isArray(n.routes)&&n.routes.every(r=>typeof r==='string'&&normalizeBusRoute(r)===r));
  return mergeClosureSnapshot(previous,valid?incoming:{status:'unavailable'},now);
}
export function transitGroups(snapshot,route=''){
  const notices=snapshot?.notices||[];
  const unknown=notices.filter(n=>!n.routes?.length||(route&&n.routeUncertain&&!n.routes.includes(route)));
  return {specific:notices.filter(n=>n.routes?.length&&(!route||n.routes.includes(route))),network:unknown.filter(n=>n.serviceRelated),general:unknown.filter(n=>!n.serviceRelated)};
}
export function transitChanges(before,after,route=''){
  const selected=value=>{const groups=transitGroups(value,route);return [...groups.specific,...groups.network,...groups.general];};
  const delta=compareClosureNotices(selected(before),selected(after)),parts=[];
  for(const [key,label] of [['added','new'],['updated','updated'],['removed','no longer listed']])if(delta[key].length)parts.push(`${delta[key].length} ${label}: ${delta[key].slice(0,2).map(n=>n.title).join('; ')}${delta[key].length>2?'; and more':''}`);
  return parts.length?`RTS post changes${route?` for your Route ${route} filter`:''}. ${parts.join('. ')}.${delta.removed.length?' A removed post is not confirmation that normal service has resumed.':''}`:'';
}
function date(value){return value&&Number.isFinite(Date.parse(value))?formatDate(value,{hour:'numeric',minute:'2-digit'}):'Unknown';}
function publicationDate(value){return value&&Number.isFinite(Date.parse(value))?formatDate(value):'Unknown';}
function noticeHtml(notice){
  const source=`https://go-rts.com/?p=${/^\d+$/.test(notice.id)?notice.id:''}`;
  // Both source fields and text remain untrusted. Use the fixed WordPress post-ID permalink.
  return `<article class="transit-post"><div class="transit-post-heading"><h4>${esc(notice.title)}</h4><span class="badge neutral">${notice.routes?.length?`Mentions ${notice.routes.map(r=>'Route '+esc(r)).join(', ')}`:'Other RTS information'}</span></div><p class="transit-dates">Published ${esc(publicationDate(notice.postedAt))}</p><p>${esc((notice.body||'No readable body text returned. Open the RTS post for the original.').slice(0,250))}${notice.body?.length>250?'…':''}</p><details data-transit-id="${esc(notice.id)}"><summary>Details<span class="sr-only">: ${esc(notice.title)}</span></summary><p class="transit-dates">Updated ${esc(date(notice.modifiedAt))} Eastern</p><p class="transit-body">${esc(notice.body||'No readable body text returned.')}</p>${notice.media?'<p>RTS includes image or embedded content. It is not interpreted here; the text may not contain every detail.</p>':''}${notice.truncated?'<p>This is a shortened text extract. Open the original RTS post for the complete notice.</p>':''}<p>The publication date is not an effective-service date. RealLens has not confirmed whether this post still applies to your trip.</p><a class="transit-source-link" href="${source}" target="_blank" rel="noopener noreferrer">Open original RTS post<span class="sr-only">: ${esc(notice.title)} (opens a new tab)</span><span aria-hidden="true">↗</span></a></details></article>`;
}
export function transitContent(snapshot,route=''){
  if(!snapshot?.fetchedAt)return '<div class="transit-empty"><h3>RTS posts aren’t available yet.</h3><p>Try Check RTS now or RTS arrival predictions. Service status is unknown.</p></div>';
  const {specific,network,general}=transitGroups(snapshot,route);
  return `<div class="transit-route-posts"><h3>${route?`Route ${esc(route)} notices`:'Route notices'}</h3>${specific.length?specific.map(noticeHtml).join(''):`<p>No returned post explicitly mentions ${route?`Route ${esc(route)}`:'a specific route'}. This is not an all-clear${route?' or confirmation that this route number exists':''}.</p>`}</div>${network.length?`<div class="transit-route-posts"><h3>Other service notices</h3>${network.map(noticeHtml).join('')}</div>`:''}<details class="transit-general" data-transit-id="general"><summary>Other RTS posts (${general.length})</summary><p>Includes general information such as meetings or surveys, plus posts whose route coverage cannot be fully determined. These are not all service disruptions.</p>${general.map(noticeHtml).join('')||'<p>No other posts returned.</p>'}</details>`;
}
export function transitSpeech(snapshot,route='',now=Date.now()){
  if(!snapshot?.fetchedAt)return 'RTS rider alerts are unavailable. I cannot confirm current bus service. Open the official RTS rider-alert page or try Check RTS now.';
  const stale=snapshot.status!=='available'||now-Date.parse(snapshot.fetchedAt)>CLOSURE_STALE_MS;
  const {specific,network,general}=transitGroups(snapshot,route);
  const lead=`RTS published rider information${route?` for the Route ${route} filter`:''}. ${stale?'The feed is stale, not current. ':''}Last successful source check: ${date(snapshot.fetchedAt)} Eastern. `;
  const posts=specific.slice(0,4).map(n=>`${n.title}. Published ${date(n.postedAt)}. RTS text: ${n.body.slice(0,700)}${n.body.length>700?' The full text is in the post.':''}${n.media?' Image or embedded information is not interpreted here.':''}`).join(' ');
  const other=network.slice(0,2).map(n=>`Service-related post with unknown route relevance: ${n.title}. Published ${date(n.postedAt)}. ${n.body.slice(0,450)}${n.body.length>450?' More in the original post.':''}`).join(' ');
  return lead+(posts||`No returned post explicitly mentions ${route?`Route ${route}`:'a route'}. This does not mean normal service${route?' or verify that the route exists':''}.`)+` ${other} ${specific.length>4?`${specific.length-4} more route posts are available in the text. `:''}${network.length>2?`${network.length-2} more service-related posts are available in the text. `:''}${general.length} other or route-uncertain RTS posts are available in the text${general.length?`: ${general.slice(0,3).map(n=>n.title).join('; ')}`:''}. A publication date is not an effective-service date. This feed does not provide live bus positions or arrival estimates, and I have not confirmed whether these posts still apply to your trip.`;
}
