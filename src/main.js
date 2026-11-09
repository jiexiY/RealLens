import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import photos from './photos.json';
import { photoMapPosition } from './photo-location.js';
import './style.css';
import './photos.css';
import './no-arrows.css';

const D = `${import.meta.env.BASE_URL}data/`;
const P = `${import.meta.env.BASE_URL}photos/`;
const paths = {
  camera: '<path d="M4 6h4l2-3h4l2 3h4v14H4V6Z"/><circle cx="12" cy="12" r="4"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.6 8h16.8M3.6 16h16.8"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9l10-6ZM3 13l9 5 9-5M3 17l9 5 9-5"/>',
  orbit: '<ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="3"/><path d="M3 9V5h4"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15"/>',
  satellite: '<path d="m9 8 7 7-4 4-7-7 4-4ZM13 4l3-3 7 7-3 3-7-7ZM1 16l3-3 7 7-3 3-7-7ZM17 15c3 0 4-2 4-4"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  cross: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  leaf: '<path d="M20 3C9 2 2 8 5 15c4 8 15 2 15-12ZM4 21l10-11"/>',
  water: '<path d="M12 3C9 8 5 11 5 15a7 7 0 0 0 14 0c0-4-4-7-7-12Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>',
};
function icon(name, cls='') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`; }
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const dateLabel = date => new Date(date).toLocaleDateString('en-US', {year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
const views = [
  {id:'lake', title:'Open water', number:'01', subtitle:'Start at the lake', position:[170,4,-80], camera:[-260,340,485], target:[120,10,-50], crop:'68% 42%',
    tag:'WATER & REFLECTANCE', heading:'A lake seen in two ways.',
    body:'From here, the lake is a dark opening in the canopy. From orbit, we can compare how its surface reflects green and near-infrared light.',
    prompt:'Does open water stand apart from the surrounding trees?', explanation:'NDWI compares green and near-infrared reflectance. Open water often has a higher value than nearby vegetation. A value alone does not measure water quality or depth.', layer:'ndwi',
    note:'Look for the water’s outline in the aerial view, then compare it with the coarser satellite pixels.'},
  {id:'canopy', title:'Canopy & shoreline', number:'02', subtitle:'Read the living edge', position:[305,22,45], camera:[430,200,345], target:[255,18,20], crop:'91% 54%',
    tag:'VEGETATION & SCALE', heading:'The edge is a landscape.',
    body:'Along the eastern shore, vegetation forms a textured transition between land and open water. The scan reveals vertical structure; the satellite view measures reflected light.',
    prompt:'How does the vegetation signal change at the shoreline?', explanation:'NDVI compares near-infrared and red reflectance. Higher values commonly indicate more green vegetation. A 10-metre pixel can mix leaves, water, soil, and shade.', layer:'ndvi',
    note:'The point-cloud colors come from a separate aerial image. They are not the original colors recorded by the laser scanner.'},
  {id:'edge', title:'The ground view', number:'03', subtitle:'Zoom into the shoreline', position:[-68,7,-15], camera:[-195,68,115], target:[-20,10,-45], crop:'43% 46%',
    tag:'GROUND & CONTEXT', heading:'Move closer. Notice more.',
    body:'The western edge brings paths, structures, trees, and water into the same view. Details that are obvious here share just a few pixels in a satellite image.',
    prompt:'Which details disappear when you switch to satellite scale?', explanation:'Satellite indices describe a patch of land. Ground observations add context about what is actually present. Compare the same place, and always check the observation dates.', layer:'rgb',
    note:'These are guided viewpoints in an archived scan, not newly collected GLOBE observation records.'},
  {id:'campus', title:'Campus meets lake', number:'04', subtitle:'Connect the bigger picture', position:[-240,12,115], camera:[-510,255,325], target:[-130,12,50], crop:'24% 62%',
    tag:'LAND COVER & QUESTIONS', heading:'A campus connected by water.',
    body:'UF describes Lake Alice as part of an interconnected system of creeks, ponds, wetlands, and campus stormwater. The built surroundings are part of that environmental story.',
    prompt:'Where does the vegetation signal differ across the site?', explanation:'Compare greener patches with roofs, roads, and open water. These two dates invite investigation; they do not establish a long-term trend or explain its cause.', layer:'ndvi',
    note:'Learn about the watershed in the University of Florida’s published management plan.', source:'https://facilities.ufl.edu/lakealice/about/project-overview/'},
];
const state = {mode:'3d', view:0, photo:0, locatedPhoto:null, layer:'ndvi', season:'spring', compare:false, tour:false, inspected:null};
let data, viewer, tourTimer;

$('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="./" aria-label="RealLens home"><span class="brand-mark">${icon('globe')}</span>Field<span>Lens</span><span class="brand-divider"></span><small>FROM ORBIT TO GROUND</small></a>
    <nav aria-label="Main navigation"><button class="nav-link" id="about-btn">The field study </button><button class="source-button" id="sources-btn">${icon('layers')} Sources & method</button></nav>
  </header>
  <main>
    <section class="intro">
      <div><div class="eyebrow"><span class="live-dot"></span> FIELD SITE 001 <span class="slash">/</span> GAINESVILLE, FLORIDA</div><h1>A closer look at <em>Lake Alice.</em></h1><p>Explore the scan. Step into real photographs. See what changes from orbit.</p></div>
      <div class="site-stamp">${icon('compass')}<div>29.6420° N &nbsp; 82.3630° W<small>UNIVERSITY OF FLORIDA</small></div></div>
    </section>
    <section class="workspace" aria-label="Lake Alice interactive field study">
      <div class="explorer-column">
        <div class="viewer-toolbar">
          <div class="mode-tabs" role="tablist" aria-label="Explore the site">
            <button role="tab" aria-selected="true" data-mode="3d" aria-label="3D landscape" data-short="3D">${icon('orbit')}<span>3D landscape</span></button>
            <button role="tab" aria-selected="false" data-mode="aerial" aria-label="Aerial view" data-short="Aerial">${icon('map')}<span>Aerial view</span></button>
            <button role="tab" aria-selected="false" data-mode="satellite" aria-label="Satellite layers" data-short="Satellite">${icon('satellite')}<span>Satellite layers</span></button>
            <button role="tab" aria-selected="false" data-mode="photos" aria-label="Ground photos" data-short="Photos">${icon('camera')}<span>Ground photos</span></button>
          </div>
          <button class="icon-button" id="fullscreen" title="Expand viewer" aria-label="Expand viewer">${icon('expand')}</button>
        </div>
        <div id="scene-frame" class="scene-frame">
          <div id="scene" aria-label="Interactive 3D LiDAR scan of Lake Alice" tabindex="0"></div>
          <div id="image-view" hidden><div class="map-stage" id="map-stage"><img id="map-image" alt="Georeferenced aerial view of Lake Alice"/><div id="compare-clip" hidden><img id="compare-image" alt="Comparison date of the selected satellite layer"/></div><div id="map-pins"></div><div id="compare-line" hidden></div></div></div>
          <div id="photo-view" class="photo-view" tabindex="0" aria-label="Lake Alice ground photograph viewer" hidden>
            <img id="ground-photo" alt="" decoding="async"/>
            <span class="photo-number" id="photo-number"></span>
            <button class="photo-arrow photo-prev" id="prev-photo" aria-label="Previous photograph">Previous</button>
            <button class="photo-arrow photo-next" id="next-photo" aria-label="Next photograph">Next</button>
            <div class="photo-overlay"><span>FROM THE GROUND</span><h2 id="photo-title" aria-live="polite"></h2><p id="photo-byline"></p></div>
            <div class="photo-error" id="photo-error" hidden>Photograph could not load. <button id="retry-photo">Try again</button></div>
          </div>
          <div class="scene-top"><span class="scene-badge"><span></span><b id="scene-badge">USGS LIDAR · 2018–19</b></span><span class="north">North is up</span></div>
          <div id="scene-pins"></div>
          <div id="load-state" class="load-state"><span class="loader-orbit">${icon('globe')}</span><strong>Bringing Lake Alice into view</strong><span id="load-detail">Loading the archived scan…</span><div class="load-track"><i id="load-bar"></i></div></div>
          <div id="pixel-tooltip" hidden></div>
          <div id="layer-controls" class="layer-controls" hidden>
            <button class="active" data-layer="ndvi">${icon('leaf')} Vegetation <small>NDVI</small></button>
            <button data-layer="ndwi">${icon('water')} Water <small>NDWI</small></button>
            <button data-layer="rgb">Natural color</button>
          </div>
          <div class="scene-bottom"><div class="scene-instructions" id="scene-instructions">${icon('orbit')} Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Right-drag to pan</div><div class="scene-actions"><button id="top-view" title="Top-down view" aria-label="Top-down view">${icon('map')}</button><button id="reset-view" title="Reset camera" aria-label="Reset camera">Reset</button></div></div>
          <div id="legend" class="map-legend" hidden><div><b id="legend-name">Vegetation index</b><small id="legend-unit">NDVI · −1 to +1</small></div><div id="legend-gradient"></div><div class="legend-labels"><span id="legend-low">Lower</span><span id="legend-high">Higher</span></div></div>
        </div>
        <div class="viewer-caption"><span id="viewer-caption">A real laser scan, colored with separate aerial imagery.</span><button id="color-mode">Color: aerial ${icon('layers')}</button></div>
        <div id="photo-credit" class="photo-credit" hidden></div>
        <div class="satellite-timeline" id="satellite-timeline" hidden>
          <span class="timeline-label">OBSERVATION DATE</span><div class="date-buttons"><button data-season="spring" class="active">21 Mar 2024</button><span class="timeline-line"></span><button data-season="autumn">22 Sep 2024</button></div>
          <button class="compare-button" id="compare-button" aria-pressed="false">Compare dates</button>
          <label id="swipe-control" hidden>Swipe comparison <input id="swipe" type="range" min="0" max="100" value="50"/><span>March / September</span></label>
        </div>
        <section class="photo-archive" aria-label="Ground photo archive">
          <div class="archive-heading"><div><span class="eyebrow">GROUND ARCHIVE <span class="archive-count">04</span></span><h2>The place behind the pixels.</h2></div><span>Real photographs · 2022 & 2026</span></div>
          <div class="photo-filmstrip">${photos.map((p,i)=>`<button class="photo-card" data-photo="${i}" aria-label="Open photograph: ${p.title}" aria-pressed="false"><span class="photo-thumb"><img src="${P}${p.file}" alt="" loading="lazy"/><span>${icon('camera')}</span></span><strong>${p.title}</strong><small>${dateLabel(p.date)}</small></button>`).join('')}</div>
        </section>
        <div class="viewpoints-head"><div><span class="eyebrow">FOLLOW YOUR CURIOSITY</span><h2>Four ways into the landscape.</h2></div><button id="tour-button">${icon('play')} Take the tour</button></div>
        <div class="viewpoints">${views.map((v,i)=>`<button class="view-card ${i===0?'selected':''}" data-view="${i}" aria-pressed="${i===0}"><span class="view-thumb" style="background-image:url('${D}aerial.jpg');background-position:${v.crop}"><span>${v.number}</span></span><strong>${v.title}</strong><small>${v.subtitle}</small></button>`).join('')}</div>
      </div>
      <aside class="field-notes" aria-label="Field notes">
        <div class="notes-header"><span id="note-label">${icon('leaf')} FIELD NOTES</span><span id="note-count">01 / 04</span></div>
        <div id="note-content"></div>
        <div class="observation-box"><div class="observation-title">${icon('satellite')} SATELLITE OBSERVATION <span id="metric-date">MAR 21, 2024</span></div><div class="metrics"><div><small>Vegetation · NDVI</small><strong id="ndvi-value">—</strong><span id="ndvi-bar"></span></div><div><small>Water · NDWI</small><strong id="ndwi-value">—</strong><span id="ndwi-bar"></span></div></div><p id="metric-context">Index values at the selected viewpoint. Source bands: 10 m.</p></div>
        <div class="note-caution">${icon('info')}<p id="note-caution"></p></div>
        <div class="note-nav"><button id="prev-note" aria-label="Previous field note">Previous</button><span id="step-label">OPEN WATER</span><button id="next-note" aria-label="Next field note">Next</button></div>
      </aside>
    </section>
    <section class="learning-strip"><span class="lesson-mark">${icon('globe')}</span><div><span class="eyebrow">BUILT ON A REAL LESSON</span><p>One place. Different perspectives. Better questions.</p></div><a href="https://geo-di-lab.github.io/emerge-lessons/docs/ch3/lesson3.html" target="_blank" rel="noreferrer">Explore the EMERGE lesson </a></section>
  </main>
  <footer><span>RealLens <span class="footer-dot">·</span> An environmental field study</span><span>USGS / USDA <span>+</span> Copernicus Sentinel-2 <span>+</span> EMERGE</span><button id="download-notes">Save field notes </button></footer>
  <dialog id="info-dialog"><div class="dialog-top"><span class="eyebrow">THE REALLENS NOTEBOOK</span><button id="close-dialog" class="icon-button" aria-label="Close dialog">${icon('cross')}</button></div><div id="dialog-content"></div></dialog>
  <div class="toast" id="toast" role="status" hidden></div>
`;

function renderNote() {
  if(state.mode==='photos'||state.locatedPhoto!==null){renderPhotoNote();return;}
  $('#note-label').innerHTML=`${icon('leaf')} FIELD NOTES`;
  $('.observation-box').hidden=false;
  const v=views[state.view];
  $('#note-count').textContent=`${v.number} / 04`;
  const related=[0,1,0,2][state.view];const photo=photos[related];
  $('#note-content').innerHTML=`<span class="note-kicker">${v.tag}</span><h2>${v.heading}</h2><p class="note-body">${v.body}</p><div class="look-closer"><span class="eyebrow">LOOK A LITTLE CLOSER</span><p>${v.prompt}</p><button id="investigate">Explore ${v.layer==='ndwi'?'water':v.layer==='ndvi'?'vegetation':'natural color'} </button></div><p class="explanation">${v.explanation}</p><button class="ground-evidence" id="related-photo"><img src="${P}${photo.file}" alt=""/><span><small>${icon('camera')} GROUND EVIDENCE</small><strong>${photo.title}</strong><span>Open photograph </span></span></button>`;
  $('#related-photo').onclick=()=>selectPhoto(related);
  $('#note-caution').innerHTML=v.note+(v.source?` <a href="${v.source}" target="_blank" rel="noreferrer">Read the plan </a>`:'');
  $('#step-label').textContent=v.title.toUpperCase();
  $('#investigate').onclick=()=>{state.layer=v.layer;state.compare=false;setMode('satellite');};
  $$('[data-view]').forEach(b=>{const active=Number(b.dataset.view)===state.view;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});
  $$('.scene-pin').forEach(b=>b.classList.toggle('active',Number(b.dataset.pin)===state.view));
  updateMetrics();
}

function setView(index, auto=false) {
  if (!auto) stopTour();
  state.view=(index+views.length)%views.length;state.inspected=null;
  if(state.mode==='photos')setMode('3d');
  state.locatedPhoto=null;
  renderNote();
  if(viewer) viewer.moveTo(views[state.view]);
  renderMapPins();
}

function setMode(mode) {
  state.mode=mode;
  state.locatedPhoto=null;
  $('#pixel-tooltip').hidden=true;
  if(mode!=='3d') stopTour();
  $$('[data-mode]').forEach(b=>b.setAttribute('aria-selected',b.dataset.mode===mode));
  $('#scene').hidden=mode!=='3d';$('#scene-pins').hidden=mode!=='3d';$('#image-view').hidden=mode!=='aerial'&&mode!=='satellite';
  $('#photo-view').hidden=mode!=='photos';$('#photo-credit').hidden=mode!=='photos';
  $('.scene-top').hidden=mode==='photos';$('.scene-bottom').hidden=mode==='photos';
  $('#scene-frame').classList.toggle('photograph-mode',mode==='photos');
  $('#top-view').hidden=mode!=='3d';$('#reset-view').hidden=mode!=='3d';$('#color-mode').hidden=mode!=='3d';
  $('#layer-controls').hidden=mode!=='satellite';$('#satellite-timeline').hidden=mode!=='satellite';
  $('#legend').hidden=mode!=='satellite'||state.layer==='rgb';
  $('#scene-instructions').innerHTML=mode==='3d'?`${icon('orbit')} Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Right-drag to pan`:mode==='aerial'?`${icon('map')} North-up aerial imagery <span>·</span> Select a viewpoint`:`${icon('satellite')} Hover or tap a pixel to inspect its values`;
  $('#scene-frame').classList.toggle('flat-view',mode==='aerial'||mode==='satellite');
  if(mode!=='3d') $('.north>span').style.transform='';
  if(mode==='3d') { $('#scene-badge').textContent='USGS LIDAR · 2018–19';$('#viewer-caption').textContent='A real laser scan, colored with separate aerial imagery.'; }
  else if(mode==='photos')renderPhoto();
  else updateMap();
  renderNote();updatePhotoSelection();
  if(viewer) viewer.resize();
}

function updatePhotoSelection(){
  $$('[data-photo]').forEach(b=>b.setAttribute('aria-pressed',state.mode==='photos'&&Number(b.dataset.photo)===state.photo));
}
function selectPhoto(index){state.photo=(index+photos.length)%photos.length;setMode('photos');}
function renderPhoto(){
  const p=photos[state.photo];const img=$('#ground-photo');
  $('#photo-error').hidden=true;
  img.alt=p.alt;img.src=P+p.file;
  $('#photo-title').textContent=p.title;
  $('#photo-byline').textContent=`${dateLabel(p.date)} · Photograph by ${p.author}`;
  $('#photo-number').textContent=`${String(state.photo+1).padStart(2,'0')} / ${String(photos.length).padStart(2,'0')}`;
  $('#viewer-caption').textContent='An independent ground photograph. Not an input to the 3D reconstruction.';
  $('#photo-credit').innerHTML=`<span>© ${p.author} · <a href="${p.licenseUrl}" target="_blank" rel="noreferrer">${p.license}</a></span><a href="${p.source}" target="_blank" rel="noreferrer">Original & attribution </a>`;
}
function renderPhotoNote(){
  const p=photos[state.photo];
  $('#note-label').innerHTML=`${icon('camera')} PHOTO FIELD NOTES`;
  $('#note-count').textContent=`${String(state.photo+1).padStart(2,'0')} / 04`;
  $('.observation-box').hidden=true;
  $('#note-content').innerHTML=`<span class="note-kicker">OBSERVE · CONNECT · QUESTION</span><h2>${p.title}.</h2><p class="note-body">${p.caption}</p><div class="look-closer"><span class="eyebrow">LOOK A LITTLE CLOSER</span><p>${p.question}</p><button id="photo-context">${state.mode==='aerial'?'Back to photograph':'Locate camera on aerial'} </button></div><p class="explanation">${p.insight}</p><dl class="photo-record"><div><dt>PHOTOGRAPHED</dt><dd>${dateLabel(p.date)}</dd></div><div><dt>PHOTOGRAPHER</dt><dd>${p.author}</dd></div><div><dt>REUSE LICENSE</dt><dd><a href="${p.licenseUrl}" target="_blank" rel="noreferrer">${p.license} </a></dd></div></dl><button class="photo-to-scan" id="photo-to-scan">Explore the related 3D view </button>`;
  $('#photo-context').onclick=()=>{if(state.mode==='aerial'){selectPhoto(state.photo);return;}setMode('aerial');state.locatedPhoto=state.photo;renderMapPins();renderPhotoNote();$('#viewer-caption').textContent='Camera location supplied by the photographer. Accuracy and viewing direction are not verified.';};
  $('#photo-to-scan').onclick=()=>{setMode('3d');setView(p.relatedView);};
  $('#note-caution').textContent='Separate dates, separate evidence. These photographs were not used to generate the scan or satellite indices. Related views are thematic, not exact camera matches.';
  $('#step-label').textContent='GROUND ARCHIVE';
}
$$('[data-photo]').forEach(b=>b.onclick=()=>{selectPhoto(Number(b.dataset.photo));$('#scene-frame').scrollIntoView({block:'start',behavior:'auto'});});
$('#prev-photo').onclick=()=>selectPhoto(state.photo-1);$('#next-photo').onclick=()=>selectPhoto(state.photo+1);
$('#ground-photo').onerror=()=>$('#photo-error').hidden=false;
$('#ground-photo').onload=()=>$('#photo-error').hidden=true;
$('#retry-photo').onclick=renderPhoto;
$('#photo-view').addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='ArrowRight'){e.preventDefault();selectPhoto(state.photo+1);}if(e.key==='ArrowLeft'){e.preventDefault();selectPhoto(state.photo-1);}if(e.key==='Home'){e.preventDefault();selectPhoto(0);}});

function updateMap() {
  const satellite=state.mode==='satellite';
  const slug=state.compare?'spring':state.season;
  $('#map-image').src=satellite?`${D}${slug}-${state.layer}.png`:`${D}aerial.jpg`;
  $('#map-image').alt=satellite?`Lake Alice ${state.layer.toUpperCase()}, ${slug==='spring'?'21 March':'22 September'} 2024`:'USGS NAIP Plus aerial imagery of Lake Alice';
  $('#map-stage').classList.toggle('satellite',satellite);
  const scene=data?.satellite.scenes.find(s=>s.slug===state.season);
  $('#scene-badge').textContent=satellite?`SENTINEL-2 · ${state.compare?'MAR / SEP 2024':scene?dateLabel(scene.datetime).toUpperCase():'2024'}`:'USDA / USGS · AERIAL MOSAIC';
  $('#viewer-caption').textContent=satellite?'Measured reflectance indices · source bands 10 m · masked pixels shown as gaps.':'NAIP imagery · center tile acquired Jan 26, 2023 · dates may vary across the mosaic.';
  $('#legend').hidden=!satellite||state.layer==='rgb';
  $('#legend-name').textContent=state.layer==='ndvi'?'Vegetation index':'Water index';
  $('#legend-unit').textContent=state.layer.toUpperCase()+' · −1 to +1';
  $('#legend-gradient').className=state.layer;
  $$('[data-layer]').forEach(b=>{b.classList.toggle('active',b.dataset.layer===state.layer);b.setAttribute('aria-pressed',b.dataset.layer===state.layer);});
  $$('[data-season]').forEach(b=>{b.classList.toggle('active',b.dataset.season===state.season);b.setAttribute('aria-pressed',b.dataset.season===state.season);});
  $('#compare-button').setAttribute('aria-pressed',state.compare);
  $('#compare-button').textContent=state.compare?'Exit comparison':'Compare dates';
  $('#swipe-control').hidden=!state.compare;
  $('#compare-clip').hidden=!satellite||!state.compare;$('#compare-line').hidden=!satellite||!state.compare;
  if(satellite&&state.compare) {$('#compare-image').src=`${D}autumn-${state.layer}.png`; updateSwipe();}
  renderMapPins();updateMetrics();resizeMap();
}

function resizeMap(){
  const frame=$('#scene-frame');const stage=$('#map-stage');
  const width=Math.min(frame.clientWidth,frame.clientHeight*1600/1248);
  stage.style.width=width+'px';stage.style.height=(width*1248/1600)+'px';
}
new ResizeObserver(resizeMap).observe($('#scene-frame'));

function renderMapPins() {
  if(state.locatedPhoto!==null){
    const p=photos[state.locatedPhoto];const {left,top}=photoMapPosition(p);
    $('#map-pins').innerHTML=`<button class="map-pin camera-map-pin" style="left:${left}%;top:${top}%" aria-label="Open photograph: ${p.title}">${icon('camera')}<span>Photo ${String(state.photo+1).padStart(2,'0')}</span></button>`;
    $('.camera-map-pin').onclick=()=>selectPhoto(state.photo);
    $('#scene-instructions').innerHTML=`${icon('camera')} Contributor-reported camera location · Click to open photo`;
    return;
  }
  $('#map-pins').innerHTML=views.map((v,i)=>`<button class="map-pin ${i===state.view?'active':''}" data-map-pin="${i}" style="left:${(v.position[0]/1000+.5)*100}%;top:${(v.position[2]/780+.5)*100}%" aria-label="View ${v.title}"><span>${v.number}</span></button>`).join('');
  $$('[data-map-pin]').forEach(b=>b.onclick=()=>setView(Number(b.dataset.mapPin)));
}

function sampleAt(x,z,season=state.season) {
  const grid=data?.grids[season];if(!grid) return null;
  const col=Math.min(grid.width-1,Math.max(0,Math.floor((x/1000+.5)*grid.width)));
  const row=Math.min(grid.height-1,Math.max(0,Math.floor((z/780+.5)*grid.height)));
  return {ndvi:grid.ndvi[row][col],ndwi:grid.ndwi[row][col],col,row};
}

function updateMetrics() {
  if(!data)return;
  const v=views[state.view];const p=state.inspected;
  const season=p?.season||(state.compare&&state.mode==='satellite'?((v.position[0]/1000+.5)>Number($('#swipe').value)/100?'autumn':'spring'):state.season);
  const s=sampleAt(p?.x??v.position[0],p?.z??v.position[2],season);
  $('#metric-date').textContent=dateLabel(data.satellite.scenes.find(s=>s.slug===season).datetime).toUpperCase();
  for(const k of ['ndvi','ndwi']) {const n=s?.[k];$(`#${k}-value`).textContent=n==null?'No data':n.toFixed(2);$(`#${k}-bar`).style.setProperty('--metric',`${n==null?0:(n+1)*50}%`);}
  $('#metric-context').textContent=p?'Selected satellite pixel. Source bands: 10 m.':'Pixel at this viewpoint. Source bands: 10 m.';
}

function updateSwipe(){const percent=Number($('#swipe').value);$('#compare-clip').style.clipPath=`inset(0 0 0 ${percent}%)`;$('#compare-line').style.left=percent+'%';updateMetrics();}
$('#swipe').oninput=updateSwipe;
$('#map-stage').addEventListener('pointermove', e=>{
  if(state.mode!=='satellite'||!data||e.target.closest('button'))return;
  const box=$('#map-stage').getBoundingClientRect();const u=(e.clientX-box.left)/box.width,v=(e.clientY-box.top)/box.height;
  if(u<0||u>1||v<0||v>1)return;
  const season=state.compare?(u>Number($('#swipe').value)/100?'autumn':'spring'):state.season;
  const sample=sampleAt((u-.5)*1000,(v-.5)*780,season);
  const tip=$('#pixel-tooltip');tip.hidden=false;tip.innerHTML=`<b>${season==='spring'?'21 MAR':'22 SEP'} 2024</b><span>NDVI ${sample.ndvi==null?'No data':sample.ndvi.toFixed(2)} &nbsp; NDWI ${sample.ndwi==null?'No data':sample.ndwi.toFixed(2)}</span>`;
  const frame=$('#scene-frame').getBoundingClientRect();tip.style.left=Math.min(frame.width-210,Math.max(10,e.clientX-frame.left+14))+'px';tip.style.top=Math.max(60,e.clientY-frame.top-55)+'px';
});
$('#map-stage').addEventListener('pointerleave',()=>$('#pixel-tooltip').hidden=true);
$('#map-stage').addEventListener('click', e=>{if(state.mode!=='satellite'||e.target.closest('button'))return;const b=$('#map-stage').getBoundingClientRect();const u=(e.clientX-b.left)/b.width;state.inspected={x:(u-.5)*1000,z:((e.clientY-b.top)/b.height-.5)*780,season:state.compare?(u>Number($('#swipe').value)/100?'autumn':'spring'):state.season};updateMetrics();});

function stopTour(){state.tour=false;clearInterval(tourTimer);$('#tour-button').innerHTML=`${icon('play')} Take the tour`;$('#tour-button').classList.remove('touring');}
$('#tour-button').onclick=()=>{if(state.tour){stopTour();return;}setMode('3d');state.tour=true;setView(0,true);$('#tour-button').innerHTML=`${icon('pause')} Pause tour`;$('#tour-button').classList.add('touring');tourTimer=setInterval(()=>{if(state.view===3){stopTour();return;}setView(state.view+1,true);},9500);};
$$('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$$('[data-view]').forEach(b=>b.onclick=()=>setView(Number(b.dataset.view)));
$$('[data-layer]').forEach(b=>b.onclick=()=>{state.layer=b.dataset.layer;updateMap();});
$$('[data-season]').forEach(b=>b.onclick=()=>{state.season=b.dataset.season;state.compare=false;state.inspected=null;updateMap();});
$('#compare-button').onclick=()=>{state.compare=!state.compare;state.inspected=null;updateMap();};
$('#prev-note').onclick=()=>state.mode==='photos'||state.locatedPhoto!==null?selectPhoto(state.photo-1):setView(state.view-1);$('#next-note').onclick=()=>state.mode==='photos'||state.locatedPhoto!==null?selectPhoto(state.photo+1):setView(state.view+1);
$('#reset-view').onclick=()=>{stopTour();viewer?.moveTo(views[0]);};
$('#top-view').onclick=()=>{stopTour();viewer?.moveTo({camera:[50,760,0.01],target:[50,0,0]});};
$('#color-mode').onclick=()=>{if(!viewer)return;viewer.heightColor=!viewer.heightColor;$('#color-mode').innerHTML=`Color: ${viewer.heightColor?'elevation':'aerial'} ${icon('layers')}`;};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#scene-frame').requestFullscreen();}catch{toast('Full screen is unavailable in this browser.');}};
$('#scene').addEventListener('keydown', e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='ArrowRight'){e.preventDefault();setView(state.view+1);}if(e.key==='ArrowLeft'){e.preventDefault();setView(state.view-1);}if(e.key==='Home'){e.preventDefault();viewer?.moveTo(views[0]);}});
$('#close-dialog').onclick=()=>$('#info-dialog').close();
$('#info-dialog').onclick=e=>{if(e.target===$('#info-dialog'))$('#info-dialog').close();};
function openDialog(html){$('#dialog-content').innerHTML=html;$('#info-dialog').showModal();}
$('#about-btn').onclick=()=>openDialog(`<h2>One place, many ways of seeing.</h2><p>RealLens is a small environmental field study of Lake Alice in Gainesville. Explore a real archived laser scan, inspect aerial imagery, and connect the landscape to two satellite observations.</p><p>It adapts <a href="https://geo-di-lab.github.io/emerge-lessons/docs/ch3/lesson3.html" target="_blank" rel="noreferrer">EMERGE Textbook 1, Chapter 3, Lesson 3: Vegetation & Water Indices</a> into a guided public resource.</p><div class="dialog-callout">The question: what can we learn from orbit, and what needs a closer look on the ground?</div><h3>How to explore</h3><p>Choose a viewpoint, read its field note, then follow the question into the satellite layers. Switch dates or drag the comparison slider. Tap a satellite pixel to keep its values in the notes panel.</p><p>The 3D canvas supports orbit, zoom, and pan. Focus it and use left/right arrow keys to move between viewpoints, or Home to reset.</p><p class="fineprint">A CityCamp prototype. Independently built using public data and the open EMERGE curriculum; not an official NASA, USGS, or UF product.</p>`);
$('#sources-btn').onclick=()=>{
  const scenes=data?.satellite.scenes||[];
  openDialog(`<h2>Follow the evidence.</h2><p>Every layer represents a particular observation, date, and scale. The 3D scan stays fixed while satellite dates change.</p>
  <div class="source-item"><span>01</span><div><h3>3D geometry · USGS 3DEP</h3><p>Alachua County survey, Dec 2018–Dec 2019. ${data?.lidar.points.toLocaleString()||'650,000'} measured points in a deterministic display subset. Geometry is LiDAR, not a photo reconstruction or a Gaussian splat. No vertical exaggeration.</p><a href="https://portal.opentopography.org/usgsDataset?dsid=FL_Peninsular_FDEM_Alachua_2018" target="_blank" rel="noreferrer">Dataset & survey metadata </a></div></div>
  <div class="source-item"><span>02</span><div><h3>Aerial color · USDA / USGS</h3><p>USGS NAIP Plus mosaic. The center tile was acquired January 26, 2023; dates can vary across the mosaic. Aerial RGB is projected onto the LiDAR from above. Colors and geometry are different acquisitions. A flat image beneath the points provides context, not measured water depth.</p><a href="https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer" target="_blank" rel="noreferrer">Aerial imagery service </a></div></div>
  <div class="source-item"><span>03</span><div><h3>Satellite indices · Copernicus Sentinel-2</h3><p>Two individual L2A Collection 1 scenes, not live readings or a seasonal trend. Red, green, and near-infrared bands have 10 m source pixels. Scene classification masks no-data, cloud, cloud shadow, snow, and defective pixels; remaining classification errors are possible.</p>${scenes.map(s=>`<a href="${s.stacUrl}" target="_blank" rel="noreferrer">${dateLabel(s.datetime)} · ${(s.validFractionLocal*100).toFixed(1)}% local pixels retained </a>`).join('')}<p>Values at a viewpoint sample a satellite pixel, not an individual tree or water sample.</p></div></div>
  <div class="source-item"><span>04</span><div><h3>Method · EMERGE</h3><p>Textbook 1, Chapter 3, Lesson 3. We apply its band-ratio equations to a bounded Lake Alice extent. Our adaptation uses separate dated scenes instead of a temporal median and applies a quality mask. Nearest-neighbor reprojection aligns the display layers.</p><code>NDVI = (NIR − red) / (NIR + red)<br>NDWI = (green − NIR) / (green + NIR)</code><a href="https://geo-di-lab.github.io/emerge-lessons/docs/ch3/lesson3.html" target="_blank" rel="noreferrer">Open the source lesson </a><p>These indices do not establish drinking-water safety, pollution, mosquito abundance, or disease risk.</p></div></div>
  <div class="source-item"><span>05</span><div><h3>Ground photographs · Wikimedia Commons</h3><p>Four real Lake Alice photographs by Michael Rivera and Alexander Abair, shared under Creative Commons Attribution 4.0. Capture dates and camera coordinates are the contributors’ records, not independently surveyed positions. They are contextual evidence, not inputs to the LiDAR or satellite calculations.</p>${photos.map(p=>`<a href="${p.source}" target="_blank" rel="noreferrer">${p.originalTitle} </a><p>${p.author} · ${dateLabel(p.date)} · <a class="inline-license" href="${p.licenseUrl}" target="_blank" rel="noreferrer">${p.license}</a></p>`).join('')}<p>Wikimedia’s 1280-pixel previews are bundled without image edits. Thumbnail cards crop the display; the main viewer preserves the full frame. No photographer endorsement is implied.</p></div></div>
  <div class="dialog-callout"><b>Reproducibility</b><p>The project includes its data preparation script, input catalog records, source links, and validation checks. No GLOBE observations or geoemerge package are used in this first version. The track permits other public environmental data.</p></div>`);
};
$('#download-notes').onclick=()=>{
  const lines=['# RealLens — Lake Alice','',`Exported ${new Date().toISOString()}`,'','Study question: What can we learn from orbit, and what needs a closer look on the ground?',''];
  views.forEach(v=>{lines.push(`## ${v.number}. ${v.title}`,v.body,'',v.prompt,v.explanation,'');});
  lines.push('## Method','EMERGE Textbook 1, Chapter 3, Lesson 3: https://geo-di-lab.github.io/emerge-lessons/docs/ch3/lesson3.html','NDVI=(NIR-red)/(NIR+red); NDWI=(green-NIR)/(green+NIR).','LiDAR geometry: 2018–2019; aerial center tile: 2023-01-26. Colors and geometry are separate acquisitions.','');
  data?.satellite.scenes.forEach(s=>lines.push(`${dateLabel(s.datetime)} — ${s.stacUrl}`));
  lines.push('','## Ground photograph credits','Photos are independent observations, not reconstruction inputs. Wikimedia 1280px previews; thumbnail display crops only.');
  photos.forEach(p=>lines.push(`${p.originalTitle} — ${p.author}, ${dateLabel(p.date)}. ${p.license}: ${p.licenseUrl}`,p.source,''));
  const blob=new Blob([lines.join('\n')],{type:'text/markdown'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='fieldlens-lake-alice-notes.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Field notes saved.');
};
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,3500);}

class Landscape {
  constructor(host, metadata) {
    this.host=host;this.metadata=metadata;this.heightColor=false;this.animation=null;this.dirty=true;this.lastHeight=false;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.8));this.renderer.setClearColor('#121e1c');
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2('#121e1c',.00035);
    this.camera=new THREE.PerspectiveCamera(44,1,1,5000);
    this.camera.position.set(...views[0].camera);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.target.set(...views[0].target);this.controls.enableDamping=true;this.controls.dampingFactor=.075;
    this.controls.minDistance=25;this.controls.maxDistance=1450;this.controls.maxPolarAngle=Math.PI*.49;
    this.controls.addEventListener('start',()=>{this.animation=null;stopTour();});
    this.controls.addEventListener('change',()=>this.dirty=true);
    this.resize=()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();if(this.material)this.material.uniforms.uViewport.value=height*this.renderer.getPixelRatio();this.dirty=true;};
    new ResizeObserver(this.resize).observe(host);this.resize();
    $('#scene-pins').innerHTML=views.map((v,i)=>`<button class="scene-pin ${i===0?'active':''}" data-pin="${i}" aria-label="View ${v.title}"><span>${v.number}</span><b>${v.title}</b></button>`).join('');
    $$('[data-pin]').forEach(b=>b.onclick=()=>setView(Number(b.dataset.pin)));
    this.pinButtons=$$('[data-pin]');this.pinVectors=views.map(v=>new THREE.Vector3(...v.position));
  }
  async load(buffer) {
    const texture=await new THREE.TextureLoader().loadAsync(`${D}aerial.jpg`);texture.colorSpace=THREE.SRGBColorSpace;
    const interleaved=new THREE.InterleavedBuffer(new Float32Array(buffer),4);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.InterleavedBufferAttribute(interleaved,3,0));geo.setAttribute('classification',new THREE.InterleavedBufferAttribute(interleaved,1,3));geo.computeBoundingSphere();
    this.material=new THREE.ShaderMaterial({uniforms:{uMap:{value:texture},uHeight:{value:0},uViewport:{value:this.host.clientHeight*this.renderer.getPixelRatio()}},
      vertexShader:`attribute float classification; varying vec2 vUv; varying float vHeight; varying float vDepth; uniform float uViewport; void main(){vUv=vec2(position.x/1000.0+0.5,0.5-position.z/780.0);vHeight=position.y;vec4 mv=modelViewMatrix*vec4(position,1.0);vDepth=-mv.z;gl_Position=projectionMatrix*mv;gl_PointSize=clamp(1.7*uViewport/(0.81*max(-mv.z,1.0)),1.1,16.0);}`,
      fragmentShader:`uniform sampler2D uMap;uniform float uHeight;varying vec2 vUv;varying float vHeight;varying float vDepth;void main(){vec2 p=gl_PointCoord-0.5;if(dot(p,p)>0.25)discard;vec3 natural=texture2D(uMap,vUv).rgb;natural*=0.87+0.2*smoothstep(0.0,28.0,vHeight);vec3 low=vec3(0.12,0.31,0.27);vec3 high=vec3(0.90,0.80,0.48);vec3 elev=mix(low,high,clamp(vHeight/35.0,0.0,1.0));vec3 color=mix(natural,elev,uHeight);float fog=1.0-exp(-0.00000005*vDepth*vDepth);color=mix(color,vec3(0.027,0.05,0.044),fog);gl_FragColor=vec4(color,1.0);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
    this.cloud=new THREE.Points(geo,this.material);this.scene.add(this.cloud);
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(1000,780),new THREE.MeshBasicMaterial({map:texture,color:'#bcc6ba',side:THREE.DoubleSide}));plane.rotation.x=-Math.PI/2;plane.position.y=-1.25;this.scene.add(plane);
    const border=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-500,-1,-390),new THREE.Vector3(500,-1,-390),new THREE.Vector3(500,-1,390),new THREE.Vector3(-500,-1,390)]),new THREE.LineBasicMaterial({color:'#b7c8a5',transparent:true,opacity:.25}));this.scene.add(border);
    this.controls.update();this.frame();
  }
  moveTo(view){this.animation={start:performance.now(),from:this.camera.position.clone(),targetFrom:this.controls.target.clone(),to:new THREE.Vector3(...view.camera),targetTo:new THREE.Vector3(...view.target)};}
  frame=()=>{
    requestAnimationFrame(this.frame);
    if(document.hidden||state.mode!=='3d')return;
    if(this.animation){const a=this.animation;let t=Math.min(1,(performance.now()-a.start)/1500);t=t*t*(3-2*t);this.camera.position.lerpVectors(a.from,a.to,t);this.controls.target.lerpVectors(a.targetFrom,a.targetTo,t);if(t>=1)this.animation=null;}
    this.controls.update();
    if(this.lastHeight!==this.heightColor){this.dirty=true;this.lastHeight=this.heightColor;}
    if(!this.dirty)return;
    this.dirty=false;this.material.uniforms.uHeight.value=this.heightColor?1:0;this.renderer.render(this.scene,this.camera);
    const center=this.controls.target.clone().project(this.camera);
    const north=this.controls.target.clone().add(new THREE.Vector3(0,0,-100)).project(this.camera);
    const angle=Math.atan2((north.x-center.x)*this.host.clientWidth,(north.y-center.y)*this.host.clientHeight);
    $('.north>span').style.transform=`rotate(${angle}rad)`;
    for(let i=0;i<this.pinVectors.length;i++){const p=this.pinVectors[i].clone().project(this.camera);const b=this.pinButtons[i];const visible=p.z<1&&p.z>-1&&Math.abs(p.x)<.91&&p.y<.82&&p.y>-.74;b.style.display=visible?'':'none';if(visible)b.style.transform=`translate(${(p.x*.5+.5)*this.host.clientWidth}px,${(-p.y*.5+.5)*this.host.clientHeight}px) translate(-50%,-50%)`;}
  }
}

async function json(file){const r=await fetch(D+file);if(!r.ok)throw new Error(`Could not load ${file}`);return r.json();}
async function loadBuffer(){const response=await fetch(D+'lake-alice.bin');if(!response.ok)throw new Error('The LiDAR sample is unavailable');const total=Number(response.headers.get('content-length'))||10400000;const reader=response.body.getReader();let received=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;chunks.push(value);received+=value.length;$('#load-bar').style.width=Math.min(95,received/total*95)+'%';$('#load-detail').textContent=`Reading scan · ${(received/1000000).toFixed(1)} MB`;}const all=new Uint8Array(received);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}return all.buffer;}
renderNote();
try {
  const [lidar,satellite,spring,autumn]=await Promise.all([json('lidar.json'),json('satellite.json'),json('spring-grid.json'),json('autumn-grid.json')]);
  data={lidar,satellite,grids:{spring,autumn}};
  updateMetrics();
  try {viewer=new Landscape($('#scene'),lidar);const buffer=await loadBuffer();await viewer.load(buffer);$('#load-state').hidden=true;} catch(error){console.error(error);$('#load-state').hidden=true;setMode('aerial');toast('3D could not load. Aerial imagery and satellite layers are available.');}
} catch(error){console.error(error);$('#load-detail').textContent='Some study data could not load. Refresh to try again.';$('#load-state strong').textContent='Connection interrupted';setMode('aerial');}
