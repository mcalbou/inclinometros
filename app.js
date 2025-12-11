// Variables globales
let currentData = [];
let map = null;
let mapMarker = null;
let currentSensorInfo = null;
let dateSlider = null;
let depthSlider = null;

const COLOR_A = "#1f77b4";
const COLOR_B = "#ff7f0e";

// --- INICIALIZACIÓN PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. ACTIVAR BOTÓN DE SALIR (PRIORIDAD MÁXIMA)
    // Lo configuramos antes de pedir datos para que funcione siempre.
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("Cerrando sesión...");
            
            try {
                // Intentar avisar al servidor
                await axios.get('api.php?action=logout');
            } catch (err) {
                console.warn("No se pudo contactar con servidor, saliendo igual...");
            } finally {
                // Redirigir SIEMPRE, haya error o no
                window.location.href = 'login.html';
            }
        });
    }

    // 2. INICIAR EL RESTO DE LA APP
    initApp();
});

// --- LÓGICA DE LA APP ---
async function initApp() {
    try {
        // Verificar sesión
        const res = await axios.get('api.php?action=check_session');
        
        // Si no está logueado, fuera
        if (!res.data.logged_in) {
            window.location.href = 'login.html';
            return;
        }

        console.log("Acceso concedido:", res.data.usuario);
        
        // Actualizar nombre de usuario en la cabecera
        setupUserUI(res.data);

        // Cargar datos
        loadSensors();
        initMap();
        
        // Listeners del Dashboard
        const btnUpdate = document.getElementById('btnUpdate');
        if(btnUpdate) btnUpdate.addEventListener('click', (e) => { e.preventDefault(); updateDashboard(); });
        
        const uploadForm = document.getElementById('uploadForm');
        if(uploadForm) uploadForm.addEventListener('submit', handleUpload);
        
        const sensorSelect = document.getElementById('sensorSelect');
        if(sensorSelect) sensorSelect.addEventListener('change', () => { updateSensorInfo(); });

    } catch (err) {
        console.error("Error en inicialización:", err);
        // Opcional: Si falla la conexión, podrías redirigir al login
        // window.location.href = 'login.html';
    }
}

function setupUserUI(userData) {
    const userDisplay = document.getElementById('userDisplay');
    // Actualiza el texto "Cargando..." con el nombre real
    if(userDisplay) userDisplay.textContent = `${userData.usuario} (${userData.rol})`;

    // Si es CLIENTE, ocultar la zona de carga del sidebar
    if (userData.rol === 'cliente') {
        const uploadZone = document.querySelector('.upload-zone');
        if(uploadZone) uploadZone.style.display = 'none';
    }
}

// --- API CALLS ---
async function loadSensors() {
    try {
        const res = await axios.get('api.php?action=get_sensors');
        const sensores = res.data;
        const sel = document.getElementById('sensorSelect');
        
        if(sel) {
            sel.innerHTML = '';
            sensores.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.nombre;
                opt.dataset.lat = s.latitud;
                opt.dataset.lon = s.longitud;
                opt.dataset.nf = s.nf;
                opt.dataset.foto = s.foto_path;
                sel.appendChild(opt);
            });
            if(sensores.length > 0) updateDashboard();
        }
    } catch (err) {
        console.error("Error cargando sensores", err);
    }
}

async function updateDashboard() {
    const sel = document.getElementById('sensorSelect');
    if(!sel || !sel.value) return;

    showLoading(true);

    try {
        updateSensorInfo();
        const res = await axios.get(`api.php?action=get_data&id=${sel.value}`);
        currentData = res.data;

        setupDates();
        setupDepths();
        renderAllCharts();

    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
    } finally {
        showLoading(false);
    }
}

// --- CONFIGURACIÓN DE SLIDERS Y DATOS ---

function setupDates() {
    if(currentData.length === 0) return;
    
    const feMinStr = currentData[0].fecha_str;
    const feMaxStr = currentData[currentData.length - 1].fecha_str;
    const minTs = new Date(feMinStr).getTime();
    const maxTs = new Date(feMaxStr).getTime();

    const slider = document.getElementById('dateSlider');
    if(!slider) return;

    if (slider.noUiSlider) slider.noUiSlider.destroy();

    noUiSlider.create(slider, {
        start: [minTs, maxTs],
        connect: true,
        range: { 'min': minTs, 'max': maxTs },
        step: 86400000, 
        tooltips: [
            { to: (val) => new Date(parseInt(val)).toLocaleDateString('es-ES') },
            { to: (val) => new Date(parseInt(val)).toLocaleDateString('es-ES') }
        ]
    });

    slider.noUiSlider.on('set', function (values) {
        const start = new Date(parseInt(values[0])).toISOString().split('T')[0];
        const end = new Date(parseInt(values[1])).toISOString().split('T')[0];
        document.getElementById('startDate').value = start;
        document.getElementById('endDate').value = end;
        renderAllCharts();
    });
    
    document.getElementById('startDate').value = feMinStr;
    document.getElementById('endDate').value = feMaxStr;
}

function setupDepths() {
    const uniqueProfs = [...new Set(currentData.map(item => parseFloat(item.profundidad)))].sort((a,b) => a - b);
    if (uniqueProfs.length === 0) return;

    const minProf = uniqueProfs[0];
    const maxProf = uniqueProfs[uniqueProfs.length - 1];
    let stepVal = uniqueProfs.length > 1 ? (uniqueProfs[1] - uniqueProfs[0]) : 0.5;

    const sliderElement = document.getElementById('depthSlider');
    const hiddenInput = document.getElementById('profSelect');
    if(!sliderElement) return;

    if (sliderElement.noUiSlider) sliderElement.noUiSlider.destroy();

    noUiSlider.create(sliderElement, {
        start: [minProf],
        connect: 'lower',
        range: { 'min': minProf, 'max': maxProf },
        step: stepVal,
        tooltips: { to: (val) => parseFloat(val).toFixed(1) + " m" }
    });

    sliderElement.noUiSlider.on('update', function (values) {
        hiddenInput.value = parseFloat(values[0]);
        const txtTime = document.getElementById('txtProfTime');
        const txtPolar = document.getElementById('txtProfPolar');
        if(txtTime) txtTime.textContent = parseFloat(values[0]);
        if(txtPolar) txtPolar.textContent = parseFloat(values[0]);
    });

    sliderElement.noUiSlider.on('change', function () { renderAllCharts(); });
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
    if(!sel || sel.selectedIndex < 0) return;
    
    const opt = sel.options[sel.selectedIndex];
    
    const latRaw = String(opt.dataset.lat).replace(',', '.');
    const lonRaw = String(opt.dataset.lon).replace(',', '.');

    currentSensorInfo = {
        lat: parseFloat(latRaw),
        lon: parseFloat(lonRaw),
        nf: parseFloat(opt.dataset.nf),
        foto: opt.dataset.foto
    };

    const infoBox = document.getElementById('sensorInfoBox');
    if(infoBox) infoBox.style.display = 'block';
    
    const infoNombre = document.getElementById('infoNombre');
    const infoCoords = document.getElementById('infoCoords');
    if(infoNombre) infoNombre.textContent = opt.text;
    if(infoCoords) infoCoords.textContent = `${currentSensorInfo.lat.toFixed(4)}, ${currentSensorInfo.lon.toFixed(4)}`;

    if(map && !isNaN(currentSensorInfo.lat)) {
        map.invalidateSize();
        map.flyTo([currentSensorInfo.lat, currentSensorInfo.lon], 18);
        if(mapMarker) map.removeLayer(mapMarker);
        mapMarker = L.circleMarker([currentSensorInfo.lat, currentSensorInfo.lon], {
            radius: 12, color: 'red', fillColor: '#f03', fillOpacity: 0.8
        }).addTo(map);
    }

    const img = document.getElementById('sensorPhoto');
    const txt = document.getElementById('noPhotoText');
    if(img && txt) {
        if(currentSensorInfo.foto && currentSensorInfo.foto !== 'null' && currentSensorInfo.foto !== '') {
            img.src = `static/img/${currentSensorInfo.foto}`;
            img.style.display = 'block';
            txt.style.display = 'none';
        } else {
            img.style.display = 'none';
            txt.style.display = 'block';
        }
    }
}

function renderAllCharts() {
    const data = getFilteredData();
    const profInput = document.getElementById('profSelect');
    const profVal = parseFloat(profInput ? profInput.value : 0) || 0;

    // 1. Gráficos de Perfil (A y B)
    const dates = [...new Set(data.map(d => d.fecha_str))].sort();
    const latestDate = dates[dates.length - 1]; 

    const formatDateES = (str) => {
        if(!str) return str;
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
    };

    function makeProfileTrace(axis) {
        const traces = [];
        dates.forEach(date => {
            const dateData = data.filter(d => d.fecha_str === date);
            const isLatest = (date === latestDate);

            traces.push({
                x: dateData.map(d => axis === 'A' ? d.valor_a : d.valor_b),
                y: dateData.map(d => d.profundidad),
                mode: isLatest ? 'lines+markers' : 'lines',
                name: formatDateES(date),
                line: { width: isLatest ? 3 : 1 },
                marker: { size: 6, symbol: 'circle' },
                opacity: isLatest ? 1 : 0.7,
                showlegend: true,
                hovertemplate: `<b>${formatDateES(date)}</b><br>Prof: %{y:.1f}m<br>Desp: %{x:.2f}mm<extra></extra>`
            });
        });
        return traces;
    }

    const layoutProfile = (title) => ({
        title: title,
        yaxis: { title: 'Profundidad (m)', autorange: 'reversed' },
        xaxis: { title: 'Desplazamiento (mm)', range: [-20, 20] },
        shapes: [
            { type: 'rect', x0: -20, x1: -10, y0: 0, y1: 1, xref: 'x', yref: 'paper', fillcolor: 'yellow', opacity: 0.15, line: {width: 0}, layer: 'below' },
            { type: 'rect', x0: 10, x1: 20, y0: 0, y1: 1, xref: 'x', yref: 'paper', fillcolor: 'yellow', opacity: 0.15, line: {width: 0}, layer: 'below' },
            { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: currentSensorInfo.nf, y1: currentSensorInfo.nf, yref: 'y', line: { color: 'blue', dash: 'dash', width: 2 } }
        ],
        hovermode: 'closest'
    });

    Plotly.newPlot('chartA', makeProfileTrace('A'), layoutProfile('Eje A'));
    Plotly.newPlot('chartB', makeProfileTrace('B'), layoutProfile('Eje B'));

    // 2. Serie Temporal
    const dataProf = data.filter(d => parseFloat(d.profundidad) === profVal);
    
    const traceTimeA = { x: dataProf.map(d => d.fecha_str), y: dataProf.map(d => d.valor_a), name: 'Eje A', type: 'scatter', mode: 'lines+markers', marker: {color: COLOR_A} };
    const traceTimeB = { x: dataProf.map(d => d.fecha_str), y: dataProf.map(d => d.valor_b), name: 'Eje B', type: 'scatter', mode: 'lines+markers', marker: {color: COLOR_B} };

    const layoutTime = {
        title: `Serie Temporal - ${profVal}m`,
        yaxis: { title: 'Desplazamiento (mm)', range: [-20, 20] },
        shapes: [
            { type: 'rect', xref: 'paper', x0: 0, x1: 1, y0: 10, y1: 20, fillcolor: 'yellow', opacity: 0.15, line: {width: 0}, layer: 'below' },
            { type: 'rect', xref: 'paper', x0: 0, x1: 1, y0: -20, y1: -10, fillcolor: 'yellow', opacity: 0.15, line: {width: 0}, layer: 'below' },
            { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 10, y1: 10, line: { color: '#ffbd2e', dash: 'dash', width: 1 } },
            { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: -10, y1: -10, line: { color: '#ffbd2e', dash: 'dash', width: 1 } }
        ],
        hovermode: 'closest'
    };
    Plotly.newPlot('chartTime', [traceTimeA, traceTimeB], layoutTime);

    // 3. Polar
    const rVals = dataProf.map(d => Math.sqrt(d.valor_a**2 + d.valor_b**2));
    const thetaVals = dataProf.map(d => Math.atan2(d.valor_b, d.valor_a) * (180/Math.PI));
    
    Plotly.newPlot('chartPolar', [
        { type: 'scatterpolar', r: new Array(360).fill(10), theta: Array.from({length:360}, (_,i)=>i), mode: 'lines', line: {color: 'yellow'}, name: 'Umbral', hoverinfo: 'skip' },
        { type: 'scatterpolar', r: rVals, theta: thetaVals, mode: 'markers+lines', marker: { color: COLOR_A, size: 6 }, name: 'Lectura' }
    ], {
        title: 'Desplazamiento Polar (mm)',
        polar: { radialaxis: { range: [0, 20] } },
        images: [{ source: "static/img/Polar.png", xref: "paper", yref: "paper", x: 0.5, y: 0.5, sizex: 1.1, sizey: 1.1, xanchor: "center", yanchor: "middle", layer: "below", opacity: 0.5 }]
    });

    // 4. 3D
    Plotly.newPlot('chart3D', [{
        x: data.map(d => d.valor_a), y: data.map(d => d.valor_b), z: data.map(d => d.profundidad),
        mode: 'markers', marker: { size: 3, color: COLOR_A }, type: 'scatter3d'
    }], {
        title: 'Modelo 3D',
        scene: { xaxis: {title: 'A', range:[-20,20]}, yaxis: {title: 'B', range:[-20,20]}, zaxis: {title: 'Prof', autorange:'reversed'} },
        height: 600
    });
}

function initMap() {
    if (map) { map.remove(); map = null; }
    map = L.map('map').setView([40.416, -3.703], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    setTimeout(() => { map.invalidateSize(); }, 1000);
}

async function handleUpload(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const sel = document.getElementById('sensorSelect');
    if(!sel) return;
    formData.append('sensor_id', sel.value);

    showLoading(true);
    try {
        const res = await axios.post('api.php?action=upload', formData, { headers: {'Content-Type': 'multipart/form-data'} });
        if(res.data.success) {
            Swal.fire('Éxito', res.data.message, 'success');
            updateDashboard();
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
    const overlay = document.getElementById('loadingOverlay');
    if(overlay) overlay.style.display = show ? 'flex' : 'none';
}