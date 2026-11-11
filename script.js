(function () {
'use strict';

const EventBus = {
  _events: {},
  on(evt, cb) { (this._events[evt] ||= []).push(cb); },
  emit(evt, payload) { (this._events[evt] || []).forEach(fn => fn(payload)); }
};

// Estado compartido entre modulos
const AppState = { modo: 'incidente' };      // 'incidente' | 'mascota': que se reporta al tocar el mapa
const Cache = { reportes: [], mascotas: [] }; // datos en memoria, los usan las alertas cercanas

const ETIQUETAS = {
  danger: 'Peligro',
  caution: 'Precaucion',
  accident: 'Accidente',
  animal: 'Animal en la via'
};

// Escapa HTML: todo texto escrito por usuarios pasa por aqui antes de ir a un popup (evita XSS)
function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

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
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  async function add(report) {
    const res = await fetch("/reportes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  return { load, add };
})();

const PetModel = (() => {
  const KEY = 'sinisvial_tokens';

  // El token (secreto de quien publico) se guarda solo en este navegador
  function tokens() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function guardarToken(id, token) {
    try {
      const t = tokens();
      t[id] = token;
      localStorage.setItem(KEY, JSON.stringify(t));
    } catch (e) { /* sin almacenamiento: simplemente no podra cerrar el reporte */ }
  }
  function tokenDe(id) { return tokens()[id] || null; }

  async function load() {
    const res = await fetch('/mascotas');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  async function add(data) {
    const res = await fetch('/mascotas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al guardar');
    guardarToken(json.id, json.token);
    return json;
  }

  async function resolver(id) {
    const res = await fetch(`/mascotas/${id}/resuelta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenDe(id) }),
    });
    if (!res.ok) throw new Error('No se pudo cerrar el reporte');
  }

  return { load, add, resolver, tokenDe };
})();

const pin = (clase, html) => L.divIcon({
  className: '',
  html: `<div class="pin ${clase}">${html}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

const iconos = {
  danger: pin('pin-danger', 'RO'),
  caution: pin('pin-caution', 'PR'),
  accident: pin('pin-accident', 'AC'),
  animal: pin('pin-animal', 'AN'),
  perdida: pin('pin-perdida', '<i class="material-icons">pets</i>'),
  encontrada: pin('pin-encontrada', '<i class="material-icons">pets</i>'),
};

const MapView = {
  // html puede ser un string o una funcion que devuelve el string (Leaflet la evalua al abrir el popup)
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
    M.FloatingActionButton.init(document.querySelectorAll('.fixed-action-btn'));
  },
  get(id) { return document.getElementById(id); },
  toast(msg, color = '') { M.toast({ html: esc(msg), classes: color }); }
};

const GeocoderService = {
  init() {
    L.Control.geocoder({ defaultMarkGeocode: false })
      .on('markgeocode', function (e) {
        const center = e.geocode.center;
        MapSingleton.get().setView(center, 16);
        MapView.addMarker(center, `<b>${esc(e.geocode.name)}</b>`, 'danger');
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

/* ------------------------------------------------------------------
   Alertas cercanas: con la campana activada, la app sigue al conductor
   y le avisa (mensaje + voz + vibracion) cuando pasa cerca de una
   mascota perdida o de un incidente reportado. Cada conductor se
   convierte en un par de ojos para buscar mascotas, y la mascota
   suelta en la via deja de ser sorpresa para quien conduce.
------------------------------------------------------------------ */
const ProximityService = (() => {
  const RADIO_MASCOTA = 1000;  // metros
  const RADIO_REPORTE = 300;   // metros
  const avisados = new Set();  // para no repetir el mismo aviso
  let watchId = null;
  let marcadorYo = null;

  function hablar(texto) {
    try {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = 'es-CO';
        window.speechSynthesis.speak(u);
      }
      if (navigator.vibrate) navigator.vibrate(200);
    } catch (e) { /* el aviso en pantalla ya salio */ }
  }

  function avisar(clave, texto, color) {
    if (avisados.has(clave)) return;
    avisados.add(clave);
    UIView.toast(texto, color);
    hablar(texto);
  }

  function ignorar(clave) { avisados.add(clave); }

  function revisar(ll) {
    const pos = L.latLng(ll);

    Cache.mascotas.forEach((m) => {
      const d = pos.distanceTo([m.lat, m.lng]);
      if (d <= RADIO_MASCOTA) {
        avisar('m' + m.id,
          `Mascota ${m.estado} a ${Math.round(d)} metros: ${m.nombre || m.especie}. Conduce con precaucion`,
          'orange');
      }
    });

    Cache.reportes.forEach((r) => {
      const d = pos.distanceTo([r.lat, r.lng]);
      if (d <= RADIO_REPORTE) {
        avisar('r' + r.id,
          `${ETIQUETAS[r.tipo] || 'Incidente'} a ${Math.round(d)} metros: ${r.descripcion}`,
          'red');
      }
    });
  }

  function marcarBoton(activo) {
    document.querySelectorAll('[data-action="alertas"] .material-icons').forEach((i) => {
      i.textContent = activo ? 'notifications_active' : 'notifications_none';
    });
  }

  function iniciar() {
    if (!navigator.geolocation) {
      return UIView.toast('Geolocalizacion no disponible', 'red');
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        if (!marcadorYo) {
          marcadorYo = L.circleMarker(ll, {
            radius: 8, color: '#ffffff', weight: 2, fillColor: '#1976d2', fillOpacity: 1
          }).addTo(MapSingleton.get());
          MapSingleton.get().setView(ll, 15);
        } else {
          marcadorYo.setLatLng(ll);
        }
        revisar(ll);
      },
      () => {
        UIView.toast('No se pudo obtener la ubicacion', 'red');
        detener();
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    marcarBoton(true);
    UIView.toast('Alertas cercanas activadas', 'green');
  }

  function detener() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    if (marcadorYo) {
      MapSingleton.get().removeLayer(marcadorYo);
      marcadorYo = null;
    }
    avisados.clear();
    marcarBoton(false);
  }

  function init() {
    EventBus.on('accion:alertas', () => (watchId === null ? iniciar() : detener()));
  }

  return { init, ignorar };
})();

const ReportController = (() => {
  let coordsSeleccionadas = null;
  let marcadorTemporal = null;

  function popup(r) {
    const fecha = r.creado_en ? `<br><small>${formatFecha(r.creado_en)}</small>` : '';
    const etiqueta = (ETIQUETAS[r.tipo] || r.tipo || '').toUpperCase();
    return `<b>${esc(etiqueta)}</b><br>${esc(r.descripcion)}${fecha}`;
  }

  // Punto unico de seleccion: segun el modo, la ubicacion va al reporte de incidente o al de mascota
  function alSeleccionar(latlng) {
    if (AppState.modo === 'mascota') {
      AppState.modo = 'incidente';
      EventBus.emit('pet:ubicacion', latlng);
      return;
    }
    coordsSeleccionadas = latlng;
    if (marcadorTemporal) MapSingleton.get().removeLayer(marcadorTemporal);
    marcadorTemporal = MapView.addMarker(latlng, 'Reportar aqui?', 'danger').openPopup();
    EventBus.emit('ui:openModal');
  }

  function init() {
    setTimeout(() => {
      ReportModel.load().then(reportes => {
        Cache.reportes = reportes;
        reportes.forEach(r => MapView.addMarker([r.lat, r.lng], popup(r), r.tipo));
      }).catch(err => console.error("Error cargando reportes:", err));
    }, 500);

    MapSingleton.get().on('click', (e) => alSeleccionar(e.latlng));

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
        alSeleccionar(coords);
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
      const nuevo = await ReportModel.add({
        tipo,
        descripcion,
        coords: { lat: coordsSeleccionadas.lat, lng: coordsSeleccionadas.lng }
      });
      MapView.addMarker([nuevo.lat, nuevo.lng], popup(nuevo), nuevo.tipo).openPopup();
      Cache.reportes.push(nuevo);
      ProximityService.ignorar('r' + nuevo.id);

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

/* ------------------------------------------------------------------
   Mascotas perdidas / encontradas
------------------------------------------------------------------ */
const PetController = (() => {
  const marcadores = new Map();   // id -> { marker, data }
  let coords = null;
  let marcadorTemporal = null;
  let filtro = 'todas';           // 'todas' | 'perdida' | 'encontrada'

  const TXT_ESTADO = { perdida: 'Perdida', encontrada: 'Encontrada' };

  function fotoUrl(m) { return `/mascotas/${Number(m.id)}/foto`; }

  function popup(m) {
    const foto = m.tiene_foto ? `<img class="pet-foto" src="${fotoUrl(m)}" alt="Foto de la mascota">` : '';
    const nombre = m.nombre ? ` - ${esc(m.nombre)}` : '';
    const tel = esc(m.contacto);
    // Solo quien publico (tiene el token en este navegador) ve el boton para cerrar el reporte
    const cerrar = PetModel.tokenDe(m.id)
      ? `<br><button class="btn-small green" data-resolver="${Number(m.id)}">${m.estado === 'perdida' ? 'Ya aparecio' : 'Ya fue entregada'}</button>`
      : '';
    return `${foto}<b>${esc((TXT_ESTADO[m.estado] || '').toUpperCase())}${nombre}</b>` +
      `<br>${esc(m.especie)}<br>${esc(m.descripcion)}` +
      `<br><small>${formatFecha(m.creado_en)}</small>` +
      `<br><a href="tel:+57${tel}">Llamar</a> | ` +
      `<a href="https://wa.me/57${tel}" target="_blank" rel="noopener">WhatsApp</a>${cerrar}`;
  }

  function agregar(m) {
    const marker = MapView.addMarker([m.lat, m.lng], () => popup(m), m.estado);
    marcadores.set(m.id, { marker, data: m });
  }

  function quitar(id) {
    const x = marcadores.get(id);
    if (!x) return;
    MapSingleton.get().removeLayer(x.marker);
    marcadores.delete(id);
    sincronizar();
    renderLista();
  }

  function sincronizar() {
    Cache.mascotas = [...marcadores.values()].map(x => x.data);
  }

  // Trae las mascotas del servidor; agrega las nuevas y retira las ya cerradas o vencidas
  async function refrescar() {
    try {
      const lista = await PetModel.load();
      const ids = new Set(lista.map(m => m.id));
      for (const [id, x] of marcadores) {
        if (!ids.has(id)) {
          MapSingleton.get().removeLayer(x.marker);
          marcadores.delete(id);
        }
      }
      lista.forEach(m => { if (!marcadores.has(m.id)) agregar(m); });
      sincronizar();
      renderLista();
    } catch (err) {
      console.error('Error cargando mascotas:', err);
    }
  }

  function renderLista() {
    const ul = UIView.get('mascotas-list-content');
    ul.innerHTML = '';

    document.querySelectorAll('[data-filtro]').forEach((b) => {
      b.classList.toggle('blue', b.dataset.filtro === filtro);
      b.classList.toggle('grey', b.dataset.filtro !== filtro);
    });

    const datos = Cache.mascotas.filter(m => filtro === 'todas' || m.estado === filtro);
    if (!datos.length) {
      const vacio = document.createElement('li');
      vacio.className = 'collection-item';
      vacio.textContent = 'No hay mascotas reportadas.';
      ul.appendChild(vacio);
      return;
    }

    datos.forEach((m) => {
      const li = document.createElement('li');
      li.className = 'collection-item avatar';
      const imagen = m.tiene_foto
        ? `<img class="circle" src="${fotoUrl(m)}" alt="">`
        : '<i class="material-icons circle grey">pets</i>';
      li.innerHTML =
        `${imagen}<span class="title"><b>${esc(TXT_ESTADO[m.estado])}</b> - ${esc(m.nombre || m.especie)}</span>` +
        `<p>${esc(m.descripcion)}<br><small>${formatFecha(m.creado_en)}</small></p>`;
      li.addEventListener('click', () => {
        M.Modal.getInstance(UIView.get('mascotas-list')).close();
        MapSingleton.get().flyTo([m.lat, m.lng], 17);
        const x = marcadores.get(m.id);
        if (x) x.marker.openPopup();
      });
      ul.appendChild(li);
    });
  }

  function iniciarReporte() {
    M.Modal.getInstance(UIView.get('mascotas-list')).close();
    AppState.modo = 'mascota';
    UIView.toast('Toca el mapa donde la viste (o usa el boton de mi ubicacion)', 'orange');
  }

  function limpiarTemporal() {
    if (marcadorTemporal) {
      MapSingleton.get().removeLayer(marcadorTemporal);
      marcadorTemporal = null;
    }
  }

  function alElegirUbicacion(latlng) {
    coords = { lat: latlng.lat, lng: latlng.lng };
    limpiarTemporal();
    marcadorTemporal = MapView.addMarker([coords.lat, coords.lng], 'Ubicacion de la mascota', 'perdida');
    M.Modal.getInstance(UIView.get('reportar-mascota')).open();
  }

  function limpiarFormulario() {
    ['mascota-nombre', 'mascota-descripcion', 'mascota-contacto'].forEach((id) => { UIView.get(id).value = ''; });
    UIView.get('mascota-foto').value = '';
    const ruta = document.querySelector('#reportar-mascota .file-path');
    if (ruta) ruta.value = '';
    UIView.get('mascota-consent').checked = false;
    M.updateTextFields();
  }

  // Reduce la foto a max 640 px y JPEG calidad 0.7 (unos 40-90 KB) antes de subirla
  function redimensionarFoto(archivo, maxLado = 640, calidad = 0.7) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, maxLado / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * k);
        canvas.height = Math.round(img.height * k);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('La imagen no es valida'));
      };
      img.src = url;
    });
  }

  async function publicar() {
    if (!coords) return UIView.toast('Selecciona una ubicacion en el mapa', 'red');

    const estado = UIView.get('mascota-estado').value;
    const especie = UIView.get('mascota-especie').value;
    const nombre = UIView.get('mascota-nombre').value.trim();
    const descripcion = UIView.get('mascota-descripcion').value.trim();
    const contacto = UIView.get('mascota-contacto').value.replace(/\D/g, '');
    const consentimiento = UIView.get('mascota-consent').checked;

    if (!descripcion) return UIView.toast('Describe a la mascota', 'orange');
    if (!/^(57)?3\d{9}$/.test(contacto)) return UIView.toast('Celular invalido (10 digitos)', 'orange');
    if (!consentimiento) return UIView.toast('Debes autorizar mostrar tu celular', 'orange');

    const boton = UIView.get('confirmar-mascota');
    boton.disabled = true;
    try {
      const archivo = UIView.get('mascota-foto').files[0];
      const foto = archivo ? await redimensionarFoto(archivo) : null;

      const nueva = await PetModel.add({
        estado, especie, nombre, descripcion, contacto, consentimiento, foto,
        coords: { lat: coords.lat, lng: coords.lng }
      });

      agregar(nueva);
      sincronizar();
      renderLista();
      ProximityService.ignorar('m' + nueva.id);

      limpiarTemporal();
      M.Modal.getInstance(UIView.get('reportar-mascota')).close();
      limpiarFormulario();
      coords = null;
      UIView.toast('Mascota publicada', 'green');
      marcadores.get(nueva.id).marker.openPopup();
    } catch (err) {
      console.error('Error publicando mascota:', err);
      UIView.toast(err.message || 'Error al publicar', 'red');
    } finally {
      boton.disabled = false;
    }
  }

  function init() {
    EventBus.on('accion:reportar-mascota', iniciarReporte);
    EventBus.on('accion:ver-mascotas', () => {
      renderLista();
      M.Modal.getInstance(UIView.get('mascotas-list')).open();
    });
    EventBus.on('pet:ubicacion', alElegirUbicacion);

    // Si cierran el formulario sin publicar, se retira el marcador provisional
    M.Modal.getInstance(UIView.get('reportar-mascota')).options.onCloseEnd = limpiarTemporal;

    UIView.get('confirmar-mascota').addEventListener('click', publicar);

    document.querySelectorAll('[data-filtro]').forEach((b) => {
      b.addEventListener('click', () => {
        filtro = b.dataset.filtro;
        renderLista();
      });
    });

    // Los popups se crean dinamicamente: delegacion de eventos para el boton "Ya aparecio"
    document.addEventListener('click', async (ev) => {
      const boton = ev.target.closest && ev.target.closest('[data-resolver]');
      if (!boton) return;
      const id = Number(boton.dataset.resolver);
      try {
        await PetModel.resolver(id);
        quitar(id);
        UIView.toast('Reporte cerrado, gracias', 'green');
      } catch (err) {
        UIView.toast(err.message || 'Error al cerrar', 'red');
      }
    });

    refrescar();
    setInterval(refrescar, 60 * 1000); // ve lo que reportan otros usuarios
  }

  return { init };
})();

const UIController = (() => {
  function abrir(id) { M.Modal.getInstance(UIView.get(id)).open(); }

  const acciones = {
    'reportar': () => { AppState.modo = 'incidente'; abrir('reportar'); },
    'emergencia': () => abrir('emergencia'),
    'mi-ubicacion': () => UIView.get('btn-mi-ubicacion').click(),
  };

  function init() {
    EventBus.on('ui:openModal', () => {
      M.Modal.getInstance(UIView.get('reportar')).open();
    });

    UIView.get('llamar-emergencia').addEventListener('click', () => {
      window.location.href = 'tel:123';
    });

    // Botones del menu superior y del boton flotante: <a data-action="...">
    document.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        const accion = el.dataset.action;
        if (acciones[accion]) acciones[accion]();
        else EventBus.emit('accion:' + accion);
      });
    });
  }
  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  UIView.init();
  MapSingleton.init();
  GeocoderService.init();
  ReportController.init();
  PetController.init();
  ProximityService.init();
  UIController.init();
});

})();
