// map-init.js — Leaflet map, controls, markers, file layer, menu

// ===== LeafletMenu =====
L.Control.LeafletMenu = L.Control.extend({
    options: { mapId: "map", items: [], button: void 0 },
    statics: { CLASS: "leaflet-menu", OverFlow_Y: "overflow-y", OverFlow_X: "overflow-x" },
    initialize: function(a, b) {
        L.setOptions(this, b);
        this.map = a;
        this.menuItem = [];
        this.menu_div = L.DomUtil.create("div", "menu", document.getElementById(this.options.mapId));
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
    container: function() {
        return this.container = L.DomUtil.create("div", L.Control.LeafletMenu.CLASS, this.menu_div),
            this.container.style.position = "absolute",
            this.container.style.OverFlow_Y = "auto",
            this.container.style.OverFlow_X = "hidden",
            this;
    },
    createMenu: function() {
        const button = L.DomUtil.get("styles-menu");
        if (!button) { console.error("Button not found"); return; }
        const buttonRect = button.getBoundingClientRect();
        const mapContainer = document.querySelector('.leaflet-container');
        if (!mapContainer) { console.error("Map container not found"); return; }
        const offset = 2;
        const menuLeft = buttonRect.right - mapContainer.getBoundingClientRect().left + offset;
        const menuTop = buttonRect.top - mapContainer.getBoundingClientRect().top;
        this.container.style.position = 'absolute';
        this.container.style.left = menuLeft + 'px';
        this.container.style.top = menuTop + 'px';
        this._removeItems()._createItems();
        return this;
    },
    removeMenu: function() {
        for (; this.menu_div.firstChild;) this.menu_div.removeChild(this.menu_div.firstChild);
    },
    _createItems: function() {
        for (var a = this.options.items, b = Object.keys(a), c = 0; c <= b.length - 1; c++) {
            this.menuItem[c] = L.DomUtil.create("a", "leaflet-menu-item", this.container);
            this.menuItem[c].text = b[c];
            if (a[b[c]].onClick) {
                if (a[b[c]].onClick && a[b[c]].href) throw "Menu item could not be clickable and redirectable at the same time";
            } else {
                this.menuItem[c].href = a[b[c]].href;
            }
        }
        return this;
    },
    _removeItems: function() {
        for (; this.container.firstChild;) this.container.removeChild(this.container.firstChild);
        return this;
    },
    show: function() {
        try { this.createMenu(); this.container.style.display = "block"; this.options.button && this.options.button.state("hide-menu"); }
        catch (a) { console.log("Error(show-menu): \n" + a); }
    },
    hide: function() {
        try { this.container.style.display = "none"; this.options.button && this.options.button.state("show-menu"); }
        catch (a) { console.log("Error(hide-menu): \n" + a); }
    },
    _itemFunc: function(a) {
        if (this.options.items[a].href) return this;
        if (this.target) {
            if (!this.target || !this.target._map) throw "Sorry, there could be some error with your function";
            try { this.map.removeLayer(this.target); this.target = void 0; }
            catch (a) { console.log("Error(Removing target): \n" + a); }
        } else {
            this.target = this.options.items[a].onClick(arguments);
        }
    },
    _onMouseOver: function(a) { L.DomUtil.addClass(a.target || a.srcElement, "over"); },
    _onMouseOut: function(a) { L.DomUtil.removeClass(a.target || a.src.Element, "over"); },
    _onMouseClick: function(a) { this._itemFunc(a.target.text); }
});
L.leafletMenu = function(a, b) { return new L.Control.LeafletMenu(a, b); };

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

const connectTextElement = document.getElementById('connectText');
const rsdDataElement = document.getElementById('rsdData');

// Read config injected by Flask template
var appVersionNum = window.APP_CONFIG ? window.APP_CONFIG.appVersionNum : '';
var appVersionType = window.APP_CONFIG ? window.APP_CONFIG.appVersionType : '';
var selectedDevicePlatform = window.APP_CONFIG ? window.APP_CONFIG.currentPlatform : '';

if (appVersionType === "standard") {
    const fuelTypeSection = document.getElementById('fuelTypeSection');
    const fuelRegionSection = document.getElementById('fuelRegionSection');
    const enableFuelPricesCheckbox = document.getElementById('enableFuelPrices');
    const enableFuelPricesLabel = document.querySelector('label[for="enableFuelPrices"]');
    if (enableFuelPricesLabel) enableFuelPricesLabel.style.display = 'none';
    if (fuelTypeSection) fuelTypeSection.style.display = 'none';
    if (fuelRegionSection) fuelRegionSection.style.display = 'none';
    if (enableFuelPricesCheckbox) enableFuelPricesCheckbox.style.display = 'none';
}

if (connectTextElement && rsdDataElement) {
    rsdDataElement.style.display = connectTextElement.innerText === "Connected" ? 'block' : 'none';
}

// ===== Map Initialization =====
async function initializeMap(userLocale) {
    var userLocale = window.APP_CONFIG ? window.APP_CONFIG.userLocale : '';
    console.log('User locale:', userLocale);

    map = L.map('map', { keyboard: false });

    var stadiaTileLayer = L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, noWrap: true, attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> contributors'
    });
    var openStreetMapTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    var OpenStreetMap_HOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a>'
    });
    var OPNVKarte = L.tileLayer('https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: 'Map <a href="https://memomaps.de/">memomaps.de</a> <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    var Stadia_AlidadeSmooth = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
        minZoom: 0, maxZoom: 20, attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>', ext: 'png'
    });
    var Stadia_AlidadeSmoothDark = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}', {
        minZoom: 0, maxZoom: 20, attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>', ext: 'png'
    });
    var Stadia_AlidadeSatellite = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.{ext}', {
        minZoom: 0, maxZoom: 20, attribution: '&copy; CNES, Distribution Airbus DS | &copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>', ext: 'jpg'
    });
    var Stadia_Outdoors = L.tileLayer('https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}', {
        minZoom: 0, maxZoom: 20, attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>', ext: 'png'
    });
    var Stadia_StamenToner = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.{ext}', {
        minZoom: 0, maxZoom: 20, attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a>', ext: 'png'
    });
    var Stadia_StamenWatercolor = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.{ext}', {
        minZoom: 1, maxZoom: 16, attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a>', ext: 'jpg'
    });
    var Stadia_StamenTerrain = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.{ext}', {
        minZoom: 0, maxZoom: 18, attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a>', ext: 'png'
    });
    var Esri_WorldStreetMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });
    var Esri_WorldTopoMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });
    var Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });
    var CartoDB_Voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd', maxZoom: 20
    });

    await searchLocation(userLocale);
    map.on('dblclick', handleMapDoubleClick);
    map.setZoom(4);
    stadiaTileLayer.addTo(map);

    const baseLayers = {
        "Stadia Maps": stadiaTileLayer,
        "OpenStreetMap": openStreetMapTileLayer,
        "OpenStreetMap_HOT": OpenStreetMap_HOT,
        "OPNVKarte": OPNVKarte,
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
    const style = { color: 'orange', opacity: 1.0, fillOpacity: 0.1, weight: 2, clickable: true };
    orangeIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
    });

    L.Control.FileLayerLoad.LABEL = '<i class="lni lni-cloud-upload"></i>';
    L.Control.fileLayerLoad({
        position: 'topleft',
        fitBounds: true,
        addToMap: false,
        layerOptions: {
            style: style,
            pointToLayer: function(data, latlng) { return L.marker(latlng, { icon: orangeIcon }); },
            onEachFeature: onEachFeature
        },
        fileSizeLimit: 4096,
        onFileLoad: function(e) { console.log("file load trigger"); }
    }).addTo(map);

    map.addLayer(drawnItems);
    drawnItems.on('layeradd', function(e) {});

    // Save button
    const saveMapButton = L.easyButton({
        states: [{ stateName: 'draw-polyline', icon: '<i class="lni lni-save"></i>', title: 'Save File', onClick: handleSaveButtonClick }]
    });
    saveMapButton.button.style.fontSize = '24px';
    saveMapButton.button.style.paddingLeft = '4px';
    saveMapButton.addTo(map);
    const fileLayerControlContainer = document.querySelector('.leaflet-control-filelayer');
    fileLayerControlContainer.appendChild(saveMapButton.button);
    saveMapButton.button.classList.add('leaflet-control-filelayer-custom');

    // Playback button
    const playbackButton = L.easyButton({
        states: [{
            stateName: 'play',
            icon: '<i class="lni lni-play"></i>',
            title: 'GPX Playback',
            onClick: function(btn, map) {
                if (!isPlaybackStopped) return;
                isPlaybackStopped = false;
                if (!wasPlaybackPaused) {
                    _smoothSegIdx = 0;
                    _smoothSegT = 0;
                    playbackIndex = 0;
                }
                wasPlaybackPaused = false;
                processNextPoint();
                btn.state('pause');
            }
        }, {
            stateName: 'pause',
            icon: '<i class="lni lni-pause"></i>',
            title: 'Pause GPX Playback',
            onClick: function(btn, map) {
                if (!isPlaybackStopped) {
                    isPlaybackStopped = true;
                    wasPlaybackPaused = true;
                    if (_smoothPlaybackTimer) { clearInterval(_smoothPlaybackTimer); _smoothPlaybackTimer = null; }
                } else {
                    isPlaybackStopped = false;
                    if (_smoothPlaybackTimer) clearInterval(_smoothPlaybackTimer);
                    _smoothPlaybackTimer = setInterval(_smoothTick, GPS_TICK_MS);
                }
                btn.state('play');
            }
        }]
    });
    playbackButton.button.style.fontSize = '24px';
    playbackButton.button.style.paddingLeft = '4px';
    playbackButton.addTo(map);
    fileLayerControlContainer.appendChild(playbackButton.button);
    playbackButton.button.classList.add('leaflet-control-filelayer-custom');

    // Draw polyline button
    const drawPolylineButton = L.easyButton({
        states: [{
            stateName: 'draw-polyline',
            icon: '<i class="lni lni-travel"></i>',
            title: 'Draw Track',
            onClick: function(btn, map) {
                isDrawingMode = !isDrawingMode;
                if (isDrawingMode) {
                    map.on('click', handleMapClick);
                    btn.button.innerHTML = '<i class="lni lni-pencil"></i>';
                    btn.button.classList.add('active');
                    map.getContainer().style.cursor = 'crosshair';
                } else {
                    map.off('click', handleMapClick);
                    btn.button.innerHTML = '<i class="lni lni-travel"></i>';
                    btn.button.classList.remove('active');
                    map.getContainer().style.cursor = '';
                }
            }
        }]
    });
    drawPolylineButton.button.style.fontSize = '24px';
    drawPolylineButton.button.style.paddingLeft = '4px';
    drawPolylineButton.addTo(map);
    fileLayerControlContainer.appendChild(drawPolylineButton.button);
    drawPolylineButton.button.classList.add('leaflet-control-filelayer-custom');

    // Speed validation helpers
    window.validateInput = function(input) {
        const value = input.value;
        const regex = /^[1-9]\d{0,2}(\.\d{0,2})?$/;
        if (!regex.test(value)) input.value = '';
    };
    window.saveCustomSpeed = function() {
        const customSpeedInput = document.getElementById('customSpeedInput');
        const v = customSpeedInput.value.trim();
        if (v === '0' || v === null || v === '') { alert('Speed value cannot be 0 or empty.\nValue not saved!'); return; }
        velocitySelect = v;
        new bootstrap.Modal(document.getElementById('customSpeedModal')).hide();
    };

    // Leaflet speed menu
    const menu = L.leafletMenu(map, {
        items: {
            Walk: { onClick: function() { velocitySelect = 'walk'; } },
            Run:  { onClick: function() { velocitySelect = 'run'; } },
            Ride: { onClick: function() { velocitySelect = 'ride'; } },
            Drive: { onClick: function() { velocitySelect = 'drive'; } },
            Custom: {
                label: 'Custom Speed',
                onClick: function() {
                    const modalHtml = `
                        <div class="modal fade" id="customSpeedModal" tabindex="-1" aria-labelledby="customSpeedModalLabel" aria-hidden="true">
                        <div class="modal-dialog"><div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="customSpeedModalLabel">Custom Speed</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <input type="text" class="form-control" id="customSpeedInput" placeholder="Enter custom speed (Km/H)" oninput="validateInput(this)">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="validateInput(document.getElementById('customSpeedInput')); saveCustomSpeed();" data-bs-dismiss="modal">Save changes</button>
                        </div>
                        </div></div></div>`;
                    document.body.insertAdjacentHTML('beforeend', modalHtml);
                    new bootstrap.Modal(document.getElementById('customSpeedModal')).show();
                }
            }
        }
    });

    // Dashboard/speed menu button
    const dashboardButton = L.easyButton({
        states: [{
            stateName: 'show-menu', icon: 'lni lni-dashboard', title: 'Select Speed',
            onClick: function(btn, map) { menu.options.button = btn; menu.show(); btn.state('hide-menu'); }
        }, {
            stateName: 'hide-menu', icon: 'fa fa-tasks', title: 'Hide Menu',
            onClick: function(btn, map) { menu.hide(); btn.state('show-menu'); }
        }],
        id: 'styles-menu',
    });
    dashboardButton.button.style.fontSize = '24px';
    dashboardButton.button.style.paddingLeft = '4px';
    dashboardButton.addTo(map);
    fileLayerControlContainer.appendChild(dashboardButton.button);
    dashboardButton.button.classList.add('leaflet-control-filelayer-custom');

    // Clear button
    const customButton = L.DomUtil.create('a', 'leaflet-bar leaflet-control-zoom-in leaflet-bar-part leaflet-control-custom', document.querySelector('.leaflet-control-filelayer'));
    customButton.innerHTML = '<i class="lni lni-trash-can"></i>';
    customButton.title = 'Clear markers';
    customButton.classList.add('leaflet-control-filelayer-custom');
    customButton.onclick = function() {
        drawnItems.clearLayers();
        lineLatLngs = [];
        isPlaybackStopped = true;
        playbackIndex = 0;
        const textbox = document.getElementById('timeToPointText');
        if (textbox) textbox.style.display = 'none';
    };

    // Time-to-next-point control
    const TimeToNextPointControl = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'time-to-next-point-control leaflet-bar leaflet-control');
            const textbox = L.DomUtil.create('input');
            textbox.type = 'text';
            textbox.disabled = true;
            textbox.placeholder = 'Time to next point';
            textbox.style.width = '200px';
            textbox.id = 'timeToPointText';
            container.appendChild(textbox);

            function updateContent() {
                if (!isPlaybackStopped) {
                    container.style.display = 'block';
                    textbox.value = `Time to next point: ${typeof timeToNextPoint === 'number' ? timeToNextPoint.toFixed(2) : 'N/A'} seconds`;
                } else {
                    container.style.display = 'none';
                }
            }
            updateContent();
            map.on('playbackchange', updateContent);
            return container;
        },
        onRemove: function(map) { map.off('playbackchange'); }
    });
    new TimeToNextPointControl({ position: 'bottomleft' }).addTo(map);
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
        waypoints: [L.latLng(startPoint[0], startPoint[1]), L.latLng(endPoint[0], endPoint[1])],
        routeWhileDragging: false,
        lineOptions: { styles: [{ color: 'blue', opacity: 1, weight: 5 }] },
        router: L.Routing.osrmv1({ serviceUrl: 'https://routing.openstreetmap.de/routed-foot/route/v1/', profile: 'walking' }),
        show: false
    }).on('routesfound', function(e) {
        L.polyline(e.routes[0].coordinates, { color: 'blue' }).addTo(drawnItems);
    }).addTo(drawnItems);
}

function clearPolylines() {
    drawnItems.clearLayers();
    lineLatLngs = [];
}

function onEachFeature(feature, layer) {
    drawnItems.addLayer(layer);
    if (layer instanceof L.Polyline) {
        layer.getLatLngs().forEach(function(latLng) {
            lineLatLngs.push([latLng.lat, latLng.lng]);
        });
    }
    console.log("latArray:", lineLatLngs);
    layer.bindPopup(generatePopupContent(feature.properties));
    layer.on('click', handleMarkerClick);
    layer.on('contextmenu', function(event) { handleMarkerRightClick(event, feature); });
}

function generatePopupContent(properties) {
    let content = '';
    for (const key in properties) {
        content = `<h4 style="text-align: center;">${properties.name}</h4>`;
        content += `<p><strong>${key}:</strong><br>${properties[key]}<br>`;
        content += `<p><strong>Coordinates:</strong><br> ${document.getElementById('coordinates').value}<br>`;
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
        content += '<div class="text-center"><br><button type="button" id="saveActive" class="btn btn-primary" onclick="saveChanges()">Save</button></div>';
        menu.setContent(content);
        menu.openOn(map);
    }
}

function generateEditPopupContent(properties) {
    let content = '<h3>Edit Marker</h3>';
    content += '<label for="name"><strong>Name:</strong></label><br>';
    content += `<input type="text" class="form-control" id="name" value="${properties.name || ''}"><br>`;
    content += '<br><label for="description"><strong>Description:</strong></label><br>';
    content += `<textarea class="form-control" type="text" id="description" rows="2" value="${properties.description || ''}"></textarea><br>`;
    return `<div class="custom-popup-content">${content}</div>`;
}

function saveChanges() {
    const newNameInput = document.getElementById('name');
    const newDescriptionInput = document.getElementById('description');
    if (!newNameInput || !newDescriptionInput) { console.error('Input elements not found.'); return; }
    if (!currentFeature) { console.error('Current feature not found.'); return; }
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
    content += '<div class="text-center"><br><button type="button" id="saveActive" class="btn btn-primary" onclick="saveActiveMarker()">Save</button></div>';
    menu.setContent(content);
    menu.openOn(map);
}

function saveActiveMarker() {
    const newNameInput = document.getElementById('name');
    const newDescriptionInput = document.getElementById('description');
    if (!newNameInput || !newDescriptionInput) { console.error('Input elements not found.'); return; }
    const newFeature = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [marker.getLatLng().lng, marker.getLatLng().lat] },
        properties: { name: newNameInput.value, description: newDescriptionInput.value }
    };
    L.geoJSON(newFeature, {
        pointToLayer: function(feature, latlng) { return L.marker(latlng, { icon: orangeIcon }); },
        onEachFeature: onEachFeature
    }).addTo(drawnItems);
    map.closePopup();
}

function sendGPXToBackend() {
    const selectedFile = document.getElementById('gpxFileInput') ? document.getElementById('gpxFileInput').files[0] : null;
    const velocitySelect = document.getElementById('velocitySelect');
    const velocity = velocitySelect ? velocitySelect.value : 'walk';

    if (selectedFile) {
        const formData = new FormData();
        formData.append('gpxFile', selectedFile);
        formData.append('velocity', velocity);
        fetch('/upload_gpx', { method: 'POST', body: formData })
            .then(response => { if (!response.ok) throw new Error('Network response was not ok'); return response.text(); })
            .then(data => console.log('GPX file uploaded successfully:', data))
            .catch(error => console.error('Error uploading GPX file:', error));
    } else {
        console.error('No GPX file selected.');
    }
}

function submitCustomSpeed() {
    const customSpeed = document.getElementById("customSpeedInput").value;
    velocitySelect = customSpeed;
    new bootstrap.Modal(document.getElementById('customSpeedModal')).hide();
}

// ===== DOMContentLoaded Bootstrap =====
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    searchLocation();
    handleFuelTypeChange();
    document.getElementById('rsdData').addEventListener('change', updateSetLocationButtonStatus);
    document.getElementById('coordinates').addEventListener('input', updateSetLocationButtonStatus);
    populateDeviceList();
    updateStopLocationButtonStatus();
    document.addEventListener('keydown', handleKeyDown);

    document.getElementById('search').addEventListener('click', handleSearch);
    document.getElementById('coordinates').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') { event.preventDefault(); handleSearch(); }
    });
});
