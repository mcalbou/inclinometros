<?php
// api/api_upload_postgres.php (Versión con Log de Depuración)

// --- FUNCIÓN DE LOGGING ---
// Esta función escribirá mensajes en un archivo de log.
function log_message($message) {
    // La ruta al archivo de log, relativo a este script.
    $log_file = __DIR__ . '/upload_log.txt';
    // Formato del mensaje: [FECHA Y HORA] Mensaje
    $formatted_message = "[" . date("Y-m-d H:i:s") . "] " . $message . "\n";
    // Añadimos el mensaje al final del archivo.
    file_put_contents($log_file, $formatted_message, FILE_APPEND);
}

// Limpiamos el log al principio de cada intento.
file_put_contents(__DIR__ . '/upload_log.txt', '');

log_message("--- INICIO DE LA PETICIÓN ---");

header('Content-Type: application/json');

// --- CONFIGURACIÓN DB ---
$host = 'localhost';
$port = '5432';
$dbname = 'login_db';
$user = 'postgres';
$password = 'DatosBase1';

try {
    log_message("Paso 1: Verificando método de la petición.");
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido.');
    }
    log_message("OK: Método es POST.");

    log_message("Paso 2: Verificando archivo subido.");
    if (!isset($_FILES['csvFile']) || $_FILES['csvFile']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('No se recibió ningún archivo o hubo un error en la subida. Código de error: ' . ($_FILES['csvFile']['error'] ?? 'N/A'));
    }
    log_message("OK: Archivo recibido. Nombre temporal: " . $_FILES['csvFile']['tmp_name']);

    log_message("Paso 3: Verificando obra_id.");
    $obraId = $_POST['obraId'] ?? null;
    if (!$obraId) {
        throw new Exception('No se especificó el ID de la obra.');
    }
    log_message("OK: obra_id recibida: " . $obraId);

    $filePath = $_FILES['csvFile']['tmp_name'];

    log_message("Paso 4: Intentando conectar a la base de datos PostgreSQL.");
    $conn_string = "host={$host} port={$port} dbname={$dbname} user={$user} password={$password}";
    $dbconn = @pg_connect($conn_string);
    if (!$dbconn) {
        throw new Exception('Error de conexión a la base de datos PostgreSQL. Revisa las credenciales.');
    }
    log_message("OK: Conexión a la base de datos exitosa.");

    log_message("Paso 5: Iniciando transacción en la base de datos.");
    pg_query($dbconn, 'BEGIN');
    log_message("OK: Transacción iniciada.");

    log_message("Paso 6: Abriendo el archivo CSV en: " . $filePath);
    $handle = fopen($filePath, "r");
    if ($handle === FALSE) {
        throw new Exception("No se pudo abrir el archivo CSV temporal.");
    }
    log_message("OK: Archivo CSV abierto para lectura.");

    $query = 'INSERT INTO lecturas_sensores (obra_id, sensor_id, timestamp, lectura, temperatura) VALUES ($1, $2, $3, $4, $5)';
    pg_prepare($dbconn, "insert_lectura", $query);
    log_message("OK: Consulta SQL preparada.");

    $rowCount = 0;
    $isHeader = true;

    log_message("Paso 7: Empezando a leer el archivo CSV línea por línea.");
    while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
        if ($isHeader) {
            $isHeader = false;
            log_message("Saltando cabecera: " . implode(',', $data));
            continue;
        }

        if (count($data) < 4) {
             log_message("ERROR en fila: La fila tiene menos de 4 columnas. Contenido: " . implode(',', $data));
             continue;
        }

        $sensor_id = $data[0] ?? null;
        $timestamp_str = $data[1] ?? null;
        $lectura = (isset($data[2]) && $data[2] !== '') ? (float)$data[2] : null;
        $temperatura = (isset($data[3]) && $data[3] !== '') ? (float)$data[3] : null;

        if ($sensor_id && $timestamp_str) {
            $result = pg_execute($dbconn, "insert_lectura", [
                $obraId, $sensor_id, $timestamp_str, $lectura, $temperatura
            ]);
            if ($result === false) {
                $db_error = pg_last_error($dbconn);
                throw new Exception("Error al insertar en la base de datos: " . $db_error);
            }
            $rowCount++;
        }
    }
    fclose($handle);
    log_message("OK: Lectura del CSV finalizada. Filas procesadas: " . $rowCount);

    log_message("Paso 8: Haciendo COMMIT de la transacción.");
    pg_query($dbconn, 'COMMIT');
    log_message("OK: COMMIT exitoso.");
    
    pg_close($dbconn);

    http_response_code(200);
    echo json_encode(['message' => "$rowCount filas importadas correctamente en la obra '$obraId'."]);

} catch (Exception $e) {
    // Si algo falla, lo registramos en el log
    log_message("¡¡¡ERROR!!! -> " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Ocurrió un error en el servidor. Revisa el archivo api/upload_log.txt para más detalles.']);
}
?>