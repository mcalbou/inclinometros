// Variables globales
let currentData = [];
let map = null;
let mapMarker = null;
let mapSensorsLayer = null;
let groupedMap = null;
let groupedMarkersLayer = null;
let currentSensorInfo = null;
let dateSlider = null;
let depthSlider = null;
let allSensors = [];
let activeSensorType = 'Todos';
let groupedDataCache = {};

const COLOR_A = "#1f77b4";
const COLOR_B = "#ff7f0e";
const GROUP_COLOR_PALETTE = ['#3b82f6', '#f59e0b', '#22c55e', '#e11d48', '#8b5cf6', '#06b6d4'];
const SENSOR_TYPE_ALIASES = {
    inclinometro: 'Inclinómetros',
    inclinómetro: 'Inclinómetros',
    inclinometros: 'Inclinómetros',
    inclinómetros: 'Inclinómetros',
    fisurometro: 'Fisurómetros',
    fisurómetro: 'Fisurómetros',
    fisurometros: 'Fisurómetros',
    fisurómetros: 'Fisurómetros',
    acelerometro: 'Acelerómetros',
    acelerómetro: 'Acelerómetros',
    acelerometros: 'Acelerómetros',
    acelerómetros: 'Acelerómetros',
    'long gauge': 'Extensómetros',
    'long-gauge': 'Extensómetros',
    'long_gauge': 'Extensómetros',
    'long–gauge': 'Extensómetros',
    'long—gauge': 'Extensómetros',
    longgauge: 'Extensómetros',
    extensometro: 'Extensómetros',
    extensómetro: 'Extensómetros',
    extensometros: 'Extensómetros',
    extensómetros: 'Extensómetros'
};
const GROUPED_SENSOR_CONFIG = {
    'Fisurómetros': {
        title: 'Desplazamientos en juntas',
        yAxisTitle: 'Desplazamiento (mm)',
        valueUnit: 'mm',
        charts: [
            { label: 'V5', sensors: ['FIS_V5N', 'FIS_V5S', 'FIS_V5N_LAT', 'FIS_V5S_LAT'] },
            { label: 'V6', sensors: ['FIS_V6N', 'FIS_V6S'] }
        ]
    },
    'Acelerómetros': {
        title: 'Acelerómetros',
        yAxisTitle: 'Acelerómetros (m/s²)',
        valueUnit: 'm/s²',
        charts: [
            { label: 'V5', sensors: ['AC_V5N', 'AC_V5S'] },
            { label: 'V6', sensors: ['AC_V6N', 'AC_V6S'] }
        ]
    },
    'Extensómetros': {
        title: 'Deformaciones',
        yAxisTitle: 'Deformación (µε)',
        valueUnit: 'µε',
        charts: [
            { label: 'P4', sensors: ['LG_P4N', 'LG_P4S', 'LG_P4E', 'LG_P4O'] },
            { label: 'P5', sensors: ['LG_P5N', 'LG_P5S', 'LG_P5E', 'LG_P5O'] }
        ]
    }
};

function canonicalSensorType(value) {
    const key = String(value || '').trim().toLowerCase();
    return SENSOR_TYPE_ALIASES[key] || value;
}

function normalizeSensorType(sensor) {
    const raw = sensor?.tipo_sensor || sensor?.tipo || sensor?.sensor_type || '';
    const clean = canonicalSensorType(String(raw || '').trim());
    return clean || 'Inclinómetros';
}

function isGroupedSensorType(type = activeSensorType) {
    return Object.prototype.hasOwnProperty.call(GROUPED_SENSOR_CONFIG, type);
}

function getFixedSensorTypes() {
    const hasInclinometro = allSensors.some(s => normalizeSensorType(s) === 'Inclinómetros');
    const hasFis = allSensors.some(s => normalizeSensorType(s) === 'Fisurómetros');
    const hasAc = allSensors.some(s => normalizeSensorType(s) === 'Acelerómetros');
    const hasLg = allSensors.some(s => normalizeSensorType(s) === 'Extensómetros');
    return [
        ...(hasInclinometro ? ['Inclinómetros'] : []),
        ...(hasFis ? ['Fisurómetros'] : []),
        ...(hasAc ? ['Acelerómetros'] : []),
        ...(hasLg ? ['Extensómetros'] : [])
    ];
}

function renderSensorTypeTabs() {
    const container = document.getElementById('sensorTypeTabs');
    if (!container) return;

    const types = getFixedSensorTypes();

    if (types.length === 0) {
        container.innerHTML = '';
        return;
    }
    if (!activeSensorType || !types.includes(activeSensorType)) {
        activeSensorType = types[0];
    }

    container.innerHTML = '';
    types.forEach(type => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `sensor-type-tab ${type === activeSensorType ? 'active' : ''}`;
        btn.textContent = type;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', type === activeSensorType ? 'true' : 'false');
        btn.dataset.type = type;
        btn.addEventListener('click', () => {
            if (activeSensorType === type) return;
            activeSensorType = type;
            renderSensorTypeTabs();
            fillSensorSelect();
            updateDashboardByMode();
        });
        container.appendChild(btn);
    });
}

function getSensorsByActiveType() {
    return allSensors.filter(s => normalizeSensorType(s) === activeSensorType);
}

function getSensorImageUrl(photoPath) {
    const raw = String(photoPath ?? '').trim();
    if (!raw || raw === 'null') return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^\/\//.test(raw)) return `${window.location.protocol}${raw}`;
    const fileName = raw.split(/[\\/]/).pop();
    if (!fileName) return '';
    return `api.php?action=sensor_image&name=${encodeURIComponent(fileName)}`;
}

function setSensorImageWithFallback(img, txt, photoPath, failText) {
    const raw = String(photoPath ?? '').trim();
    const imageUrl = getSensorImageUrl(raw);
    if (!imageUrl) {
        img.style.display = 'none';
        txt.style.display = 'block';
        txt.textContent = failText;
        return;
    }

    const fileName = raw.split(/[\\/]/).pop();
    const directUrl = fileName ? `static/img/${encodeURIComponent(fileName)}` : '';

    img.onerror = () => {
        if (directUrl && img.dataset.fallbackTried !== '1') {
            img.dataset.fallbackTried = '1';
            img.src = directUrl;
            return;
        }
        img.style.display = 'none';
        txt.style.display = 'block';
        txt.textContent = failText;
    };
    img.dataset.fallbackTried = '0';
    img.src = imageUrl;
    img.style.display = 'block';
    txt.style.display = 'none';
}

function resetDashboardVisuals() {
    currentData = [];
    const infoBox = document.getElementById('sensorInfoBox');
    if (infoBox) infoBox.style.display = 'none';
    const linkMaps = document.getElementById('linkGoogleMaps');
    if (linkMaps) linkMaps.style.display = 'none';
    const img = document.getElementById('sensorPhoto');
    const txt = document.getElementById('noPhotoText');
    if (img) img.style.display = 'none';
    if (txt) {
        txt.style.display = 'block';
        txt.textContent = 'Seleccione un sensor';
    }
    if (map && mapMarker) {
        map.removeLayer(mapMarker);
        mapMarker = null;
    }
    updateMainMapMarkers();
    setupDates();
    setupDepths();
    renderAllCharts();
}

function applyDashboardMode() {
    const grouped = isGroupedSensorType();
    const inclinoSections = document.getElementById('inclinoSections');
    const groupedSections = document.getElementById('groupedSections');
    const groupedOnly = document.querySelectorAll('.grouped-only');
    const inclinoOnly = document.querySelectorAll('.inclino-only');

    if (inclinoSections) inclinoSections.style.display = grouped ? 'none' : 'block';
    if (groupedSections) groupedSections.style.display = grouped ? 'block' : 'none';
    groupedOnly.forEach(el => { el.style.display = grouped ? '' : 'none'; });
    inclinoOnly.forEach(el => { el.style.display = grouped ? 'none' : ''; });

    // Leaflet necesita recalcular tamaño cuando el contenedor pasa de hidden a visible.
    if (grouped && groupedMap) {
        setTimeout(() => {
            groupedMap.invalidateSize();
            updateGroupedMapMarkers();
        }, 80);
    }
    if (!grouped && map) {
        setTimeout(() => {
            map.invalidateSize();
            updateMainMapMarkers();
        }, 80);
    }
}

function updateDashboardByMode() {
    applyDashboardMode();
    if (isGroupedSensorType()) {
        updateGroupedDashboard();
        return;
    }
    updateMainMapMarkers();
    updateDashboard();
}

function fillSensorSelect(selectedId = '') {
    const sel = document.getElementById('sensorSelect');
    if (!sel) return;

    if (isGroupedSensorType()) {
        sel.innerHTML = '';
        const info = document.createElement('option');
        info.value = '';
        info.textContent = '-- Vista agrupada por tipo --';
        sel.appendChild(info);
        return;
    }

    sel.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = "";
    defaultOpt.textContent = "-- Selecciona un sensor --";
    defaultOpt.selected = true;
    defaultOpt.hidden = true;
    sel.appendChild(defaultOpt);

    const sensoresFiltrados = getSensorsByActiveType();
    const groupCanal = document.createElement('optgroup');
    groupCanal.label = "--- CANAL ---";
    const groupColector = document.createElement('optgroup');
    groupColector.label = "--- COLECTOR ---";
    const groupGiorgeta = document.createElement('optgroup');
    groupGiorgeta.label = "--- GIORGETA ---";
    const groupOtros = document.createElement('optgroup');
    groupOtros.label = "--- OTROS ---";

    sensoresFiltrados.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.nombre;
        opt.dataset.lat = s.latitud;
        opt.dataset.lon = s.longitud;
        opt.dataset.nf = s.nf;
        opt.dataset.foto = s.foto_path;
        opt.dataset.sensorType = normalizeSensorType(s);
        opt.dataset.lugar = s.lugar || '';

        const lugar = String(s.lugar || '').toLowerCase().trim();
        if (lugar === 'canal') {
            groupCanal.appendChild(opt);
        } else if (lugar === 'colector') {
            groupColector.appendChild(opt);
        } else if (lugar === 'giorgeta') {
            groupGiorgeta.appendChild(opt);
        } else {
            groupOtros.appendChild(opt);
        }
    });

    if (groupCanal.children.length > 0) sel.appendChild(groupCanal);
    if (groupColector.children.length > 0) sel.appendChild(groupColector);
    if (groupGiorgeta.children.length > 0) sel.appendChild(groupGiorgeta);
    if (groupOtros.children.length > 0) sel.appendChild(groupOtros);

    const candidate = String(selectedId || '');
    const hasCandidate = candidate && Array.from(sel.options).some(o => o.value === candidate);
    sel.value = hasCandidate ? candidate : '';

    if (!hasCandidate) {
        resetDashboardVisuals();
    }
}

// --- INICIALIZACIÓN PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {

    // 1. ACTIVAR BOTÓN DE SALIR (PRIORIDAD MÁXIMA)
    const btnExit = document.getElementById('btnExit');
    if (btnExit) {
        btnExit.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("Cerrando sesión...");
            try {
                await axios.get('api.php?action=logout');
            } catch (err) {
                console.warn("Error red logout", err);
            } finally {
                window.location.href = 'login.html';
            }
        });
    }

    // 2. INICIAR EL RESTO DE LA APP
    initApp();
});

// --- LÓGICA DE LA APP ---
async function initApp() {
    console.log("Iniciando App..."); // DEBUG
    try {
        // Verificar sesión
        const res = await axios.get('api.php?action=check_session');

        if (!res.data.logged_in) {
            window.location.href = 'login.html';
            return;
        }

        console.log("Usuario logueado:", res.data.usuario);
        setupUserUI(res.data);

        // Cargar datos iniciales
        initMap();
        initGroupedMap();
        await loadSensors();
        setupCreateVersionUI();

        // Listeners del Dashboard
        const btnUpdate = document.getElementById('btnUpdate');
        if(btnUpdate) btnUpdate.addEventListener('click', (e) => { e.preventDefault(); updateDashboardByMode(); });

        const uploadForm = document.getElementById('uploadForm');
        if(uploadForm) uploadForm.addEventListener('submit', handleUpload);

        // --- EL LISTENER CLAVE ---
        const sensorSelect = document.getElementById('sensorSelect');
        if(sensorSelect) {
            // Eliminamos listeners antiguos clonando el nodo (truco para limpiar basura en memoria)
            const newSelect = sensorSelect.cloneNode(true);
            sensorSelect.parentNode.replaceChild(newSelect, sensorSelect);

            // Añadimos el evento limpio
            newSelect.addEventListener('change', () => {
                console.log("¡Cambio de sensor detectado!"); // DEBUG
                updateDashboardByMode();
            });
        }
        // Listener para Crear Usuario
        const createUserForm = document.getElementById('createUserForm');
        if(createUserForm) {
            createUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(e.target);

                const modalEl = document.getElementById('userModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();

                showLoading(true);

                try {
                    const res = await axios.post('api.php?action=create_user', formData);

                    if (res.data.success) {
                        Swal.fire('Creado', res.data.message, 'success');
                        e.target.reset();
                    } else {
                        Swal.fire('Error', res.data.message, 'error');
                    }
                } catch (err) {
                    console.error(err);
                    Swal.fire('Error', 'No se pudo crear el usuario', 'error');
                } finally {
                    showLoading(false);
                }
            });

        }
        // --- NUEVO LISTENER: CREAR SENSOR ---
        const createSensorForm = document.getElementById('createSensorForm');
        if(createSensorForm) {
            createSensorForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(e.target);

                const modalEl = document.getElementById('sensorModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();

                showLoading(true);

                try {
                    const res = await axios.post('api.php?action=add_sensor', formData);

                    if (res.data.success) {
                        Swal.fire('Guardado', res.data.message, 'success');
                        e.target.reset();

                        if (res.data.sensor_type) {
                            activeSensorType = String(res.data.sensor_type);
                        }

                        await loadSensors();

                        if (res.data.sensor_id) {
                            fillSensorSelect(String(res.data.sensor_id));
                        }
                    } else {
                        Swal.fire('Error', res.data.message, 'error');
                    }
                } catch (err) {
                    console.error(err);
                    Swal.fire('Error', 'No se pudo crear el sensor', 'error');
                } finally {
                    showLoading(false);
                }
            });
        }
        // --- LISTENER PARA DESCARGAR CSV ---
        const btnDownload = document.getElementById('btnDownloadCsv');
        if (btnDownload) {
            btnDownload.addEventListener('click', () => {
                const sel = document.getElementById('sensorSelect');
                const start = document.getElementById('startDate').value;
                const end = document.getElementById('endDate').value;

                if (!sel || !sel.value) {
                    Swal.fire('Atención', 'Selecciona un sensor primero', 'warning');
                    return;
                }

                const url = `api.php?action=export_csv&id=${sel.value}&start=${start}&end=${end}`;
                window.location.href = url;
            });
        }

        updateDashboardByMode();

    } catch (err) {
        console.error("Error en inicialización:", err);
    }
}

function setupUserUI(userData) {
    const userDisplay = document.getElementById('userDisplay');
    if(userDisplay) userDisplay.textContent = `${userData.usuario} (${userData.rol})`;

    if (userData.rol === 'cliente') {
        const uploadZone = document.querySelector('.upload-zone');
        if(uploadZone) uploadZone.style.display = 'none';
    }

    if (userData.rol === 'superAdmin') {
        const adminPanel = document.getElementById('adminPanel');
        if(adminPanel) adminPanel.style.display = 'block';
    }

    if (userData.rol === 'superAdmin' || userData.rol === 'admin') {
        const btnAdmin = document.getElementById('btnAdminLink');
        if(btnAdmin) btnAdmin.style.display = 'block';
    }
}

// --- API CALLS ---
async function loadSensors() {
    try {
        const res = await axios.get('api.php?action=get_sensors');
        const sensores = Array.isArray(res.data) ? res.data : [];
        const sel = document.getElementById('sensorSelect');
        const selectedBefore = sel ? sel.value : '';
        allSensors = sensores;
        renderSensorTypeTabs();
        fillSensorSelect(selectedBefore);
        fillBaseSensorSelect(sensores);
        applyDashboardMode();
    } catch (err) {
        console.error("Error cargando sensores", err);
    }
}

async function loadGroupedData(sensorNames) {
    const dataBySensor = {};
    const sensorsByName = {};
    allSensors.forEach(s => { sensorsByName[s.nombre] = s; });

    for (const sensorName of sensorNames) {
        const sensor = sensorsByName[sensorName];
        if (!sensor) {
            dataBySensor[sensorName] = [];
            continue;
        }
        try {
            const res = await axios.get(`api.php?action=get_data&id=${sensor.id}`);
            const rows = Array.isArray(res.data) ? res.data : [];
            dataBySensor[sensorName] = rows
                .filter(r => r && r.fecha_str)
                .map(r => ({
                    ...r,
                    fecha_str: r.fecha_full || r.fecha_str,
                    medida: parseFloat(r.valor_a ?? 0),
                    temperatura: parseFloat(r.valor_b ?? NaN)
                }));
        } catch (err) {
            console.warn(`No se pudieron cargar datos de ${sensorName}`, err);
            dataBySensor[sensorName] = [];
        }
    }
    return dataBySensor;
}

function filterGroupedRows(rows) {
    const start = document.getElementById('groupStartDate')?.value || '';
    const end = document.getElementById('groupEndDate')?.value || '';
    if (!start || !end) return rows;
    return rows.filter(r => {
        const day = String(r.fecha_str || '').slice(0, 10);
        if (!day) return false;
        return day >= start && day <= end;
    });
}

function fillBaseSensorSelect(sensores) {
    const baseSel = document.getElementById('baseSensorSelect');
    if (!baseSel) return;

    baseSel.innerHTML = '<option value="">-- Selecciona sensor --</option>';
    if (!Array.isArray(sensores)) return;

    sensores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.nombre;
        opt.dataset.lat = s.latitud;
        opt.dataset.lon = s.longitud;
        opt.dataset.nf = s.nf;
        opt.dataset.lugar = s.lugar;
        opt.dataset.sensorType = normalizeSensorType(s);
        baseSel.appendChild(opt);
    });
}

function setupCreateVersionUI() {
    const toggle = document.getElementById('createVersionToggle');
    const baseWrap = document.getElementById('createVersionFields');
    const baseSel = document.getElementById('baseSensorSelect');
    const hidden = document.getElementById('createVersionInput');

    if (!toggle || !hidden) return;

    const form = document.getElementById('createSensorForm');
    const nombreInput = form ? form.querySelector('input[name="nombre"]') : null;
    const latInput = form ? form.querySelector('input[name="latitud"]') : null;
    const lonInput = form ? form.querySelector('input[name="longitud"]') : null;
    const nfInput = form ? form.querySelector('input[name="nf"]') : null;
    const lugarSelect = form ? form.querySelector('select[name="lugar"]') : null;
    const typeInput = form ? form.querySelector('input[name="sensor_type"]') : null;

    const lockFields = (lock) => {
        if (nombreInput) nombreInput.readOnly = lock;
        if (latInput) latInput.disabled = lock;
        if (lonInput) lonInput.disabled = lock;
        if (nfInput) nfInput.disabled = lock;
        if (lugarSelect) lugarSelect.disabled = lock;
        if (typeInput) typeInput.readOnly = lock;
        if (baseSel) baseSel.required = lock;
        if (baseWrap) baseWrap.classList.toggle('d-none', !lock);
    };

    const applyBaseToFields = () => {
        if (!baseSel || baseSel.selectedIndex < 0) return;
        const opt = baseSel.options[baseSel.selectedIndex];
        if (!opt || !opt.value) return;
        if (nombreInput) nombreInput.value = opt.textContent;
        if (latInput) latInput.value = opt.dataset.lat || '';
        if (lonInput) lonInput.value = opt.dataset.lon || '';
        if (nfInput) nfInput.value = opt.dataset.nf || '';
        if (lugarSelect && opt.dataset.lugar) lugarSelect.value = opt.dataset.lugar;
        if (typeInput) typeInput.value = opt.dataset.sensorType || 'Inclinómetros';
    };

    toggle.addEventListener('change', () => {
        const isVersion = toggle.checked;
        hidden.value = isVersion ? '1' : '0';
        lockFields(isVersion);
        if (isVersion) {
            applyBaseToFields();
        }
    });

    if (baseSel) {
        baseSel.addEventListener('change', () => {
            if (toggle.checked) applyBaseToFields();
        });
    }
}

async function updateDashboard() {
    const sel = document.getElementById('sensorSelect');
    if(!sel || !sel.value) return;

    console.log("Actualizando Dashboard para sensor ID:", sel.value); // DEBUG
    showLoading(true);

    try {
        // 1. Actualizar Info Visual (Mapa/Foto)
        updateSensorInfo();

        // 2. Descargar Datos Nuevos
        const res = await axios.get(`api.php?action=get_data&id=${sel.value}`);
        console.log("Datos recibidos:", res.data.length, "registros"); // DEBUG

        currentData = res.data;

        // 3. Repintar Todo
        setupDates();
        setupDepths();
        renderAllCharts();

    } catch (err) {
        console.error("Error en updateDashboard:", err);
        Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
    } finally {
        showLoading(false);
    }
}

// --- CONFIGURACIÓN DE SLIDERS Y DATOS ---

function setupDates() {
    const slider = document.getElementById('dateSlider');
    if(!slider) return;

    if(currentData.length === 0) {
        if (slider.noUiSlider) slider.noUiSlider.destroy();
        return;
    }

    const feMinStr = currentData[0].fecha_str;
    const feMaxStr = currentData[currentData.length - 1].fecha_str;
    const minTs = new Date(feMinStr).getTime();
    const maxTs = new Date(feMaxStr).getTime();

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

function setupGroupDates(groupedSeries) {
    const slider = document.getElementById('groupDateSlider');
    if (!slider) return;

    const allDates = [];
    Object.values(groupedSeries).forEach(points => {
        points.forEach(p => allDates.push(p.fecha_str));
    });
    const uniqueDates = [...new Set(allDates)].sort();
    if (uniqueDates.length === 0) {
        if (slider.noUiSlider) slider.noUiSlider.destroy();
        const startInput = document.getElementById('groupStartDate');
        const endInput = document.getElementById('groupEndDate');
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        return;
    }

    const minTs = new Date(uniqueDates[0]).getTime();
    const maxTs = new Date(uniqueDates[uniqueDates.length - 1]).getTime();
    if (slider.noUiSlider) slider.noUiSlider.destroy();

    noUiSlider.create(slider, {
        start: [minTs, maxTs],
        connect: true,
        range: { min: minTs, max: maxTs },
        step: 86400000,
        tooltips: [
            { to: (val) => new Date(parseInt(val, 10)).toLocaleDateString('es-ES') },
            { to: (val) => new Date(parseInt(val, 10)).toLocaleDateString('es-ES') }
        ]
    });

    const startInput = document.getElementById('groupStartDate');
    const endInput = document.getElementById('groupEndDate');
    if (startInput) startInput.value = String(uniqueDates[0]).slice(0, 10);
    if (endInput) endInput.value = String(uniqueDates[uniqueDates.length - 1]).slice(0, 10);

    slider.noUiSlider.on('set', (values) => {
        const start = new Date(parseInt(values[0], 10)).toISOString().split('T')[0];
        const end = new Date(parseInt(values[1], 10)).toISOString().split('T')[0];
        if (startInput) startInput.value = start;
        if (endInput) endInput.value = end;
        renderGroupedCharts();
    });
}

function setupDepths() {
    const sliderElement = document.getElementById('depthSlider');
    const hiddenInput = document.getElementById('profSelect');
    if(!sliderElement) return;

    const uniqueProfs = [...new Set(currentData.map(item => parseFloat(item.profundidad)))].sort((a,b) => a - b);

    if (uniqueProfs.length === 0) {
        if (sliderElement.noUiSlider) sliderElement.noUiSlider.destroy();
        return;
    }

    const minProf = uniqueProfs[0];
    const maxProf = uniqueProfs[uniqueProfs.length - 1];
    let stepVal = uniqueProfs.length > 1 ? (uniqueProfs[1] - uniqueProfs[0]) : 0.5;

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
    if(!start || !end) return [];
    return currentData.filter(d => d.fecha_str >= start && d.fecha_str <= end);
}

// --- RENDERIZADO ---

function updateMainMapMarkers() {
    if (!map) return;
    if (!mapSensorsLayer) {
        mapSensorsLayer = L.layerGroup().addTo(map);
    }
    mapSensorsLayer.clearLayers();

    if (isGroupedSensorType()) return;

    const sensors = getSensorsByActiveType();
    const sel = document.getElementById('sensorSelect');
    const selectedId = sel ? String(sel.value || '') : '';

    sensors.forEach(sensor => {
        const lat = parseFloat(String(sensor.latitud ?? '').replace(',', '.'));
        const lon = parseFloat(String(sensor.longitud ?? '').replace(',', '.'));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const isSelected = String(sensor.id) === selectedId;
        const marker = L.circleMarker([lat, lon], {
            radius: isSelected ? 9 : 7,
            color: isSelected ? '#dc2626' : '#0284c7',
            fillColor: isSelected ? '#ef4444' : '#38bdf8',
            fillOpacity: 0.85,
            weight: isSelected ? 2 : 1.5
        });

        marker.bindPopup(`<b>${sensor.nombre}</b><br>${sensor.lugar || 'Sin ubicación'}`);
        marker.on('click', () => {
            const sensorSelect = document.getElementById('sensorSelect');
            if (!sensorSelect) return;
            const sensorId = String(sensor.id);
            if (String(sensorSelect.value || '') === sensorId) return;
            sensorSelect.value = sensorId;
            updateDashboardByMode();
        });

        mapSensorsLayer.addLayer(marker);
    });
}

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
    updateMainMapMarkers();

    // 1. Mostrar caja de información
    const infoBox = document.getElementById('sensorInfoBox');
    if(infoBox) infoBox.style.display = 'block';

    const infoNombre = document.getElementById('infoNombre');
    const infoCoords = document.getElementById('infoCoords');
    if(infoNombre) infoNombre.textContent = opt.text;
    if(infoCoords) infoCoords.textContent = `${currentSensorInfo.lat.toFixed(5)}, ${currentSensorInfo.lon.toFixed(5)}`;

    // 2. Actualizar enlace Google Maps
    const linkMaps = document.getElementById('linkGoogleMaps');
    if (linkMaps && !isNaN(currentSensorInfo.lat)) {
        linkMaps.href = `https://www.google.com/maps?q=${currentSensorInfo.lat},${currentSensorInfo.lon}`;
        linkMaps.style.display = 'inline-block';
    }

    // 3. ACTUALIZAR MAPA
    if(map && !isNaN(currentSensorInfo.lat)) {
        map.invalidateSize();

        if(mapMarker) {
            map.removeLayer(mapMarker);
            mapMarker = null;
        }

        map.flyTo([currentSensorInfo.lat, currentSensorInfo.lon], 18, {
            animate: true,
            duration: 1.5
        });

        map.once('moveend', function() {
            mapMarker = L.circleMarker([currentSensorInfo.lat, currentSensorInfo.lon], {
                radius: 12,
                color: 'red',
                fillColor: '#f03',
                fillOpacity: 0.8
            }).addTo(map);

            mapMarker.bindPopup(`
                <b>${opt.text}</b><br>
                <a href="https://www.google.com/maps?q=${currentSensorInfo.lat},${currentSensorInfo.lon}" target="_blank">
                    Abrir en Google Maps
                </a>
            `);
        });
    }

    // 4. Actualizar Foto
    const img = document.getElementById('sensorPhoto');
    const txt = document.getElementById('noPhotoText');
    if(img && txt) {
        if(currentSensorInfo.foto && currentSensorInfo.foto !== 'null' && currentSensorInfo.foto !== '') {
            setSensorImageWithFallback(img, txt, currentSensorInfo.foto, 'No se pudo cargar la imagen');
        } else {
            img.style.display = 'none';
            txt.style.display = 'block';
        }
    }
}

// MOSTRAR BOTÓN DE VERSIONES
const btnVer = document.getElementById('btnVersions');
if(btnVer) {
    btnVer.style.display = 'block';
    btnVer.onclick = () => {
        const sel = document.getElementById('sensorSelect');
        if (!sel || !sel.value) {
            Swal.fire('Atención', 'Selecciona un sensor primero', 'warning');
            return;
        }
        openVersionsModal(sel.value);
    };
}

function renderAllCharts() {
    const data = getFilteredData();
    const profInput = document.getElementById('profSelect');
    const profVal = parseFloat(profInput ? profInput.value : 0) || 0;

    if (data.length === 0) {
        ['chartA', 'chartB', 'chartTime', 'chartPolar', 'chart3D'].forEach(id => {
            Plotly.newPlot(id, [], {title: 'Sin datos'});
        });
        return;
    }

    // 1. Gráficos de Perfil (A y B)
    const dates = [...new Set(data.map(d => d.fecha_str))].sort().reverse();
    const latestDate = dates[0];

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
                zorder: isLatest ? 100 : 1,
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
        { type: 'scatterpolar', r: new Array(360).fill(10), theta: Array.from({length:360}, (_,i)=>i), mode: 'lines', line: {color: '#e8e01e'}, name: 'Umbral', hoverinfo: 'skip' },
        { type: 'scatterpolar', r: rVals, theta: thetaVals, mode: 'markers+lines', marker: { color: COLOR_A, size: 6 }, name: 'Lectura' }
    ], {
        title: 'Desplazamiento Polar (mm)',
        polar: { radialaxis: { range: [0, 20] } }
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

function makePhaseShapes(yMin, yMax) {
    const range = Math.abs(yMax - yMin);
    const yText = yMax - (range * 0.08);
    return {
        shapes: [
            { type: 'rect', xref: 'paper', yref: 'y', x0: 0.10, x1: 0.28, y0: yMin, y1: yMax, fillcolor: 'rgba(220, 53, 69, 0.12)', line: { color: 'rgba(220, 53, 69, 0.45)', dash: 'dot', width: 1 } },
            { type: 'rect', xref: 'paper', yref: 'y', x0: 0.38, x1: 0.58, y0: yMin, y1: yMax, fillcolor: 'rgba(59, 130, 246, 0.12)', line: { color: 'rgba(59, 130, 246, 0.45)', dash: 'dot', width: 1 } },
            { type: 'rect', xref: 'paper', yref: 'y', x0: 0.74, x1: 0.92, y0: yMin, y1: yMax, fillcolor: 'rgba(34, 197, 94, 0.12)', line: { color: 'rgba(34, 197, 94, 0.45)', dash: 'dot', width: 1 } }
        ],
        annotations: [
            { xref: 'paper', yref: 'y', x: 0.10, y: yText, text: '1A', showarrow: false, font: { color: '#be123c', size: 16, family: 'Inter, sans-serif' } },
            { xref: 'paper', yref: 'y', x: 0.38, y: yText, text: '1B', showarrow: false, font: { color: '#1d4ed8', size: 16, family: 'Inter, sans-serif' } },
            { xref: 'paper', yref: 'y', x: 0.74, y: yText, text: '3A', showarrow: false, font: { color: '#15803d', size: 16, family: 'Inter, sans-serif' } }
        ]
    };
}

function makeGroupedTraces(seriesBySensor) {
    const names = Object.keys(seriesBySensor);
    const traces = [];
    const lastLabels = [];
    const values = [];
    const tempValues = [];

    names.forEach((sensorName, idx) => {
        const rows = filterGroupedRows(seriesBySensor[sensorName] || []);
        if (rows.length === 0) return;
        const sortedRows = [...rows].sort((a, b) => a.fecha_str.localeCompare(b.fecha_str));
        const color = GROUP_COLOR_PALETTE[idx % GROUP_COLOR_PALETTE.length];
        sortedRows.forEach(r => {
            if (!Number.isNaN(r.medida)) values.push(r.medida);
        });

        traces.push({
            x: sortedRows.map(r => r.fecha_str),
            y: sortedRows.map(r => r.medida),
            mode: 'lines',
            type: 'scatter',
            name: sensorName,
            line: { width: 1.7, color }
        });

        if (activeSensorType === 'Extensómetros') {
            const tempRows = sortedRows.filter(r => Number.isFinite(r.temperatura));
            tempRows.forEach(r => tempValues.push(r.temperatura));
            if (tempRows.length > 0) {
                traces.push({
                    x: tempRows.map(r => r.fecha_str),
                    y: tempRows.map(r => r.temperatura),
                    mode: 'lines',
                    type: 'scatter',
                    name: `${sensorName} (T)`,
                    yaxis: 'y2',
                    line: { width: 1.2, color, dash: 'dot' },
                    opacity: 0.75
                });
            }
        }

        const last = sortedRows[sortedRows.length - 1];
        if (last && Number.isFinite(last.medida)) {
            lastLabels.push({
                x: last.fecha_str,
                y: last.medida,
                text: `${last.medida.toFixed(2)} ${GROUPED_SENSOR_CONFIG[activeSensorType]?.valueUnit ?? ''}`,
                showarrow: false,
                xanchor: 'left',
                yanchor: 'middle',
                bgcolor: 'rgba(255,255,255,0.7)',
                bordercolor: color,
                borderwidth: 1,
                font: { color, size: 11 }
            });
        }
    });

    if (values.length === 0) {
        return { traces: [], yMin: -1, yMax: 1, annotations: [] };
    }
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const margin = Math.max((maxV - minV) * 0.12, 0.1);
    let tempMin = null;
    let tempMax = null;
    if (tempValues.length > 0) {
        const tMin = Math.min(...tempValues);
        const tMax = Math.max(...tempValues);
        const tMargin = Math.max((tMax - tMin) * 0.12, 0.2);
        tempMin = tMin - tMargin;
        tempMax = tMax + tMargin;
    }
    return { traces, yMin: minV - margin, yMax: maxV + margin, annotations: lastLabels, tempMin, tempMax };
}

function renderGroupedCharts() {
    const cfg = GROUPED_SENSOR_CONFIG[activeSensorType];
    if (!cfg) return;

    const groupedTitle = document.getElementById('groupedTitle');
    if (groupedTitle) groupedTitle.textContent = cfg.title;

    cfg.charts.forEach((chartCfg, idx) => {
        const chartId = idx === 0 ? 'groupChart1' : 'groupChart2';
        const chartWrap = idx === 0 ? null : document.getElementById('groupChart2Wrap');
        if (idx === 1 && chartWrap) {
            chartWrap.style.display = cfg.charts[1] ? 'block' : 'none';
        }
        if (!chartCfg) return;
        const seriesBySensor = {};
        chartCfg.sensors.forEach(sensorName => {
            seriesBySensor[sensorName] = groupedDataCache[sensorName] || [];
        });

        const { traces, yMin, yMax, annotations, tempMin, tempMax } = makeGroupedTraces(seriesBySensor);
        const layout = {
            title: cfg.title,
            xaxis: { title: 'Fecha y hora', type: 'date' },
            yaxis: { title: cfg.yAxisTitle, range: [yMin, yMax] },
            legend: { orientation: 'h', y: -0.20 },
            hovermode: 'x unified',
            annotations: [...annotations],
            plot_bgcolor: '#f4f4f5',
            paper_bgcolor: '#f4f4f5'
        };
        if (activeSensorType === 'Extensómetros' && Number.isFinite(tempMin) && Number.isFinite(tempMax)) {
            layout.yaxis2 = {
                title: 'Temperatura (°C)',
                overlaying: 'y',
                side: 'right',
                range: [tempMin, tempMax],
                showgrid: false
            };
        }
        Plotly.newPlot(chartId, traces, layout, { responsive: true });
    });
}

async function updateGroupedDashboard() {
    const cfg = GROUPED_SENSOR_CONFIG[activeSensorType];
    if (!cfg) return;
    showLoading(true);
    try {
        const allNames = [...new Set(cfg.charts.flatMap(chart => chart.sensors))];
        groupedDataCache = await loadGroupedData(allNames);
        updateGroupedMapMarkers();
        setupGroupDates(groupedDataCache);
        renderGroupedCharts();
    } catch (err) {
        console.error('Error cargando datos agrupados', err);
        Swal.fire('Error', 'No se pudieron cargar los datos agrupados', 'error');
    } finally {
        showLoading(false);
    }
}

function initMap() {
    if (map) { map.remove(); map = null; }
    map = L.map('map').setView([40.416, -3.703], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    mapSensorsLayer = L.layerGroup().addTo(map);
    setTimeout(() => { map.invalidateSize(); }, 1000);
}

function initGroupedMap() {
    if (groupedMap) { groupedMap.remove(); groupedMap = null; }
    const groupedMapEl = document.getElementById('groupedMap');
    if (!groupedMapEl) return;
    groupedMap = L.map('groupedMap').setView([40.416, -3.703], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(groupedMap);
    groupedMarkersLayer = L.layerGroup().addTo(groupedMap);
    setTimeout(() => { groupedMap.invalidateSize(); }, 1000);
}

function updateGroupedSensorPhoto(sensor) {
    const img = document.getElementById('groupedSensorPhoto');
    const txt = document.getElementById('groupedNoPhotoText');
    const link = document.getElementById('groupedLinkGoogleMaps');
    if (!img || !txt || !link) return;

    const fotoDb = sensor?.foto_path;
    const fotoFallback = sensor?.nombre ? `${sensor.nombre}.png` : null;
    const foto = (fotoDb && fotoDb !== 'null') ? fotoDb : fotoFallback;
    const lat = parseFloat(String(sensor?.latitud ?? '').replace(',', '.'));
    const lon = parseFloat(String(sensor?.longitud ?? '').replace(',', '.'));

    if (foto) {
        setSensorImageWithFallback(img, txt, foto, sensor ? `Sin foto para ${sensor.nombre}` : 'Seleccione un sensor en el mapa');
    } else {
        img.style.display = 'none';
        txt.style.display = 'block';
        txt.textContent = 'Sin foto para este sensor';
    }

    if (sensor && Number.isFinite(lat) && Number.isFinite(lon)) {
        link.href = `https://www.google.com/maps?q=${lat},${lon}`;
        link.style.display = 'inline-block';
    } else {
        link.style.display = 'none';
    }
}

function updateGroupedMapMarkers() {
    if (!groupedMap || !groupedMarkersLayer) return;
    groupedMarkersLayer.clearLayers();

    const sensors = getSensorsByActiveType();
    const boundsPoints = [];

    sensors.forEach(sensor => {
        const lat = parseFloat(String(sensor.latitud ?? '').replace(',', '.'));
        const lon = parseFloat(String(sensor.longitud ?? '').replace(',', '.'));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const marker = L.circleMarker([lat, lon], {
            radius: 8,
            color: '#0ea5e9',
            fillColor: '#38bdf8',
            fillOpacity: 0.85
        });
        marker.bindPopup(`<b>${sensor.nombre}</b><br>${sensor.lugar || 'Sin ubicación'}`);
        marker.on('click', () => updateGroupedSensorPhoto(sensor));
        groupedMarkersLayer.addLayer(marker);
        boundsPoints.push([lat, lon]);
    });

    if (boundsPoints.length > 0) {
        groupedMap.fitBounds(boundsPoints, { padding: [30, 30], maxZoom: 16 });
        const firstWithCoords = sensors.find(s => {
            const la = parseFloat(String(s.latitud ?? '').replace(',', '.'));
            const lo = parseFloat(String(s.longitud ?? '').replace(',', '.'));
            return Number.isFinite(la) && Number.isFinite(lo);
        });
        if (firstWithCoords) updateGroupedSensorPhoto(firstWithCoords);
    } else {
        groupedMap.setView([40.416, -3.703], 6);
        updateGroupedSensorPhoto(null);
    }
}

async function handleUpload(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const sel = document.getElementById('sensorSelect');
    if(!sel) return;
    formData.append('sensor_id', sel.value);

    showLoading(true);
    try {
        const res = await axios.post('api.php?action=upload', formData);
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

// --- GESTIÓN DE VERSIONES ---

async function openVersionsModal(currentId) {
    const listContainer = document.getElementById('versionsList');
    listContainer.innerHTML = '<div class="p-3 text-center text-muted">Cargando versiones...</div>';

    const modal = new bootstrap.Modal(document.getElementById('versionsModal'));
    modal.show();

    try {
        const res = await axios.get(`api.php?action=get_versions&id=${currentId}`);
        const versiones = res.data;

        listContainer.innerHTML = '';

        const versionConFinMasReciente = versiones.reduce((acc, v) => {
            if (!v.f_fin) return acc;
            const ts = new Date(v.f_fin.split('/').reverse().join('-')).getTime();
            if (!acc || ts > acc.ts) return { id: v.id, ts };
            return acc;
        }, null);

        versiones.forEach(v => {
            const isCurrent = (v.id == currentId);
            const isPeriodoActual = versionConFinMasReciente && v.id == versionConFinMasReciente.id;

            let fechaTexto = 'Período: Sin datos';
            if (v.f_ini && v.f_fin) {
                fechaTexto = `Período: ${v.f_ini} - ${v.f_fin}`;
            }

            const item = document.createElement('button');
            item.className = `list-group-item list-group-item-action py-3 ${isCurrent ? 'active bg-light text-dark border-start border-4 border-primary' : ''}`;

            item.innerHTML = `
                <div class="d-flex w-100 justify-content-between align-items-center">
                    <h6 class="mb-1 fw-bold">Período</h6>
                    ${isCurrent ? '<span class="badge bg-primary">Viendo ahora</span>' : ''}
                </div>
                <p class="mb-1 small">${fechaTexto}</p>
                ${isPeriodoActual ? '<span class="badge bg-success">Período actual</span>' : ''}
            `;

            if (!isCurrent) {
                item.onclick = () => switchVersion(v.id, modal);
            } else {
                item.style.cursor = 'default';
            }

            listContainer.appendChild(item);
        });

    } catch (err) {
        console.error(err);
        listContainer.innerHTML = '<div class="p-3 text-danger">Error al cargar versiones</div>';
    }
}

async function switchVersion(newId, modalInstance) {
    modalInstance.hide();
    showLoading(true);

    const sel = document.getElementById('sensorSelect');
    let opt = sel.querySelector(`option[value="${newId}"]`);

    if (!opt) {
        opt = document.createElement('option');
        opt.value = newId;
        opt.text = "Versión Histórica";
        opt.selected = true;
        sel.appendChild(opt);
    }

    sel.value = newId;

    console.log("Cambiando a versión ID:", newId);

    await updateDashboard();

    const infoNombre = document.getElementById('infoNombre');
    if(infoNombre) infoNombre.innerHTML += ` <span class="badge bg-warning text-dark">HISTÓRICO</span>`;

    showLoading(false);
}