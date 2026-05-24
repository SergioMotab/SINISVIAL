(function () {
'use strict';

const EventBus = {
  _events: {},
  on(evt, cb) { (this._events[evt] ||= []).push(cb); },
  emit(evt, payload) { (this._events[evt] || []).forEach(fn => fn(payload)); }
};

const MapSingleton = (() => {
  let map = null;

  function init() {
    if (map) return map;
    map = L.map('map').setView([4.6097, -74.0817], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    return map;
  }

  function get() { return map; }
  return { init, get };
})();

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

const iconos = {
  danger: L.divIcon({ className: '', html: 'RO', iconSize: [24, 24] }),
  caution: L.divIcon({ className: '', html: 'PR', iconSize: [24, 24] }),
  accident: L.divIcon({ className: '', html: 'AC', iconSize: [24, 24] }),
};

const MapView = {
  addMarker(coords, html, tipo) {
    const icono = iconos[tipo] || iconos.danger;
    return L.marker(coords, { icon: icono })
      .addTo(MapSingleton.get())
      .bindPopup(html);
  }
};

const UIView = {
  init() {
    M.Modal.init(document.querySelectorAll('.modal'));
    M.FormSelect.init(document.querySelectorAll('select'));
  },
  get(id) { return document.getElementById(id); },
  toast(msg, color = '') { M.toast({ html: msg, classes: color }); }
};

const GeocoderService = {
  init() {
    L.Control.geocoder({ defaultMarkGeocode: false })
      .on('markgeocode', function (e) {
        const center = e.geocode.center;
        MapSingleton.get().setView(center, 16);
        MapView.addMarker(center, `<b>${e.geocode.name}</b>`, 'danger');
      })
      .addTo(MapSingleton.get());

    setTimeout(() => {
      const navbar = document.getElementById('geocoder-navbar');
      const el = document.querySelector('.leaflet-control-geocoder');
      if (navbar && el) navbar.appendChild(el);
    }, 100);
  }
};

function formatFecha(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const ReportController = (() => {
  let coordsSeleccionadas = null;
  let marcadorTemporal = null;

  function popup(r) {
    const fecha = r.creado_en ? `<br><small>${formatFecha(r.creado_en)}</small>` : '';
    return `<b>${r.tipo.toUpperCase()}</b><br>${r.descripcion}${fecha}`;
  }

  function init() {
    ReportModel.load().then(reportes => {
      reportes.forEach(r => MapView.addMarker([r.lat, r.lng], popup(r), r.tipo));
    }).catch(err => console.error("Error cargando reportes:", err));

    MapSingleton.get().on('click', (e) => {
      coordsSeleccionadas = e.latlng;
      if (marcadorTemporal) MapSingleton.get().removeLayer(marcadorTemporal);
      marcadorTemporal = MapView.addMarker(e.latlng, 'Reportar aqui?', 'danger').openPopup();
      EventBus.emit('ui:openModal');
    });

    UIView.get('confirmar-reporte').addEventListener('click', confirmar);
    UIView.get('btn-mi-ubicacion').addEventListener('click', usarMiUbicacion);
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      return UIView.toast('Geolocalizacion no disponible', 'red');
    }

    UIView.toast('Obteniendo ubicacion...', '');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        MapSingleton.get().setView([coords.lat, coords.lng], 16);
        coordsSeleccionadas = coords;
        if (marcadorTemporal) MapSingleton.get().removeLayer(marcadorTemporal);
        marcadorTemporal = MapView.addMarker([coords.lat, coords.lng], 'Reportar aqui?', 'danger').openPopup();
        EventBus.emit('ui:openModal');
      },
      () => UIView.toast('No se pudo obtener la ubicacion', 'red')
    );
  }

  async function confirmar() {
    if (!coordsSeleccionadas) return UIView.toast('Selecciona una ubicacion', 'red');

    const descripcion = UIView.get('incidente-descripcion').value.trim();
    const tipo = UIView.get('tipo-marcador').value;

    if (!descripcion) return UIView.toast('Describe el incidente', 'orange');

    try {
      const nuevo = await ReportModel.add({ tipo, descripcion, coords: coordsSeleccionadas });
      MapView.addMarker([nuevo.lat, nuevo.lng], popup(nuevo), nuevo.tipo).openPopup();

      if (marcadorTemporal) {
        MapSingleton.get().removeLayer(marcadorTemporal);
        marcadorTemporal = null;
      }

      M.Modal.getInstance(UIView.get('reportar')).close();
      UIView.get('incidente-descripcion').value = '';
      UIView.toast('Reporte guardado', 'green');
    } catch (err) {
      console.error("Error guardando reporte:", err);
      UIView.toast('Error al guardar', 'red');
    }
  }

  return { init };
})();

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

document.addEventListener('DOMContentLoaded', () => {
  UIView.init();
  MapSingleton.init();
  GeocoderService.init();
  ReportController.init();
  UIController.init();
});

})();
