(function () {
        const center = e.geocode.center;

        map.setView(center, 16);

        L.marker(center)
          .addTo(map)
          .bindPopup(e.geocode.name)
          .openPopup();
      })
      .addTo(map);

    setTimeout(() => {

      const navbar = document.getElementById('geocoder-navbar');
      const geocoderElement = document.querySelector('.leaflet-control-geocoder');

      if (navbar && geocoderElement) {
        navbar.appendChild(geocoderElement);
      }

    }, 100);
  }

  /* ==========================
     TOAST
  ========================== */
  function showToast(message, color = '') {

    M.toast({
      html: message,
      classes: color
    });
  }

  /* ==========================
     INICIALIZAR UI
  ========================== */
  function initUI() {

    M.Modal.init(document.querySelectorAll('.modal'));
    M.FormSelect.init(document.querySelectorAll('select'));

    document
      .getElementById('confirmar-reporte')
      .addEventListener('click', submitReport);

    document
      .getElementById('llamar-emergencia')
      .addEventListener('click', () => {

        window.location.href = 'tel:123';
      });
  }

  /* ==========================
     START
  ========================== */
  document.addEventListener('DOMContentLoaded', () => {

    initUI();
    initMap();
  });

})();
