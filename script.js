'use strict';

// ===== AJUSTE MAPA (TU MÉTODO ORIGINAL) =====
const mapEl = document.getElementById('map');
mapEl.style.height = "calc(100vh - 64px)";
mapEl.style.width = "100%";

// ===== MAPA =====
const map = L.map('map').setView([4.6097, -74.0817], 12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

window.addEventListener('load', () => {
  setTimeout(() => map.invalidateSize(), 200);
});

// ===== GEOCODER (LUPA) =====
const geocoderControl = L.Control.geocoder({
  defaultMarkGeocode: false,
  placeholder: "Buscar en Bogotá..."
})
.on('markgeocode', function(e) {

  const center = e.geocode.center;

  map.setView(center, 16);

  L.marker(center).addTo(map)
    .bindPopup(`<b>${e.geocode.name}</b>`)
    .openPopup();
})
.addTo(map);

// ===== BUSCADOR PERSONALIZADO =====
const inputBusqueda = document.getElementById('search-address');
const searchIcon = document.getElementById('search-icon');

function buscarDireccion() {
  let direccion = inputBusqueda.value.trim();
  if (!direccion) return;

  direccion = direccion.replace('#', ' ');
  direccion = direccion.replace('-', ' ');
  direccion += ', Bogotá, Colombia';

  geocoderControl.options.geocoder.geocode(direccion, function(results) {

    if (results.length > 0) {
      const r = results[0];

      map.setView(r.center, 16);

      L.marker(r.center).addTo(map)
        .bindPopup(`<b>${r.name}</b>`)
        .openPopup();

    } else {
      M.toast({html: 'No se encontró la dirección', classes: 'red'});
    }
  });
}

inputBusqueda.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    buscarDireccion();
  }
});

searchIcon.addEventListener('click', buscarDireccion);

// ===== MATERIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  M.AutoInit();
});

// ===== REPORTES =====
let marcadorTemporal;
let listaDeReportes = [];

map.on('click', (e) => {

  if (marcadorTemporal) {
    map.removeLayer(marcadorTemporal);
  }

  marcadorTemporal = L.marker(e.latlng).addTo(map)
    .bindPopup("¿Reportar aquí?")
    .openPopup();

  window.coordenadasIncidente = e.latlng;

  const modal = M.Modal.getInstance(document.getElementById('reportar'));
  if (modal) modal.open();
});

// confirmar
document.getElementById('confirmar-reporte').addEventListener('click', () => {

  if (!window.coordenadasIncidente) {
    M.toast({html: 'Selecciona ubicación', classes: 'red'});
    return;
  }

  const descripcion = document.getElementById('incidente-descripcion').value;
  const tipo = document.getElementById('tipo-marcador').value;

  const marker = L.marker(window.coordenadasIncidente).addTo(map)
    .bindPopup(`<b>${tipo}</b><br>${descripcion}`)
    .openPopup();

  listaDeReportes.push({
    tipo,
    descripcion,
    coords: window.coordenadasIncidente
  });

  if (marcadorTemporal) map.removeLayer(marcadorTemporal);

  const modal = M.Modal.getInstance(document.getElementById('reportar'));
  modal.close();

  M.toast({html: 'Reporte guardado', classes: 'green'});
});

// ===== LISTA =====
document.getElementById('markers-list').addEventListener('click', () => {

  const ul = document.getElementById('markers-list-content');
  ul.innerHTML = '';

  listaDeReportes.forEach(r => {
    const li = document.createElement('li');
    li.textContent = `${r.tipo} - ${r.descripcion}`;
    ul.appendChild(li);
  });
});

// ===== EMERGENCIA =====
document.getElementById('llamar-emergencia').addEventListener('click', () => {
  window.location.href = 'tel:123';
});