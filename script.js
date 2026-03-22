(function () {
  'use strict';

  /* ===========================
     OBSERVER (EventBus)
  ============================ */
  const EventBus = {
    _events: Object.create(null),

    on(evt, cb) {
      (this._events[evt] ||= []).push(cb);
    },

    emit(evt, payload) {
      (this._events[evt] || []).forEach(fn => fn(payload));
    }
  };

  /* ===========================
     SINGLETON MAPA
  ============================ */
  const MapSingleton = (function () {
    let map = null;

    function init() {
      if (map) return map;

      map = L.map('map').setView([4.6097, -74.0817], 12);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      return map;
    }

    function get() {
      return map;
    }

    return { init, get };
  })();

  /* ===========================
     MODELO
  ============================ */
  const ReportModel = (function () {
    const KEY = 'reportes';
    let data = [];

    function load() {
      data = JSON.parse(localStorage.getItem(KEY)) || [];
      return [...data];
    }

    function save() {
      localStorage.setItem(KEY, JSON.stringify(data));
    }

    function add(report) {
      const newReport = { id: Date.now(), ...report };
      data.push(newReport);
      save();
      EventBus.emit('report:added', newReport);
      return newReport;
    }

    function getAll() {
      return [...data];
    }

    return { load, add, getAll };
  })();

  /* ===========================
     VISTA MAPA
  ============================ */
  const MapView = {
    addMarker(coords, html) {
      return L.marker(coords)
        .addTo(MapSingleton.get())
        .bindPopup(html);
    },

    focus(coords) {
      MapSingleton.get().setView(coords, 17);
    }
  };

  /* ===========================
     VISTA UI
  ============================ */
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
  ============================ */
  const GeocoderService = {
    init() {
      const control = L.Control.geocoder({
        defaultMarkGeocode: false
      })
        .on('markgeocode', function (e) {
          const center = e.geocode.center;

          MapSingleton.get().setView(center, 16);

          const partes = e.geocode.name.split(',');
          const direccion = partes.slice(0, 3).join(',');

          MapView.addMarker(center, `<b>${direccion}</b>`).openPopup();
        })
        .addTo(MapSingleton.get());

      setTimeout(() => {
        const navbar = document.getElementById('geocoder-navbar');
        const el = document.querySelector('.leaflet-control-geocoder');
        if (navbar && el) navbar.appendChild(el);
      }, 0);
    }
  };

  /* ===========================
     CONTROLLER REPORTES
  ============================ */
  const ReportController = (function () {
    let coordsSeleccionadas = null;
    let marcadorTemporal = null;

    function init() {
      // cargar reportes
      ReportModel.load().forEach(r => {
        const html = buildPopup(r);
        MapView.addMarker(r.coords, html);
      });

      // click mapa
      MapSingleton.get().on('click', (e) => {
        coordsSeleccionadas = e.latlng;

        if (marcadorTemporal) {
          MapSingleton.get().removeLayer(marcadorTemporal);
        }

        marcadorTemporal = MapView.addMarker(e.latlng, '¿Reportar aquí?').openPopup();

        EventBus.emit('ui:openModal');
      });

      // confirmar
      UIView.get('confirmar-reporte')?.addEventListener('click', confirmar);
    }

    function buildPopup(r) {
      return `<b>${r.tipo.toUpperCase()}</b><br>${r.descripcion}`;
    }

    function confirmar() {
      if (!coordsSeleccionadas) {
        return UIView.toast('Selecciona ubicación', 'red');
      }

      const descripcion = UIView.get('incidente-descripcion').value.trim();
      const tipo = UIView.get('tipo-marcador').value;

      if (!descripcion) {
        return UIView.toast('Agrega descripción', 'orange');
      }

      const nuevo = ReportModel.add({
        tipo,
        descripcion,
        coords: coordsSeleccionadas
      });

      MapView.addMarker(nuevo.coords, buildPopup(nuevo)).openPopup();

      if (marcadorTemporal) {
        MapSingleton.get().removeLayer(marcadorTemporal);
        marcadorTemporal = null;
      }

      M.Modal.getInstance(UIView.get('reportar')).close();
      UIView.get('incidente-descripcion').value = '';

      UIView.toast('Reporte guardado', 'green');
    }

    return { init };
  })();

  /* ===========================
     CONTROLLER UI
  ============================ */
  const UIController = (function () {


    function init() {
      EventBus.on('ui:openModal', () => {
        const modal = M.Modal.getInstance(UIView.get('reportar'));
        modal?.open();
      });

      // Mostrar historial de reportes en el modal de marcadores
      UIView.get('markers-list')?.addEventListener('click', () => {
        const ul = UIView.get('markers-list-content');
        ul.innerHTML = '';
        ReportModel.getAll().forEach(r => {
          const li = document.createElement('li');
          li.textContent = `${r.tipo} - ${r.descripcion}`;
          ul.appendChild(li);
        });
      });

      UIView.get('llamar-emergencia')?.addEventListener('click', () => {
        window.location.href = 'tel:123';
      });
    }

    return { init };
  })();

  /* ===========================
     INIT APP
  ============================ */
  document.addEventListener('DOMContentLoaded', () => {
    UIView.init();
    MapSingleton.init();
    GeocoderService.init();
    ReportController.init();
    UIController.init();
  });

})();