// playback.js — GPX smooth playback, distance/time calculation

let gpxPlaybackInterval;
let isPlaybackInProgress = false;
let isPlaybackStopped = true;
let playbackIndex = 0;
let gpxMarker = null;
let wasPlaybackPaused = false;
let velocitySelect = 'walk';
let timeToNextPoint = 'N/A';

let _smoothPlaybackTimer = null;
let _smoothSegIdx = 0;
let _smoothSegT = 0;

// 預計算快取：載入路徑後儲存每段距離，避免 tick 內重複計算
let _segDistCache = [];

function buildSegDistCache() {
    _segDistCache = [];
    for (let i = 0; i < lineLatLngs.length - 1; i++) {
        const [lat0, lng0] = lineLatLngs[i];
        const [lat1, lng1] = lineLatLngs[i + 1];
        _segDistCache.push(calculateDistance(lat0, lng0, lat1, lng1));
    }
}

function _smoothTick() {
    if (isPlaybackStopped) return;

    if (_smoothSegIdx >= lineLatLngs.length - 1) {
        const [lat, lng] = lineLatLngs[lineLatLngs.length - 1];
        _pushRouteLocation(lat, lng);
        clearInterval(_smoothPlaybackTimer);
        _smoothPlaybackTimer = null;
        isPlaybackStopped = true;
        map.fire('playbackchange');
        return;
    }

    let remainDist = joystickSpeed * (CONFIG.GPS_TICK_MS / 1000);

    while (remainDist > 0 && _smoothSegIdx < lineLatLngs.length - 1) {
        const segDist = _segDistCache[_smoothSegIdx];

        if (segDist < CONFIG.DUPLICATE_POINT_KM) {
            _smoothSegIdx++;
            _smoothSegT = 0;
            continue;
        }

        const remainSegDist = segDist * (1 - _smoothSegT);

        if (remainDist < remainSegDist) {
            _smoothSegT += remainDist / segDist;
            remainDist = 0;
        } else {
            remainDist -= remainSegDist;
            _smoothSegIdx++;
            _smoothSegT = 0;
        }
    }

    if (_smoothSegIdx >= lineLatLngs.length - 1) {
        _smoothSegIdx = lineLatLngs.length - 1;
        _smoothSegT = 0;
    }

    const [cLat0, cLng0] = lineLatLngs[_smoothSegIdx];
    const nextIdx = Math.min(_smoothSegIdx + 1, lineLatLngs.length - 1);
    const [cLat1, cLng1] = lineLatLngs[nextIdx];
    const t = Math.min(_smoothSegT, 1);
    const curLat = cLat0 + (cLat1 - cLat0) * t;
    const curLng = cLng0 + (cLng1 - cLng0) * t;

    _pushRouteLocation(curLat, curLng);
    playbackIndex = _smoothSegIdx;
    map.fire('playbackchange');
}

function _pushRouteLocation(lat, lng) {
    if (!gpxMarker || !map.hasLayer(gpxMarker)) {
        gpxMarker = L.marker([lat, lng], { icon: orangeIcon }).addTo(drawnItems);
    } else {
        gpxMarker.setLatLng([lat, lng]);
    }
    setCoordinates(lat, lng);
    fetch(CONFIG.API.SET_LOCATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
    });
}

function processNextPoint() {
    if (isPlaybackStopped) return;

    if (!wasPlaybackPaused) {
        _smoothSegIdx = 0;
        _smoothSegT = 0;
        buildSegDistCache();
    }

    if (_smoothPlaybackTimer) clearInterval(_smoothPlaybackTimer);
    _smoothPlaybackTimer = setInterval(_smoothTick, CONFIG.GPS_TICK_MS);
}

// 平面近似（短距離用，比 Haversine 快 ~3x）
function _distFlat(lat1, lon1, lat2, lon2) {
    const DEG = Math.PI / 180;
    const dlat = (lat2 - lat1) * DEG * CONFIG.METERS_PER_DEG_LAT;
    const cosLat = Math.cos(lat1 * DEG);
    const dlon = (lon2 - lon1) * DEG * CONFIG.METERS_PER_DEG_LAT * cosLat;
    return Math.sqrt(dlat * dlat + dlon * dlon) / 1000; // km
}

// Haversine（長距離精確版）
function _distHaversine(lat1, lon1, lat2, lon2) {
    const DEG = Math.PI / 180;
    const dLat = (lat2 - lat1) * DEG;
    const dLon = (lon2 - lon1) * DEG;
    const a = 0.5 - Math.cos(dLat) / 2 +
        Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * (1 - Math.cos(dLon)) / 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const dLat = Math.abs(lat2 - lat1);
    const dLon = Math.abs(lon2 - lon1);
    // GPS 相鄰點通常 < 1km，用平面近似即可
    if (dLat < 0.01 && dLon < 0.01) return _distFlat(lat1, lon1, lat2, lon2);
    return _distHaversine(lat1, lon1, lat2, lon2);
}

function resetPlaybackFlag() {
    isPlaybackStopped = false;
}
