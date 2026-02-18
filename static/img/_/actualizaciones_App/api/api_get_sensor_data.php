<?php
// api/api_get_sensor_data.php -- VERSIÓN DE DEPURACIÓN

header('Content-Type: application/json');
require_once 'db_config.php';

// --- PASO 1: ¿Llegan los datos? ---
// echo "Paso 1: Script alcanzado. Parámetros recibidos: \n";
// print_r($_GET);
// exit;

$obraId = $_GET['obra'] ?? null;
$startTime = $_GET['startTime'] ?? null;
$endTime = $_GET['endTime'] ?? null;
$sensorIdDesdeUrl = $_GET['id'] ?? $_GET['sensorId'] ?? null;

if (!$obraId || !$startTime || !$endTime || !$sensorIdDesdeUrl) {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan parámetros obligatorios.']);
    exit;
}

$dbconn = get_db_connection();
if (!$dbconn) {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo conectar a la base de datos.']);
    exit;
}

// --- PASO 2: ¿Se identifica bien el sensor? ---
$db_sensor_id = $sensorIdDesdeUrl;
$columna_a_seleccionar = null; // Cambiado a null para una mejor comprobación

if (preg_match('/(TH\d+)_([TH])/', $sensorIdDesdeUrl, $matches)) {
    $db_sensor_id = $matches[1];
    $tipo = $matches[2];
    $columna_a_seleccionar = ($tipo === 'H') ? 'humedad' : 'temperatura';
} 
elseif (preg_match('/(CL\d+)_([AB])/', $sensorIdDesdeUrl, $matches)) {
    $db_sensor_id = $matches[1];
    $tipo = $matches[2];
    $columna_a_seleccionar = ($tipo === 'B') ? '"inclinacion B"' : '"inclinacion A"';
}
elseif (preg_match('/^(CA\d+)/', $sensorIdDesdeUrl, $matches)) {
    $db_sensor_id = $matches[1];
    $columna_a_seleccionar = 'desplazamiento';
}

// echo "Paso 2: Sensor identificado. \n";
// echo "ID de sensor para DB: " . $db_sensor_id . "\n";
// echo "Columna a seleccionar: " . $columna_a_seleccionar . "\n";
// exit;

if ($columna_a_seleccionar === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Tipo de sensor no reconocido o formato de ID incorrecto: ' . $sensorIdDesdeUrl]);
    pg_close($dbconn);
    exit;
}

// --- PASO 3: ¿La consulta SQL es correcta? ---
$query = '
    SELECT 
        timestamp, 
        ' . $columna_a_seleccionar . ' AS lectura 
    FROM 
        lecturas_sensores
    WHERE 
        LOWER(obra_id) = LOWER($1) 
        AND sensor_id = $2 
        AND timestamp BETWEEN $3 AND $4
    ORDER BY 
        timestamp ASC;
';

$params = [$obraId, $db_sensor_id, $startTime, $endTime];

// echo "Paso 3: Consulta SQL a punto de ejecutarse. \n";
// echo "Query: " . $query . "\n";
// echo "Parámetros: \n";
// print_r($params);
// exit;

$result = pg_query_params($dbconn, $query, $params);

if (!$result) {
    http_response_code(500);
    echo json_encode(['error' => 'Error en la consulta SQL.', 'details' => pg_last_error($dbconn)]);
    pg_close($dbconn);
    exit;
}

$data = pg_fetch_all($result) ?: [];
pg_close($dbconn);
echo json_encode($data);

?>