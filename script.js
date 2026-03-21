/* script.js – SINISVIAL
   - Mapa y búsqueda con geocoder robusto (timeout + validaciones)
   - Reportes con persistencia local (MVP)
   - Botón SOS (tel:123)
   - Modal de reportes y listado de marcadores
*/

'use strict';

// 1) Geocoder del plugin (revisa que esté cargado en index.html)
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

// 2) Persistencia local (MVP). Cambia luego por Firebase si quieres multiusuario
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

// 3) Repintar reportes guardados al iniciar
function repintarReportes(map, listaDeReportes) {
  listaDeReportes.forEach((r) => {
    const popupHtml =
      `<b>TIPO: ${r.tipo?.toUpperCase() || 'N/A'}</b><br>` +
      `DESCRIPCIÓN: ${r.descripcion || ''}`;
    L.marker(r.coords).addTo(map).bindPopup(popupHtml);
  });
}

// 4) Lógica principal cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  // Ajuste del contenedor del mapa
  const mapEl = document.getElementById('map');
  if (mapEl) {
    mapEl.style.height = 'calc(100vh - 64px)';
    mapEl.style.width = '100%';
  }

  // Inicialización del mapa
  const map = L.map('map').setView([4.6097, -74.0817], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  window.addEventListener('load', () => {
    setTimeout(() => map.invalidateSize(), 200);
  });

  // Estado global mínimo
  let marcadorBusqueda = null;
  let marcadorTemporal = null;
  let listaDeReportes = cargarReportesLocal();
  repintarReportes(map, listaDeReportes);

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
    const q = raw.toLowerCase().includes('bogotá') ? raw : `${raw}, Bogotá, Colombia`;
    M?.toast({ html: 'Buscando dirección…', classes: 'blue' });
    try {
      const results = await geocodeConTimeout(q, { timeoutMs: 4500 });
      if (!results || results.length === 0) {
        M?.toast({ html: 'No se encontró la dirección', classes: 'red' });
        return;
      }
      const r = results[0];
      map.setView(r.center, 16);
      if (marcadorBusqueda) {
        map.removeLayer(marcadorBusqueda);
      }
      marcadorBusqueda = L.marker(r.center).addTo(map)
        .bindPopup(r.name)
        .openPopup();
    } catch (e) {
      M?.toast({ html: 'Error en la búsqueda', classes: 'red' });
      console.error('Error en buscarDireccion:', e);
    }
  }

  if (inputBusqueda) {
    inputBusqueda.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        buscarDireccion();
      }
    });
  }
  if (searchIcon) {
    searchIcon.addEventListener('click', function() {
      buscarDireccion();
    });
  }

});