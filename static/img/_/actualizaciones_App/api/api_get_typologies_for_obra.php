<?php
// api/api_get_typologies_for_obra.php
header('Content-Type: application/json');
require_once 'db_config.php';

$obra_id = $_GET['obra'] ?? '';

if (empty($obra_id)) {
    http_response_code(400);
    echo json_encode([]);
    exit;
}

// Clasificación de sensores. En una aplicación más grande, esto podría estar en una tabla de la BD.
$sensor_typologies = [
    'Deformaciones' => ['S1_TB', 'S4_TH', 'S1_BA', 'S4_BG', 'S5_BA'],
    'Temperaturas' => ['S3_BE']
];
// Sensores que además tienen lectura de temperatura secundaria
$sensors_with_secondary_temp = ['S1_TB', 'S4_TH', 'S1_BA', 'S4_BG', 'S5_BA'];

$dbconn = get_db_connection();
$query = 'SELECT DISTINCT sensor_id FROM sensores WHERE obra_id = $1';
$result = pg_query_params($dbconn, $query, array($obra_id));

if (!$result) {
    http_response_code(500);
    echo json_encode([]);
    exit;
}

$sensores_en_obra = pg_fetch_all_columns($result, 0) ?: [];
pg_close($dbconn);

$typologies_present = [];

foreach ($sensores_en_obra as $sensorId) {
    $found = false;
    foreach ($sensor_typologies as $type => $sensor_list) {
        if (in_array($sensorId, $sensor_list)) {
            if (!in_array($type, $typologies_present)) {
                $typologies_present[] = $type;
            }
            $found = true;
        }
    }
    // Comprobar si es un sensor de deformación que también mide temperatura
    if (in_array($sensorId, $sensors_with_secondary_temp)) {
        if (!in_array('Temperaturas', $typologies_present)) {
            $typologies_present[] = 'Temperaturas';
        }
    }

    if (!$found && !in_array('Otros', $typologies_present)) {
        $typologies_present[] = 'Otros';
    }
}

sort($typologies_present);
echo json_encode($typologies_present);
?>