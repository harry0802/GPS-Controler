// location.js — coordinates, search, set/stop location, marker helpers

// 快取熱路徑 DOM 元素，避免每次 setCoordinates 都重新查詢
let _elCoordinates = null;
let _elRsdData = null;
let _elSetLocation = null;
let _elStopLocation = null;
let _elToggleJoystick = null;
let _geoProvider = null; // GeoSearch provider 重複使用

function _initLocationEls() {
  _elCoordinates = document.getElementById("coordinates");
  _elRsdData = document.getElementById("rsdData");
  _elSetLocation = document.getElementById("set-location");
  _elStopLocation = document.getElementById("stop-location");
  _elToggleJoystick = document.getElementById("toggle-joystick");
}

function setCoordinates(lat, lng) {
  _elCoordinates.value = `${lat}, ${lng}`;
  updateSetLocationButtonStatus();
  updateStopLocationButtonStatus();
  // 搖桿開啟時同步起始點，避免切換地點後回彈
  if (typeof joystickEnabled !== "undefined" && joystickEnabled) {
    _joyLat = lat;
    _joyLng = lng;
  }
  // 只更新前端狀態，不再額外發 /update_location
  // /set_location 本身已包含 location 變數的更新
}

function handleSearch() {
  searchLocation(_elCoordinates.value);
}

async function searchLocation(input) {
  if (!_geoProvider) _geoProvider = new GeoSearch.OpenStreetMapProvider();
  try {
    const results = await _geoProvider.search({ query: input });
    if (results.length > 0) {
      const { x, y } = results[0];
      if (!marker) {
        marker = L.marker([y, x], { draggable: true }).addTo(map);
        marker.on("dragend", handleMarkerDragEnd);
        marker.on("contextmenu", handleMarkerRightClick);
      } else {
        marker.setLatLng([y, x]);
      }
      map.setView([y, x], CONFIG.SEARCH_ZOOM);
      setCoordinates(y, x);
    } else {
      alert("No results found for the provided location");
    }
  } catch (err) {
    console.error("Error during geocoding:", err);
  }
}

function _currentLatLng() {
    const val = _elCoordinates ? _elCoordinates.value.trim() : '';
    if (!val) return null;
    const parts = val.split(',');
    if (parts.length < 2) return null;
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
}

function setLocationArrows() {
    const pos = _currentLatLng();
    if (!pos) return;
    navigator.sendBeacon(
        CONFIG.API.SET_LOCATION,
        new Blob([JSON.stringify(pos)], { type: 'application/json' })
    );
}

function setLocation() {
    const pos = _currentLatLng();
    if (!pos) { displayToast('No location set.'); return; }
    fetch(CONFIG.API.SET_LOCATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pos),
    })
        .then(r => r.text())
        .then(data => displayToast(data))
        .catch(err => console.error('Error setting location:', err));
}

function stopLocation() {
  fetch(CONFIG.API.STOP_LOCATION, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
    .then((r) => r.text())
    .then((data) => {
      displayToast(data);
      console.log("stop_location response:", data);
    })
    .catch((err) => console.error("Error stopping location:", err));
}

function updateSetLocationButtonStatus() {
  const rsdData = _elRsdData.value.trim();
  const coords = _elCoordinates.value.trim();
  _elSetLocation.disabled = !(rsdData && coords);
  if (_elToggleJoystick) _elToggleJoystick.disabled = !rsdData;
}

function updateStopLocationButtonStatus() {
  _elStopLocation.disabled = !_elRsdData.value.trim();
}

function createMarker(latlng) {
  marker = L.marker(latlng, { draggable: true }).addTo(map);
  marker.on("dragend", handleMarkerDragEnd);
  marker.on("contextmenu", handleMarkerRightClick);
  return marker;
}

function handleMapDoubleClick(e) {
  map.doubleClickZoom.disable();
  if (!marker) marker = createMarker(e.latlng);
  else marker.setLatLng(e.latlng);
  setCoordinates(e.latlng.lat, e.latlng.lng);
  marker.on("contextmenu", handleActiveMarkerRightClick);
}

function handleMarkerDragEnd(event) {
  const { lat, lng } = event.target.getLatLng();
  setCoordinates(lat, lng);
}

function deleteMarker() {
  map.removeLayer(marker);
  map.closePopup();
  marker = null;
}

function handleKeyDown(event) {
  if (!marker) return;
  const { lat, lng } = marker.getLatLng();
  const s = CONFIG.KEY_STEP;
  const moves = {
    ArrowUp: [lat + s, lng],
    ArrowDown: [lat - s, lng],
    ArrowLeft: [lat, lng - s],
    ArrowRight: [lat, lng + s],
  };
  const next = moves[event.key];
  if (!next) return;
  marker.setLatLng(next);
  setLocationArrows();
  setCoordinates(next[0], next[1]);
  event.preventDefault();
}
