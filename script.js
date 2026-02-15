
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


//inicializar el geocodificador

var geocoder = L.Control.Geocoder({
    defaultMarkGeoCode: false,
    placeholder: "Buscar direccion en Bogotá...",
    errorMessage: "No se logro encontrar la ubicación"
})
.on('markgeocode',function(e){
    var bbox = e.geocode.bbox;
    var poly = L.polygon([
        bbox.getSouthEast(),
        bbox.getNorthEast(),
        bbox.getNorthWest(),
        bbox.getSouthWest()
    ]);
    map.fitBounds(poly.getBounds());
})
.addTo(map);

//variable global guardado click usuario

var marcadorTemporal;
map.on('click',function(e){
    if (marcadorTemporal){
        map.removeLayer(marcadorTemporal);
    }

    // 2.Poner un marcador donde el usuario le dio click

    marcadorTemporal = L.marker(e.latlng).addTo(map);

    //3. Abrir el modal de reporte automaticamente

    var instance = M.Modal.getInstance(document.getElementById('reportar'));
    instance.open();

})


// crear motor busqueda

const motorBusqueda = L.Control.geocoder.nominatim();

document.getElementById('search-address').addEventListener('keypress',function(e){
    if (e.key === 'Enter'){
        const direccion = e.target.value;

        motorBusqueda.geocode(direccion,function(results){
            if (results.lenght > 0){
                const r = results[0];
                map.setView(r.center,16);

                L.marker(r.center).addTo(map)
                .bindPopup("ubicacion encontrada"+r.name)
                .openPopup();
            } else{
                M.toast({html: 'No se encontró la dirección en Bogotá'})
            }
        })
    }
})

map.on('click',function(e) {
    const coordenadas = e.latlng;

    L.marker(coordenadas).addTo(map)
       .bindPopup("¿Reportar incidente aquí?")
         .openPopup();


         //abrir formulario reporte

    const elem = document.getElementById('reportar');
    const instance = M.Modal.getInstance(elem);
    instance.open();
    
    
    //guardar coordenadas

    window.ultimaUbicacionClic = coordenadas;
})