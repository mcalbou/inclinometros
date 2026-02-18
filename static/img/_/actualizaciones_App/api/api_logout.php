<?php
// api/api_logout.php

// 1. Iniciar la sesión para poder acceder a ella
session_start();

// 2. Destruir todas las variables de sesión
$_SESSION = array();

// 3. Si se está usando cookies de sesión, borrarlas
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// 4. Finalmente, destruir la sesión
session_destroy();

// 5. Redirigir al usuario a la página de login
// Usamos una ruta absoluta para asegurarnos de que siempre funciona
header('Location: /mi_mapa_3d/login.html');
exit;
?>