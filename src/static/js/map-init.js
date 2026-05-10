// map-init.js — Leaflet map, controls, markers, file layer, menu

// ===== LeafletMenu =====
L.Control.LeafletMenu = L.Control.extend({
  options: { mapId: "map", items: [], button: void 0 },
  statics: {
    CLASS: "leaflet-menu",
    OverFlow_Y: "overflow-y",
    OverFlow_X: "overflow-x",
  },
  initialize: function (a, b) {
    L.setOptions(this, b);
    this.map = a;
    this.menuItem = [];
    this.menu_div = L.DomUtil.create(
      "div",
      "menu",
      document.getElementById(this.options.mapId),
    );
    this.container();
    L.DomEvent.on(this.container, "click", this._onMouseClick, this)
      .on(this.container, "mouseover", this._onMouseOver, this)
      .on(this.container, "mouseout", this._onMouseOut, this)
      .on(this.container, "mousewheel", L.DomEvent.stop)
      .on(this.container, "mousedown", L.DomEvent.stop)
      .on(this.container, "dblclick", L.DomEvent.stop)
      .on(this.container, "contextmenu", L.DomEvent.stop)
      .on(window, "click", this.hide, this);
  },
  container: function () {
    return (
      (this.container = L.DomUtil.create(
        "div",
        L.Control.LeafletMenu.CLASS,
        this.menu_div,
      )),
      (this.container.style.position = "absolute"),
      (this.container.style.OverFlow_Y = "auto"),
      (this.container.style.OverFlow_X = "hidden"),
      this
    );
  },
  createMenu: function () {
    const button = L.DomUtil.get("styles-menu");
    if (!button) {
      console.error("Button not found");
      return;
    }
    const buttonRect = button.getBoundingClientRect();
    const mapContainer = document.querySelector(".leaflet-container");
    if (!mapContainer) {
      console.error("Map container not found");
      return;
    }
    const mapRect = mapContainer.getBoundingClientRect();
    const menuLeft = buttonRect.right - mapRect.left + 2;
    const menuTop = buttonRect.top - mapRect.top;
    this.container.style.position = "absolute";
    this.container.style.left = menuLeft + "px";
    this.container.style.top = menuTop + "px";
    this._removeItems()._createItems();
    return this;
  },
  removeMenu: function () {
    for (; this.menu_div.firstChild; )
      this.menu_div.removeChild(this.menu_div.firstChild);
  },
  _createItems: function () {
    for (
      var a = this.options.items, b = Object.keys(a), c = 0;
      c <= b.length - 1;
      c++
    ) {
      this.menuItem[c] = L.DomUtil.create(
        "a",
        "leaflet-menu-item",
        this.container,
      );
      this.menuItem[c].text = b[c];
      if (a[b[c]].onClick) {
        if (a[b[c]].onClick && a[b[c]].href)
          throw "Menu item could not be clickable and redirectable at the same time";
      } else {
        this.menuItem[c].href = a[b[c]].href;
      }
    }
    return this;
  },
  _removeItems: function () {
    for (; this.container.firstChild; )
      this.container.removeChild(this.container.firstChild);
    return this;
  },
  show: function () {
    try {
      this.createMenu();
      this.container.style.display = "block";
      this.options.button && this.options.button.state("hide-menu");
    } catch (a) {
      console.log("Error(show-menu): \n" + a);
    }
  },
  hide: function () {
    try {
      this.container.style.display = "none";
      this.options.button && this.options.button.state("show-menu");
    } catch (a) {
      console.log("Error(hide-menu): \n" + a);
    }
  },
  _itemFunc: function (a) {
    if (this.options.items[a].href) return this;
    if (this.target) {
      if (!this.target || !this.target._map)
        throw "Sorry, there could be some error with your function";
      try {
        this.map.removeLayer(this.target);
        this.target = void 0;
      } catch (a) {
        console.log("Error(Removing target): \n" + a);
      }
    } else {
      this.target = this.options.items[a].onClick(arguments);
    }
  },
  _onMouseOver: function (a) {
    L.DomUtil.addClass(a.target || a.srcElement, "over");
  },
  _onMouseOut: function (a) {
    L.DomUtil.removeClass(a.target || a.src.Element, "over");
  },
  _onMouseClick: function (a) {
    this._itemFunc(a.target.text);
  },
});
L.leafletMenu = function (a, b) {
  return new L.Control.LeafletMenu(a, b);
};

// ===== Global Variables =====
let map = null;
let marker = null;
let drawnItems = new L.FeatureGroup();
let gpxArray = [];
let orangeIcon;
let markerLatLngs = [];
let lineLatLngs = [];
let isDrawingMode = false;
let currentFeature = null;
let currentLayer = null;

const connectTextElement = document.getElementById("connectText");
const rsdDataElement = document.getElementById("rsdData");

// Read config injected by Flask template
var appVersionNum = window.APP_CONFIG ? window.APP_CONFIG.appVersionNum : "";
var appVersionType = window.APP_CONFIG ? window.APP_CONFIG.appVersionType : "";
var selectedDevicePlatform = window.APP_CONFIG
  ? window.APP_CONFIG.currentPlatform
  : "";

if (appVersionType === "standard") {
  const fuelTypeSection = document.getElementById("fuelTypeSection");
  const fuelRegionSection = document.getElementById("fuelRegionSection");
  const enableFuelPricesCheckbox = document.getElementById("enableFuelPrices");
  const enableFuelPricesLabel = document.querySelector(
    'label[for="enableFuelPrices"]',
  );
  if (enableFuelPricesLabel) enableFuelPricesLabel.style.display = "none";
  if (fuelTypeSection) fuelTypeSection.style.display = "none";
  if (fuelRegionSection) fuelRegionSection.style.display = "none";
  if (enableFuelPricesCheckbox) enableFuelPricesCheckbox.style.display = "none";
}

if (connectTextElement && rsdDataElement) {
  rsdDataElement.style.display =
    connectTextElement.innerText === "Connected" ? "block" : "none";
}

// 取得瀏覽器 GPS 位置，回傳 {lat, lng} 或 null
function _getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null), // 拒絕或逾時都回退
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

// 初始化地圖起始位置：優先 GPS → 回退 userLocale 搜尋 → 最後預設台灣
async function _initMapLocation(userLocale) {
  const gps = await _getBrowserLocation();
  if (gps) {
    map.setView([gps.lat, gps.lng], CONFIG.SEARCH_ZOOM);
    setCoordinates(gps.lat, gps.lng);
    marker = L.marker([gps.lat, gps.lng], { draggable: true }).addTo(map);
    marker.on("dragend", handleMarkerDragEnd);
    marker.on("contextmenu", handleMarkerRightClick);
    return;
  }
  // GPS 失敗：用 userLocale 做地名搜尋
  if (userLocale) {
    await searchLocation(userLocale);
    return;
  }
  // 最後回退：預設台灣中心
  map.setView([23.6978, 120.9605], 7);
}

// ===== Map Initialization =====
async function initializeMap(userLocale) {
  var userLocale = window.APP_CONFIG ? window.APP_CONFIG.userLocale : "";

  map = L.map("map", { keyboard: false });

  var stadiaTileLayer = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 19,
      noWrap: true,
      attribution:
        '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> contributors',
    },
  );
  var openStreetMapTileLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  );
  var OpenStreetMap_HOT = L.tileLayer(
    "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a>',
    },
  );
  var OPNVKarte = L.tileLayer(
    "https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png",
    {
      maxZoom: 18,
      attribution:
        'Map <a href="https://memomaps.de/">memomaps.de</a> <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  );
  var Stadia_AlidadeSmooth = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}",
    {
      minZoom: 0,
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>',
      ext: "png",
    },
  );
  var Stadia_AlidadeSmoothDark = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}",
    {
      minZoom: 0,
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>',
      ext: "png",
    },
  );
  var Stadia_AlidadeSatellite = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.{ext}",
    {
      minZoom: 0,
      maxZoom: 20,
      attribution:
        '&copy; CNES, Distribution Airbus DS | &copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>',
      ext: "jpg",
    },
  );
  var Stadia_Outdoors = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}",
    {
      minZoom: 0,
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>',
      ext: "png",
    },
  );
  var Stadia_StamenToner = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.{ext}",
    {
      minZoom: 0,
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a>',
      ext: "png",
    },
  );
  var Stadia_StamenWatercolor = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.{ext}",
    {
      minZoom: 1,
      maxZoom: 16,
      attribution:
        '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a>',
      ext: "jpg",
    },
  );
  var Stadia_StamenTerrain = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.{ext}",
    {
      minZoom: 0,
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a>',
      ext: "png",
    },
  );
  var Esri_WorldStreetMap = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri",
    },
  );
  var Esri_WorldTopoMap = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri",
    },
  );
  var Esri_WorldImagery = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri",
    },
  );
  var CartoDB_Voyager = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    },
  );

  await _initMapLocation(userLocale);
  map.on("dblclick", handleMapDoubleClick);
  stadiaTileLayer.addTo(map);

  const baseLayers = {
    "Stadia Maps": stadiaTileLayer,
    OpenStreetMap: openStreetMapTileLayer,
    OpenStreetMap_HOT: OpenStreetMap_HOT,
    OPNVKarte: OPNVKarte,
    "Stadia Alidade Smooth": Stadia_AlidadeSmooth,
    "Stadia Alidade Smooth Dark": Stadia_AlidadeSmoothDark,
    "Stadia Alidade Satellite": Stadia_AlidadeSatellite,
    "Stadia Outdoors": Stadia_Outdoors,
    "Stadia Stamen Toner": Stadia_StamenToner,
    "Stadia Stamen Watercolor": Stadia_StamenWatercolor,
    "Stadia Stamen Terrain": Stadia_StamenTerrain,
    "Esri World Street Map": Esri_WorldStreetMap,
    "Esri World Topo Map": Esri_WorldTopoMap,
    "Esri World Imagery": Esri_WorldImagery,
    "CartoDB Voyager": CartoDB_Voyager,
  };
  L.control.layers(baseLayers).addTo(map);

  // FileLayer
  const style = {
    color: "orange",
    opacity: 1.0,
    fillOpacity: 0.1,
    weight: 2,
    clickable: true,
  };
  orangeIcon = L.icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  map.addLayer(drawnItems);
  drawnItems.on('layeradd', function() {});

  // SVG helpers
  const _svg = p => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON = {
    upload: _svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    save:   _svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
    play:   _svg('<polygon points="5 3 19 12 5 21 5 3"/>'),
    pause:  _svg('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'),
    route:  _svg('<path d="M3 12h18M3 6h18M3 18h18"/>'),
    pencil: _svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
    speed:  _svg('<path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 12l4-4"/><circle cx="12" cy="12" r="1"/>'),
    trash:  _svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>'),
  };

  // Speed state
  const _speedMap = { walk: 1.4, run: 4.5, bike: 5.6, drive: 13.9 };
  function _setSpeed(mode) {
    velocitySelect = mode;
    setPlaybackSpeed(_speedMap[mode]);
    setJoystickSpeed(mode, document.getElementById(`speed-btn-${mode}`));
  }

  // Custom speed dialog
  if (!document.getElementById('customSpeedDialog')) {
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="customSpeedDialog">
        <div class="modal-inner">
          <h3 class="modal-title">Custom Speed</h3>
          <div style="display:flex;gap:.5rem;align-items:center;margin:.25rem 0">
            <input type="number" id="customSpeedInput" class="input input-sm" style="flex:1" min="1" max="999" placeholder="e.g. 30">
            <span style="font-size:.875rem;color:hsl(240 3.8% 46.1%)">km/h</span>
          </div>
          <div class="modal-footer">
            <form method="dialog"><button class="btn btn-secondary btn-sm">Cancel</button></form>
            <button class="btn btn-default btn-sm" onclick="_applyCustomSpeedDialog()">Apply</button>
          </div>
        </div>
      </dialog>`);
  }
  window._applyCustomSpeedDialog = function() {
    const kmh = parseFloat(document.getElementById('customSpeedInput').value);
    if (isNaN(kmh) || kmh <= 0) { alert('Please enter a valid speed.'); return; }
    joystickSpeed = kmh / 3.6;
    setPlaybackSpeed(joystickSpeed);
    document.getElementById('customSpeedDialog').close();
  };

  // ── Single unified toolbar (custom L.Control, no EasyButton) ──
  const MapToolbar = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function(map) {
      const bar = L.DomUtil.create('div', 'map-toolbar');
      L.DomEvent.disableClickPropagation(bar);

      // helper: create a toolbar button
      const btn = (icon, title, onClick) => {
        const b = L.DomUtil.create('button', 'map-tb-btn', bar);
        b.innerHTML = icon;
        b.title = title;
        b.type = 'button';
        L.DomEvent.on(b, 'click', L.DomEvent.stop);
        L.DomEvent.on(b, 'click', onClick);
        return b;
      };

      // hidden file input for GPX/GeoJSON upload
      const fileInput = L.DomUtil.create('input', '', bar);
      fileInput.type = 'file';
      fileInput.accept = '.gpx,.geojson,.json,.kml';
      fileInput.style.display = 'none';
      fileInput.id = 'map-file-input';
      fileInput.addEventListener('change', function() {
        if (!this.files.length) return;
        const reader = new FileReader();
        reader.onload = e => {
          try {
            lineLatLngs = [];
            const geojson = JSON.parse(e.target.result);
            L.geoJSON(geojson, {
              style: { color: 'orange', opacity: 1, fillOpacity: 0.1, weight: 2 },
              pointToLayer: (d, ll) => L.marker(ll, { icon: orangeIcon }),
              onEachFeature: onEachFeature,
            });
            if (lineLatLngs.length) map.fitBounds(L.latLngBounds(lineLatLngs.map(p => [p[0], p[1]])));
          } catch(err) { console.error('File parse error:', err); }
        };
        reader.readAsText(this.files[0]);
        this.value = '';
      });

      // Upload
      btn(ICON.upload, 'Upload GPX / GeoJSON', () => fileInput.click());

      // Save
      btn(ICON.save, 'Save GeoJSON', handleSaveButtonClick);

      // Play / Pause (toggle)
      const playBtn = btn(ICON.play, 'Play GPX', function() {
        if (!isPlaybackStopped) {
          // pause
          isPlaybackStopped = true; wasPlaybackPaused = true;
          if (_smoothPlaybackTimer) { clearInterval(_smoothPlaybackTimer); _smoothPlaybackTimer = null; }
          playBtn.innerHTML = ICON.play;
          playBtn.title = 'Play GPX';
        } else {
          // play / resume
          isPlaybackStopped = false;
          if (!wasPlaybackPaused) { _smoothSegIdx = 0; _smoothSegT = 0; playbackIndex = 0; }
          wasPlaybackPaused = false;
          processNextPoint();
          playBtn.innerHTML = ICON.pause;
          playBtn.title = 'Pause GPX';
        }
      });
      // reset play button when playback ends
      map.on('playbackchange', () => {
        if (isPlaybackStopped) { playBtn.innerHTML = ICON.play; playBtn.title = 'Play GPX'; }
      });

      // Draw track
      const drawBtn = btn(ICON.route, 'Draw Track', function() {
        isDrawingMode = !isDrawingMode;
        if (isDrawingMode) {
          map.on('click', handleMapClick);
          drawBtn.innerHTML = ICON.pencil;
          drawBtn.classList.add('active');
          map.getContainer().style.cursor = 'crosshair';
        } else {
          map.off('click', handleMapClick);
          drawBtn.innerHTML = ICON.route;
          drawBtn.classList.remove('active');
          map.getContainer().style.cursor = '';
        }
      });

      // Speed menu
      const speedMenu = L.leafletMenu(map, {
        items: {
          Walk:   { onClick: () => _setSpeed('walk') },
          Run:    { onClick: () => _setSpeed('run') },
          Bike:   { onClick: () => _setSpeed('bike') },
          Drive:  { onClick: () => _setSpeed('drive') },
          Custom: { onClick: () => document.getElementById('customSpeedDialog').showModal() },
        },
      });
      const speedBtn = btn(ICON.speed, 'Select Speed', function() {
        speedMenu.options.button = { button: speedBtn, state: () => {} };
        speedMenu.show();
      });
      speedBtn.id = 'styles-menu';

      // Clear
      btn(ICON.trash, 'Clear all layers', function() {
        drawnItems.clearLayers();
        lineLatLngs = [];
        isPlaybackStopped = true;
        playbackIndex = 0;
        playBtn.innerHTML = ICON.play;
        playBtn.title = 'Play GPX';
      });

      return bar;
    },
  });
  new MapToolbar().addTo(map);

  // Time-to-next-point control
  const TimeToNextPointControl = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd: function (map) {
      const container = L.DomUtil.create(
        "div",
        "time-to-next-point-control leaflet-bar leaflet-control",
      );
      const textbox = L.DomUtil.create("input");
      textbox.type = "text";
      textbox.disabled = true;
      textbox.placeholder = "Time to next point";
      textbox.style.width = "200px";
      textbox.id = "timeToPointText";
      container.appendChild(textbox);

      function updateContent() {
        if (!isPlaybackStopped) {
          container.style.display = "block";
          textbox.value = `Time to next point: ${typeof timeToNextPoint === "number" ? timeToNextPoint.toFixed(2) : "N/A"} seconds`;
        } else {
          container.style.display = "none";
        }
      }
      updateContent();
      map.on("playbackchange", updateContent);
      return container;
    },
    onRemove: function (map) {
      map.off("playbackchange");
    },
  });
  new TimeToNextPointControl({ position: "bottomleft" }).addTo(map);
}

// ===== Map Click / Feature Handling =====
function handleMapClick(event) {
  if (!isDrawingMode) return;
  const { lat, lng } = event.latlng;
  lineLatLngs.push([lat, lng]);
  if (lineLatLngs.length >= 2) {
    const lastPoint = lineLatLngs.length - 2;
    calculateRoute(lineLatLngs[lastPoint], lineLatLngs[lastPoint + 1]);
  }
}

function calculateRoute(startPoint, endPoint) {
  L.Routing.control({
    waypoints: [
      L.latLng(startPoint[0], startPoint[1]),
      L.latLng(endPoint[0], endPoint[1]),
    ],
    routeWhileDragging: false,
    lineOptions: { styles: [{ color: "blue", opacity: 1, weight: 5 }] },
    router: L.Routing.osrmv1({
      serviceUrl: "https://routing.openstreetmap.de/routed-foot/route/v1/",
      profile: "walking",
    }),
    show: false,
  })
    .on("routesfound", function (e) {
      L.polyline(e.routes[0].coordinates, { color: "blue" }).addTo(drawnItems);
    })
    .addTo(drawnItems);
}

function clearPolylines() {
  drawnItems.clearLayers();
  lineLatLngs = [];
}

function onEachFeature(feature, layer) {
  drawnItems.addLayer(layer);
  if (layer instanceof L.Polyline) {
    layer.getLatLngs().forEach((latLng) => {
      const lat = latLng.lat;
      const lng = latLng.lng;
      // 去除重複點：與上一個點距離 < 閾值則跳過
      const last = lineLatLngs[lineLatLngs.length - 1];
      if (
        !last ||
        Math.abs(lat - last[0]) > 1e-7 ||
        Math.abs(lng - last[1]) > 1e-7
      ) {
        lineLatLngs.push([lat, lng]);
      }
    });
    // 每次 feature 載入後重建距離快取
    buildSegDistCache();
  }
  layer.bindPopup(generatePopupContent(feature.properties));
  layer.on("click", handleMarkerClick);
  layer.on("contextmenu", (event) => handleMarkerRightClick(event, feature));
}

function generatePopupContent(properties) {
  let content = "";
  for (const key in properties) {
    content = `<h4 style="text-align: center;">${properties.name}</h4>`;
    content += `<p><strong>${key}:</strong><br>${properties[key]}<br>`;
    content += `<p><strong>Coordinates:</strong><br> ${document.getElementById("coordinates").value}<br>`;
  }
  return content;
}

function handleMarkerRightClick(event) {
  L.DomEvent.stopPropagation(event);
  const menu = L.popup();
  menu.setLatLng(event.latlng);
  currentFeature = event.target.feature;
  if (event.target && event.target.feature && event.target.feature.properties) {
    let content = generateEditPopupContent(event.target.feature.properties);
    content +=
      '<div class="text-center"><br><button type="button" id="saveActive" class="btn btn-primary" onclick="saveChanges()">Save</button></div>';
    menu.setContent(content);
    menu.openOn(map);
  }
}

function generateEditPopupContent(properties) {
  let content = "<h3>Edit Marker</h3>";
  content += '<label for="name"><strong>Name:</strong></label><br>';
  content += `<input type="text" class="form-control" id="name" value="${properties.name || ""}"><br>`;
  content +=
    '<br><label for="description"><strong>Description:</strong></label><br>';
  content += `<textarea class="form-control" type="text" id="description" rows="2" value="${properties.description || ""}"></textarea><br>`;
  return `<div class="custom-popup-content">${content}</div>`;
}

function saveChanges() {
  const newNameInput = document.getElementById("name");
  const newDescriptionInput = document.getElementById("description");
  if (!newNameInput || !newDescriptionInput) {
    console.error("Input elements not found.");
    return;
  }
  if (!currentFeature) {
    console.error("Current feature not found.");
    return;
  }
  currentFeature.properties.name = newNameInput.value;
  currentFeature.properties.description = newDescriptionInput.value;
  marker.setPopupContent(generatePopupContent(currentFeature));
  map.closePopup();
}

function handleMarkerClick(event) {
  const feature = event.target.feature;
  const coordinates = event.latlng;
  setCoordinates(coordinates.lat, coordinates.lng);
  const popupContent = generatePopupContent(feature.properties);
  map.openPopup(L.popup().setLatLng(coordinates).setContent(popupContent));
}

function handleActiveMarkerRightClick(event) {
  L.DomEvent.stopPropagation(event);
  const menu = L.popup();
  menu.setLatLng(event.latlng);
  let content = generateEditPopupContent({ name: "", description: "" });
  content +=
    '<div class="text-center"><br><button type="button" id="saveActive" class="btn btn-primary" onclick="saveActiveMarker()">Save</button></div>';
  menu.setContent(content);
  menu.openOn(map);
}

function saveActiveMarker() {
  const newNameInput = document.getElementById("name");
  const newDescriptionInput = document.getElementById("description");
  if (!newNameInput || !newDescriptionInput) {
    console.error("Input elements not found.");
    return;
  }
  const newFeature = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [marker.getLatLng().lng, marker.getLatLng().lat],
    },
    properties: {
      name: newNameInput.value,
      description: newDescriptionInput.value,
    },
  };
  L.geoJSON(newFeature, {
    pointToLayer: function (feature, latlng) {
      return L.marker(latlng, { icon: orangeIcon });
    },
    onEachFeature: onEachFeature,
  }).addTo(drawnItems);
  map.closePopup();
}

function sendGPXToBackend() {
  const selectedFile = document.getElementById("gpxFileInput")
    ? document.getElementById("gpxFileInput").files[0]
    : null;
  const velocitySelect = document.getElementById("velocitySelect");
  const velocity = velocitySelect ? velocitySelect.value : "walk";

  if (selectedFile) {
    const formData = new FormData();
    formData.append("gpxFile", selectedFile);
    formData.append("velocity", velocity);
    fetch("/upload_gpx", { method: "POST", body: formData })
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.text();
      })

      .catch((error) => console.error("Error uploading GPX file:", error));
  } else {
    console.error("No GPX file selected.");
  }
}

function submitCustomSpeed() {
  const customSpeed = document.getElementById("customSpeedInput").value;
  velocitySelect = customSpeed;
  new bootstrap.Modal(document.getElementById("customSpeedModal")).hide();
}

// ===== DOMContentLoaded Bootstrap =====
document.addEventListener("DOMContentLoaded", function () {
  _initLocationEls(); // 快取 DOM 元素供 location.js 使用
  initializeMap();
  // fuel mode removed
  _elRsdData.addEventListener("change", updateSetLocationButtonStatus);
  _elCoordinates.addEventListener("input", updateSetLocationButtonStatus);
  populateDeviceList();
  updateStopLocationButtonStatus();
  document.addEventListener("keydown", handleKeyDown);

  document.getElementById("search").addEventListener("click", handleSearch);
  _elCoordinates.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  });
});
