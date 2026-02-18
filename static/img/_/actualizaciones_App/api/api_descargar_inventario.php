<?php
// api/api_descargar_inventario.php

session_start();
if (!isset($_SESSION['rol'])) {
    http_response_code(403);
    // Enviamos un JSON para que el JS lo pueda leer
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Acceso no autorizado.']);
    exit;
}

require_once 'db_config.php';

// Leemos el JSON enviado por fetch
$input = json_decode(file_get_contents('php://input'), true);
$sensores_seleccionados = $input['sensores'] ?? [];
$columnas_seleccionadas_raw = $input['columnas'] ?? [];

// --- Validaciones ---
if (empty($sensores_seleccionados) || empty($columnas_seleccionadas_raw)) {
    http_response_code(400); // Bad Request
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Debe seleccionar al menos un sensor y una columna de información.']);
    exit;
}


// --- Procesamiento de Columnas ---
$columnas_permitidas = [
    'sensor_id'       => 'ID Sensor',
    'obra_id'         => 'ID Obra',
    'tipo_sensor'     => 'Tipo de Sensor',
    'descripcion'     => 'Descripcion',
    'fecha_instalacion' => 'Fecha de Instalacion'
];

$dbconn = get_db_connection(); // Conectamos aquí para usar pg_escape_identifier

$columnas_sql = [];
$columnas_csv_header = [];
foreach ($columnas_seleccionadas_raw as $col) {
    if (isset($columnas_permitidas[$col])) {
        $columnas_sql[] = pg_escape_identifier($dbconn, $col);
        $columnas_csv_header[] = $columnas_permitidas[$col];
    }
}


// --- Construcción y Ejecución de la Consulta ---
$params = [];
$query_string = "SELECT " . implode(', ', $columnas_sql) . " FROM sensores";

$placeholders = [];
foreach ($sensores_seleccionados as $i => $sensor) {
    $placeholders[] = '$' . ($i + 1);
    $params[] = $sensor;
}
$query_string .= " WHERE sensor_id IN (" . implode(', ', $placeholders) . ")";
$query_string .= " ORDER BY sensor_id ASC";


try {
    $result = pg_query_params($dbconn, $query_string, $params);
    if (!$result) {
        throw new Exception("Error al consultar la base de datos: " . pg_last_error($dbconn));
    }

    // --- Generación del CSV ---
    $filename = "Inventario_Sensores_" . date('Y-m-d') . ".csv";
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $output = fopen('php://output', 'w');
    fputcsv($output, $columnas_csv_header, ';');
    while ($row = pg_fetch_assoc($result)) {
        fputcsv($output, $row, ';');
    }
    fclose($output);
    pg_close($dbconn);
    exit();

} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Error al generar el archivo: ' . $e->getMessage()]);
    exit;
}
?>