<?php
// api/db_config.php

function get_db_connection() {
    $host = 'localhost';
    $port = '5432';
    $dbname = 'login_db';
    $user = 'postgres';
    $password = 'DatosBase1';

    $conn_string = "host={$host} port={$port} dbname={$dbname} user={$user} password={$password}";
    $dbconn = pg_connect($conn_string);

    if (!$dbconn) {
        // Si la conexión falla, detenemos todo y enviamos una respuesta de error JSON
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos.']);
        exit;
    }

    return $dbconn;
}
?>