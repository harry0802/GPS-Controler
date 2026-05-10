// devices.js — device list, connect/disconnect, developer mode, fuel data

function populateDeviceList() {
  const deviceDropdown = document.getElementById("device");
  const connectionDropdown = document.getElementById("connection");
  const devicesInfo = {};
  const sudoMessage = window.APP_CONFIG?.sudoMessage ?? "";

  fetch(CONFIG.API.LIST_DEVICES)
    .then((r) => r.json())
    .then((data) => {
      deviceDropdown.innerHTML = "";
      connectionDropdown.innerHTML = "";

      Object.keys(data).forEach((udid) => {
        const connections = data[udid];
        Object.keys(connections).forEach((connType) => {
          connections[connType].forEach((deviceInfo) => {
            const option = document.createElement("option");
            option.text = `${connType}: ${deviceInfo.DeviceName} - (${deviceInfo.DeviceClass} - iOS: ${deviceInfo.ProductVersion})`;
            option.value = JSON.stringify(deviceInfo);
            devicesInfo[udid] = devicesInfo[udid] || {};
            devicesInfo[udid][connType] = deviceInfo;
            deviceDropdown.add(option);
          });
        });
      });

      deviceDropdown.devicesInfo = devicesInfo;
      deviceDropdown.addEventListener("change", () => {
        const opt = deviceDropdown.options[deviceDropdown.selectedIndex];
        opt.value = JSON.stringify(JSON.parse(opt.value));
      });

      if (sudoMessage) displayToast(sudoMessage);
    })
    .catch((err) => console.error("Error fetching device list:", err));
}

function toggleFuelTypeVisibility() {
  const checkbox = document.getElementById("enableFuelPrices");
  if (!checkbox) return;
  const show = checkbox.checked;
  document.getElementById("fuelTypeSection").classList.toggle("hidden", !show);
  document.getElementById("fuelRegionSection").classList.toggle("hidden", !show);
}

async function updateDynamoDB(
  udid,
  version,
  name,
  cls,
  platform,
  appVersion,
  appType,
  connType,
  wifiState,
  country,
) {
  try {
    await fetch(`https://api.geoport.me/${udid}`, {
      mode: "no-cors",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: window.location.pathname,
        version,
        deviceName: name,
        deviceClass: cls,
        platform,
        appType,
        appVersion,
        connType,
        wifiState,
        country,
      }),
    });
  } catch (_) {}
}

function connectDevice() {
  const connectButton = document.getElementById("connect");
  const connectTextElement = document.getElementById("connectText");
  const spinnerElement = document.getElementById("spinner");
  const deviceDropdown = document.getElementById("device");
  const dev = JSON.parse(deviceDropdown.value);

  const {
    Identifier: udid,
    ConnectionType: connType,
    ProductVersion: iosVersion,
    DeviceName: deviceName,
    DeviceClass: deviceClass,
    wifiState,
    userLocale: country,
  } = dev;

  const platform = window.APP_CONFIG?.currentPlatform ?? "";
  const appVersion = window.APP_CONFIG?.appVersionNum ?? "";
  const appType = window.APP_CONFIG?.appVersionType ?? "";

  updateDynamoDB(
    udid,
    iosVersion,
    deviceName,
    deviceClass,
    platform,
    appVersion,
    appType,
    connType,
    wifiState,
    country,
  );

  if (connectTextElement) {
    connectTextElement.innerText = "Connecting, please wait...";
    // connectText always visible;
    spinnerElement.classList.remove('hidden');
  }

  fetch(CONFIG.API.CONNECT_DEVICE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      udid,
      ios_version: iosVersion,
      connType,
      wifiState,
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      if ("developer_mode_required" in data) {
        showModalDeveloperModeRequired();
        return;
      }
      if (data.Error === "No Pair Record Found") {
        showPairRecordModal();
        return;
      }
      if ("error" in data) {
        showModalTimeout();
        if (connectTextElement) {
          connectTextElement.innerText = "Connect Device";
          spinnerElement.classList.add('hidden');
        }
        if (connectButton) connectButton.disabled = false;
        return;
      }

      if (connectTextElement) connectTextElement.innerText = "Connected";
      if (connectButton) connectButton.disabled = true;
      if (deviceDropdown) deviceDropdown.disabled = true;
      if (spinnerElement) spinnerElement.classList.add('hidden');

      const rsdDataElement = document.getElementById("rsdData");
      if (rsdDataElement) {
        rsdDataElement.value = data.rsd_data ?? "No rsd_data found";
        rsdDataElement.readOnly = true;
        updateSetLocationButtonStatus();
        updateStopLocationButtonStatus();
        const disconnectBtn = document.getElementById("disconnect");
        if (disconnectBtn) {
          disconnectBtn.classList.remove('hidden');
          disconnectBtn.innerText = "Disconnect";
        }
      }
    })
    .catch((err) => {
      console.error("Error connecting device:", err);
      if (connectTextElement) connectTextElement.innerText = "Error connecting";
      if (connectButton) connectButton.disabled = false;
    });
}

function disconnectDevice() {
  stopLocation();
  document.getElementById("set-location").disabled = true;
  document.getElementById("stop-location").disabled = true;

  const deviceDropdown = document.getElementById("device");
  if (deviceDropdown) deviceDropdown.disabled = false;

  const disconnectBtn = document.getElementById("disconnect");
  if (disconnectBtn) {
    disconnectBtn.innerText = "Disconnecting, Please wait...";
    disconnectBtn.classList.add('hidden');
  }

  const rsdDataElement = document.getElementById("rsdData");
  if (rsdDataElement) rsdDataElement.classList.add('hidden');

  const connectTextElement = document.getElementById("connectText");
  const connectButton = document.getElementById("connect");
  if (connectTextElement) connectTextElement.innerText = "Connect Device";
  if (connectButton) connectButton.disabled = false;
}

function continueAfterDeveloperModeRequired() {
  const udid = JSON.parse(document.getElementById("device").value).Identifier;
  const connectTextElement = document.getElementById("connectText");
  const spinnerElement = document.getElementById("spinner");

  if (connectTextElement) {
    connectTextElement.innerText = "Enabling Developer Mode";
    spinnerElement.classList.remove('hidden');
  }

  fetch(CONFIG.API.ENABLE_DEV_MODE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ udid }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) connectDevice();
      else if (data.error) showAlertOrModal(data.error);
    })
    .catch(() => showAlertOrModal("Error enabling developer mode."));
}

function cancelAfterDeveloperModeRequired() {
  const connectTextElement = document.getElementById("connectText");
  const spinnerElement = document.getElementById("spinner");
  if (connectTextElement) {
    connectTextElement.innerText = "Connect Device";
    spinnerElement.classList.add('hidden');
  }
  fetch("/", { method: "GET" });
}

async function handleFuelTypeChange() {
  const fuelTypeDropdown = document.getElementById("fuelType");
  const fuelText = document.getElementById("fuelText");
  const selectedFuelRegion = document.getElementById("fuelRegion").value;
  const selectedFuelType = fuelTypeDropdown.value;
  fuelText.value = "";
  fuelTypeDropdown.innerHTML = "";

  try {
    const fuelTypes = await fetch(
      `${CONFIG.API.FUEL_TYPES}?region=${selectedFuelRegion}`,
    ).then((r) => r.json());
    fuelTypes.sort().forEach((type) => {
      const option = Object.assign(document.createElement("option"), {
        value: type,
        text: type,
      });
      fuelTypeDropdown.add(option);
    });
    fuelTypeDropdown.value = selectedFuelType;
    updateFuelText(selectedFuelType, selectedFuelRegion);
  } catch (err) {
    console.error("Error fetching fuel types:", err);
  }
}

async function updateFuelText(selectedFuelType, selectedFuelRegion) {
  const fuelText = document.getElementById("fuelText");
  const fuelDataCollapse = document.getElementById("fuelDataCollapse");
  try {
    const d = await fetch(
      `${CONFIG.API.FUEL_DATA}/${selectedFuelType}?region=${selectedFuelRegion}`,
    ).then((r) => r.json());
    fuelText.value = `Type: ${d.type}\nPrice: ${d.price}\nSuburb: ${d.suburb}\nState: ${d.state}\nLat: ${d.lat}\nLng: ${d.lng}`;
    setCoordinates(d.lat, d.lng);
    handleSearch();
    fuelDataCollapse.classList.toggle("show", !!d);
  } catch (err) {
    console.error("Error fetching fuel type data:", err);
  }
}
