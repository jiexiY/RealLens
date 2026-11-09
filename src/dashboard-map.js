import {escapeHtml as esc} from './notebook.js';

// A local, dated OSM overview. No map tiles, geolocation, or implied live tracking.
export function dashboardMap(campus,places,{brief=null,zoom=1}={}){
  if(!campus?.ways?.length||!places?.length)return '<p class="map-loading">Campus map unavailable. The text planner remains available.</p>';
  const points=brief?[...brief.route.coordinates,brief.origin.coord,brief.destination.coord]:places.map(p=>p.coord);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
  const cos=Math.cos(center[1]*Math.PI/180),width=900,height=720,pad=82;
  const scale=Math.min((width-pad*2)/Math.max((Math.max(...xs)-Math.min(...xs))*cos,.004),(height-pad*2)/Math.max(Math.max(...ys)-Math.min(...ys),.004));
  const project=p=>[width/2+(p[0]-center[0])*cos*scale,height/2-(p[1]-center[1])*scale];
  const coords=ps=>ps.map(p=>project(p).map(n=>n.toFixed(2)).join(',')).join(' ');
  const visible=campus.ways.filter(w=>w.geometry.some(p=>{const [x,y]=project(p);return x>=-50&&x<=width+50&&y>=-50&&y<=height+50;}));
  const extent=[width*(1-1/zoom)/2,height*(1-1/zoom)/2,width/zoom,height/zoom];
  const markers=brief?[brief.origin,brief.destination]:places;
  const names=new Set();
  const roads=visible.filter(w=>w.tags.highway&&!['footway','path','steps','pedestrian','cycleway'].includes(w.tags.highway));
  return `<svg class="dashboard-map-svg" viewBox="${extent.join(' ')}" role="img" aria-label="${brief?`Mapped study line from ${esc(brief.origin.name)} to ${esc(brief.destination.name)}. Not an accessible-route recommendation.`:'Dated OpenStreetMap context for the six campus places. No journey is drawn until a briefing is prepared.'}">
    <rect x="-900" y="-720" width="2700" height="2160" fill="var(--map-ground)"/>
    ${visible.filter(w=>!w.tags.highway&&(w.tags.building||w.tags.natural||w.tags.landuse||w.tags.leisure)).map(w=>`<polygon points="${coords(w.geometry)}" fill="${w.tags.building?'var(--map-building)':w.tags.natural==='water'?'var(--map-water)':'var(--map-green)'}" stroke="var(--map-line)" stroke-width="1.2"/>`).join('')}
    ${visible.filter(w=>w.tags.highway).map(w=>`<polyline points="${coords(w.geometry)}" fill="none" stroke="var(--map-path)" stroke-width="${['footway','path','steps'].includes(w.tags.highway)?3:9}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
    ${roads.map(w=>{if(!w.tags.name||names.has(w.tags.name)||names.size>=7)return '';names.add(w.tags.name);const [x,y]=project(w.geometry[Math.floor(w.geometry.length/2)]);return `<text class="map-road-label" x="${x}" y="${y-8}" text-anchor="middle">${esc(w.tags.name)}</text>`;}).join('')}
    ${brief?brief.closures.matches.flatMap(n=>n.polygons.map(rings=>`<path d="${rings.map(r=>`M${coords(r)}Z`).join(' ')}" fill="var(--map-closure)" fill-rule="evenodd" stroke="#a84428" stroke-width="2"/>`)).join(''):''}
    ${brief?`<polyline points="${coords(brief.route.coordinates)}" fill="none" stroke="var(--paper)" stroke-width="8" stroke-linejoin="round"/><polyline points="${coords(brief.route.coordinates)}" fill="none" stroke="var(--map-route)" stroke-width="4" stroke-dasharray="9 4" stroke-linejoin="round"/>`:''}
    ${markers.map((p,i)=>{const [x,y]=project(p.coord),name=p.name.replace('Science Library','Library');return `<g><circle cx="${x}" cy="${y}" r="18" fill="var(--map-route)" opacity=".12"/><circle cx="${x}" cy="${y}" r="8" fill="var(--map-route)" stroke="var(--paper)" stroke-width="3"/><rect x="${x-Math.max(name.length*3.8,38)}" y="${y+16}" width="${Math.max(name.length*7.6,76)}" height="29" rx="6" fill="var(--paper)" stroke="var(--line)"/><text class="map-place-label" x="${x}" y="${y+35}" text-anchor="middle">${brief?`${i?'B':'A'} · `:''}${esc(name)}</text></g>`;}).join('')}
  </svg>`;
}

export function overviewSummary(brief){
  if(!brief)return `<p class="map-card-kicker">A LITTLE CONTEXT GOES A LONG WAY</p><h3>Your campus.<br>Your way of getting there.</h3><p>Choose a journey to bring its weather, surroundings, and official notices together.</p><div class="overview-key"><span class="key-dot"></span>6 campus places<span>·</span>Text & voice available</div>`;
  return `<p class="map-card-kicker">YOUR PREPARED JOURNEY</p><div class="overview-stops"><p><span>A</span>${esc(brief.origin.name)}</p><p><span>B</span>${esc(brief.destination.name)}</p></div><div class="overview-stats"><div><span>Time outdoors</span><strong>${brief.duration} min</strong><small>Your estimate</small></div><div><span>Study line</span><strong>${(brief.route.metres/1000).toFixed(2)} km</strong><small>Not a verified route</small></div></div><a href="#results">Read your environmental briefing </a>`;
}
