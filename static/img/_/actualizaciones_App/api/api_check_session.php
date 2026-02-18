<?php
// api/api_check_session.php

function check_session_and_activity() {
    if (session_status() == PHP_SESSION_NONE) {
        session_start();
    }

    $timeout_duration = 1800; // 30 minutos en segundos (30 * 60)

    // 1. Comprobar si hay una sesión iniciada
    if (!isset($_SESSION['usuario'])) {
        http_response_code(401); // 401 Unauthorized
        echo json_encode(['success' => false, 'message' => 'No hay una sesión activa. Por favor, inicie sesión.']);
        exit();
    }

    // 2. Comprobar si la sesión ha expirado por inactividad
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > $timeout_duration) {
        session_unset();
        session_destroy();
        http_response_code(401); // 401 Unauthorized
        echo json_encode(['success' => false, 'message' => 'La sesión ha expirado por inactividad.']);
        exit();
    }

    // 3. Si la sesión es válida, actualizamos la marca de tiempo de la última actividad
    $_SESSION['last_activity'] = time();
}

// Opcional: Si este archivo se llama directamente (ej. desde JS para un 'ping'),
// podemos devolver una respuesta de éxito.
// La comprobación `basename(__FILE__) == basename($_SERVER["SCRIPT_FILENAME"])` 
// asegura que este bloque solo se ejecute si se llama a este archivo directamente.
if (basename(__FILE__) == basename($_SERVER["SCRIPT_FILENAME"])) {
    check_session_and_activity();
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => 'Sesión activa.']);
}
?>