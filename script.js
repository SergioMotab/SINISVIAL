/* script.js – SINISVIAL
   - Mapa y búsqueda con geocoder robusto (timeout + validaciones)
   - Reportes con persistencia local (MVP)
   - Botón SOS (tel:123)
   - Modal de reportes y listado de marcadores
*/

'use strict';

// 1) Ajuste del contenedor del mapa
(() => {
  const mapEl = document.getElementById('map');
  if (mapEl) {
    mapEl.style.height = 'calc(100vh - 64px)';
    mapEl.style.width = '100%';
  }
})();

// 2) Inicialización del mapa
const map = L.map('map').setView([4.6097, -74.0817], 12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Asegurar que el mapa calcule dimensiones correctas tras carga
window.addEventListener('load', () => {
  setTimeout(() => map.invalidateSize(), 200);
});

// 3) Estado global mínimo
let marcadorBusqueda = null;   // marcador para la búsqueda
let marcadorTemporal = null;   // marcador temporal al hacer click para reportar
let listaDeReportes = [];      // almacén local (MVP)

// 4) Persistencia local (MVP). Cambia luego por Firebase si quieres multiusuario
function guardarReportesLocal(data) {
  try {
    localStorage.setItem('sinisvial_reportes', JSON.stringify(data));
  } catch (e) {
    console.warn('No se pudo guardar en localStorage', e);
  }
}
function cargarReportesLocal() {
  try {
    return JSON.parse(localStorage.getItem('sinisvial_reportes')) || [];
  } catch {
    return [];
  }
}

// 5) Repintar reportes guardados al iniciar
function repintarReportes() {
  listaDeReportes.forEach((r) => {
    const popupHtml =
      `<b>TIPO: ${r.tipo?.toUpperCase() || 'N/A'}</b><br>` +
      `DESCRIPCIÓN: ${r.descripcion || ''}`;
    L.marker(r.coords).addTo(map).bindPopup(popupHtml);
  });
}

// 6) Geocoder del plugin (revisa que esté cargado en index.html)
const motorBusqueda =
  (L.Control.Geocoder && L.Control.Geocoder.nominatim)
    ? L.Control.Geocoder.nominatim({
        geocodingQueryParams: {
          countrycodes: 'co',
          'accept-language': 'es'
        }
      })
    : null;

if (!motorBusqueda) {
  console.error('Leaflet Control Geocoder NO está cargado. Verifica Control.Geocoder.js en index.html');
}

// Utilidad: geocodificar con timeout de seguridad (evita “cargando” infinito)
async function geocodeConTimeout(query, { timeoutMs = 4500 } = {}) {
  return new Promise((resolve) => {
    let settled = false;

    try {
      motorBusqueda?.geocode(query, (res) => {
        if (!settled) {
          settled = true;
          resolve(Array.isArray(res) ? res : []);
        }
      });
    } catch (e) {
      console.warn('Error en geocoder del plugin:', e);
    }

    // Timeout de seguridad
    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve([]); // forzar salida para no quedar colgado
      }
    }, timeoutMs);
  });
}

// (Opcional) Debounce para futuras mejoras (buscar mientras se escribe)
function debounce(fn, ms = 350) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// 7) Lógica principal cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Materialize
  if (window.M) {
    M.Modal.init(document.querySelectorAll('.modal'));
    M.FormSelect.init(document.querySelectorAll('select'));
  }

  // Cargar y repintar reportes previos (MVP)
  listaDeReportes = cargarReportesLocal();
  repintarReportes();

  // ----- BUSCADOR EN LA BARRA DE NAVEGACIÓN -----
  const inputBusqueda = document.getElementById('search-address');
  const searchIcon = document.getElementById('search-icon');

  async function buscarDireccion() {
    if (!motorBusqueda) {
      M?.toast({ html: 'Geocoder no disponible', classes: 'red' });
      return;
    }
    const raw = (inputBusqueda?.value || '').trim();
    if (!raw) return;

    // Añadimos pista de ciudad para mejorar resultados
    const q = raw.toLowerCase().includes('bogotá') ? raw : `${raw}, Bogotá, Colombia`;

    M?.toast({ html: 'Buscando dirección…', classes: 'blue' });

    try {
      const results = await geocodeConTimeout(q, { timeoutMs: 4500 });

      if (!results || results.length === 0) {
        M?.toast({ html: 'No