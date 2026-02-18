<?php
// api/api_listar_usuarios.php

require_once 'api_check_session.php'; // Incluimos nuestro guardia de seguridad
check_session_and_activity(); // Ejecutamos la comprobación de sesión y timeout

header('Content-Type: application/json');

// La comprobación de rol sigue siendo necesaria, pero la de sesión ya está hecha.
if ($_SESSION['rol'] !== 'admin') {
    http_response_code(403); // 403 Forbidden
    echo json_encode(['success' => false, 'message' => 'Acceso denegado. Permisos de administrador requeridos.']);
    exit;
}

require_once 'db_config.php';
$dbconn = get_db_connection();

// Seleccionamos todos los usuarios MENOS el admin que está logueado
$query = 'SELECT id, nombre_usuario, email, rol FROM usuarios WHERE nombre_usuario != $1 ORDER BY nombre_usuario ASC';
$result = pg_query_params($dbconn, $query, array($_SESSION['usuario']));

if ($result) {
    $usuarios = pg_fetch_all($result);
    // Devolvemos un array vacío si no hay resultados, en lugar de false
    echo json_encode($usuarios ?: []);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al obtener la lista de usuarios.']);
}

pg_close($dbconn);
?>