import photos from "./photos.json";
import { views, observations, initialState, transition } from "./study.js";
import { photoMapPosition } from "./photo-location.js";
import { Landscape } from "./landscape.js";
import {
  LAYERS,
  SEASONS,
  METHOD_URL,
  sampleGrid,
  pointEvidence,
  numberLabel,
  changeLabel,
  clampSwipe,
  locatorBox,
} from "./evidence.js";
import {
  readNotebook,
  storeNotebook,
  addEntry,
  notebookMarkdown,
  escapeHtml,
} from "./notebook.js";
import "./workbench.css";
import "./refinement.css";
import "./no-arrows.css";

const base = import.meta.env.BASE_URL,
  D = base + "data/",
  P = base + "photos/";
// Demo credentials may run only in Vite's local development server, never a build.
const demoKey = import.meta.env.DEV
  ? import.meta.env.VITE_GOOGLE_MAPS_DEMO_KEY
  : "";
const googleEnabled = Boolean(demoKey);
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const dateLabel = (date) =>
  new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const shapes = {
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/>',
  camera:
    '<path d="M3 7h5l2-3h4l2 3h5v13H3V7Z"/><circle cx="12" cy="13" r="4"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  up: '<path d="m7 17 10-10M7 7h10v10"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  top: '<path d="m4 9 8-5 8 5-8 5-8-5ZM4 14l8 5 8-5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.info}</svg>`;
}
let state = initialState(),
  study = null,
  landscape = null,
  sceneReady = false,
  sceneFailed = false,
  savedPose = null,
  tourTimer = null,
  tourIndex = 0;
let sceneSource = googleEnabled ? "google" : "lidar",
  sceneRequest = 0;
const engines = new Map(),
  engineLoads = new Map();
let lidarThumbnails = [];
let dataStatus = "loading";
const notebookStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};
const restoredNotebook = readNotebook(notebookStorage);
const canPersistNotebook = restoredNotebook.status === "ready";
let notebook = restoredNotebook.notebook,
  storageReady = restoredNotebook.status === "ready";
let notebookFeedback = "";
const sceneVisible = () =>
  state.mode === "scene" && (state.activePhoto === null || state.peek);

$("#app").innerHTML = `
<header class="app-header"><a href="./" class="brand" aria-label="RealLens home"><span>${icon("globe")}</span>RealLens</a><span class="header-divider"></span><h1>Lake Alice <span>Field Study</span></h1><div class="header-meta"><i></i> Public environmental data</div><button id="sources-top" class="header-source">${icon("info")}<span>Sources</span></button></header>
<main class="workbench" id="workbench">
  <div class="study-route"><div><span class="eyebrow">GAINESVILLE, FLORIDA · OPEN FIELD GUIDE</span><p>What can a satellite tell us about this lake?</p></div><nav aria-label="Study workflow"><button data-step="place"><b>01</b> Explore</button><button data-step="evidence"><b>02</b> Compare</button><button data-step="notebook"><b>03</b> Record</button></nav></div>
  <section class="explorer" aria-label="Lake Alice site explorer">
    <div class="mode-bar"><nav class="scene-modes" aria-label="Scene mode"><button data-mode="scene" aria-pressed="true">3D scene</button><button data-mode="photos" aria-pressed="false">Source photos</button><button data-mode="map" aria-pressed="false">Satellite layers</button></nav><button id="expand-scene" class="expand-button" aria-expanded="false">${icon("expand")}<span>Expand scene</span></button></div>
    <div class="scene-source-bar" id="scene-source-bar" ${googleEnabled ? "" : "hidden"}><div role="group" aria-label="3D data source"><button data-scene-source="google" aria-pressed="true">Photorealistic 3D</button><button data-scene-source="lidar" aria-pressed="false">LiDAR archive</button></div><span>LOCAL DEMO · NOT PUBLISHED</span></div>
    <div id="scene-status" class="scene-status" role="status" hidden></div>
    <div class="viewer" id="viewer">
      <div id="scene" aria-label="Interactive 3D scene"><div id="google-scene" class="scene-engine" tabindex="0" hidden></div><div id="lidar-scene" class="scene-engine" tabindex="0" hidden></div></div>
      <div class="scene-markers" id="scene-markers"><div id="landmarks">${views.map((v, i) => `<button class="landmark" data-landmark="${i}" aria-label="View ${v.title}"><i></i><span>${v.title}</span></button>`).join("")}</div><div id="photo-cameras">${photos.map((p, i) => `<button class="camera-pin" data-camera="${i}" aria-label="Open photo ${i + 1}: ${p.title}">${icon("camera")}<span>${p.title}</span></button>`).join("")}</div></div>
      <div class="crosshair" id="crosshair" hidden>+</div>
      <div class="photo-surface" id="photo-surface" hidden><img id="source-photo" alt=""/><div class="photo-error" id="photo-error" hidden><span>Photo could not load.</span><button id="retry-photo">Retry photograph</button></div></div>
      <div class="map-surface" id="map-surface" hidden><div id="map-stage"><img id="map-image" alt=""/><div id="compare-clip" hidden><img id="compare-image" alt="Comparison observation"/></div><div id="map-markers"></div><div id="sample-highlight" hidden></div><div class="map-date-label first" id="map-date-first"></div><div class="map-date-label second" id="map-date-second" hidden></div><div id="compare-divider" role="slider" tabindex="0" aria-label="Satellite date comparison divider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" hidden><span>Compare</span></div><div class="map-scale"><i></i>200 m</div></div><div class="map-badge" id="map-badge"></div><span class="north">North is up</span><div class="map-legend" id="map-legend"><span id="legend-title"></span><i id="legend-gradient"></i><div><span>−1</span><span>0</span><span>+1</span></div><p id="legend-meaning"></p></div><div id="pixel-tooltip" hidden></div></div>
      <div class="photo-session" id="photo-session" hidden><button id="peek-scene" aria-pressed="false">Show 3D</button><button id="back-scene">Back to scene <kbd>Esc</kbd></button></div>
      <div class="scene-label" id="scene-label">Whole-site overview</div><div class="context-warning" id="context-warning" hidden>Related 3D view · not camera-aligned</div>
      <div class="loading-state" id="loading-state"><div class="spinner"></div><strong>LOADING THE LANDSCAPE</strong><span id="load-label">USGS LiDAR · Lake Alice</span><div class="load-track"><i id="load-progress"></i></div><small id="load-percent">0%</small></div>
    </div>
    <div class="control-bar" id="scene-controls"><div class="control-buttons"><button id="fly-toggle" aria-pressed="false">Fly <span>Off</span></button><button id="cameras-toggle" aria-label="Photo cameras" aria-pressed="true">${icon("camera")} Photos</button><button id="top-view" aria-label="Top-down view">${icon("top")}<span>Top down</span></button><button id="tour" aria-label="Follow scene tour" aria-pressed="false">${icon("play")}</button><button id="overview"><span>Overview</span></button></div><div class="control-help"><strong>Drag to orbit · Double-click to recenter</strong><span>WASD move · QE height · Shift faster · Left / Right keys: photos</span></div></div>
    <div class="control-bar source-controls" id="source-controls" hidden><span id="photo-source-label"></span><div><button id="prev-photo" aria-label="Previous photograph">Previous</button><span id="photo-counter"></span><button id="next-photo" aria-label="Next photograph">Next</button><a id="photo-source-link" target="_blank" rel="noreferrer">Original source </a></div></div>
    <div class="map-controls" id="map-controls" hidden><div class="layer-switches" role="group" aria-label="Map layer"><button data-layer="ndvi" aria-pressed="true">Vegetation · NDVI</button><button data-layer="ndwi" aria-pressed="false">Water · NDWI</button><button data-layer="rgb" aria-pressed="false">Natural color</button><button data-layer="aerial" aria-pressed="false">Aerial</button></div><div class="date-row" id="date-row"><button data-season="spring">21 Mar 2024</button><button data-season="autumn">22 Sep 2024</button><button id="compare-dates" aria-pressed="false">Compare dates</button><label id="swipe-label" hidden>March <input type="range" min="0" max="100" value="50" id="swipe" aria-label="Compare March and September"/> September</label></div></div>
    <div class="viewer-credit" id="viewer-credit"></div>
    <section class="viewpoint-section" aria-label="Viewpoints and source photographs"><div class="strip-heading"><span>Viewpoints <small>01–04</small> <i></i> Ground photographs <small>P1–P4</small></span><div><button id="previous-views" aria-label="Previous views">Previous</button><button id="next-views" aria-label="Next views">Next</button></div></div><div class="viewpoint-strip" id="viewpoint-strip">${views.map((v, i) => `<button class="view-card" data-view="${i}" aria-pressed="${i === 0}"><span class="thumb"><img id="view-thumb-${i}" src="${D}aerial.jpg" alt=""/>${locatorThumbnail(v, i)}<em>${String(i + 1).padStart(2, "0")}</em><small>3D</small></span><span>${v.title}</span></button>`).join("")}${photos.map((p, i) => `<button class="view-card photo-card" data-photo="${i}" aria-pressed="false"><span class="thumb"><img src="${P}${p.file}" alt="" loading="lazy"/><em>P${i + 1}</em><small>${icon("camera")}</small></span><span>${p.title}</span></button>`).join("")}</div></section>
  </section>
  <aside class="evidence-panel" id="evidence-panel" aria-label="Environmental evidence"><div class="panel-tabs" role="tablist" aria-label="Evidence panel"><button id="notes-tab" role="tab" aria-controls="notes-panel" aria-selected="true" data-panel="notes">Field notes</button><button id="log-tab" role="tab" aria-controls="log-panel" aria-selected="false" data-panel="log">Observation log</button></div><section id="notes-panel" role="tabpanel" aria-labelledby="notes-tab"></section><section id="log-panel" role="tabpanel" aria-labelledby="log-tab" hidden><div class="log-intro"><span class="eyebrow">2018–2026 · SOURCE RECORD</span><h2>One place.<br>Different observations.</h2><p>Choose a record to open its evidence. Dates belong to different instruments—not one continuous environmental timeline.</p></div><div id="event-detail"></div><div class="event-list">${observations.map((e, i) => `<button data-event="${i}" aria-pressed="${i === 0}"><span>${e.date}</span><strong>${e.title}</strong><small>${e.type}</small></button>`).join("")}</div><p class="log-caution">Changes in lighting, resolution, season, and acquisition method affect what you see. This is not evidence of a causal or long-term trend.</p><a class="lesson-link" href="https://geo-di-lab.github.io/emerge-lessons/docs/ch3/lesson3.html" target="_blank" rel="noreferrer">EMERGE source lesson </a></section></aside>
</main>
<footer><span>Independent learning prototype · EMERGE Textbook 1, Ch. 3, Lesson 3</span><div><button id="download-notes" disabled>Export notebook </button><button id="sources-footer">Sources & method </button></div></footer>
<dialog id="source-dialog"><div class="dialog-heading"><span>SOURCES & METHOD</span><button id="close-dialog" aria-label="Close sources">${icon("close")}</button></div><div id="source-content"></div></dialog><div class="toast" id="toast" role="status" hidden></div>`;

$("#sources-top").setAttribute("aria-label", "Sources");
$("#viewer").insertAdjacentHTML(
  "beforeend",
  '<div class="scene-error" id="scene-error" role="status" hidden><strong>The 3D scene is unavailable.</strong><p>Your device or connection could not load the scan. The satellite layers and source photographs are still available.</p><button id="retry-scene">Try loading 3D again</button></div>',
);
$("#retry-scene").onclick = () => selectScene(sceneSource);
$("#notes-tab").textContent = "Field guide";
$(".panel-tabs").insertAdjacentHTML(
  "beforeend",
  '<button id="notebook-tab" role="tab" aria-controls="notebook-panel" aria-selected="false" data-panel="notebook">Notebook <span id="notebook-count">0</span></button>',
);
$("#evidence-panel").insertAdjacentHTML(
  "beforeend",
  '<section id="notebook-panel" role="tabpanel" aria-labelledby="notebook-tab" hidden></section>',
);
function locatorThumbnail(view, index) {
  const box = locatorBox(view, index),
    r = box.width / 22;
  return `<svg class="locator-thumb" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" aria-hidden="true" hidden><image href="${D}aerial.jpg" width="1000" height="780"/><circle cx="${view.position[0] + 500}" cy="${view.position[2] + 390}" r="${r}" fill="#122831dd" stroke="#f0d5a2" stroke-width="${r / 8}"/><circle cx="${view.position[0] + 500}" cy="${view.position[2] + 390}" r="${r / 4}" fill="#f0d5a2"/></svg>`;
}
function dispatch(action) {
  stopTour();
  if (
    (action.type === "PHOTO" ||
      (action.type === "MODE" && action.mode === "photos") ||
      (action.type === "EVENT" &&
        observations[action.index]?.photo !== undefined)) &&
    state.activePhoto === null &&
    landscape
  )
    savedPose = landscape.pose();
  const wasPhoto = state.activePhoto !== null;
  state = transition(state, action);
  landscape?.setFly(false);
  if (
    action.type === "EVENT" &&
    state.mode === "scene" &&
    sceneSource !== "lidar"
  )
    selectScene("lidar");
  if (action.type === "VIEW") landscape?.moveTo(views[state.view]);
  if (action.type === "PEEK" && state.peek)
    landscape?.moveTo(views[photos[state.activePhoto].relatedView]);
  if (
    (action.type === "BACK" ||
      (action.type === "MODE" && action.mode === "scene")) &&
    wasPhoto &&
    savedPose
  ) {
    landscape?.moveTo(savedPose);
    savedPose = null;
  }
  if (action.type === "EVENT" && state.mode === "scene")
    landscape?.moveTo(views[0]);
  render();
  const selected =
    state.activePhoto !== null
      ? $(`[data-photo="${state.activePhoto}"]`)
      : state.mode === "scene"
        ? $(`[data-view="${state.view}"]`)
        : null;
  if (selected) {
    const strip = $("#viewpoint-strip");
    strip.scrollTo({
      left:
        selected.offsetLeft -
        strip.offsetLeft -
        (strip.clientWidth - selected.clientWidth) / 2,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
}
function render() {
  const viewingScene = sceneVisible(),
    photo = state.activePhoto !== null ? photos[state.activePhoto] : null;
  $$("[data-mode]").forEach((b) =>
    b.setAttribute("aria-pressed", b.dataset.mode === state.mode),
  );
  const googleScene = sceneSource === "google";
  $$("[data-step]").forEach((b) =>
    b.setAttribute(
      "aria-current",
      b.dataset.step ===
        (state.panel === "notebook"
          ? "notebook"
          : state.mode === "map"
            ? "evidence"
            : "place")
        ? "step"
        : "false",
    ),
  );
  $("#scene").hidden = !viewingScene;
  $("#scene-markers").hidden = !viewingScene || state.peek || googleScene;
  $("#photo-cameras").hidden = !state.showCameras;
  $("#google-scene").hidden = !googleScene;
  $("#lidar-scene").hidden = googleScene;
  $("#viewer").classList.toggle("google-active", googleScene && viewingScene);
  $("#scene-source-bar").hidden = !googleEnabled || state.mode !== "scene";
  $$("[data-scene-source]").forEach((b) =>
    b.setAttribute("aria-pressed", b.dataset.sceneSource === sceneSource),
  );
  $("#scene-status").hidden =
    !$("#scene-status").textContent || state.mode !== "scene";
  $(".control-help strong").textContent = googleScene
    ? "Drag to explore · Ctrl + scroll to zoom"
    : "Drag to orbit · Double-click to recenter";
  if (googleScene)
    landscape?.setMarkers?.(!state.peek, state.showCameras && !state.peek);
  landscape?.setActiveView?.(state.view);
  $$("[data-view] .thumb small").forEach(
    (b) => (b.textContent = googleScene ? "NAIP LOCATOR" : "3D"),
  );
  $$("[data-view] .locator-thumb").forEach((svg) =>
    svg.toggleAttribute("hidden", !googleScene),
  );
  $$("[data-view] .thumb img").forEach((img) => (img.hidden = googleScene));
  $$("[data-view] .thumb img").forEach((img, i) => {
    const src =
      !googleScene && lidarThumbnails[i]
        ? lidarThumbnails[i]
        : D + "aerial.jpg";
    if (img.getAttribute("src") !== src) img.src = src;
  });
  $("#photo-surface").hidden = !photo || state.peek;
  $("#map-surface").hidden = state.mode !== "map";
  $("#scene-label").hidden =
    state.mode === "map" || (googleScene && state.peek);
  $("#scene-label").textContent = photo ? photo.title : views[state.view].title;
  $("#photo-session").hidden = !photo || state.mode !== "scene";
  $("#peek-scene").setAttribute("aria-pressed", state.peek);
  $("#peek-scene").textContent = state.peek ? "Show photo" : "Show 3D";
  $("#context-warning").hidden = !state.peek;
  $("#crosshair").hidden = !state.fly;
  $("#scene-controls").hidden = state.mode !== "scene";
  $("#source-controls").hidden = state.mode !== "photos";
  $("#map-controls").hidden = state.mode !== "map";
  $("#loading-state").hidden = !viewingScene || sceneReady || sceneFailed;
  $("#scene-error").hidden = !viewingScene || !sceneFailed;
  $("#viewer").setAttribute(
    "aria-busy",
    viewingScene && !sceneReady && !sceneFailed,
  );
  $("#peek-scene").disabled = !sceneReady;
  $("#fly-toggle").setAttribute("aria-pressed", state.fly);
  $("#fly-toggle span").textContent = state.fly ? "On" : "Off";
  $("#fly-toggle").disabled = !sceneReady || photo !== null;
  $("#cameras-toggle").setAttribute("aria-pressed", state.showCameras);
  $("#cameras-toggle").disabled = photo !== null;
  $("#top-view").disabled = !sceneReady;
  $("#overview").disabled = !sceneReady;
  $("#tour").disabled = !sceneReady;
  $("#viewer").classList.toggle("showing-photo", !!photo && !state.peek);
  $("#viewer").classList.toggle("fly-mode", state.fly);
  $("#workbench").classList.toggle("expanded", state.expanded);
  $("#expand-scene").setAttribute("aria-expanded", state.expanded);
  $("#expand-scene").setAttribute(
    "aria-label",
    state.expanded ? "Restore layout" : "Expand scene",
  );
  $("#expand-scene span").textContent = state.expanded
    ? "Restore layout"
    : "Expand scene";
  if (photo) {
    const img = $("#source-photo");
    if (img.getAttribute("src") !== P + photo.file) {
      $("#photo-error").hidden = true;
      img.src = P + photo.file;
    }
    img.alt = photo.alt;
    $("#photo-source-label").textContent =
      `${dateLabel(photo.date)} · ${photo.author}`;
    $("#photo-counter").textContent =
      `${state.activePhoto + 1} / ${photos.length}`;
    $("#photo-source-link").href = photo.source;
    $("#viewer-credit").innerHTML =
      `© ${photo.author} · ${dateLabel(photo.date)} · <a href="${photo.licenseUrl}" target="_blank" rel="noreferrer">${photo.license}</a> · <a href="${photo.source}" target="_blank" rel="noreferrer">Original photo </a><span class="credit-note">Independent photograph · not reconstruction input</span>`;
  } else if (state.mode === "scene")
    $("#viewer-credit").innerHTML =
      'USGS LiDAR · 2018–19 geometry / 2023 aerial color <span class="credit-note">650,000 measured points · no vertical exaggeration</span>';
  if (googleScene && viewingScene)
    $("#viewer-credit").innerHTML =
      'Google Maps · Photorealistic 3D context <span class="credit-note">Capture date unavailable · separate from dated evidence</span>';
  if (state.mode === "map") renderMap();
  $$("[data-view]").forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      state.mode === "scene" &&
        state.activePhoto === null &&
        Number(b.dataset.view) === state.view,
    ),
  );
  $$("[data-photo]").forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      Number(b.dataset.photo) === state.activePhoto,
    ),
  );
  $$("[data-landmark]").forEach((b) =>
    b.classList.toggle("active", Number(b.dataset.landmark) === state.view),
  );
  renderPanel();
  landscape?.resize();
}
function renderPanel() {
  $$("[data-panel]").forEach((b) => {
    b.setAttribute("aria-selected", b.dataset.panel === state.panel);
    b.tabIndex = b.dataset.panel === state.panel ? 0 : -1;
  });
  $("#notes-panel").hidden = state.panel !== "notes";
  $("#log-panel").hidden = state.panel !== "log";
  $("#notebook-panel").hidden = state.panel !== "notebook";
  $("#notebook-count").textContent = notebook.entries.length;
  $("#download-notes").disabled = !notebook.entries.length;
  if (state.panel === "notebook") {
    renderNotebook();
    return;
  }
  if (state.panel === "log") {
    const e = observations[state.event];
    $("#event-detail").innerHTML =
      `<span>${e.date}</span><small>${e.type}</small><h3>${e.title}</h3><p>${e.detail}</p><a href="${e.source}" target="_blank" rel="noreferrer">Open source record </a>`;
    if (sceneSource === "google" && e.mode === "scene")
      $("#event-detail").insertAdjacentHTML(
        "beforeend",
        '<p class="archive-hint">The map currently shows Google 3D context. Select this record below to open the dated LiDAR scan.</p>',
      );
    $$("[data-event]").forEach((b) =>
      b.setAttribute("aria-pressed", Number(b.dataset.event) === state.event),
    );
    return;
  }
  const photoIndex = state.activePhoto ?? state.locatedPhoto,
    photographic = photoIndex !== null,
    v = views[state.view],
    p = photos[photographic ? photoIndex : v.photo];
  if (state.mode === "map" && !photographic) {
    renderInspector();
    return;
  }
  $("#notes-panel").innerHTML =
    `<div class="side-photo"><button id="evidence-photo" aria-label="Open evidence photograph: ${p.title}"><img src="${P}${p.file}" alt="${p.alt}"/><span>${icon("camera")} ${photographic ? "SOURCE PHOTOGRAPH" : "GROUND EVIDENCE"}</span></button></div><div class="side-photo-credit">${p.author} · ${dateLabel(p.date)} · <a href="${p.licenseUrl}" target="_blank" rel="noreferrer">${p.license}</a></div><div class="note-copy"><span class="eyebrow">${photographic ? "FROM THE GROUND" : v.tag}</span><h2>${photographic ? p.title : v.heading}</h2><p>${photographic ? p.caption : v.body}</p><div class="question"><span>LOOK CLOSER</span><p>${photographic ? p.question : v.question}</p><button id="note-action">${photographic ? "Locate camera on aerial" : "Explore " + (v.layer === "ndwi" ? "water" : v.layer === "ndvi" ? "vegetation" : "natural color")} </button></div><p class="note-insight">${photographic ? p.insight : v.insight}</p>${photographic ? `<div class="photo-facts"><span>CAPTURED <b>${dateLabel(p.date)}</b></span><span>CAMERA LOCATION <b>${p.latitude.toFixed(5)}°, ${p.longitude.toFixed(5)}°</b></span><a href="${p.source}" target="_blank" rel="noreferrer">Original photograph & attribution </a></div><p class="small-caution">Contributor-reported camera location. Related 3D views are thematic, not calibrated camera matches.</p>` : `<div class="metrics-box"><span id="metric-label">SATELLITE OBSERVATION</span><div class="metrics"><div><span>NDVI</span><strong id="metric-ndvi">—</strong></div><div><span>NDWI</span><strong id="metric-ndwi">—</strong></div></div><p id="metric-context">10 m source bands · selected viewpoint</p></div><a class="lesson-link" href="https://geo-di-lab.github.io/emerge-lessons/docs/ch3/lesson3.html" target="_blank" rel="noreferrer">Method: EMERGE lesson </a>`}</div>`;
  if (!photographic && state.view === 0 && sceneSource === "google")
    $(".note-copy>p").textContent =
      "Explore Lake Alice’s textured 3D surroundings, then open a ground photograph or a dated satellite observation. Google’s scene is spatial context—not a dated scientific measurement or a reconstruction from these photos.";
  $("#evidence-photo").onclick = () =>
    dispatch({ type: "PHOTO", index: photographic ? photoIndex : v.photo });
  if (state.locatedPhoto !== null)
    $("#note-action").innerHTML = `Back to photograph `;
  $("#note-action").onclick = () => {
    stopTour();
    landscape?.setFly(false);
    if (state.locatedPhoto !== null) {
      dispatch({ type: "PHOTO", index: photoIndex });
    } else if (photographic) {
      state = transition(state, { type: "MODE", mode: "map" });
      state.layer = "aerial";
      state.locatedPhoto = photoIndex;
      render();
    } else {
      state = transition(state, { type: "MODE", mode: "map" });
      state.layer = v.layer;
      state.locatedPhoto = null;
      render();
    }
  };
  if (!photographic) {
    $(".note-copy").insertAdjacentHTML(
      "beforeend",
      '<p class="learner-context">For Gainesville students and curious neighbors. Explore a place, compare its evidence, then record what you can—and cannot—conclude.</p>',
    );
  }
  $(".note-copy").insertAdjacentHTML(
    "beforeend",
    '<button class="record-observation" id="record-observation">Record an observation ' +
      "" +
      "</button>",
  );
  $("#record-observation").onclick = openNotebook;
  updateMetrics();
}
function selectedPoint() {
  const v = views[state.view];
  return state.inspected ?? { x: v.position[0], z: v.position[2] };
}
function renderInspector() {
  const layer = LAYERS[state.layer],
    data = pointEvidence(study, selectedPoint()),
    aerial = state.layer === "aerial";
  const row = (key) =>
    `<tr><th scope="row">${key.toUpperCase()}</th><td>${numberLabel(data.spring?.[key])}</td><td>${numberLabel(data.autumn?.[key])}</td><td>${changeLabel(data.change[key])}</td></tr>`;
  $("#notes-panel").innerHTML =
    `<div class="inspector"><span class="eyebrow">02 / COMPARE THE EVIDENCE</span><h2>${layer.title}</h2><p>${layer.meaning}</p><div class="sample-location"><span>${state.inspected ? "SELECTED DISPLAY PIXEL" : "STUDY POINT " + String(state.view + 1).padStart(2, "0")}</span><strong>${state.inspected ? "Your selected location" : views[state.view].title}</strong><code>${data.lat.toFixed(5)}° N · ${Math.abs(data.lng).toFixed(5)}° W</code><small>Click the map or choose a numbered study point.</small></div>${aerial ? `<div class="evidence-note"><b>26 Jan 2023</b><p>NAIP center-tile acquisition. Dates can vary across the mosaic.</p></div>` : `<div class="pixel-comparison"><div class="table-heading">Same location · two dates</div><table><caption class="sr-only">Satellite indices at the selected location. Difference is September minus March.</caption><thead><tr><th>Index</th><th>21 Mar</th><th>22 Sep</th><th>Δ</th></tr></thead><tbody>${row("ndvi")}${row("ndwi")}</tbody></table><p>2024 · Δ = September − March<br>10 m source bands · resampled display</p></div><div class="evidence-note"><b>${dataStatus === "loading" ? "Loading measurements…" : dataStatus === "error" ? "Measurements unavailable" : data.spring?.ndvi === null || data.autumn?.ndvi === null ? "Some pixels have no data" : "What does this tell us?"}</b><p>${dataStatus === "error" ? "The numeric data did not load. Do not interpret missing values as zero. Reload the page to retry." : "A difference between two acquisitions is not a trend. Season, surface mix, shade, atmosphere, and residual masking errors can affect the values."}</p></div>${layer.formula ? `<details class="method-detail"><summary>How the index is calculated</summary><code>${layer.formula}</code><p>Near-infrared is light beyond visible red. Leaves and water reflect it differently. This is a reflectance ratio, not a direct measurement of environmental quality.</p></details>` : ""}`}
    <button class="record-observation" id="record-observation">Record this location </button><a class="lesson-link" href="${METHOD_URL}" target="_blank" rel="noreferrer">EMERGE · Textbook 1, Ch. 3, Lesson 3 </a></div>`;
  $("#record-observation").onclick = openNotebook;
}
function evidenceSnapshot() {
  const point = selectedPoint(),
    data = pointEvidence(study, point),
    photoIndex = state.activePhoto ?? state.locatedPhoto;
  if (photoIndex !== null) {
    const p = photos[photoIndex];
    return {
      title: p.title,
      detail: `Ground photograph · ${dateLabel(p.date)} · ${p.author} · ${p.license}. Independent of the 3D scene.`,
      location: `Contributor-reported camera: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}. Position and orientation not independently verified.`,
      measurements:
        "No satellite measurement is inferred from this photograph.",
      sources: [
        { label: "Original photograph", url: p.source },
        { label: p.license, url: p.licenseUrl },
      ],
    };
  }
  const location = `Study location: ${data.lat.toFixed(5)}, ${data.lng.toFixed(5)} (${state.inspected ? "selected display pixel" : "authored study point; not camera position"}).`;
  if (state.mode === "map")
    return {
      title: state.inspected
        ? "Selected satellite location"
        : views[state.view].title,
      detail: `${LAYERS[state.layer].name} · ${state.layer === "aerial" ? "NAIP center tile 26 Jan 2023" : state.compare ? "21 Mar / 22 Sep 2024" : SEASONS[state.season]}.`,
      location,
      measurements:
        state.layer === "aerial"
          ? "Aerial context only."
          : `Same location, 21 Mar 2024: NDVI ${numberLabel(data.spring?.ndvi)}, NDWI ${numberLabel(data.spring?.ndwi)}. 22 Sep 2024: NDVI ${numberLabel(data.autumn?.ndvi)}, NDWI ${numberLabel(data.autumn?.ndwi)}. September minus March: NDVI ${changeLabel(data.change.ndvi)}, NDWI ${changeLabel(data.change.ndwi)}. Source bands 10 m; display resampled; masked pixels are no data. Two dates do not establish a trend.`,
      sources:
        state.layer === "aerial"
          ? [{ label: "USGS NAIP service", url: observations[2].source }]
          : [
              {
                label: "21 Mar 2024 Sentinel-2 record",
                url: observations[3].source,
              },
              {
                label: "22 Sep 2024 Sentinel-2 record",
                url: observations[4].source,
              },
              { label: "EMERGE method", url: METHOD_URL },
            ],
    };
  return {
    title: views[state.view].title,
    detail:
      sceneSource === "google"
        ? "Google photorealistic 3D · capture date unavailable. Spatial context, not a dated measurement."
        : "USGS LiDAR · 2018–19 geometry with separate 2023 aerial color.",
    location,
    measurements: "No satellite measurement is inferred from the 3D rendering.",
    sources: [
      {
        label:
          sceneSource === "google"
            ? "Google Maps 3D context"
            : "USGS LiDAR source",
        url:
          sceneSource === "google"
            ? `https://www.google.com/maps/@?api=1&map_action=map&center=${data.lat},${data.lng}&zoom=17&basemap=satellite`
            : observations[0].source,
      },
    ],
  };
}
function openNotebook() {
  state.panel = "notebook";
  render();
  $("#notebook-observation").focus({ preventScroll: true });
}
function renderNotebook() {
  const snapshot = notebook.draftSnapshot ?? evidenceSnapshot(),
    e = escapeHtml;
  $("#notebook-panel").innerHTML =
    `<div class="notebook"><span class="eyebrow">03 / MAKE YOUR OWN OBSERVATION</span><h2>Your field notebook.</h2><p>Separate what you see from what you think it means. Your notes stay in this browser; they are not submitted or shared.</p><div class="notebook-context"><span>EVIDENCE ATTACHED ON SAVE</span><strong>${e(snapshot.title)}</strong><p>${e(snapshot.detail)}</p><small>${e(snapshot.location)}</small></div><form id="notebook-form"><label for="notebook-observation">What do you observe? <span>Required</span></label><textarea id="notebook-observation" name="observation" maxlength="3000" rows="3" required placeholder="Describe a visible pattern or a measured value.">${e(notebook.draft.observation)}</textarea><label for="notebook-interpretation">How do you interpret it?</label><textarea id="notebook-interpretation" name="interpretation" maxlength="3000" rows="2" placeholder="A possible explanation—not a proven cause.">${e(notebook.draft.interpretation)}</textarea><label for="notebook-uncertainty">What is uncertain?</label><textarea id="notebook-uncertainty" name="uncertainty" maxlength="3000" rows="2" placeholder="What else would you need to check?">${e(notebook.draft.uncertainty)}</textarea><p class="storage-status" id="storage-status" role="status">${storageReady ? "Draft stored only in this browser." : "Browser storage is unavailable or unreadable. Notes are temporary; export to keep them."}</p><button type="submit" class="record-observation">Save observation </button></form><p class="notebook-feedback" role="status">${e(notebookFeedback)}</p><div class="notebook-list-heading"><h3>Saved observations <span>${notebook.entries.length}</span></h3><button id="export-notebook" ${notebook.entries.length ? "" : "disabled"}>Export .md </button></div><div class="notebook-entries">${notebook.entries.length ? notebook.entries.map((entry) => `<details><summary><span>${e(entry.snapshot.title)}</span><small>${dateLabel(entry.createdAt)}</small></summary><div><b>Observed</b><p>${e(entry.observation)}</p><b>Interpretation</b><p>${e(entry.interpretation || "Not recorded.")}</p><b>Uncertainty</b><p>${e(entry.uncertainty || "Not recorded.")}</p><p class="entry-provenance">${e(entry.snapshot.detail)}<br>${e(entry.snapshot.location)}<br>${e(entry.snapshot.measurements)}</p>${entry.snapshot.sources.map((s) => `<a href="${e(s.url)}" target="_blank" rel="noreferrer">${e(s.label)}</a>`).join("")}</div></details>`).join("") : '<div class="notebook-empty"><span>One careful observation is a start.</span><p>Choose a place or a pixel, describe it, and save its source alongside your note.</p></div>'}</div></div>`;
  $("#notebook-form").oninput = (event) => {
    notebook.draftSnapshot ??= evidenceSnapshot();
    notebook.draft[event.target.name] = event.target.value;
    storageReady =
      canPersistNotebook && storeNotebook(notebookStorage, notebook);
    $("#storage-status").textContent = storageReady
      ? "Draft saved in this browser."
      : "Could not save in this browser. Your draft is temporary; save and export it.";
    $(".notebook-context > span").textContent =
      "ATTACHED EVIDENCE · KEPT WITH THIS DRAFT";
  };
  $(".notebook-context > span").textContent = notebook.draftSnapshot
    ? "ATTACHED EVIDENCE · KEPT WITH THIS DRAFT"
    : "CURRENT EVIDENCE · ATTACHED WHEN YOU WRITE";
  const attachButton = document.createElement("button");
  attachButton.type = "button";
  attachButton.className = "attach-evidence";
  attachButton.textContent = "Use current view as evidence";
  attachButton.onclick = () => {
    notebook.draftSnapshot = evidenceSnapshot();
    storageReady =
      canPersistNotebook && storeNotebook(notebookStorage, notebook);
    notebookFeedback = "Draft evidence updated to the current view.";
    renderNotebook();
  };
  $(".notebook-context").append(attachButton);
  $("#notebook-form").onsubmit = (event) => {
    event.preventDefault();
    const result = addEntry(notebook, evidenceSnapshot(), {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    if (result.error) {
      notebookFeedback = result.error;
      renderNotebook();
      return;
    }
    notebook = result.notebook;
    storageReady =
      canPersistNotebook && storeNotebook(notebookStorage, notebook);
    notebookFeedback = storageReady
      ? "Observation saved with its evidence."
      : "Observation saved in memory only. Export it before leaving this page.";
    renderPanel();
  };
  $("#export-notebook").onclick = exportNotebook;
}
function exportNotebook() {
  if (!notebook.entries.length) {
    openNotebook();
    return;
  }
  const url = URL.createObjectURL(
    new Blob([notebookMarkdown(notebook)], {
      type: "text/markdown;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "fieldlens-lake-alice-notebook.md";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Notebook export prepared with your observations and linked evidence.");
}
function renderMap() {
  const aerial = state.layer === "aerial";
  const first = state.compare && !aerial ? "spring" : state.season;
  $("#map-image").src = aerial
    ? D + "aerial.jpg"
    : `${D}${first}-${state.layer}.png`;
  $("#map-image").alt = aerial
    ? "USGS NAIP aerial view of Lake Alice"
    : `${first === "spring" ? "March 21" : "September 22"}, 2024 Sentinel-2 ${state.layer.toUpperCase()} at Lake Alice`;
  $("#map-stage").classList.toggle("pixel-map", !aerial);
  const comparison = state.compare && !aerial;
  $("#compare-clip").hidden = !comparison;
  $("#compare-divider").hidden = !comparison;
  $("#swipe-label").hidden = !comparison;
  if (comparison) {
    $("#compare-image").src = `${D}autumn-${state.layer}.png`;
    updateSwipe();
  }
  $("#date-row").hidden = aerial;
  $("#compare-dates").setAttribute("aria-pressed", comparison);
  $("#compare-dates").textContent = comparison
    ? "Exit comparison"
    : "Compare dates";
  $$("[data-layer]").forEach((b) =>
    b.setAttribute("aria-pressed", b.dataset.layer === state.layer),
  );
  $$("[data-season]").forEach((b) =>
    b.setAttribute("aria-pressed", b.dataset.season === state.season),
  );
  $("#map-badge").textContent = aerial
    ? "NAIP · AERIAL MOSAIC"
    : comparison
      ? "SENTINEL-2 · MAR / SEP 2024"
      : `SENTINEL-2 · ${state.season === "spring" ? "21 MAR" : "22 SEP"} 2024`;
  $("#map-date-first").textContent = aerial
    ? "26 JAN 2023 · CENTER TILE"
    : SEASONS[first];
  $("#map-date-second").textContent = SEASONS.autumn;
  $("#map-date-second").hidden = !comparison;
  $("#map-legend").hidden = aerial || state.layer === "rgb";
  $("#legend-title").textContent =
    state.layer === "ndvi" ? "Vegetation · NDVI" : "Water · NDWI";
  $("#legend-gradient").className = state.layer;
  $("#legend-gradient").style.background = LAYERS[state.layer].gradient ?? "";
  $("#legend-meaning").textContent = LAYERS[state.layer].high ?? "";
  const located = state.locatedPhoto != null;
  $("#map-markers").innerHTML = located
    ? (() => {
        const i = state.locatedPhoto,
          p = photos[i],
          point = photoMapPosition(p);
        return `<button class="map-camera" data-map-photo="${i}" style="left:${point.left}%;top:${point.top}%" aria-label="Open camera photograph: ${p.title}">${icon("camera")}<span>Photo ${i + 1}</span></button>`;
      })()
    : views
        .map(
          (v, i) =>
            `<button class="map-point ${i === state.view ? "active" : ""}" data-map-view="${i}" style="left:${(v.position[0] / 1000 + 0.5) * 100}%;top:${(v.position[2] / 780 + 0.5) * 100}%" aria-label="Inspect ${v.title}">${i + 1}</button>`,
        )
        .join("");
  $$("[data-map-view]").forEach(
    (b) =>
      (b.onclick = () => {
        state.view = Number(b.dataset.mapView);
        state.inspected = null;
        render();
      }),
  );
  $$("[data-map-photo]").forEach(
    (b) =>
      (b.onclick = () => {
        state.locatedPhoto = null;
        dispatch({ type: "PHOTO", index: Number(b.dataset.mapPhoto) });
      }),
  );
  $("#viewer-credit").textContent = located
    ? "Camera location supplied by the photographer · position and viewing direction not independently verified"
    : aerial
      ? "NAIP / USDA / USGS · center tile: Jan 26, 2023 · acquisition dates can vary across the mosaic"
      : "Sentinel-2 L2A · 10 m source bands · cloud / invalid pixels masked · select a pixel to inspect";
  renderSelectedPixel();
  resizeMap();
}
function renderSelectedPixel() {
  const grid = study?.grids[state.season],
    sample = sampleGrid(grid, selectedPoint().x, selectedPoint().z),
    highlight = $("#sample-highlight");
  highlight.hidden = state.layer === "aerial" || !sample;
  if (sample) {
    highlight.style.left = (sample.col / grid.width) * 100 + "%";
    highlight.style.top = (sample.row / grid.height) * 100 + "%";
    highlight.style.width = 100 / grid.width + "%";
    highlight.style.height = 100 / grid.height + "%";
  }
}
function resizeMap() {
  const frame = $("#viewer"),
    stage = $("#map-stage");
  const legendSpace = matchMedia("(max-width: 600px)").matches ? 84 : 0;
  const width = Math.min(
    frame.clientWidth,
    ((frame.clientHeight - legendSpace) * 1600) / 1248,
  );
  stage.style.width = width + "px";
  stage.style.height = (width * 1248) / 1600 + "px";
}
new ResizeObserver(resizeMap).observe($("#viewer"));
function sample(x, z, season) {
  return sampleGrid(study?.grids[season], x, z);
}
function activeSample() {
  const v = views[state.view],
    p = state.inspected;
  const x = p?.x ?? v.position[0],
    z = p?.z ?? v.position[2];
  const season =
    state.compare && state.mode === "map" && state.layer !== "aerial"
      ? (x / 1000 + 0.5) * 100 > state.swipe
        ? "autumn"
        : "spring"
      : state.season;
  return { ...sample(x, z, season), season };
}
function updateMetrics() {
  if (!$("#metric-label")) return;
  const data = activeSample();
  $("#metric-label").textContent =
    `${data.season === "spring" ? "21 MAR" : "22 SEP"} 2024 · SENTINEL-2`;
  $("#metric-ndvi").textContent =
    data.ndvi == null ? "—" : data.ndvi.toFixed(2);
  $("#metric-ndwi").textContent =
    data.ndwi == null ? "—" : data.ndwi.toFixed(2);
  $("#metric-context").textContent = state.inspected
    ? "Selected pixel · 10 m source bands"
    : "Selected viewpoint · 10 m source bands";
  if (state.locatedPhoto != null) {
    $(".metrics-box").hidden = true;
  }
}
function updateSwipe() {
  state.swipe = clampSwipe($("#swipe").value);
  $("#compare-clip").style.clipPath = `inset(0 0 0 ${state.swipe}%)`;
  $("#compare-divider").style.left = state.swipe + "%";
  $("#compare-divider").setAttribute("aria-valuenow", state.swipe);
  $("#compare-divider").setAttribute(
    "aria-valuetext",
    `${Math.round(state.swipe)}% March, ${Math.round(100 - state.swipe)}% September`,
  );
  updateMetrics();
}
$("#swipe").oninput = updateSwipe;
let draggingDivider = false;
function moveDivider(event) {
  const box = $("#map-stage").getBoundingClientRect();
  $("#swipe").value = clampSwipe(
    ((event.clientX - box.left) / box.width) * 100,
  );
  updateSwipe();
}
$("#compare-divider").onpointerdown = (event) => {
  event.preventDefault();
  event.stopPropagation();
  draggingDivider = true;
  event.currentTarget.setPointerCapture(event.pointerId);
  moveDivider(event);
};
$("#compare-divider").onpointermove = (event) => {
  if (draggingDivider) {
    event.stopPropagation();
    moveDivider(event);
  }
};
$("#compare-divider").onpointerup = (event) => {
  draggingDivider = false;
  event.currentTarget.releasePointerCapture(event.pointerId);
};
$("#compare-divider").onpointercancel = () => (draggingDivider = false);
$("#compare-divider").onclick = (event) => event.stopPropagation();
$("#compare-divider").onkeydown = (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  $("#swipe").value =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? 100
        : state.swipe + (event.key === "ArrowRight" ? 2 : -2);
  updateSwipe();
};
function mapPosition(e) {
  const box = $("#map-stage").getBoundingClientRect();
  return {
    x: ((e.clientX - box.left) / box.width - 0.5) * 1000,
    z: ((e.clientY - box.top) / box.height - 0.5) * 780,
  };
}
$("#map-stage").onpointermove = (e) => {
  if (
    state.layer === "aerial" ||
    !study ||
    draggingDivider ||
    e.target.closest('button,[role="slider"]')
  )
    return;
  const p = mapPosition(e);
  const season =
    state.compare && (p.x / 1000 + 0.5) * 100 > state.swipe
      ? "autumn"
      : state.compare
        ? "spring"
        : state.season;
  const result = sample(p.x, p.z, season);
  if (!result) return;
  const tip = $("#pixel-tooltip");
  tip.hidden = false;
  tip.textContent = `${SEASONS[season]} · NDVI ${numberLabel(result.ndvi)} · NDWI ${numberLabel(result.ndwi)}`;
};
$("#map-stage").onpointerleave = () => ($("#pixel-tooltip").hidden = true);
$("#map-stage").onclick = (e) => {
  if (e.target.closest('button,[role="slider"]') || state.layer === "aerial")
    return;
  state.inspected = mapPosition(e);
  renderSelectedPixel();
  renderPanel();
};
function stopTour() {
  clearInterval(tourTimer);
  tourTimer = null;
  $("#tour").setAttribute("aria-pressed", "false");
  $("#tour").setAttribute("aria-label", "Follow scene tour");
  $("#tour").innerHTML = icon("play");
}
$("#tour").onclick = () => {
  if (tourTimer) {
    stopTour();
    return;
  }
  dispatch({ type: "VIEW", index: 0 });
  tourIndex = 0;
  $("#tour").setAttribute("aria-pressed", "true");
  $("#tour").setAttribute("aria-label", "Pause scene tour");
  $("#tour").innerHTML = icon("pause");
  tourTimer = setInterval(() => {
    if (++tourIndex >= views.length) {
      stopTour();
      return;
    }
    state = transition(state, { type: "VIEW", index: tourIndex });
    landscape?.moveTo(views[tourIndex]);
    render();
  }, 7500);
};
$$("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      state.locatedPhoto = null;
      dispatch({ type: "MODE", mode: b.dataset.mode });
    }),
);
$$("[data-view],[data-landmark]").forEach(
  (b) =>
    (b.onclick = () => {
      state.locatedPhoto = null;
      dispatch({
        type: "VIEW",
        index: Number(b.dataset.view ?? b.dataset.landmark),
      });
    }),
);
$$("[data-photo],[data-camera]").forEach(
  (b) =>
    (b.onclick = () =>
      dispatch({
        type: "PHOTO",
        index: Number(b.dataset.photo ?? b.dataset.camera),
      })),
);
$$("[data-panel]").forEach(
  (b) =>
    (b.onclick = () => {
      state.panel = b.dataset.panel;
      render();
    }),
);
$(".panel-tabs").onkeydown = (e) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  e.stopPropagation();
  const panels = ["notes", "log", "notebook"];
  state.panel =
    e.key === "Home"
      ? "notes"
      : e.key === "End"
        ? "notebook"
        : panels[
            (panels.indexOf(state.panel) + (e.key === "ArrowRight" ? 1 : 2)) % 3
          ];
  render();
  $(`[data-panel="${state.panel}"]`).focus();
};
$$("[data-step]").forEach(
  (b) =>
    (b.onclick = () => {
      if (b.dataset.step === "notebook") {
        openNotebook();
        return;
      }
      state.panel = "notes";
      if (b.dataset.step === "place") dispatch({ type: "VIEW", index: 0 });
      else {
        dispatch({ type: "MODE", mode: "map" });
        state.layer = "ndwi";
        state.compare = true;
        render();
      }
    }),
);
$$("[data-event]").forEach(
  (b) =>
    (b.onclick = () => {
      state.locatedPhoto = null;
      dispatch({ type: "EVENT", index: Number(b.dataset.event) });
    }),
);
$$("[data-layer]").forEach(
  (b) =>
    (b.onclick = () => {
      state.layer = b.dataset.layer;
      state.locatedPhoto = null;
      state.inspected = null;
      render();
    }),
);
$$("[data-season]").forEach(
  (b) =>
    (b.onclick = () => {
      state.season = b.dataset.season;
      state.compare = false;
      state.inspected = null;
      render();
    }),
);
$("#compare-dates").onclick = () => {
  state.compare = !state.compare;
  state.inspected = null;
  render();
};
$("#peek-scene").onclick = () => dispatch({ type: "PEEK" });
$("#back-scene").onclick = () => dispatch({ type: "BACK" });
$("#prev-photo").onclick = () =>
  dispatch({
    type: "PHOTO",
    index: (state.lastPhoto + photos.length - 1) % photos.length,
  });
$("#next-photo").onclick = () =>
  dispatch({ type: "PHOTO", index: (state.lastPhoto + 1) % photos.length });
$("#source-photo").onerror = () => ($("#photo-error").hidden = false);
$("#source-photo").onload = () => ($("#photo-error").hidden = true);
$("#retry-photo").onclick = () => {
  const img = $("#source-photo");
  img.src = img.src;
};
$("#fly-toggle").onclick = () => {
  stopTour();
  state.fly = !state.fly;
  landscape?.setFly(state.fly);
  render();
};
$("#cameras-toggle").onclick = () => {
  state.showCameras = !state.showCameras;
  render();
};
$$("[data-scene-source]").forEach(
  (b) =>
    (b.onclick = () => {
      dispatch({ type: "BACK" });
      selectScene(b.dataset.sceneSource);
    }),
);
$("#top-view").onclick = () => {
  dispatch({ type: "BACK" });
  landscape?.moveTo({ camera: [30, 820, 0.01], target: [30, 0, 0] });
};
$("#overview").onclick = () => dispatch({ type: "VIEW", index: 0 });
$("#expand-scene").onclick = () => {
  state.expanded = !state.expanded;
  render();
};
$("#previous-views").onclick = () =>
  $("#viewpoint-strip").scrollBy({ left: -340, behavior: "smooth" });
$("#next-views").onclick = () =>
  $("#viewpoint-strip").scrollBy({ left: 340, behavior: "smooth" });
document.addEventListener("keydown", (e) => {
  if (
    $("#source-dialog").open ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    e.target.matches("input,textarea,select")
  )
    return;
  if (e.key === "Escape") {
    if (state.activePhoto !== null) dispatch({ type: "BACK" });
    else if (state.expanded) {
      state.expanded = false;
      render();
    } else if (state.fly) {
      state.fly = false;
      landscape?.setFly(false);
      render();
    }
    return;
  }
  if (
    (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
    state.mode !== "map"
  ) {
    e.preventDefault();
    const delta = e.key === "ArrowLeft" ? -1 : 1;
    dispatch({
      type: "PHOTO",
      index: (state.lastPhoto + delta + photos.length) % photos.length,
    });
  }
});
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  setTimeout(() => ($("#toast").hidden = true), 4000);
}
function openSources() {
  $("#source-content").innerHTML =
    `<h2>Follow the evidence.</h2><p>RealLens adapts EMERGE’s vegetation and water indices lesson into a Lake Alice study. The observations come from different dates and instruments.</p><h3>01 · LiDAR geometry</h3><p>USGS 3DEP Alachua survey: December 2018–December 2019. 650,000 measured points in a deterministic display subset; no vertical exaggeration. This is LiDAR, not a Gaussian splat.</p><a href="https://portal.opentopography.org/usgsDataset?dsid=FL_Peninsular_FDEM_Alachua_2018" target="_blank" rel="noreferrer">USGS dataset and survey metadata</a><h3>02 · Aerial color</h3><p>USDA / USGS NAIP Plus. The center tile was captured January 26, 2023; mosaic dates may vary. Aerial RGB colors the older LiDAR from above. The flat image below the scan is context, not measured water depth.</p><a href="https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer" target="_blank" rel="noreferrer">NAIP imagery service</a><h3>03 · Sentinel-2 and EMERGE</h3><p>Two individual L2A Collection 1 scenes: March 21 and September 22, 2024. Spectral source bands: 10 m. SCL classes 4, 5, 6, 7 are retained; cloud, shadow, snow, no-data, and defective classes are masked. Residual classification errors remain possible.</p><code>NDVI = (NIR − red) / (NIR + red)<br>NDWI = (green − NIR) / (green + NIR)</code><p>EMERGE Textbook 1, Chapter 3, Lesson 3. Our adaptation uses individual dated scenes instead of a temporal median, adds a quality mask, and aligns the display with nearest-neighbor reprojection. It does not increase the source resolution.</p><a href="https://geo-di-lab.github.io/emerge-lessons/docs/ch3/lesson3.html" target="_blank" rel="noreferrer">EMERGE source lesson</a>${(study?.satellite.scenes || []).map((s) => `<a href="${s.stacUrl}" target="_blank" rel="noreferrer">${dateLabel(s.datetime)} · STAC source record</a>`).join("")}<h3>04 · Ground photographs</h3>${photos.map((p) => `<p><a href="${p.source}" target="_blank" rel="noreferrer">${p.originalTitle}</a>${p.author} · ${dateLabel(p.date)} · <a class="inline" href="${p.licenseUrl}" target="_blank" rel="noreferrer">${p.license}</a></p>`).join("")}<p>Wikimedia’s 1280-pixel previews are bundled without image edits. Thumbnail cards crop the display; the viewer preserves the full frame. Camera XY positions come from contributor metadata; marker height is anchored to the nearest archived LiDAR ground return, not a measured camera elevation. Photo orientation and position accuracy are unverified. “Show 3D” opens related context, not a calibrated image/scan registration.</p><h3>Limits and credit</h3><p>These indices and photographs do not establish water quality, disease risk, mosquito abundance, or causal environmental change. Two dates do not establish a trend. No GLOBE observations or geoemerge package are used. The source includes reproducible preparation and validation scripts.</p><p>Interaction layout follows the Flight 7598 explorer reference, implemented independently with Three.js and public Lake Alice data. No reference-site code, branding, or media is reused. This is not an official NASA, USGS, UF, EMERGE, or photographer-endorsed product.</p><a href="https://facilities.ufl.edu/lakealice/about/project-overview/" target="_blank" rel="noreferrer">UF Lake Alice watershed context</a>`;
  if (googleEnabled) {
    $("#source-content").insertAdjacentHTML(
      "afterbegin",
      '<div class="google-source-note"><h3>Local preview · Google photorealistic 3D</h3><p>The textured landscape is streamed directly by the Google Maps JavaScript 3D SDK. Google’s imagery capture date is not supplied here. This is spatial context, not the 2018–19 LiDAR survey, a current-condition claim, or a model generated from the four ground photographs. The observation log’s LiDAR record switches back to the archived scan. Google imagery is not used to calculate NDVI or NDWI.</p><p>The demo key is for local evaluation only and is excluded from production builds. Google attribution remains inside the map. No Google tile data, geometry, or screenshot thumbnails are exported or cached by RealLens; viewpoint thumbnail images use the independent NAIP aerial mosaic. Photo markers use contributor XY coordinates with an illustrative height above Google terrain.</p><a href="https://cloud.google.com/terms/maps-platform/demo-project-terms" target="_blank" rel="noreferrer">Google Maps demo project terms</a></div>',
    );
  }
  $("#source-dialog").showModal();
}
$("#sources-top").onclick = openSources;
$("#sources-footer").onclick = openSources;
$("#close-dialog").onclick = () => $("#source-dialog").close();
$("#source-dialog").onclick = (e) => {
  if (e.target === $("#source-dialog")) $("#source-dialog").close();
};
$("#download-notes").onclick = exportNotebook;
async function json(file) {
  const response = await fetch(D + file);
  if (!response.ok) throw new Error("Study data unavailable: " + file);
  return response.json();
}
async function loadPoints() {
  const response = await fetch(D + "lake-alice.bin");
  if (!response.ok) throw new Error("LiDAR unavailable");
  const reader = response.body.getReader(),
    chunks = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const percent = Math.min(95, Math.round((received / 10400000) * 95));
    $("#load-progress").style.width = percent + "%";
    $("#load-percent").textContent = percent + "%";
    $("#load-label").textContent =
      `Reading measured points · ${(received / 1000000).toFixed(1)} MB`;
  }
  const data = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data.buffer;
}
render();
async function loadStudy() {
  try {
    const [satellite, spring, autumn] = await Promise.all([
      json("satellite.json"),
      json("spring-grid.json"),
      json("autumn-grid.json"),
    ]);
    study = { satellite, grids: { spring, autumn } };
    dataStatus = "ready";
    render();
  } catch (error) {
    dataStatus = "error";
    render();
    toast(
      "Satellite measurements could not load. The photographs remain available.",
    );
  }
}
async function getEngine(source) {
  if (engines.has(source)) return engines.get(source);
  if (engineLoads.has(source)) return engineLoads.get(source);
  const loading = (async () => {
    const host = $("#" + source + "-scene");
    const options = {
      views,
      photos,
      onInteract: stopTour,
      isVisible: () => sceneVisible() && sceneSource === source,
      onView: (index) => dispatch({ type: "VIEW", index }),
      onPhoto: (index) => dispatch({ type: "PHOTO", index }),
    };
    let engine;
    try {
      if (source === "google" && import.meta.env.DEV) {
        const { GoogleLandscape } = await import("./google-landscape.js");
        engine = new GoogleLandscape(host, options);
        await engine.load(demoKey);
      } else {
        engine = new Landscape(host, {
          ...options,
          markers: {
            views: $$("[data-landmark]"),
            photos: $$("[data-camera]"),
          },
        });
        const buffer = await loadPoints();
        await engine.load(buffer, D + "aerial.jpg");
        lidarThumbnails = engine.thumbnails();
      }
      engines.set(source, engine);
      return engine;
    } catch (error) {
      engine?.setFly(false);
      engine?.dispose?.();
      host.replaceChildren();
      throw error;
    }
  })();
  engineLoads.set(source, loading);
  try {
    return await loading;
  } finally {
    engineLoads.delete(source);
  }
}
async function selectScene(source) {
  if (source === "google" && !googleEnabled) return;
  stopTour();
  landscape?.setFly(false);
  state.fly = false;
  savedPose = null;
  sceneSource = source;
  sceneReady = false;
  sceneFailed = false;
  landscape = null;
  const request = ++sceneRequest;
  if (source === "google") $("#scene-status").textContent = "";
  $("#load-label").textContent =
    source === "google"
      ? "Streaming Google photorealistic 3D · Lake Alice"
      : "USGS LiDAR · Lake Alice";
  $("#load-percent").textContent =
    source === "google" ? "DEMO KEY · LOCAL PREVIEW" : "0%";
  $("#load-progress").style.width = source === "google" ? "35%" : "0%";
  render();
  try {
    const engine = await getEngine(source);
    if (request !== sceneRequest) return;
    landscape = engine;
    sceneReady = true;
    landscape.moveTo(
      views[state.peek ? photos[state.activePhoto].relatedView : state.view],
      true,
    );
    render();
  } catch (error) {
    if (request !== sceneRequest) return;
    // Do not log SDK URLs or credentials. A visible provider label prevents silent substitution.
    if (source === "google") {
      $("#scene-status").textContent =
        "Google 3D could not load. Showing the archived LiDAR instead; photos and satellite evidence are unchanged.";
      await selectScene("lidar");
    } else {
      sceneFailed = true;
      state = transition(state, { type: "MODE", mode: "photos" });
      render();
      toast(
        "3D unavailable on this device. Source photos and satellite layers still work.",
      );
    }
  }
}
await Promise.all([loadStudy(), selectScene(sceneSource)]);
