// location.js — coordinates, search, set/stop location, marker helpers

function setCoordinates(lat, lng) {
    document.getElementById('coordinates').value = `${lat}, ${lng}`;
    updateSetLocationButtonStatus();
    updateStopLocationButtonStatus();
    fetch(CONFIG.API.UPDATE_LOCATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
    })
        .then(r => r.text())
        .then(data => console.log(data))
        .catch(err => console.error('Error updating location:', err));
}

function handleSearch() {
    const input = document.getElementById('coordinates').value;
    searchLocation(input);
}

async function searchLocation(input) {
    const provider = new GeoSearch.OpenStreetMapProvider();
    try {
        const results = await provider.search({ query: input });
        if (results.length > 0) {
            const { x, y } = results[0];
            if (!marker) {
                marker = L.marker([y, x], { draggable: true }).addTo(map);
                marker.on('dragend', handleMarkerDragEnd);
                marker.on('contextmenu', handleMarkerRightClick);
            } else {
                marker.setLatLng([y, x]);
            }
            map.setView([y, x], CONFIG.SEARCH_ZOOM);
            setCoordinates(y, x);
        } else {
            alert('No results found for the provided location');
        }
    } catch (err) {
        console.error('Error during geocoding:', err);
    }
}

function setLocationArrows() {
    fetch(CONFIG.API.SET_LOCATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    })
        .then(r => r.text())
        .then(data => console.log('set_location response:', data))
        .catch(err => console.error('Error setting location:', err));
}

function setLocation() {
    fetch(CONFIG.API.SET_LOCATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    })
        .then(r => r.text())
        .then(data => { displayToast(data); console.log('set_location response:', data); })
        .catch(err => console.error('Error setting location:', err));
}

function stopLocation() {
    fetch(CONFIG.API.STOP_LOCATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    })
        .then(r => r.text())
        .then(data => { displayToast(data); console.log('stop_location response:', data); })
        .catch(err => console.error('Error stopping location:', err));
}

function updateSetLocationButtonStatus() {
    const rsdData = document.getElementById('rsdData').value.trim();
    const coords  = document.getElementById('coordinates').value.trim();
    document.getElementById('set-location').disabled = !(rsdData && coords);
    const joystickBtn = document.getElementById('toggle-joystick');
    if (joystickBtn) joystickBtn.disabled = !rsdData;
}

function updateStopLocationButtonStatus() {
    const rsdData = document.getElementById('rsdData').value.trim();
    document.getElementById('stop-location').disabled = !rsdData;
}

function createMarker(latlng) {
    marker = L.marker(latlng, { draggable: true }).addTo(map);
    marker.on('dragend', handleMarkerDragEnd);
    marker.on('contextmenu', handleMarkerRightClick);
    return marker;
}

function handleMapDoubleClick(e) {
    map.doubleClickZoom.disable();
    if (!marker) marker = createMarker(e.latlng);
    else marker.setLatLng(e.latlng);
    setCoordinates(e.latlng.lat, e.latlng.lng);
    marker.on('contextmenu', handleActiveMarkerRightClick);
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
        ArrowUp:    [lat + s, lng],
        ArrowDown:  [lat - s, lng],
        ArrowLeft:  [lat, lng - s],
        ArrowRight: [lat, lng + s],
    };
    const next = moves[event.key];
    if (!next) return;
    marker.setLatLng(next);
    setLocationArrows();
    setCoordinates(next[0], next[1]);
    event.preventDefault();
}
