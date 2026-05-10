// playback.js — GPX smooth playback, distance/time calculation

let gpxPlaybackInterval;
let isPlaybackInProgress = false;
let isPlaybackStopped = true;
let playbackIndex = 0;
let gpxMarker = null;
let wasPlaybackPaused = false;
let velocitySelect = 'walk';
let timeToNextPoint = 'N/A';

// GPX 播放速度獨立於搖桿速度，單位 m/s
let playbackSpeed = CONFIG.GPX_DEFAULT_SPEED;

let _smoothPlaybackTimer = null;
let _smoothSegIdx = 0;
let _smoothSegT = 0;
let _tickCount = 0;  // 計數每幾個 UI tick 才推一次位置給裝置

// 模組層級常數，避免每次計算時重新轉換
const _DEG_TO_RAD = Math.PI / 180;
const _EARTH_R    = 6371;

// Float64Array：記憶體連續，比普通陣列快 ~2x 隨機存取
let _segDistCache = new Float64Array(0);

function buildSegDistCache() {
    const n = lineLatLngs.length - 1;
    _segDistCache = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const [lat0, lng0] = lineLatLngs[i];
        const [lat1, lng1] = lineLatLngs[i + 1];
        _segDistCache[i] = calculateDistance(lat0, lng0, lat1, lng1);
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
        wasPlaybackPaused = false;
        map.fire('playbackchange');
        return;
    }

    let remainDist = playbackSpeed * (CONFIG.GPS_TICK_MS / 1000);

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

    // 每 GPS_PUSH_EVERY 個 UI tick 才推一次給裝置，避免過於頻繁
    _tickCount++;
    if (_tickCount >= CONFIG.GPS_PUSH_EVERY) {
        _tickCount = 0;
        navigator.sendBeacon(
            CONFIG.API.SET_LOCATION,
            new Blob([JSON.stringify({ lat, lng })], { type: 'application/json' })
        );
    }
}

// 去除 lineLatLngs 中的折返段：
// 若後段某個點曾在前段出現過（距離 < threshold 公尺），截斷到那個位置
function _deduplicatePath() {
    if (lineLatLngs.length < 4) return;

    const THRESHOLD = 5; // 公尺，兩點距離小於此視為同一位置
    const seen = [];     // 已確認的點

    for (let i = 0; i < lineLatLngs.length; i++) {
        const [lat, lng] = lineLatLngs[i];

        // 檢查這個點是否在 seen 裡已經出現過（排除最近 10 個點，避免誤判）
        let isDuplicate = false;
        for (let j = 0; j < seen.length - 10; j++) {
            const [slat, slng] = seen[j];
            const dlat = (lat - slat) * 111320;
            const dlng = (lng - slng) * 111320 * Math.cos(lat * Math.PI / 180);
            if (Math.sqrt(dlat * dlat + dlng * dlng) < THRESHOLD) {
                isDuplicate = true;
                break;
            }
        }

        if (isDuplicate) {
            // 折返點發現，截斷路徑
            lineLatLngs = lineLatLngs.slice(0, i);
            break;
        }
        seen.push([lat, lng]);
    }
}

function processNextPoint() {
    if (isPlaybackStopped) return;

    // 停止搖桿和方向鍵，避免兩者搶控制權
    if (typeof joystickEnabled !== 'undefined' && joystickEnabled) {
        toggleJoystick();
    }
    if (typeof _dpadActive !== 'undefined' && _dpadActive) {
        _dpadClear();
    }

    if (!wasPlaybackPaused) {
        _smoothSegIdx = 0;
        _smoothSegT = 0;
        _tickCount = 0;
        _deduplicatePath();   // 播放前去除折返重複段
        buildSegDistCache();
    }

    if (_smoothPlaybackTimer) clearInterval(_smoothPlaybackTimer);
    _smoothPlaybackTimer = setInterval(_smoothTick, CONFIG.GPS_TICK_MS);
}

// 設定 GPX 播放速度（供 UI 呼叫）
function setPlaybackSpeed(mps) {
    playbackSpeed = mps;
}

// 全部統一用「公尺」，避免 km vs m 混用造成速度計算錯誤

// 平面近似（短距離，比 Haversine 快 ~3x，誤差 < 0.1%）回傳公尺
// 注意：度數差直接乘公尺/度，不需要再乘 DEG_TO_RAD
function _distFlat(lat1, lon1, lat2, lon2) {
    const dlat = (lat2 - lat1) * CONFIG.METERS_PER_DEG_LAT;
    const dlon = (lon2 - lon1) * CONFIG.METERS_PER_DEG_LAT * Math.cos(lat1 * _DEG_TO_RAD);
    return Math.sqrt(dlat * dlat + dlon * dlon); // 公尺
}

// Haversine（長距離精確版）回傳公尺
function _distHaversine(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * _DEG_TO_RAD;
    const dLon = (lon2 - lon1) * _DEG_TO_RAD;
    const a = 0.5 - Math.cos(dLat) / 2 +
        Math.cos(lat1 * _DEG_TO_RAD) * Math.cos(lat2 * _DEG_TO_RAD) * (1 - Math.cos(dLon)) / 2;
    return _EARTH_R * 2 * Math.asin(Math.sqrt(a)) * 1000; // km → 公尺
}

// 回傳公尺
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (Math.abs(lat2 - lat1) < 0.01 && Math.abs(lon2 - lon1) < 0.01) {
        return _distFlat(lat1, lon1, lat2, lon2);
    }
    return _distHaversine(lat1, lon1, lat2, lon2);
}

function resetPlaybackFlag() {
    isPlaybackStopped = false;
}
