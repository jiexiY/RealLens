export const ZONE='America/New_York';
export const METHOD='https://geo-di-lab.github.io/emerge-lessons/docs/ch3/lesson3.html';
export function easternParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
}
export function localInput(date=new Date()) {
  const p=easternParts(date);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function parseDeparture(value) {
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value??'')) return null;
  const target=Date.parse(`${value}:00Z`);if(!Number.isFinite(target))return null;
  let result=target;
  for(let i=0;i<3;i++) result+=target-Date.parse(`${localInput(new Date(result))}:00Z`);
  return localInput(new Date(result))===value ? new Date(result) : null;
}
export function formatDate(value,options={}) {
  if(value===null||value===undefined||value==='')return 'Date unavailable';
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US',{timeZone:ZONE,month:'short',day:'numeric',year:'numeric',...options}).format(date);
}
export function timeLabel(value) {return formatDate(value,{month:undefined,day:undefined,year:undefined,hour:'numeric',minute:'2-digit'});}
export function distance(a,b) {
  const r=Math.PI/180,dLat=(b[1]-a[1])*r,dLon=(b[0]-a[0])*r;
  const h=Math.sin(dLat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLon/2)**2;
  return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function buildGraph(ways) {
  const nodes=new Map(),edges=new Map();
  for(const way of ways) {
    const t=way.tags;
    if(!t.highway || ['no','private'].includes(t.access) || ['no','private'].includes(t.foot) || t.indoor==='yes' || t.area==='yes')continue;
    for(let i=0;i<way.nodes.length;i++) {
      const id=way.nodes[i],coord=way.geometry[i];nodes.set(id,coord);if(!edges.has(id))edges.set(id,[]);
      if(i){const previous=way.nodes[i-1],length=distance(way.geometry[i-1],coord);edges.get(previous).push({to:id,length,way});edges.get(id).push({to:previous,length,way});}
    }
  }
  // Isolated courtyard fragments must not become the sole snap candidate.
  // Use the largest connected pedestrian component; expose all endpoint gaps.
  const unseen=new Set(nodes.keys());let largest=[];
  while(unseen.size){const seed=unseen.values().next().value,component=[],stack=[seed];unseen.delete(seed);while(stack.length){const id=stack.pop();component.push(id);for(const e of edges.get(id)??[])if(unseen.delete(e.to))stack.push(e.to);}if(component.length>largest.length)largest=component;}
  const keep=new Set(largest);
  return {nodes:new Map([...nodes].filter(([id])=>keep.has(id))),edges:new Map([...edges].filter(([id])=>keep.has(id)))};
}
export function nearestNode(graph,point) {
  let found=null,metres=Infinity;for(const [id,coord] of graph.nodes){const d=distance(coord,point);if(d<metres){found=id;metres=d;}}
  return {id:found,metres};
}
export function findRoute(graph,start,end) {
  const first=nearestNode(graph,start),last=nearestNode(graph,end);
  if(first.id===null||last.id===null||first.metres>150||last.metres>150)return null;
  const remaining=new Set(graph.nodes.keys()),cost=new Map([[first.id,0]]),previous=new Map();
  while(remaining.size){
    let current=null,best=Infinity;for(const id of remaining){const n=cost.get(id)??Infinity;if(n<best){best=n;current=id;}}
    if(current===null)break;if(current===last.id)break;remaining.delete(current);
    for(const edge of graph.edges.get(current)??[]){if(!remaining.has(edge.to))continue;const next=best+edge.length;if(next<(cost.get(edge.to)??Infinity)){cost.set(edge.to,next);previous.set(edge.to,{from:current,...edge});}}
  }
  if(!cost.has(last.id))return null;
  const segments=[];let id=last.id;
  while(id!==first.id){const edge=previous.get(id);if(!edge)return null;segments.push({a:graph.nodes.get(edge.from),b:graph.nodes.get(id),length:edge.length,wayId:edge.way.id,tags:edge.way.tags});id=edge.from;}
  segments.reverse();return {segments,coordinates:[graph.nodes.get(first.id),...segments.map(s=>s.b)],metres:cost.get(last.id),startGap:first.metres,endGap:last.metres};
}
export function sampleRoute(route,spacing=10) {
  return route.segments.flatMap(segment=>{const count=Math.max(1,Math.ceil(segment.length/spacing));return Array.from({length:count},(_,i)=>({coord:segment.a.map((v,j)=>v+(segment.b[j]-v)*(i+.5)/count),length:segment.length/count,segment}));});
}
export function insideRing(point,ring) {
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++) {const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;
}
export function insidePolygon(point,rings) {return rings.reduce((inside,ring)=>inside!==insideRing(point,ring),false);}
function intersects(a,b,c,d) {
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const on=(p,q,r)=>r[0]>=Math.min(p[0],q[0])-1e-12&&r[0]<=Math.max(p[0],q[0])+1e-12&&r[1]>=Math.min(p[1],q[1])-1e-12&&r[1]<=Math.max(p[1],q[1])+1e-12;
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  return (x*y<0&&z*w<0)||(Math.abs(x)<1e-12&&on(a,b,c))||(Math.abs(y)<1e-12&&on(a,b,d))||(Math.abs(z)<1e-12&&on(c,d,a))||(Math.abs(w)<1e-12&&on(c,d,b));
}
export function routeIntersects(route,rings) {
  return route.coordinates.some(p=>insidePolygon(p,rings))||route.segments.some(s=>rings.some(r=>r.some((p,i)=>i>0&&intersects(s.a,s.b,r[i-1],p))));
}
export function relevantClosures(route,closures,departure,duration=0) {
  if(!['available','stale'].includes(closures?.status)||!Array.isArray(closures.notices))return {status:'unavailable',matches:[],unmapped:0,unmappedNotices:[]};
  const day=localInput(departure).slice(0,10),lastDay=localInput(new Date(departure.getTime()+duration*60000)).slice(0,10);
  const notices=closures.notices.filter(n=>(!n.start||n.start.slice(0,10)<=lastDay)&&(!n.end||n.end.slice(0,10)>=day));
  const grouped=new Map();
  for(const n of notices)if(n.polygons.some(p=>routeIntersects(route,p)))grouped.set(n.id,n);
  const unmappedNotices=notices.filter(n=>!n.polygons.length);
  return {status:closures.status,geometryStatus:closures.geometryStatus||'available',matches:[...grouped.values()],unmapped:unmappedNotices.length,unmappedNotices,total:notices.length};
}
export function forecastWindow(weather,departure,duration,now=new Date()) {
  if(weather?.status!=='available')return {status:'unavailable',reason:'The weather source could not be refreshed.'};
  const generated=Date.parse(weather.generatedAt??weather.updated);
  if(!Number.isFinite(generated)||now-generated>12*3600000||generated-now>3600000)return {status:'stale',reason:'The source forecast is undated or more than 12 hours old. Refresh before relying on it.'};
  const start=departure.getTime(),end=start+duration*60000;
  const periods=weather.periods.filter(p=>Date.parse(p.end)>start&&Date.parse(p.start)<end).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  let covered=start;for(const p of periods){if(Date.parse(p.start)>covered)break;covered=Math.max(covered,Date.parse(p.end));}
  if(covered<end)return {status:'unavailable',reason:'The source does not cover your whole selected outdoor time. Choose another departure or refresh later.'};
  const temperatures=periods.map(p=>!Number.isFinite(p.temperature)?null:p.temperatureUnit==='F'?p.temperature:p.temperatureUnit==='C'?p.temperature*9/5+32:null).filter(Number.isFinite);
  const rain=periods.map(p=>p.rain).filter(v=>Number.isFinite(v)&&v>=0&&v<=100);
  return {status:'available',periods,rain:rain.length===periods.length?Math.max(...rain):null,
    low:temperatures.length===periods.length?Math.round(Math.min(...temperatures)):null,
    high:temperatures.length===periods.length?Math.round(Math.max(...temperatures)):null,
    wind:[...new Set(periods.map(p=>p.wind&&`${p.wind} ${p.windDirection??''}`.trim()).filter(Boolean))].join(' / '),
    description:[...new Set(periods.map(p=>p.description).filter(Boolean))].join(' to ')};
}
export function sampleSatellite(grid,coord) {
  if(!grid?.bbox4326)return null;const [w,s,e,n]=grid.bbox4326;
  if(coord[0]<w||coord[0]>e||coord[1]<s||coord[1]>n)return null;
  const col=Math.min(grid.width-1,Math.floor((coord[0]-w)/(e-w)*grid.width));
  const merc=v=>Math.log(Math.tan(Math.PI/4+v*Math.PI/360));
  const row=Math.min(grid.height-1,Math.floor((merc(n)-merc(coord[1]))/(merc(n)-merc(s))*grid.height));
  return grid.ndvi[row]?.[col]??null;
}
export function environmentAlong(route,grid) {
  const samples=sampleRoute(route),third=route.metres/3;let progress=0;
  return [0,1,2].map(part=>{
    const selected=[];for(const sample of samples){const midpoint=progress+sample.length/2;if(Math.min(2,Math.floor(midpoint/third))===part)selected.push(sample);progress+=sample.length;}progress=0;
    const valid=selected.map(s=>({...s,value:sampleSatellite(grid,s.coord)})).filter(s=>Number.isFinite(s.value));
    const total=selected.reduce((n,s)=>n+s.length,0),validLength=valid.reduce((n,s)=>n+s.length,0);
    const ndvi=validLength?valid.reduce((n,s)=>n+s.value*s.length,0)/validLength:null;
    const surfaces={};for(const s of selected){const key=s.segment.tags.surface??'unknown';surfaces[key]=(surfaces[key]??0)+s.length;}
    return {part,metres:total,ndvi,coverage:total?validLength/total:0,surfaces,steps:selected.some(s=>s.segment.tags.highway==='steps'),
      crossings:selected.filter(s=>s.segment.tags.footway==='crossing').length>0};
  });
}
