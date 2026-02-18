document.addEventListener('DOMContentLoaded', function() {
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    if (!usuarioLogueado) {
        window.location.href = "login.html";
        return;
    }

    inicializarMapa();

    // --- NUEVA LÓGICA DE TEMA ---
    // El mapa necesita saber cuándo cambia el tema para actualizar las teselas (tiles).
    // Usamos un MutationObserver para "escuchar" los cambios de clase en el <body>
    // que son realizados por theme-switcher.js.
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                console.log('El tema ha cambiado, actualizando el mapa...');
                aplicarModoMapa();
            }
        }
    });

    // Empezamos a observar el body para cambios en sus atributos (como la clase)
    observer.observe(document.body, { attributes: true });
});

let miMapa;
let capaTeselasOscura, capaTeselasClara;

const opcionesTeselasOscuras = {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }
};

const opcionesTeselasClaras = {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    options: {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }
};

function inicializarMapa() {
    miMapa = L.map('mapaPrincipal', {
        zoomControl: false
    }).setView([40.416775, -3.703790], 6); // Centro de España

    capaTeselasOscura = L.tileLayer(opcionesTeselasOscuras.url, opcionesTeselasOscuras.options);
    capaTeselasClara = L.tileLayer(opcionesTeselasClaras.url, opcionesTeselasClaras.options);

    // theme-switcher.js ya ha establecido la clase correcta en el body.
    // Nosotros solo tenemos que aplicar el tema de mapa correspondiente.
    aplicarModoMapa();

    L.control.zoom({
        position: 'topright'
    }).addTo(miMapa);

    const puntosDeInteres = [
        /*{
            nombrePopup: "Firme Yecla - Tramo A33",
            coords: [38.628944778396786, -1.038841315174744],
            escenaId: "murcia_yecla"
        },
        {
            nombrePopup: "Oficinas CalSens S.L., Valencia",
            coords: [39.47886087480154, -0.3376847036744172],
            escenaId: "valencia_calsens"
        },*/
        {
            nombrePopup: "Cathédrale Saint-Aubain, Namur – Belgique",
            coords: [50.46449807349381, 4.860612611771182],
            escenaId: "Belgica_Namur"
        },
    ];

    puntosDeInteres.forEach(function(punto) {
        const marcador = L.marker(punto.coords).addTo(miMapa);
        const contenidoPopup = `
            <div class="popup-container">
                <h3>${punto.nombrePopup}</h3>
                <button onclick="abrirVisorConModo('${punto.escenaId}', '2d')" class="popup-button popup-button-2d">
                    <i class="fas fa-ruler-combined"></i> Ver Planos
                </button>
            </div>
        `;
        marcador.bindPopup(contenidoPopup, { minWidth: 240, className: 'custom-popup' });
    });
}

// Esta función AHORA SOLO se encarga de cambiar las capas del mapa
function aplicarModoMapa() {
    if (!miMapa) return;

    // Comprobamos la clase del body que ha puesto theme-switcher.js
    if (document.body.classList.contains('light-mode')) {
        if (miMapa.hasLayer(capaTeselasOscura)) miMapa.removeLayer(capaTeselasOscura);
        if (!miMapa.hasLayer(capaTeselasClara)) capaTeselasClara.addTo(miMapa);
    } else { // Modo oscuro por defecto
        if (miMapa.hasLayer(capaTeselasClara)) miMapa.removeLayer(capaTeselasClara);
        if (!miMapa.hasLayer(capaTeselasOscura)) capaTeselasOscura.addTo(miMapa);
    }
}

function abrirVisorConModo(idDeLaEscena, modoVista) {
    window.location.href = `escena_3d.html?id=${idDeLaEscena}&vista=${modoVista}`;
}