<?php
session_start(); // INICIAR SESIÓN PHP
header('Content-Type: application/json');

// CONEXIÓN BD
$host = 'localhost';
$db   = 'inclinometros_db';
$user = 'postgres';
$pass = 'DatosBase1'; 
$dsn  = "pgsql:host=$host;port=5432;dbname=$db";

try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Error BD: ' . $e->getMessage()]);
    exit;
}

$action = $_GET['action'] ?? '';

// ==========================================
// 1. ACCIONES PÚBLICAS (LOGIN)
// ==========================================

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $u = $_POST['usuario'] ?? '';
    $p = $_POST['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE usuario = ?");
    $stmt->execute([$u]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Verificamos contraseña encriptada (o temporalmente texto plano si no has encriptado)
    // El hash de ejemplo era para '1234'
    if ($user && password_verify($p, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['rol'] = $user['rol'];
        $_SESSION['usuario'] = $user['usuario'];
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Usuario o contraseña incorrectos']);
    }
    exit;
}

if ($action === 'check_session') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'logged_in' => true, 
            'rol' => $_SESSION['rol'],
            'usuario' => $_SESSION['usuario']
        ]);
    } else {
        echo json_encode(['logged_in' => false]);
    }
    exit;
}

if ($action === 'logout') {
    session_destroy();
    echo json_encode(['success' => true]);
    exit;
}

// ==========================================
// 2. MIDDLEWARE DE SEGURIDAD (BARRERA)
// ==========================================
// Si no está logueado, no pasa de aquí a las siguientes acciones
if (!isset($_SESSION['user_id'])) {
    http_response_code(401); // No autorizado
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

// ==========================================
// 3. ACCIONES PROTEGIDAS
// ==========================================

// A. OBTENER SENSORES (Todos los roles pueden ver)
if ($action === 'get_sensors') {
    $stmt = $pdo->query("SELECT * FROM sensores ORDER BY nombre");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// B. OBTENER DATOS (Todos los roles pueden ver)
if ($action === 'get_data') {
    $sensor_id = $_GET['id'] ?? 0;
    $sql = "SELECT to_char(fecha, 'YYYY-MM-DD') as fecha_str, profundidad, valor_a, valor_b 
            FROM lecturas WHERE sensor_id = :sid ORDER BY fecha ASC, profundidad ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['sid' => $sensor_id]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// C. SUBIDA DE ARCHIVOS (SOLO ADMIN Y SUPERADMIN)
if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // --> RESTRICCIÓN DE ROL: Si es cliente, fuera.
    if ($_SESSION['rol'] === 'cliente') {
        echo json_encode(['success' => false, 'message' => 'Permisos insuficientes. Los clientes no pueden subir datos.']);
        exit;
    }

    // LÓGICA DE SUBIDA (Tu código original)
    $sensor_id = $_POST['sensor_id'] ?? null;
    
    if (!$sensor_id || !isset($_FILES['file'])) {
        echo json_encode(['success' => false, 'message' => 'Faltan datos']); exit;
    }

    try {
        $filePath = $_FILES['file']['tmp_name'];
        $content = file_get_contents($filePath);
        $lines = preg_split('/\r\n|\r|\n/', $content);
        
        $headerIndices = [];
        foreach ($lines as $i => $line) {
            $clean = trim($line);
            if (stripos($clean, 'depth;') === 0 && preg_match('/\d{2}\/\d{2}\/\d{4}/', $clean)) {
                $headerIndices[] = $i;
            }
        }

        if (empty($headerIndices)) throw new Exception("No se encontraron cabeceras válidas.");

        $idx_a = $headerIndices[0];
        $idx_b = count($headerIndices) > 1 ? $headerIndices[1] : null;
        $end_a = $idx_b ? ($idx_b - 2) : count($lines);
        $mergedData = [];

        function processBlock($lines, $start, $end, $axis, &$mergedData) {
            $headerLine = trim($lines[$start]);
            $headers = explode(';', $headerLine);
            $dateMap = [];
            foreach ($headers as $k => $col) {
                if (strtolower($col) !== 'depth' && preg_match('/\d{2}\/\d{2}\/\d{4}/', $col)) {
                    $dt = DateTime::createFromFormat('d/m/Y', $col);
                    if ($dt) $dateMap[$k] = $dt->format('Y-m-d');
                }
            }
            for ($i = $start + 1; $i < $end; $i++) {
                if (!isset($lines[$i])) continue;
                $row = explode(';', trim($lines[$i]));
                if (count($row) < 1) continue;
                $prof = floatval(str_replace(',', '.', $row[0]));

                foreach ($dateMap as $colIdx => $dateStr) {
                    if (isset($row[$colIdx])) {
                        $val = floatval(str_replace(',', '.', $row[$colIdx]));
                        if (!isset($mergedData[$dateStr])) $mergedData[$dateStr] = [];
                        if (!isset($mergedData[$dateStr]["$prof"])) $mergedData[$dateStr]["$prof"] = ['a'=>0, 'b'=>0];
                        $mergedData[$dateStr]["$prof"][$axis] = $val;
                    }
                }
            }
        }

        processBlock($lines, $idx_a, $end_a, 'a', $mergedData);
        if ($idx_b) processBlock($lines, $idx_b, count($lines), 'b', $mergedData);

        $pdo->beginTransaction();
        $fechas = array_keys($mergedData);
        if (!empty($fechas)) {
            $placeholders = implode(',', array_fill(0, count($fechas), '?'));
            $stmtDel = $pdo->prepare("DELETE FROM lecturas WHERE sensor_id = ? AND fecha IN ($placeholders)");
            $stmtDel->execute(array_merge([$sensor_id], $fechas));
        }

        $stmtIns = $pdo->prepare("INSERT INTO lecturas (sensor_id, fecha, profundidad, valor_a, valor_b) VALUES (?, ?, ?, ?, ?)");
        $count = 0;
        foreach ($mergedData as $fecha => $profs) {
            foreach ($profs as $profKey => $vals) {
                $stmtIns->execute([$sensor_id, $fecha, $profKey, $vals['a'], $vals['b']]);
                $count++;
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'message' => "Procesados $count registros."]);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// D. CREAR USUARIOS (SOLO SUPERADMIN)
// ==========================================
if ($action === 'create_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // 1. SEGURIDAD: Solo el superAdmin puede pasar
    if (!isset($_SESSION['rol']) || $_SESSION['rol'] !== 'superAdmin') {
        echo json_encode(['success' => false, 'message' => 'Acceso denegado. Solo SuperAdmin.']);
        exit;
    }

    $u = $_POST['new_user'] ?? '';
    $p = $_POST['new_pass'] ?? '';
    $r = $_POST['new_role'] ?? '';

    // Validar datos básicos
    if (empty($u) || empty($p) || empty($r)) {
        echo json_encode(['success' => false, 'message' => 'Faltan datos']);
        exit;
    }

    try {
        // 2. Comprobar si ya existe
        $stmtCheck = $pdo->prepare("SELECT id FROM usuarios WHERE usuario = ?");
        $stmtCheck->execute([$u]);
        if ($stmtCheck->fetch()) {
            echo json_encode(['success' => false, 'message' => 'El usuario ya existe']);
            exit;
        }

        // 3. Encriptar contraseña y Guardar
        $hash = password_hash($p, PASSWORD_DEFAULT);
        
        $sql = "INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$u, $hash, $r]);

        echo json_encode(['success' => true, 'message' => "Usuario '$u' creado correctamente."]);

    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Error BD: ' . $e->getMessage()]);
    }
    exit;
}
?>