import {escapeHtml as esc} from './notebook.js';
import {formatDate} from './journey-model.js';
import {CLOSURE_STALE_MS} from './closure-updates.js';
export function closureSummary(c){
  if(c.status==='stale')return 'Closure updates are stale. Earlier notices are shown, but current conditions could not be checked.';
  if(c.status!=='available')return 'Campus closures could not be checked. Unknown does not mean clear.';
  if(c.geometryStatus==='unavailable')return 'UF notices are available, but the closure map could not be checked. Their relevance to this path is unknown.';
  return c.matches.length?`${c.matches.length} official closure notice${c.matches.length===1?'':'s'} overlap${c.matches.length===1?'s':''} the mapped study path. Review before traveling.`:'No overlap was found in the available closure polygons. This is not an all clear or proof of an unobstructed route.';
}
export function closureSpeech(b,now=new Date()){
  const feed=b.environment?.closures||{};
  const c=feed.fetchedAt&&now-Date.parse(feed.fetchedAt)>CLOSURE_STALE_MS?{...b.closures,status:'stale'}:b.closures;
  const notices=c.matches.map(n=>`${n.title}. ${n.start||'Unknown start date'} to ${n.end||'unknown end date'}. ${n.description||n.location||'Review the official notice.'}${n.alternative?` UF travel note: ${n.alternative}.`:''}${n.accessibleAlternative?` UF accessibility note: ${n.accessibleAlternative}. This has not been independently checked by RealLens.`:''}`).join(' ');
  return `${closureSummary(c)} ${c.status==='stale'?'Earlier, unverified notices: ':''}${notices} ${c.unmapped||0} other date-relevant notices have no usable matched polygon and cannot be ruled out. ${feed?.fetchedAt?`Last successful source check ${formatDate(feed.fetchedAt,{hour:'numeric',minute:'2-digit'})} Eastern.`:'No successful source check.'} Published notices may lag conditions on the ground. Review the official source before travel.`;
}
function notice(n,unmapped=false){
  const source=/^https:\/\/campusclosures\.ufl\.edu\/post\/\d+$/.test(n.source)?n.source:'https://campusclosures.ufl.edu/closure-home';
  return `<article class="closure-item" data-notice="${esc(n.id)}"><h4>${esc(n.title)}</h4><div class="closure-tags">${n.urgent?'<span class="badge unknown">UF urgent notice</span>':''}${n.accessibilityAffected?'<span class="badge unknown">UF accessibility flag</span>':''}${(n.types||[]).map(t=>`<span class="badge neutral">${esc(t)}</span>`).join('')}</div><p>${esc(n.start||'Start date unknown')} to ${esc(n.end||'End date unknown')}${n.dateWarning?' · UF dates are invalid or inconsistent; relevance is uncertain.':''}</p>${unmapped?'<p><strong>Location relevance unknown: no usable matched polygon.</strong></p>':''}${n.location?`<p><strong>UF location:</strong> ${esc(n.location)}</p>`:''}<p>${esc(n.description||'Read the official notice for details.')}</p>${n.accessibleAlternative?`<p><strong>UF accessibility note:</strong> ${esc(n.accessibleAlternative)}</p>`:'<p>UF has not provided an accessibility alternative in this notice.</p>'}${n.alternative?`<details data-expand="${esc(n.id)}"><summary>Travel alternative described by UF</summary><p>${esc(n.alternative)}</p></details>`:''}<p class="micro">UF notes are quoted source information, not independently verified detours or guarantees of access.</p><p><a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Review the official notice <span class="sr-only">(opens a new tab)</span></a> · Notice updated ${esc(n.updated||'date not supplied')}.</p></article>`;
}
export function closureContent(c){
  return `<p>${esc(closureSummary(c))}</p>${c.matches.map(n=>notice(n)).join('')}${c.unmapped?`<details data-expand="unmapped"><summary>${c.unmapped} date-relevant notices with unknown path relevance</summary><p>These notices have no usable matched polygon. They are not confirmed to affect this journey and cannot be ruled out.</p>${(c.unmappedNotices||[]).map(n=>notice(n,true)).join('')}</details>`:''}<p class="micro">Only UF-published notices are used. No notice is not evidence of no construction, pavement damage, puddles, or barriers.</p>`;
}
