<?php
// api/api_get_custom_chart_data.php

header('Content-Type: application/json');
require_once 'db_config.php'; // Tu archivo de conexión a la BD

// --- 1. Recibir y validar parámetros ---
$obraId = $_GET['obra'] ?? null;
$startTime = $_GET['startTime'] ?? null;
$endTime = $_GET['endTime'] ?? null;
$sensorIdsStr = $_GET['sensorIds'] ?? null;

if (!$obraId || !$startTime || !$endTime || !$sensorIdsStr) {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan parámetros: obra, startTime, endTime, sensorIds.']);
    exit;
}

// --- 2. Conectar a la base de datos ---
$dbconn = get_db_connection();
if (!$dbconn) {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo conectar a la base de datos.']);
    exit;
}

// --- 3. Preparar la consulta SQL de forma segura ---
$requestedFullIds = explode(',', $sensorIdsStr);
$baseIdsToQuery = [];

// Extraer solo los IDs base (ej. 'TH01' de 'TH01_T') para la consulta
foreach ($requestedFullIds as $fullId) {
    $parts = explode('_', $fullId);
    $baseIdsToQuery[] = $parts[0];
}
$baseIdsToQuery = array_unique($baseIdsToQuery);

// Si no hay IDs base, no hay nada que hacer
if (empty($baseIdsToQuery)) {
    echo json_encode([]);
    exit;
}

// *** MEJORA DE SEGURIDAD CRÍTICA ***
// Crear placeholders ($4, $5, $6...) para la cláusula IN.
// Empezamos en $4 porque $1, $2 y $3 ya están en uso.
$placeholders = implode(',', array_map(function($i) {
    return '$' . ($i + 4); 
}, array_keys($baseIdsToQuery)));

// La consulta ahora es 100% parametrizada y segura.
$query = '
    SELECT 
        sensor_id, timestamp, temperatura, humedad, desplazamiento, 
        "inclinacion A" AS inclinacion_a, "inclinacion B" AS inclinacion_b
    FROM lecturas_sensores
    WHERE LOWER(obra_id) = LOWER($1) 
      AND sensor_id IN (' . $placeholders . ')
      AND timestamp BETWEEN $2 AND $3
    ORDER BY timestamp ASC;
';

// Combinamos todos los parámetros en un solo array en el orden correcto
$params = array_merge([$obraId, $startTime, $endTime], array_values($baseIdsToQuery));

$result = pg_query_params($dbconn, $query, $params);

if (!$result) {
    http_response_code(500);
    echo json_encode(['error' => 'Error en la consulta SQL.', 'details' => pg_last_error($dbconn)]);
    pg_close($dbconn);
    exit;
}

$dataFromDb = pg_fetch_all($result, PGSQL_ASSOC) ?: [];
pg_close($dbconn);


// --- 4. Formatear la salida para que coincida con lo que espera createChartCard ---

// *** MEJORA DE LÓGICA Y FORMATO ***
// Un mapa de configuración para que el código sea más limpio y mantenible.
$variable_config = [
    'T' => ['variable' => 'Temperatura', 'unidad' => '°C', 'columna' => 'temperatura'],
    'H' => ['variable' => 'Humedad',     'unidad' => '%',  'columna' => 'humedad'],
    'A' => ['variable' => 'Inclinacion A', 'unidad' => '°', 'columna' => 'inclinacion_a'],
    'B' => ['variable' => 'Inclinacion B', 'unidad' => '°', 'columna' => 'inclinacion_b'],
    // Para 'CA', el sufijo puede no existir, así que lo manejamos como un caso especial.
    'CA' => ['variable' => 'Desplazamiento', 'unidad' => 'mm', 'columna' => 'desplazamineto']
];

$datos_agrupados = [];

// Indexamos los datos por sensor_id para un acceso más rápido
$dataBySensorId = [];
foreach ($dataFromDb as $row) {
    $dataBySensorId[$row['sensor_id']][] = $row;
}

// Iteramos sobre los IDs que el frontend solicitó originalmente
foreach ($requestedFullIds as $fullId) {
    $parts = explode('_', $fullId);
    $baseId = $parts[0];
    $suffix = $parts[1] ?? null;
    $sensorType = strtoupper(substr($baseId, 0, 2));

    $config = null;
    if ($sensorType === 'CA') {
        $config = $variable_config['CA'];
    } elseif ($suffix && isset($variable_config[$suffix])) {
        $config = $variable_config[$suffix];
    }

    // Si no tenemos configuración para este sensor/variable, lo saltamos
    if (!$config) continue;

    $variableName = $config['variable'];
    $unidad = $config['unidad'];
    $columna = $config['columna'];
    
    // Si hay datos para este sensor base en los resultados de la BD
    if (isset($dataBySensorId[$baseId])) {
        // Inicializamos los arrays si no existen
        if (!isset($datos_agrupados[$variableName])) {
            $datos_agrupados[$variableName] = [];
        }
        if (!isset($datos_agrupados[$variableName][$fullId])) {
            $datos_agrupados[$variableName][$fullId] = [];
        }

        // Recorremos las lecturas y extraemos el valor de la columna correcta
        foreach ($dataBySensorId[$baseId] as $row) {
            if (isset($row[$columna]) && $row[$columna] !== null) {
                $datos_agrupados[$variableName][$fullId][] = [
                    'timestamp' => $row['timestamp'],
                    'lectura'   => (float)$row[$columna],
                    'unidad'    => $unidad, // Añadimos la metadata que necesita el frontend
                    'variable'  => $variableName
                ];
            }
        }
    }
}

echo json_encode($datos_agrupados);
?>