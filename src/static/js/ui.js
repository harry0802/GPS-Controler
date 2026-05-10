// ui.js — dark mode, toast, modal helpers, save/download

function toggleDarkMode() {
    const checked = document.getElementById('darkModeSwitch').checked;
    document.body.classList.toggle('dark-mode', checked);
}

function handleSaveButtonClick() {
    const filename = prompt('Please enter the filename (e.g., map_data.geojson):', 'map_data.geojson');
    if (filename != null) downloadGeoJSON(leafletToGeoJSON(), filename);
}

function leafletToGeoJSON() {
    const geojson = { type: 'FeatureCollection', features: [] };
    if (!map.hasLayer(drawnItems)) return geojson;

    drawnItems.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            geojson.features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [layer.getLatLng().lng, layer.getLatLng().lat],
                },
                properties: layer.feature ? layer.feature.properties : {},
            });
        } else if (layer instanceof L.Polyline) {
            geojson.features.push({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: layer.getLatLngs().map(c => [c.lng, c.lat]),
                },
                properties: {},
            });
        }
    });
    return geojson;
}

function downloadGeoJSON(data, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showModalDeveloperModeRequired() { $('#developerModeRequiredModal').modal('show'); }
function showPairRecordModal()            { $('#pairRecordModal').modal('show'); }
function showModalWifiModeRequired()      { $('#wifiModeRequiredModal').modal('show'); }
function showModal()                      { $('#developerModeModal').modal('show'); }
function showModalTimeout()               { $('#modalTimeout').modal('show'); }
function closeModal()                     { document.getElementById('developerModeModal').style.display = 'none'; }

function displayToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="toast-header">
          <strong class="mr-auto">GeoPort</strong>
          <small>Just Now</small>
          <button type="button" class="ml-2 mb-1 close" data-bs-dismiss="toast" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="toast-body">${message}</div>
    `;
    document.querySelector('.toast-container').appendChild(toast);
    new bootstrap.Toast(toast).show();
}

function showAlertOrModal(errorMessage) {
    const connectTextElement = document.getElementById('connectText');
    const spinnerElement     = document.getElementById('spinner');
    if (connectTextElement) {
        connectTextElement.innerText  = 'Connect Device';
        spinnerElement.style.display  = 'none';
    }
    const modal = document.getElementById('developerError');
    if (modal) {
        document.getElementById('developerErrorMessage').innerText = errorMessage;
        $('#developerError').modal('show');
    } else {
        alert(errorMessage);
    }
}

function exitApp() {
    try {
        $('#aboutModal').modal('hide');
        $('#shutdownModal').modal('show');
        navigator.sendBeacon(CONFIG.API.EXIT, JSON.stringify({}));
        window.open('', '_self', ''); window.close();
    } catch (err) {
        console.error('Error during server shutdown:', err);
    }
}

function aboutApp() {
    event.preventDefault();
    alert('App Version: ' + (window.APP_CONFIG?.appVersionNum ?? ''));
}
