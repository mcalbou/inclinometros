document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias a Elementos ---
    const form = document.getElementById('informe-form');
    const messageEl = document.getElementById('informe-message');
    const btnInformeDatos = document.getElementById('btn-informe-datos');
    const btnInformeGrafico = document.getElementById('btn-informe-grafico');
    const btnInformeExcel = document.getElementById('btn-informe-excel'); // Referencia añadida
    
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    const step4 = document.getElementById('step-4');
    const obraSelect = document.getElementById('obra-select');
    const fechaInicioInput = document.getElementById('fecha-inicio');
    const fechaFinInput = document.getElementById('fecha-fin');
    const sensorContainer = document.getElementById('sensores-checkbox-container');
    const selectAllCheckbox = document.getElementById('select-all');
    const hiddenChartContainer = document.getElementById('hidden-chart-container');
    const customizeYAxisCheckbox = document.getElementById('customize-yaxis');
    const yAxisInputsContainer = document.getElementById('yaxis-inputs-container');

    let availableTypologiesForObra = [];

    const SENSOR_TYPOLOGIES = {
        'Deformaciones': ['S1_TB', 'S4_TH', 'S1_BA', 'S4_BG', 'S5_BA'],
        'Temperaturas': ['S3_BE']
    };
    const SENSOR_COLOR_MAP = {
        'S1_TB': '#3498db', 'S4_TH': '#e74c3c', 'S5_BA': '#f1c40f',
        'S4_BG': '#2ecc71', 'S3_BE': '#9b59b6', 'S1_BA': '#e67e22', 'default': '#95a5a6'
    };

    function updateFormState() {
        const obraOk = obraSelect.value !== '';
        const datesOk = fechaInicioInput.value !== '' && fechaFinInput.value !== '';
        const sensorsOk = sensorContainer.querySelectorAll('input[type="checkbox"]:checked').length > 0;
        
        obraOk ? step2.classList.remove('hidden') : step2.classList.add('hidden');
        (obraOk && datesOk) ? step3.classList.remove('hidden') : step3.classList.add('hidden');
        (obraOk && datesOk && sensorsOk) ? step4.classList.remove('hidden') : step4.classList.add('hidden');

        const canSubmit = obraOk && datesOk && sensorsOk;
        btnInformeDatos.disabled = !canSubmit;
        btnInformeGrafico.disabled = !canSubmit;
        btnInformeExcel.disabled = !canSubmit; // Lógica de estado para el botón de Excel
    }

    async function cargarObras() {
        try {
            const response = await fetch('api/api_listar_obras.php');
            if (!response.ok) throw new Error('Error al cargar la lista de obras.');
            const obras = await response.json();
            obraSelect.innerHTML = '<option value="">-- Seleccione una obra --</option>';
            obras.forEach(obra => {
                const option = document.createElement('option');
                option.value = obra.obra_id;
                option.textContent = obra.obra_id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                obraSelect.appendChild(option);
            });
        } catch (e) {
            obraSelect.innerHTML = `<option value="">${e.message}</option>`;
        }
    }

    async function cargarRecursosDeObra(obraId) {
        await Promise.all([
            cargarSensoresDeObra(obraId),
            cargarTipologiasDeObra(obraId)
        ]);
    }

    async function cargarSensoresDeObra(obraId) {
        sensorContainer.innerHTML = '<p style="grid-column: 1 / -1;">Cargando sensores...</p>';
        try {
            const response = await fetch(`api/api_listar_sensores_por_obra.php?obra=${obraId}`);
            if (!response.ok) throw new Error('Error al cargar los sensores.');
            const sensores = await response.json();
            sensorContainer.innerHTML = '';
            if (sensores.length === 0) {
                sensorContainer.innerHTML = '<p style="grid-column: 1 / -1;">Esta obra no tiene sensores.</p>';
            } else {
                sensores.forEach(sensor => {
                    const sensorId = sensor.sensor_id;
                    const el = document.createElement('div');
                    el.className = 'checkbox-item';
                    el.innerHTML = `<input type="checkbox" id="sensor-${sensorId}" name="sensores" value="${sensorId}"><label for="sensor-${sensorId}">${sensorId}</label>`;
                    sensorContainer.appendChild(el);
                });
            }
        } catch (e) {
            sensorContainer.innerHTML = `<p style="grid-column: 1 / -1;">${e.message}</p>`;
        } finally {
            updateFormState();
        }
    }

    async function cargarTipologiasDeObra(obraId) {
        try {
            const response = await fetch(`api/api_get_typologies_for_obra.php?obra=${obraId}`);
            if (!response.ok) throw new Error('Error al cargar tipologías.');
            availableTypologiesForObra = await response.json();
        } catch (e) {
            console.error(e);
            availableTypologiesForObra = [];
        }
    }

    function generateYAxisInputs() {
        yAxisInputsContainer.innerHTML = '';
        if (availableTypologiesForObra.length === 0) return;

        availableTypologiesForObra.forEach(typology => {
            const sanitizedTypology = typology.toLowerCase().replace(/\s+/g, '-');
            const groupHtml = `
                <div>
                    <div class="yaxis-group-label">${typology}:</div>
                    <div class="compact-grid">
                        <div class="compact-grid-item">
                            <label for="min-${sanitizedTypology}">Mínimo</label>
                            <input type="text" inputmode="decimal" id="min-${sanitizedTypology}" data-type="${sanitizedTypology}" data-limit="min">
                        </div>
                        <div class="compact-grid-item">
                            <label for="max-${sanitizedTypology}">Máximo</label>
                            <input type="text" inputmode="decimal" id="max-${sanitizedTypology}" data-type="${sanitizedTypology}" data-limit="max">
                        </div>
                    </div>
                </div>`;
            yAxisInputsContainer.insertAdjacentHTML('beforeend', groupHtml);
        });
    }

    obraSelect.addEventListener('change', () => {
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        if (customizeYAxisCheckbox) customizeYAxisCheckbox.checked = false;
        yAxisInputsContainer.classList.add('hidden');
        yAxisInputsContainer.classList.remove('visible');
        yAxisInputsContainer.innerHTML = '';
        availableTypologiesForObra = [];
        
        const selectedObra = obraSelect.value;
        if (selectedObra) {
            cargarRecursosDeObra(selectedObra);
        }
        updateFormState();
    });

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', () => {
            sensorContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = selectAllCheckbox.checked; });
            updateFormState();
        });
    }
    
    sensorContainer.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') updateFormState();
    });
    
    customizeYAxisCheckbox.addEventListener('change', () => {
        const isChecked = customizeYAxisCheckbox.checked;
        yAxisInputsContainer.classList.toggle('hidden', !isChecked);
        yAxisInputsContainer.classList.toggle('visible', isChecked);
        if (isChecked) {
            generateYAxisInputs();
        } else {
            yAxisInputsContainer.innerHTML = '';
        }
    });

    const flatpickrConfig = { enableTime: true, dateFormat: "Y-m-d H:i", locale: "es", onChange: () => updateFormState() };
    flatpickr(fechaInicioInput, flatpickrConfig);
    flatpickr(fechaFinInput, flatpickrConfig);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        generarInformeDatos();
    });

    btnInformeGrafico.addEventListener('click', () => {
        generarInformeGrafico();
    });

    // Event listener para el botón de Excel
    btnInformeExcel.addEventListener('click', () => {
        generarInformeExcel();
    });
    
    async function generarInformeDatos() {
        messageEl.textContent = '';
        btnInformeDatos.disabled = true;
        btnInformeGrafico.disabled = true;
        btnInformeExcel.disabled = true;
        btnInformeDatos.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        try {
            const response = await fetch('/mi_mapa_3d/api/api_generar_informe.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    obraId: obraSelect.value, startTime: fechaInicioInput.value, endTime: fechaFinInput.value,
                    sensores: Array.from(sensorContainer.querySelectorAll('input:checked')).map(cb => cb.value)
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error desconocido.');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = `Informe_Datos_Calsens_${obraSelect.value}_${new Date().toISOString().slice(0, 10)}.pdf`;
            a.href = url;
            document.body.appendChild(a);
            a.click(); a.remove(); window.URL.revokeObjectURL(url);
        } catch (error) {
            messageEl.textContent = `Error: ${error.message}`;
        } finally {
            btnInformeDatos.innerHTML = '<i class="fas fa-table"></i> Datos (PDF)';
            updateFormState();
        }
    }

    async function generarInformeGrafico() {
        messageEl.textContent = 'Generando gráficos, por favor espere...';
        btnInformeDatos.disabled = true;
        btnInformeGrafico.disabled = true;
        btnInformeExcel.disabled = true;
        btnInformeGrafico.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando...';

        const obraId = obraSelect.value;
        const startTime = fechaInicioInput.value;
        const endTime = fechaFinInput.value;
        const sensores = Array.from(sensorContainer.querySelectorAll('input:checked')).map(cb => cb.value);

        try {
            const apiUrl = `/mi_mapa_3d/api/api_get_sensor_data.php?obra=${obraId}&startTime=${startTime}:00&endTime=${endTime}:59`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('No se pudieron obtener los datos para los gráficos.');
            const datosAgrupados = await response.json();
            const chartImagePromises = [];
            hiddenChartContainer.innerHTML = '';
            
            for (const grupoTitulo in datosAgrupados) {
                const sensoresEnGrupo = datosAgrupados[grupoTitulo];
                const datasets = [];
                for (const sensorId in sensoresEnGrupo) {
                    if (sensores.includes(sensorId)) {
                        const color = SENSOR_COLOR_MAP[sensorId] || SENSOR_COLOR_MAP['default'];
                        datasets.push({
                            label: sensorId, data: sensoresEnGrupo[sensorId], borderColor: color,
                            backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.1, fill: false
                        });
                    }
                }
                if (datasets.length === 0) continue;

                let yAxisOptions = { beginAtZero: false };
                if (customizeYAxisCheckbox.checked) {
                    const sanitizedTypology = grupoTitulo.toLowerCase().replace(/\s+/g, '-');
                    const yMinInput = yAxisInputsContainer.querySelector(`input[data-type="${sanitizedTypology}"][data-limit="min"]`);
                    const yMaxInput = yAxisInputsContainer.querySelector(`input[data-type="${sanitizedTypology}"][data-limit="max"]`);
                    if (yMinInput && yMinInput.value !== '') yAxisOptions.min = parseFloat(yMinInput.value.replace(',', '.'));
                    if (yMaxInput && yMaxInput.value !== '') yAxisOptions.max = parseFloat(yMaxInput.value.replace(',', '.'));
                }

                const canvas = document.createElement('canvas');
                hiddenChartContainer.appendChild(canvas);

                const promise = new Promise((resolve) => {
                    new Chart(canvas, {
                        type: 'line', data: { datasets },
                        options: {
                            animation: { onComplete: (animation) => resolve({ title: grupoTitulo, image: animation.chart.toBase64Image() }) },
                            plugins: { legend: { position: 'top' }, title: { display: true, text: grupoTitulo, font: { size: 16 } } },
                            scales: { x: { type: 'time', time: { tooltipFormat: 'dd/MM/yy HH:mm' } }, y: yAxisOptions }
                        }
                    });
                });
                chartImagePromises.push(promise);
            }

            if (chartImagePromises.length === 0) throw new Error("No hay datos para los sensores seleccionados en este rango.");
            const chartImages = await Promise.all(chartImagePromises);

            messageEl.textContent = 'Creando PDF...';
            const pdfResponse = await fetch('/mi_mapa_3d/api/api_generar_informe_grafico.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startTime, endTime, sensores, charts: chartImages })
            });
            if (!pdfResponse.ok) {
                const errorData = await pdfResponse.json();
                throw new Error(errorData.message || 'Error al crear el PDF.');
            }

            const blob = await pdfResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Informe_Grafico_Calsens_${obraId}_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
            messageEl.textContent = '';
        } catch (error) {
            messageEl.textContent = `Error: ${error.message}`;
        } finally {
            btnInformeGrafico.innerHTML = '<i class="fas fa-chart-line"></i> Gráficos (PDF)';
            updateFormState();
        }
    }

    async function generarInformeExcel() {
        messageEl.textContent = '';
        btnInformeDatos.disabled = true;
        btnInformeGrafico.disabled = true;
        btnInformeExcel.disabled = true;
        btnInformeExcel.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

        try {
            const response = await fetch('/mi_mapa_3d/api/api_generate_excel.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    obraId: obraSelect.value,
                    startTime: fechaInicioInput.value,
                    endTime: fechaFinInput.value,
                    sensores: Array.from(sensorContainer.querySelectorAll('input:checked')).map(cb => cb.value)
                })
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error desconocido al generar el Excel.');
                } else {
                    throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
                }
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = `Informe_Datos_Calsens_${obraSelect.value}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            messageEl.textContent = `Error: ${error.message}`;
        } finally {
            btnInformeExcel.innerHTML = '<i class="fas fa-file-excel"></i> Datos (Excel)';
            updateFormState();
        }
    }
    
    cargarObras();
    updateFormState();
});