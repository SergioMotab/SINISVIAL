
document.getElementById('map').style.height = "calc(100vh - 64px)";
document.getElementById('map').style.width = "100%";

var map = L.map('map').setView([4.6097,-74.0817],12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom: 19,
    attribution: '&copy; <a href= "https://www.openstreetmap.org"/copyright>OpenStreetMap</a>'
}).addTo(map);



window.addEventListener('load',function(){
    setTimeout(() => {
        map.invalidateSize();
    },200);
});



// agregar un marcador

var marker = L.marker([4.6097,-74.0817]).addTo(map);

var circle = L.circle([4.6099,-74.0819],{
    color: 'red',
    fillColor: '#f03',
    fillOpacity: 0.5,
    radius: 500
}).addTo(map);


// motor de busqueda

const motorBusqueda = L.Control.Geocoder.nominatim();

document.getElementById('search-address').addEventListener('keypress',function(e){
    if (e.key === 'Enter'){
        e.preventDefault(); 
        const direccion = e.target.value;

        motorBusqueda.geocode(direccion,function(results) {
            if (results && results.length > 0 ) {
                const r = results[0];
                map.setView(r.center, 16);

                L.marker(r.center).addTo(map)
                    .bindPopup("<b>Ubicacion encontrada : </b>"+ r.name)
                    .openPopup();
            } else{
                M.toast({html: 'No se encontró la dirección. Intente con otra.', classes: 'red'});
            }
        });
    }
});

var marcadorTemporal;

map.on('click',function(e) {
    const coordenadas = e.latlng;
    if (marcadorTemporal) {
        map.removeLayer(marcadorTemporal);
    }

    marcadorTemporal = L.marker(coordenadas).addTo(map)
           .binPopup("¿Reportar incidente aqui?")
              .openPopup();

    // abrir modal
    const elem  = document.getElementById('report');
    const instance = M.Modal.getInstance(elem);
    instance.open();

    //Guardar 

    window.coordenadasIncidente = coordenadas;
    console.log("coordenadas capturadas: ",coordenadas);
})