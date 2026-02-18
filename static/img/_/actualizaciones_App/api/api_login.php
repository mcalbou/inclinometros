<?php
// api/api_login.php

session_start();

if (!isset($_SESSION['rol']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(403); // Código de "Forbidden"
    echo json_encode(['success' => false, 'message' => 'Acceso denegado. Permisos insuficientes.']);
    exit(); // Detenemos el script aquí
}

header('Content-Type: application/json');

require_once 'db_config.php';
$dbconn = get_db_connection();

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['usuario']) || !isset($input['contrasena'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Faltan datos de usuario o contraseña.']);
    exit;
}

$nombreUsuario = $input['usuario'];
$contrasenaPlana = $input['contrasena'];

//Añadimos 'id' a la consulta SELECT
// Necesitamos el ID del usuario para poder registrar su acceso.
$query = 'SELECT id, nombre_usuario, contrasena_hash, rol FROM usuarios WHERE nombre_usuario = $1';
$result = pg_query_params($dbconn, $query, array($nombreUsuario));

if (!$result || pg_num_rows($result) === 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Usuario o contraseña incorrectos.']);
    pg_close($dbconn);
    exit;
}

$userData = pg_fetch_assoc($result);
$hashGuardado = $userData['contrasena_hash'];

if (password_verify($contrasenaPlana, $hashGuardado)) {
    //Bloque para registrar el acceso en la base de datos
    
    // Obtenemos los datos necesarios para el registro
    $userId = $userData['id']; // Obtenemos el ID 
    $ipAddress = $_SERVER['REMOTE_ADDR']; // La dirección IP del usuario
    $userAgent = $_SERVER['HTTP_USER_AGENT']; // El navegador y SO del usuario

    // Preparamos la consulta SQL para insertar en la tabla 'registros_acceso'
    $query_log = 'INSERT INTO registros_acceso (usuario_id, ip_direccion, user_agent) VALUES ($1, $2, $3)';
    $params_log = array($userId, $ipAddress, $userAgent);

    // Ejecutamos la consulta para guardar el registro.
    // No necesitamos comprobar el resultado aquí para no interrumpir el login si falla,
    // pero en un entorno de producción se podría añadir un log de errores.
    $result_log = pg_query_params($dbconn, $query_log, $params_log);
    
    if (!$result_log) {
        // Si falla la inserción, lo guardamos en el log de errores del servidor
        // pero permitimos que el usuario inicie sesión de todas formas.
        error_log("Fallo al registrar el acceso para el usuario ID: " . $userId . " - Error: " . pg_last_error($dbconn));
    }



    // El resto de tu código de éxito continúa igual
    $_SESSION['usuario'] = $userData['nombre_usuario'];
    $_SESSION['rol'] = $userData['rol'];
    //Añadimos el id del usuario a la sesión
    $_SESSION['user_id'] = $userData['id'];

    // Registramos la hora actual como la última actividad del usuario.
    $_SESSION['last_activity'] = time();



    echo json_encode([
        'success' => true,
        'message' => 'Inicio de sesión exitoso.',
        'usuario' => $userData['nombre_usuario'],
        'rol' => $userData['rol']
    ]);

} else {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Usuario o contraseña incorrectos.']);
}

pg_close($dbconn);
?>