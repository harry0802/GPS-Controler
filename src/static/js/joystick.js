// joystick.js — nipplejs virtual joystick, D-pad, speed control

let joystickSpeed = CONFIG.SPEED.walk;
let joystickEnabled = false;
let nippleManager = null;
let connStatusPollTimer = null;
let connStatus = "connected";
let _disconnectPromptShown = false;

let _joyDx = 0,
  _joyDy = 0;
let _joyLat = null,
  _joyLng = null;

let _dpadActive = null;

let _elJoyCoords = null;
let _elConnIndicator = null;

// 從 server 拉回目前座標，更新地圖 marker 和座標欄
// 全程常駐 poll，讓手機 D-pad 移動時電腦 marker 也即時同步
let _lastSyncLat = null, _lastSyncLng = null;

function _startPosSync() {
  // 已由 _startGlobalPosSync 常駐，不需再另開 timer
}
function _stopPosSync() {
  // 不停止，保持常駐同步
}

function _startGlobalPosSync() {
  setInterval(() => {
    fetch(CONFIG.API.JOYSTICK_POSITION)
      .then(r => r.json())
      .then(d => {
        if (d.lat == null) return;
        // 座標沒變就不更新，避免干擾使用者拖 marker
        if (d.lat === _lastSyncLat && d.lng === _lastSyncLng) return;
        _lastSyncLat = d.lat;
        _lastSyncLng = d.lng;
        _joyLat = d.lat;
        _joyLng = d.lng;
        // 更新座標輸入框
        const coordEl = document.getElementById('coordinates');
        if (coordEl) coordEl.value = `${d.lat.toFixed(6)}, ${d.lng.toFixed(6)}`;
        // 更新地圖 marker
        if (typeof marker !== 'undefined' && marker) {
          marker.setLatLng([d.lat, d.lng]);
        }
      })
      .catch(() => {});
  }, 500);
}

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
    fetch(CONFIG.API.JOYSTICK_START, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: _joyLat, lng: _joyLng, speed: joystickSpeed }),
    });
    _startPosSync();
  } else {
    destroyNipple();
    _dpadClear();
    _stopPosSync();
    fetch(CONFIG.API.JOYSTICK_STOP, { method: "POST" });
  }
}

// 發方向給 server，停止和速度切換不節流確保立即生效
let _sendDirTimer = null;
let _lastSentSpeed = null;
function _sendDirection(dx, dy) {
  const isStop = (dx === 0 && dy === 0);
  const speedChanged = joystickSpeed !== _lastSentSpeed;
  if (!isStop && !speedChanged && _sendDirTimer) return;
  if (!isStop) _sendDirTimer = setTimeout(() => { _sendDirTimer = null; }, 100);
  _lastSentSpeed = joystickSpeed;
  fetch(CONFIG.API.JOYSTICK_UPDATE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dx, dy, speed: joystickSpeed }),
  }).catch(() => {});
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
    _sendDirection(_joyDx, _joyDy);
  });
  nippleManager.on("end", () => {
    if (_dpadActive) return;
    _joyDx = 0;
    _joyDy = 0;
    _sendDirection(0, 0);
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
  _sendSpeedNow(); // 立刻把新速度送給 server
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
  _sendSpeedNow(); // 立刻把新速度送給 server
}

// 強制立刻送出目前方向 + 新速度，繞過節流
function _sendSpeedNow() {
  if (_sendDirTimer) { clearTimeout(_sendDirTimer); _sendDirTimer = null; }
  _lastSentSpeed = joystickSpeed;
  fetch(CONFIG.API.JOYSTICK_UPDATE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dx: _joyDx, dy: _joyDy, speed: joystickSpeed }),
  }).catch(() => {});
}

function startConnStatusPoll() {
  if (connStatusPollTimer) return; // 防止重複啟動
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
        const banner = document.getElementById('disconnect-banner');
        if (connStatus === "disconnected") {
          _joyDx = 0;
          _joyDy = 0;
          fetch(CONFIG.API.JOYSTICK_UPDATE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dx: 0, dy: 0, speed: joystickSpeed }),
          }).catch(() => {});
          if (banner) banner.style.display = 'flex';
          if (!_disconnectPromptShown) {
            _disconnectPromptShown = true;
            const modal = document.getElementById('disconnectedModal');
            if (modal) modal.showModal();
          }
        } else {
          if (banner) banner.style.display = 'none';
          _disconnectPromptShown = false;
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
  _joyDx = dx;
  _joyDy = dy;
  _sendDirection(dx, dy);
}

function _dpadClear() {
  _joyDx = 0;
  _joyDy = 0;
  if (_dpadActive) {
    const btn = document.getElementById(`dpad-${_dpadActive}`);
    if (btn) btn.classList.remove("active");
  }
  _dpadActive = null;
  _sendDirection(0, 0);
}

function resetConnection() {
  const modal = document.getElementById('disconnectedModal');
  if (modal) modal.close();
  const btn = document.getElementById('resetConnBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Resetting…'; }

  fetch(CONFIG.API.RESET_CONNECTION, { method: 'POST' })
    .then(r => r.json())
    .then(d => {
      if (d.error) {
        displayToast('Reset failed: ' + d.error);
      } else {
        displayToast('Connection reset successfully');
        _disconnectPromptShown = false;
      }
    })
    .catch(() => displayToast('Reset request failed'))
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = 'Reset Connection'; }
    });
}
