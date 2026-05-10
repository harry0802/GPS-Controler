// joystick.js — nipplejs virtual joystick, D-pad, speed control

let joystickSpeed = CONFIG.SPEED.walk;
let joystickEnabled = false;
let nippleManager = null;
let connStatusPollTimer = null;
let connStatus = "connected";

let _joyDx = 0,
  _joyDy = 0;
let _joyLat = null,
  _joyLng = null;
let _joyTimer = null;
let _joyInflight = false; // 節流：上一個請求未完成時跳過

let _dpadActive = null;
let _dpadTimer = null;

const _DEG = Math.PI / 180;

// 快取熱路徑 DOM 元素（_joyTick 每 250ms 執行）
let _elJoyCoords = null;
let _elConnIndicator = null;

function toggleJoystick() {
  joystickEnabled = !joystickEnabled;
  document.getElementById("joystick-panel").classList.toggle("hidden", !joystickEnabled);
  document.getElementById("toggle-joystick").textContent = joystickEnabled ? "關閉搖桿" : "搖桿模式";

  if (joystickEnabled) {
    _elJoyCoords = document.getElementById("coordinates");
    _elConnIndicator = document.getElementById("conn-indicator");
    const coordsVal = _elJoyCoords.value.trim();
    if (coordsVal) {
      const parts = coordsVal.split(",");
      _joyLat = parseFloat(parts[0]);
      _joyLng = parseFloat(parts[1]);
    } else {
      const center = map.getCenter();
      _joyLat = center.lat;
      _joyLng = center.lng;
    }
    _joyDx = 0;
    _joyDy = 0;
    initNipple();
    startConnStatusPoll();
    _joyTimer = setInterval(_joyTick, CONFIG.JOY_TICK_MS);
  } else {
    destroyNipple();
    _dpadClear();
    if (_joyTimer) {
      clearInterval(_joyTimer);
      _joyTimer = null;
    }
    stopConnStatusPoll();
    fetch(CONFIG.API.JOYSTICK_STOP, { method: "POST" });
  }
}

function _joyTick() {
  if (_joyLat === null || (_joyDx === 0 && _joyDy === 0)) return;
  if (_joyInflight) return; // 上一個請求還在途中，跳過此 tick

  const dt = CONFIG.JOY_TICK_MS / 1000;
  const dist = joystickSpeed * dt;
  const cosLat = Math.cos(_joyLat * _DEG);

  _joyLat += (_joyDy * dist) / CONFIG.METERS_PER_DEG_LAT;
  _joyLng += (_joyDx * dist) / (CONFIG.METERS_PER_DEG_LAT * cosLat);

  _elJoyCoords.value = `${_joyLat}, ${_joyLng}`;

  _joyInflight = true;
  fetch(CONFIG.API.SET_LOCATION, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat: _joyLat, lng: _joyLng }),
  }).finally(() => {
    _joyInflight = false;
  });
}

function initNipple() {
  nippleManager = nipplejs.create({
    zone: document.getElementById("joystick-zone"),
    mode: "static",
    position: { left: "50%", top: "50%" },
    color: CONFIG.NIPPLE.color,
    size: CONFIG.NIPPLE.size,
  });
  nippleManager.on("move", (evt, data) => {
    if (_dpadActive) return;
    const force = Math.min(data.force, 1);
    _joyDx = Math.cos(data.angle.radian) * force;
    _joyDy = Math.sin(data.angle.radian) * force;
  });
  nippleManager.on("end", () => {
    if (_dpadActive) return;
    _joyDx = 0;
    _joyDy = 0;
  });
}

function destroyNipple() {
  if (nippleManager) {
    nippleManager.destroy();
    nippleManager = null;
  }
  _joyDx = 0;
  _joyDy = 0;
}

function setJoystickSpeed(mode, btn) {
  document.querySelectorAll('#joystick-panel .pill-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (mode === "custom") {
    document.getElementById("custom-speed-input").classList.remove("hidden");
    return;
  }
  document.getElementById("custom-speed-input").classList.add("hidden");
  joystickSpeed = CONFIG.SPEED[mode] ?? CONFIG.SPEED.walk;
  if (typeof setPlaybackSpeed !== 'undefined') setPlaybackSpeed(joystickSpeed);
}

function applyCustomSpeed() {
  const kmh = parseFloat(document.getElementById("custom-kmh").value);
  if (isNaN(kmh) || kmh <= 0) {
    alert("請輸入有效的速度");
    return;
  }
  joystickSpeed = kmh / 3.6;
  document.getElementById("speed-btn-custom").textContent = `${kmh}km/h`;
  if (typeof setPlaybackSpeed !== 'undefined') setPlaybackSpeed(joystickSpeed);
}

function startConnStatusPoll() {
  const dot = document.getElementById("conn-indicator");
  connStatusPollTimer = setInterval(() => {
    fetch(CONFIG.API.CONN_STATUS)
      .then((r) => r.json())
      .then((d) => {
        connStatus = d.status;
        if (dot) {
          dot.style.background =
            connStatus === 'connected'    ? 'hsl(142 76% 36%)' :
            connStatus === 'reconnecting' ? 'hsl(38 92% 50%)'  : 'hsl(0 72.2% 50.6%)';
        }
        const label = document.getElementById('conn-label');
        if (label) label.textContent =
            connStatus === 'connected'    ? 'Connected'     :
            connStatus === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
        if (connStatus === "disconnected") {
          _joyDx = 0;
          _joyDy = 0;
        }
      })
      .catch(() => {});
  }, CONFIG.CONN_POLL_MS);
}

function stopConnStatusPoll() {
  if (connStatusPollTimer) {
    clearInterval(connStatusPollTimer);
    connStatusPollTimer = null;
  }
}

function dpadToggle(dx, dy, dir) {
  if (!joystickEnabled) return;
  if (_dpadActive === dir) {
    _dpadClear();
    return;
  }
  _dpadClear();
  _dpadActive = dir;
  document.getElementById(`dpad-${dir}`).classList.add("active");
  _joyDx = 0;
  _joyDy = 0;
  if (_joyTimer) {
    clearInterval(_joyTimer);
    _joyTimer = null;
  }
  _joyDx = dx;
  _joyDy = dy;
  _joyTick();
  _dpadTimer = setInterval(_joyTick, CONFIG.JOY_TICK_MS);
}

function _dpadClear() {
  if (_dpadTimer) {
    clearInterval(_dpadTimer);
    _dpadTimer = null;
  }
  _joyDx = 0;
  _joyDy = 0;
  if (_dpadActive) {
    const btn = document.getElementById(`dpad-${_dpadActive}`);
    if (btn) btn.classList.remove("active");
  }
  _dpadActive = null;
  if (joystickEnabled && !_joyTimer) {
    _joyTimer = setInterval(_joyTick, CONFIG.JOY_TICK_MS);
  }
}
