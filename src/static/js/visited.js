// visited.js — "Places I've visited" feature
// Persists to localStorage; markers shown on map with a green icon.

let visitedPlaces = [];     // [{ id, lat, lng, name, note, ts }]
let visitedMarkers = {};    // id → L.Marker

// Session-only: no localStorage persistence (closes clean each time)

// ── Icon ────────────────────────────────────────────────────────────────────

function _visitedIcon() {
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 14 26 14 26S28 23.63 28 14C28 6.27 21.73 0 14 0z" fill="#16a34a"/>
      <circle cx="14" cy="14" r="6" fill="#fff"/>
      <polyline points="10,14 13,17 18,11" stroke="#16a34a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -42],
  });
}

// ── Core logic ───────────────────────────────────────────────────────────────

function _addVisitedMarker(place) {
  if (!map) return;
  const m = L.marker([place.lat, place.lng], { icon: _visitedIcon() });
  m.bindPopup(_visitedPopupHtml(place));
  m.addTo(map);
  visitedMarkers[place.id] = m;
}

function _visitedPopupHtml(place) {
  const date = new Date(place.ts).toLocaleString();
  return `
    <div style="min-width:180px">
      <div style="font-weight:600;font-size:.9rem;margin-bottom:.25rem">✓ ${_esc(place.name)}</div>
      ${place.note ? `<div style="font-size:.8rem;color:#555;margin-bottom:.25rem">${_esc(place.note)}</div>` : ''}
      <div style="font-size:.75rem;color:#888;margin-bottom:.5rem">${date}</div>
      <button onclick="removeVisitedPlace('${place.id}')" class="btn btn-destructive btn-xs" style="width:100%">Remove</button>
    </div>`;
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Public API ───────────────────────────────────────────────────────────────

function addVisitedPlace(lat, lng, name, note) {
  const place = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    lat, lng,
    name: name || _formatLatLng(lat, lng),
    note: note || '',
    ts: Date.now(),
  };
  visitedPlaces.push(place);
  _addVisitedMarker(place);
  renderVisitedList();
  displayToast(`已標記：${place.name}`);
}

function removeVisitedPlace(id) {
  visitedPlaces = visitedPlaces.filter(p => p.id !== id);
  if (visitedMarkers[id]) {
    map.removeLayer(visitedMarkers[id]);
    delete visitedMarkers[id];
  }
  map.closePopup();
  renderVisitedList();
  displayToast('已移除標記');
}

function _formatLatLng(lat, lng) {
  return `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}`;
}

// ── Sidebar list renderer ────────────────────────────────────────────────────

function renderVisitedList() {
  const container = document.getElementById('visited-list');
  if (!container) return;

  if (!visitedPlaces.length) {
    container.innerHTML = `<p style="font-size:.8rem;color:hsl(240 3.8% 60%);text-align:center;padding:.5rem 0">尚未標記任何地點</p>`;
    return;
  }

  container.innerHTML = visitedPlaces.slice().reverse().map(p => `
    <div class="visited-item" style="display:flex;align-items:flex-start;gap:.5rem;padding:.4rem .25rem;border-bottom:1px solid hsl(240 5.9% 90%)">
      <svg style="flex-shrink:0;margin-top:2px" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="#16a34a" stroke="none"/>
      </svg>
      <div style="flex:1;min-width:0;cursor:pointer" onclick="_flyToVisited('${p.id}')">
        <div style="font-size:.8rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(p.name)}</div>
        ${p.note ? `<div style="font-size:.72rem;color:hsl(240 3.8% 46.1%);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(p.note)}</div>` : ''}
        <div style="font-size:.7rem;color:hsl(240 3.8% 60%)">${new Date(p.ts).toLocaleDateString()}</div>
      </div>
      <button onclick="removeVisitedPlace('${p.id}')" title="移除" style="flex-shrink:0;background:none;border:none;cursor:pointer;color:hsl(240 3.8% 60%);padding:2px;line-height:1" onmouseover="this.style.color='hsl(0 72% 51%)'" onmouseout="this.style.color='hsl(240 3.8% 60%)'">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');
}

function _flyToVisited(id) {
  const place = visitedPlaces.find(p => p.id === id);
  if (!place || !map) return;
  map.flyTo([place.lat, place.lng], 16, { duration: 0.8 });
  if (visitedMarkers[id]) visitedMarkers[id].openPopup();
}

// ── Dialog for adding a visited place ────────────────────────────────────────

function openAddVisitedDialog(lat, lng) {
  const dlg = document.getElementById('addVisitedDialog');
  if (!dlg) return;
  document.getElementById('visitedName').value = '';
  document.getElementById('visitedNote').value = '';
  dlg._lat = lat;
  dlg._lng = lng;
  dlg.showModal();
}

function confirmAddVisited() {
  const dlg = document.getElementById('addVisitedDialog');
  const name = document.getElementById('visitedName').value.trim();
  const note = document.getElementById('visitedNote').value.trim();
  addVisitedPlace(dlg._lat, dlg._lng, name, note);
  dlg.close();
}

// ── Initialise on map ready ──────────────────────────────────────────────────

function initVisited() {
  renderVisitedList();
}
