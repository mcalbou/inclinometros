// Variables globales
let currentData = [];
let map = null;
let mapMarker = null;
let currentSensorInfo = null;
let dateSlider = null;
let depthSlider = null;

const COLOR_A = "#1f77b4";
const COLOR_B = "#ff7f0e";

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadSensors();
    initMap();

    // Listeners
    document.getElementById('btnUpdate').addEventListener('click', (e) => {
        e.preventDefault();
        updateDashboard();
    });

    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
});

// --- API CALLS ---

async function loadSensors() {
    try {
        const res = await axios.get('api.php?action=get_sensors');
        const sensores = res.data;
        const sel = document.getElementById('sensorSelect');
        
        sel.innerHTML = '';
        sensores.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.nombre;
            // Guardar data en atributo para acceso rápido
            opt.dataset.lat = s.latitud;
            opt.dataset.lon = s.longitud;
            opt.dataset.nf = s.nf;
            opt.dataset.foto = s.foto_path;
            sel.appendChild(opt);
        });

        if(sensores.length > 0) updateDashboard(); // Cargar el primero

    } catch (err) {
        console.error("Error cargando sensores", err);
    }
}

async function updateDashboard() {
    const sensorId = document.getElementById('sensorSelect').value;
    if(!sensorId) return;

    showLoading(true);

    try {
        // 1. Actualizar Info del Sensor
        updateSensorInfo();

        // 2. Descargar Datos
        const res = await axios.get(`api.php?action=get_data&id=${sensorId}`);
        currentData = res.data; // [{fecha_str, profundidad, valor_a, valor_b}, ...]

        // 3. Configurar Fechas (si están vacías)
        setupDates();

        // 4. Llenar Select de Profundidades
        setupDepths();

        // 5. Renderizar Todo
        renderAllCharts();

    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
    } finally {
        showLoading(false);
    }
}

// --- LOGICA DE DATOS ---

function setupDates() {
    if(currentData.length === 0) return;
    
    // 1. Obtener rango de fechas (timestamps)
    const feMinStr = currentData[0].fecha_str;
    const feMaxStr = currentData[currentData.length - 1].fecha_str;
    
    const minTs = new Date(feMinStr).getTime();
    const maxTs = new Date(feMaxStr).getTime();

    const slider = document.getElementById('dateSlider');

    // 2. Si ya existe, destruirlo para evitar duplicados al recargar
    if (slider.noUiSlider) {
        slider.noUiSlider.destroy();
    }

    // 3. Crear el Slider
    noUiSlider.create(slider, {
        start: [minTs, maxTs], // Empieza seleccionando todo
        connect: true,         // Relleno azul entre puntos
        range: {
            'min': minTs,
            'max': maxTs
        },
        step: 86400000, // Pasos de 1 día (en ms)
        
        // Formateador: Qué se muestra en la etiqueta flotante
        tooltips: [
            {
                to: function(val) {
                    const d = new Date(parseInt(val));
                    return d.toLocaleDateString('es-ES'); // "17/02/2025"
                }
            },
            {
                to: function(val) {
                    const d = new Date(parseInt(val));
                    return d.toLocaleDateString('es-ES');
                }
            }
        ]
    });

    // 4. Conectar con el sistema de filtrado
    // Evento 'set': Se dispara solo cuando SUELTAS el slider (mejora rendimiento)
    slider.noUiSlider.on('set', function (values) {
        // Convertir a YYYY-MM-DD para que el filtro de JS lo entienda
        const start = new Date(parseInt(values[0])).toISOString().split('T')[0];
        const end = new Date(parseInt(values[1])).toISOString().split('T')[0];

        document.getElementById('startDate').value = start;
        document.getElementById('endDate').value = end;
        
        // Actualizar gráficos automáticamente
        renderAllCharts();
    });
    
    // Inicializar inputs ocultos
    document.getElementById('startDate').value = feMinStr;
    document.getElementById('endDate').value = feMaxStr;
}

function setupDepths() {
    // 1. Obtener lista de profundidades únicas
    const uniqueProfs = [...new Set(currentData.map(item => parseFloat(item.profundidad)))].sort((a,b) => a - b);
    
    if (uniqueProfs.length === 0) return;

    const minProf = uniqueProfs[0];
    const maxProf = uniqueProfs[uniqueProfs.length - 1];
    
    // Calculamos el "paso" (step) asumiendo que es regular (ej: cada 0.5m)
    // Si hay solo 1 profundidad, el paso es 0
    let stepVal = 0.5; 
    if (uniqueProfs.length > 1) {
        stepVal = uniqueProfs[1] - uniqueProfs[0];
    }

    const sliderElement = document.getElementById('depthSlider');
    const hiddenInput = document.getElementById('profSelect');

    // 2. Destruir si ya existe (para evitar duplicados al cambiar de sensor)
    if (sliderElement.noUiSlider) {
        sliderElement.noUiSlider.destroy();
    }

    // 3. Crear el Slider de Profundidad
    noUiSlider.create(sliderElement, {
        start: [minProf],     // Empieza en la mínima
        connect: 'lower',     // Rellena la barra desde la izquierda (estilo volumen)
        range: {
            'min': minProf,
            'max': maxProf
        },
        step: stepVal,        // Salta de 0.5 en 0.5 (o lo que tenga el sensor)
        
        // Formateador: Añade la "m" de metros al tooltip
        tooltips: {
            to: function(val) {
                return parseFloat(val).toFixed(1) + " m";
            }
        },
        // Pips: (Opcional) Si quieres rayitas debajo, añade pips: {mode: 'steps', density: 10}
    });

    // 4. Lógica de actualización
    sliderElement.noUiSlider.on('update', function (values) {
        const selectedDepth = parseFloat(values[0]);
        
        // Actualizar el input oculto
        hiddenInput.value = selectedDepth;
        
        // Actualizar textos en la interfaz
        document.getElementById('txtProfTime').textContent = selectedDepth;
        document.getElementById('txtProfPolar').textContent = selectedDepth;
    });

    // 5. Solo redibujar gráficos pesados al soltar el ratón
    sliderElement.noUiSlider.on('change', function () {
        renderAllCharts();
    });

    // Inicialización manual del valor
    hiddenInput.value = minProf;
}

function getFilteredData() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    
    if(!start || !end) return currentData;

    return currentData.filter(d => d.fecha_str >= start && d.fecha_str <= end);
}

// --- RENDERIZADO ---

function updateSensorInfo() {
    const sel = document.getElementById('sensorSelect');
    const opt = sel.options[sel.selectedIndex];
    
    if(!opt) return;

    currentSensorInfo = {
        lat: parseFloat(opt.dataset.lat),
        lon: parseFloat(opt.dataset.lon),
        nf: parseFloat(opt.dataset.nf),
        foto: opt.dataset.foto
    };

    // UI Info
    document.getElementById('sensorInfoBox').style.display = 'block';
    document.getElementById('infoNombre').textContent = opt.text;
    document.getElementById('infoCoords').textContent = `${currentSensorInfo.lat}, ${currentSensorInfo.lon}`;

    // Mapa
    if(map) {
        map.setView([currentSensorInfo.lat, currentSensorInfo.lon], 18);
        if(mapMarker) map.removeLayer(mapMarker);
        mapMarker = L.circleMarker([currentSensorInfo.lat, currentSensorInfo.lon], {
            radius: 10, color: 'blue', fillOpacity: 0.6
        }).addTo(map);
    }

    // Foto
    const img = document.getElementById('sensorPhoto');
    const txt = document.getElementById('noPhotoText');
    if(currentSensorInfo.foto && currentSensorInfo.foto !== 'null') {
        img.src = `static/img/${currentSensorInfo.foto}`;
        img.style.display = 'block';
        txt.style.display = 'none';
    } else {
        img.style.display = 'none';
        txt.style.display = 'block';
    }
}

function renderAllCharts() {
    const data = getFilteredData();
    const profVal = parseFloat(document.getElementById('profSelect').value) || 0;

    // Actualizar etiquetas UI
    document.getElementById('txtProfTime').textContent = profVal;
    document.getElementById('txtProfPolar').textContent = profVal;

    // 1. Gráficos de Perfil (A y B)
    // Ordenamos fechas para saber cuál es la última real
    const dates = [...new Set(data.map(d => d.fecha_str))].sort();
    const latestDate = dates[dates.length - 1]; // La última fecha

    // Función auxiliar para formatear fecha visualmente
    const formatDateES = (str) => {
        if(!str) return str;
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
    };

    function makeProfileTrace(axis) {
        const traces = [];
        dates.forEach(date => {
            const dateData = data.filter(d => d.fecha_str === date);
            const isLatest = (date === latestDate); // ¿Es la última?

            traces.push({
                x: dateData.map(d => axis === 'A' ? d.valor_a : d.valor_b),
                y: dateData.map(d => d.profundidad),
                
                // AQUÍ ESTÁ EL CAMBIO:
                // Si es la última -> 'lines+markers' (Línea + Puntos)
                // Si no -> 'lines' (Solo línea)
                mode: isLatest ? 'lines+markers' : 'lines',
                
                name: formatDateES(date), 
                
                // ESTILO DE LÍNEA
                line: { 
                    // NO tocamos el 'color' para que siga siendo el automático
                    // Solo hacemos la última más gorda (3px) y las otras finas (1px)
                    width: isLatest ? 3 : 1 
                },
                
                // ESTILO DE LOS PUNTOS (Solo saldrán en la última)
                marker: { 
                    size: 6,
                    symbol: 'circle'
                    // Al no poner color aquí, hereda automáticamente el color de la línea
                },

                // Que la última se pinte siempre encima de las viejas
                opacity: isLatest ? 1 : 0.7, 

                showlegend: true,   
                hovertemplate: `<b>${formatDateES(date)}</b><br>Prof: %{y:.1f}m<br>Desp: %{x:.2f}mm<extra></extra>`
            });
        });
        return traces;
    }

    const layoutProfile = (title) => ({
        title: title,
        height: 900,
        yaxis: { title: 'Profundidad (m)', autorange: 'reversed' }, 
        xaxis: { title: 'Desplazamiento (mm)', range: [-20, 20] },
        shapes: [
            { type: 'rect', x0: -20, x1: -10, y0: 0, y1: 1, xref: 'x', yref: 'paper', fillcolor: 'yellow', opacity: 0.15, line: {width: 0}, layer: 'below' },
            { type: 'rect', x0: 10, x1: 20, y0: 0, y1: 1, xref: 'x', yref: 'paper', fillcolor: 'yellow', opacity: 0.15, line: {width: 0}, layer: 'below' },
            { 
                type: 'line', 
                x0: 0, x1: 1, xref: 'paper', 
                y0: currentSensorInfo.nf, y1: currentSensorInfo.nf, yref: 'y',
                line: { color: 'blue', dash: 'dash', width: 2 }
            }
        ],
        annotations: [
            { x: 0.95, xref: 'paper', y: currentSensorInfo.nf, yref: 'y', text: 'NF', showarrow: false, font: {color: 'blue'} }
        ],
        margin: {t: 40, b: 40, l: 50, r: 20},
        hovermode: 'closest' // <--- CAMBIO CLAVE 2: Solo muestra el dato que tocas
    });

    Plotly.newPlot('chartA', makeProfileTrace('A'), layoutProfile('Eje A'));
    Plotly.newPlot('chartB', makeProfileTrace('B'), layoutProfile('Eje B'));

    // 2. Serie Temporal (Fijando Profundidad)
    const dataProf = data.filter(d => parseFloat(d.profundidad) === profVal);
    
    const traceTimeA = {
        x: dataProf.map(d => d.fecha_str),
        y: dataProf.map(d => d.valor_a),
        name: 'Eje A', type: 'scatter', mode: 'lines+markers', marker: {color: COLOR_A}
    };
    const traceTimeB = {
        x: dataProf.map(d => d.fecha_str),
        y: dataProf.map(d => d.valor_b),
        name: 'Eje B', type: 'scatter', mode: 'lines+markers', marker: {color: COLOR_B}
    };

    Plotly.newPlot('chartTime', [traceTimeA, traceTimeB], {
        title: `Serie Temporal - ${profVal}m`,
        yaxis: { title: 'Desplazamiento (mm)' },
        hovermode: 'closest'
    });

    // 3. Polar (Fijando Profundidad)
    const rVals = dataProf.map(d => Math.sqrt(d.valor_a**2 + d.valor_b**2));
    const thetaVals = dataProf.map(d => Math.atan2(d.valor_b, d.valor_a) * (180/Math.PI));

    const tracePolar = {
        type: 'scatterpolar',
        r: rVals,
        theta: thetaVals,
        mode: 'markers+lines',
        marker: { color: COLOR_A, size: 6 },
        name: 'Lectura',
        showlegend: true // También ocultamos leyenda aquí si molesta
    };

    const traceAmber = {
        type: 'scatterpolar', r: new Array(360).fill(10), theta: Array.from({length:360}, (_,i)=>i),
        mode: 'lines', line: {color: 'yellow'}, name: 'Umbral ámbar', hoverinfo: 'skip',
        showlegend: true // Esta sí la dejamos para saber qué es la línea amarilla
    };

    const polarLayout = {
        title: 'Desplazamiento polar (mm)',
        polar: { 
            radialaxis: { range: [0, 20] },
            domain: { x: [0, 1], y: [0, 1] }
        },
        images: [
            {
                source: "static/img/Polar.png",
                xref: "paper", yref: "paper",
                x: 0.5, y: 0.5,
                sizex: 1.1, sizey: 1.1,
                xanchor: "center", yanchor: "middle",
                layer: "below",
                opacity: 0.5
            }
        ]
    };

    Plotly.newPlot('chartPolar', [traceAmber, tracePolar], polarLayout);

    // 4. Modelo 3D
    const trace3D = {
        x: data.map(d => d.valor_a),
        y: data.map(d => d.valor_b),
        z: data.map(d => d.profundidad),
        mode: 'markers',
        marker: { size: 3, color: COLOR_A },
        type: 'scatter3d',
        showlegend: true
    };

    Plotly.newPlot('chart3D', [trace3D], {
        title: 'Modelo 3D',
        scene: {
            xaxis: {title: 'Eje A (mm)', range: [-20, 20]},
            yaxis: {title: 'Eje B (mm)', range: [-20, 20]},
            zaxis: {title: 'Profundidad (m)', autorange: 'reversed'}
        },
        height: 600
    });
}

// --- UTILIDADES ---
function initMap() {
    console.log("Iniciando mapa..."); // Mira si esto sale en la consola (F12)

    // 1. Limpiar mapa previo
    if (map) { map.remove(); map = null; }

    // 2. Crear mapa
    map = L.map('map').setView([40.416, -3.703], 6);

    // 3. USAR OPENSTREETMAP (El más compatible del mundo)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // 4. FORZAR REAJUSTE
    setTimeout(() => { 
        map.invalidateSize(); 
        console.log("Mapa reajustado");
    }, 1000);
}
async function handleUpload(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    formData.append('sensor_id', document.getElementById('sensorSelect').value);

    showLoading(true);
    try {
        const res = await axios.post('api.php?action=upload', formData, {
            headers: {'Content-Type': 'multipart/form-data'}
        });
        
        if(res.data.success) {
            Swal.fire('Éxito', res.data.message, 'success');
            updateDashboard(); // Refrescar datos
        } else {
            Swal.fire('Error', res.data.message, 'error');
        }
    } catch (err) {
        Swal.fire('Error', 'Fallo en la subida', 'error');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}