(function () {
'use strict';

/* ===========================
   EVENT BUS
=========================== */
const EventBus = {
  _events: {},
  on(evt, cb) {
    (this._events[evt] ||= []).push(cb);
  },
  emit(evt, payload) {
    (this._events[evt] || []).forEach(fn => fn(payload));
  }
};

/* ===========================
   MAPA
=========================== */
const MapSingleton = (() => {
  let map = null;

  function init() {
    if (map) return map;

    map = L.map('map').setView([4.6097, -74.0817], 12);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    return map;
  }

  function get() {
    return map;
  }

  return { init, get };
})();

/* ===========================
   MODELO (DB)
=========================== */
const ReportModel = (() => {

  async function load() {
    const res = await fetch("/reportes");
    return await res.json();
  }

  async function add(report) {
    const res = await fetch("/reportes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    return await res.json();
  }

  return { load, add };
})();

/* ===========================
   MAP VIEW
=========================== */
const MapView = {
  addMarker(coords, html) {
    return L.marker(coords)
      .addTo(MapSingleton.get())
      .bindPopup(html);
  }
};

/* ===========================
   UI VIEW
=========================== */
const UIView = {
  init() {
    M.Modal.init(document.querySelectorAll('.modal'));
    M.FormSelect.init(document.querySelectorAll('select'));
  },
  get(id) {
    return document.getElementById(id);
  },
  toast(msg, color = '') {
    M.toast({ html: msg, classes: color });
  }
};

/* ===========================
   GEOCODER
=========================== */
const GeocoderService = {
  init() {
    L.Control.geocoder({ defaultMarkGeocode: false })
      .on('markgeocode', function (e) {
        const center = e.geocode.center;
        MapSingleton.get().setView(center, 16);
        MapView.addMarker(center, `<b>${e.geocode.name}</b>`);
      })
      .addTo(MapSingleton.get());

    setTimeout(() => {
      const navbar = document.getElementById('geocoder-navbar');
      const el = document.querySelector('.leaflet-control-geocoder');
      if (navbar && el) navbar.appendChild(el);
    }, 100);
  }
};

/* ===========================
   CONTROLLER REPORTES
=========================== */
const ReportController = (() => {
  let coordsSeleccionadas = null;
  let marcadorTemporal = null;

  function popup(r) {
    return `<b>${r.tipo.toUpperCase()}</b><br>${r.descripcion}`;
  }

  function init() {
    ReportModel.load().then(reportes => {
      reportes.forEach(r => {
        MapView.addMarker([r.lat, r.lng], popup(r));
      });
    }).catch(err => console.error("Error cargando reportes:", err));

    MapSingleton.get().on('click', (e) => {
      coordsSeleccionadas = e.latlng;

      if (marcadorTemporal) {
        MapSingleton.get().removeLayer(marcadorTemporal);
      }

      marcadorTemporal = MapView.addMarker(e.latlng, '¿Reportar aquí?').openPopup();
      EventBus.emit('ui:openModal');
    });

    UIView.get('confirmar-reporte').addEventListener('click', confirmar);
  }

  async function confirmar() {
    if (!coordsSeleccionadas) return UIView.toast('Selecciona ubicación', 'red');

    const descripcion = UIView.get('incidente-descripcion').value.trim();
    const tipo = UIView.get('tipo-marcador').value;

    if (!descripcion) return UIView.toast('Describe el incidente', 'orange');

    try {
      const nuevo = await ReportModel.add({
        tipo,
        descripcion,
        coords: coordsSeleccionadas
      });

      MapView.addMarker([nuevo.lat, nuevo.lng], popup(nuevo)).openPopup();

      if (marcadorTemporal) {
        MapSingleton.get().removeLayer(marcadorTemporal);
        marcadorTemporal = null;
      }

      M.Modal.getInstance(UIView.get('reportar')).close();
      UIView.get('incidente-descripcion').value = '';
      UIView.toast('Reporte guardado ✅', 'green');
    } catch (err) {
      console.error("Error guardando reporte:", err);
      UIView.toast('Error al guardar ❌', 'red');
    }
  }

  return { init };
})();

/* ===========================
   UI CONTROLLER
=========================== */
const UIController = (() => {
  function init() {
    EventBus.on('ui:openModal', () => {
      M.Modal.getInstance(UIView.get('reportar')).open();
    });

    UIView.get('llamar-emergencia').addEventListener('click', () => {
      window.location.href = 'tel:123';
    });
  }

  return { init };
})();

/* ===========================
   INIT
=========================== */
document.addEventListener('DOMContentLoaded', () => {
  UIView.init();
  MapSingleton.init();
  GeocoderService.init();
  ReportController.init();
  UIController.init();
});

})();
