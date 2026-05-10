// ui.js — dark mode, toast, modal helpers, save/download

// ── Modal helpers (DaisyUI <dialog> API, no jQuery) ──────────────────────────

function _showModal(id) {
    const el = document.getElementById(id);
    if (el) el.showModal();
}
function _closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.close();
}

function showModalDeveloperModeRequired() { _showModal('developerModeRequiredModal'); }
function showPairRecordModal()            { _showModal('pairRecordModal'); }
function showModalWifiModeRequired()      { _showModal('wifiModeRequiredModal'); }
function showModal()                      { _showModal('developerModeModal'); }
function showModalTimeout()               { _showModal('modalTimeout'); }
function closeModal()                     { _closeModal('developerModeModal'); }

function showAlertOrModal(errorMessage) {
    const connectTextElement = document.getElementById('connectText');
    const spinnerElement     = document.getElementById('spinner');
    if (connectTextElement) {
        connectTextElement.innerText         = 'Connect Device';
        spinnerElement.classList.add('hidden');
    }
    const modal = document.getElementById('developerError');
    if (modal) {
        document.getElementById('developerErrorMessage').innerText = errorMessage;
        modal.showModal();
    } else {
        alert(errorMessage);
    }
}

function exitApp() {
    try {
        _closeModal('aboutModal');
        _showModal('shutdownModal');
        navigator.sendBeacon(CONFIG.API.EXIT, JSON.stringify({}));
        window.open('', '_self', ''); window.close();
    } catch (err) {
        console.error('Error during server shutdown:', err);
    }
}

// ── Dark mode ─────────────────────────────────────────────────────────────────

function toggleDarkMode() {
    const btn = document.getElementById('darkModeSwitch');
    const isDark = document.documentElement.classList.toggle('dark');
    btn.classList.toggle('active', isDark);
}

// ── Toast (DaisyUI) ───────────────────────────────────────────────────────────

function displayToast(message) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;

    const item = document.createElement('div');
    item.className = 'toast-item';
    item.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${message}</span>
    `;
    stack.appendChild(item);

    setTimeout(() => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(.5rem)';
        item.style.transition = 'opacity .3s, transform .3s';
        setTimeout(() => item.remove(), 300);
    }, 3000);
}

// ── Save / Download ───────────────────────────────────────────────────────────

function aboutApp() {
    event.preventDefault();
    alert('App Version: ' + (window.APP_CONFIG?.appVersionNum ?? ''));
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
