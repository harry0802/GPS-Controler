// config.js — 統一管理所有常數設定

const CONFIG = Object.freeze({
  // GPX 播放
  GPS_TICK_MS: 100,      // UI marker 更新間隔 (ms) — 越小越滑順
  GPS_PUSH_EVERY: 5,     // 每幾個 tick 才推一次位置給裝置（100ms × 5 = 500ms）

  // 搖桿
  JOY_TICK_MS: 250, // 搖桿位置更新間隔 (ms)
  CONN_POLL_MS: 2000, // 連線狀態輪詢間隔 (ms)
  METERS_PER_DEG_LAT: 111320, // 每緯度度數對應公尺數

  // 速度 (m/s)
  SPEED: {
    walk: 1.4,
    run:  4.5,
    bike: 5.2,
  },

  // GPX 播放預設速度 (m/s)，對應步行 1.4 m/s ≈ 5 km/h
  GPX_DEFAULT_SPEED: 1.4,

  // 鍵盤方向鍵移動步進 (度)
  KEY_STEP: 0.0001,

  // 距離近似計算閾值：低於此值(km)用平面近似取代 Haversine
  FLAT_APPROX_THRESHOLD_KM: 1.0,

  // 重複點距離閾值（公尺），低於此值視為重複點跳過
  DUPLICATE_POINT_KM: 0.1,

  // API 端點
  API: {
    SET_LOCATION: "/set_location",
    STOP_LOCATION: "/stop_location",
    UPDATE_LOCATION: "/update_location",
    LIST_DEVICES: "/list_devices",
    CONNECT_DEVICE: "/connect_device",
    UPLOAD_GPX: "/upload_gpx",
    FUEL_TYPES: "/api/fuel_types",
    FUEL_DATA: "/api/data",
    CONN_STATUS: "/connection_status",
    JOYSTICK_STOP: "/joystick/stop",
    ENABLE_DEV_MODE: "/enable_developer_mode",
    EXIT: "/exit",
  },

  // 地圖預設縮放
  DEFAULT_ZOOM: 4,
  SEARCH_ZOOM: 13,

  // Nipplejs 搖桿外觀
  NIPPLE: {
    color: "#007bff",
    size: 120,
  },
});
