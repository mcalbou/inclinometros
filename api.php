<?php
// api.php - API para gestión de sensores y datos
session_start(); // INICIAR SESIÓN PHP
header('Content-Type: application/json');

// CONEXIÓN BD
$host = 'localhost';
$db   = 'inclinometros_db';
$user = 'postgres';
//$pass = 'DatosBase1';
$pass = 'EstrucDatosAdmin';
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

// A. OBTENER SENSORES (SOLO LOS ACTUALES PARA EL DESPLEGABLE)
if ($action === 'get_sensors') {
    // Usamos DISTINCT ON en Postgres para sacar solo la última versión de cada nombre
    // Ordenamos por nombre y luego por versión descendente (la más alta primero)
    $sql = "SELECT DISTINCT ON (nombre) * 
            FROM sensores 
            ORDER BY nombre, version DESC";
            
    $stmt = $pdo->query($sql);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// NUEVO: OBTENER VERSIONES DE UN SENSOR ESPECÍFICO
if ($action === 'get_versions') {
    $sensor_id = $_GET['id'] ?? 0;
    
    // 1. Averiguar el nombre del sensor actual
    $stmtName = $pdo->prepare("SELECT nombre FROM sensores WHERE id = ?");
    $stmtName->execute([$sensor_id]);
    $nombre = $stmtName->fetchColumn();

    if ($nombre) {
        // 2. Buscar todos los sensores que se llamen igual, ordenados por versión
        $stmtVers = $pdo->prepare("SELECT s.id, s.nombre, s.version,
                                   to_char(MIN(l.fecha), 'DD/MM/YYYY') as f_ini,
                                   to_char(MAX(l.fecha), 'DD/MM/YYYY') as f_fin
                                   FROM sensores s
                                   LEFT JOIN lecturas l ON l.sensor_id = s.id
                                   WHERE s.nombre = ?
                                   GROUP BY s.id, s.nombre, s.version
                                   ORDER BY s.version DESC");
        $stmtVers->execute([$nombre]);
        echo json_encode($stmtVers->fetchAll(PDO::FETCH_ASSOC));
    } else {
        echo json_encode([]);
    }
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

// ==========================================
// C. SUBIDA DE ARCHIVOS (MODIFICADO PARA HISTORIAL)
// ==========================================
if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    
    if ($_SESSION['rol'] === 'cliente') {
        echo json_encode(['success' => false, 'message' => 'Permisos insuficientes.']); exit;
    }

    $sensor_id = $_POST['sensor_id'] ?? null;
    
    if (!$sensor_id || !isset($_FILES['file'])) {
        echo json_encode(['success' => false, 'message' => 'Faltan datos']); exit;
    }

    try {
        $fileName = $_FILES['file']['name']; // Nombre original del archivo
        $filePath = $_FILES['file']['tmp_name'];
        $content = file_get_contents($filePath);
        $lines = preg_split('/\r\n|\r|\n/', $content);
        
        // ... (Tu lógica de parsing de cabeceras se mantiene IGUAL) ...
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

        // ... (Tu función processBlock se mantiene IGUAL) ...
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

        // --- AQUÍ EMPIEZA EL CAMBIO IMPORTANTE ---
        $pdo->beginTransaction();

        // 1. Crear registro en tabla CARGAS
        $stmtCarga = $pdo->prepare("INSERT INTO cargas (sensor_id, nombre_archivo, usuario) VALUES (?, ?, ?) RETURNING id");
        $stmtCarga->execute([$sensor_id, $fileName, $_SESSION['usuario']]);
        $carga_id = $stmtCarga->fetchColumn();

        // 2. Limpiar datos antiguos que coincidan en fecha (para evitar duplicados visuales)
        // Nota: Esto borra datos viejos de esas fechas, aunque fueran de otra carga. Es necesario para no tener doble dato.
        $fechas = array_keys($mergedData);
        if (!empty($fechas)) {
            $placeholders = implode(',', array_fill(0, count($fechas), '?'));
            $stmtDel = $pdo->prepare("DELETE FROM lecturas WHERE sensor_id = ? AND fecha IN ($placeholders)");
            $stmtDel->execute(array_merge([$sensor_id], $fechas));
        }

        // 3. Insertar nuevos datos vinculados a la CARGA
        $stmtIns = $pdo->prepare("INSERT INTO lecturas (sensor_id, carga_id, fecha, profundidad, valor_a, valor_b) VALUES (?, ?, ?, ?, ?, ?)");
        $count = 0;
        foreach ($mergedData as $fecha => $profs) {
            foreach ($profs as $profKey => $vals) {
                $stmtIns->execute([$sensor_id, $carga_id, $fecha, $profKey, $vals['a'], $vals['b']]);
                $count++;
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'message' => "Archivo guardado. $count registros procesados."]);

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
// ==========================================
// E. EXPORTAR CSV (DISPONIBLE PARA TODOS)
// ==========================================
if ($action === 'export_csv') {
    
    // Solo requerimos estar logueados (cualquier rol vale)
    if (!isset($_SESSION['user_id'])) {
        die('Acceso denegado');
    }

    $sensor_id = $_GET['id'] ?? 0;
    $start = $_GET['start'] ?? '1900-01-01';
    $end = $_GET['end'] ?? '2100-01-01';

    // Obtener nombre del sensor para el nombre del archivo
    $stmtName = $pdo->prepare("SELECT nombre FROM sensores WHERE id = ?");
    $stmtName->execute([$sensor_id]);
    $sensorName = $stmtName->fetchColumn() ?: 'Sensor';

    // Configurar cabeceras para forzar descarga
    $filename = "Datos_" . str_replace(' ', '_', $sensorName) . "_" . date('Y-m-d') . ".csv";
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    // Abrir salida
    $output = fopen('php://output', 'w');

    // Escribir BOM para que Excel abra bien los caracteres raros (tildes, etc)
    fwrite($output, "\xEF\xBB\xBF");

    // Cabeceras de columna
    fputcsv($output, ['Fecha', 'Profundidad (m)', 'Eje A (mm)', 'Eje B (mm)'], ';');

    // Consultar datos
    $sql = "SELECT to_char(fecha, 'DD/MM/YYYY') as fecha_fmt, profundidad, valor_a, valor_b 
            FROM lecturas 
            WHERE sensor_id = :sid AND fecha >= :start AND fecha <= :end 
            ORDER BY fecha ASC, profundidad ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['sid' => $sensor_id, 'start' => $start, 'end' => $end]);

    // Escribir filas
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Formatear números con coma decimal para Excel en español (opcional)
        $row['profundidad'] = str_replace('.', ',', $row['profundidad']);
        $row['valor_a'] = str_replace('.', ',', $row['valor_a']);
        $row['valor_b'] = str_replace('.', ',', $row['valor_b']);
        
        fputcsv($output, $row, ';');
    }

    fclose($output);
    exit;
}
// ==========================================
// F. AÑADIR NUEVO SENSOR (SOLO ADMIN/SUPERADMIN)
// ==========================================
if ($action === 'add_sensor' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // 1. Permisos
    if (!isset($_SESSION['rol']) || ($_SESSION['rol'] !== 'admin' && $_SESSION['rol'] !== 'superAdmin')) {
        echo json_encode(['success' => false, 'message' => 'Permisos insuficientes.']);
        exit;
    }

    // 2. Recoger datos
    $createVersion = ($_POST['create_version'] ?? '0') === '1';
    $baseSensorId = $_POST['base_sensor_id'] ?? null;

    $nombre = $_POST['nombre'] ?? '';
    $lat = $_POST['latitud'] ?? 0;
    $lon = $_POST['longitud'] ?? 0;
    $nf = $_POST['nf'] ?? 0;
    $lugar = $_POST['lugar'] ?? 'Canal'; // Por defecto Canal

    if (!$createVersion && empty($nombre)) {
        echo json_encode(['success' => false, 'message' => 'El nombre es obligatorio']);
        exit;
    }

    // 3. Manejar la Foto
    $fotoFilename = null;
    if (isset($_FILES['foto']) && $_FILES['foto']['error'] === UPLOAD_ERR_OK) {
        $tmpName = $_FILES['foto']['tmp_name'];
        $originalName = basename($_FILES['foto']['name']);
        
        // Limpiamos el nombre para evitar caracteres raros
        $cleanName = preg_replace('/[^A-Za-z0-9.\-_]/', '', $originalName);
        $targetPath = __DIR__ . "/static/img/" . $cleanName;

        if (move_uploaded_file($tmpName, $targetPath)) {
            $fotoFilename = $cleanName;
        }
    }

    try {
        // 4. Si es nueva versión, usamos datos del sensor base
        if ($createVersion) {
            if (empty($baseSensorId)) {
                echo json_encode(['success' => false, 'message' => 'Selecciona el sensor base para crear la versión']);
                exit;
            }
            $stmtBase = $pdo->prepare("SELECT nombre, latitud, longitud, nf, lugar FROM sensores WHERE id = ?");
            $stmtBase->execute([$baseSensorId]);
            $base = $stmtBase->fetch(PDO::FETCH_ASSOC);
            if (!$base) {
                echo json_encode(['success' => false, 'message' => 'Sensor base no encontrado']);
                exit;
            }
            $nombre = $base['nombre'];
            $lat = $base['latitud'];
            $lon = $base['longitud'];
            $nf = $base['nf'];
            $lugar = $base['lugar'] ?: 'Canal';
        } else {
            // Evitar duplicar nombres si no es nueva versión
            $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM sensores WHERE nombre = ?");
            $stmtCheck->execute([$nombre]);
            if ($stmtCheck->fetchColumn() > 0) {
                echo json_encode(['success' => false, 'message' => 'Ya existe un sensor con ese nombre. Usa "crear nueva versión".']);
                exit;
            }
        }

        // 5. Calcular versión
        if ($createVersion) {
            $stmtVer = $pdo->prepare("SELECT COALESCE(MAX(version), 0) FROM sensores WHERE nombre = ?");
            $stmtVer->execute([$nombre]);
            $version = (int)$stmtVer->fetchColumn() + 1;
        } else {
            $version = 1;
        }

        // 6. Insertar en BD
        $sql = "INSERT INTO sensores (nombre, latitud, longitud, nf, foto_path, lugar, version) VALUES (?, ?, ?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$nombre, $lat, $lon, $nf, $fotoFilename, $lugar, $version]);

        echo json_encode(['success' => true, 'message' => 'Sensor añadido correctamente']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Error BD: ' . $e->getMessage()]);
    }
    exit;
}

// ==========================================
// G. OBTENER HISTORIAL DE CARGAS (NUEVO)
// ==========================================
if ($action === 'get_uploads') {
    // Si es superadmin ve todo, si es admin ve todo, cliente no debería entrar aquí pero por si acaso
    $sql = "SELECT c.id, c.nombre_archivo, to_char(c.fecha_subida, 'DD/MM/YYYY HH24:MI') as fecha_fmt, 
                   c.usuario, s.nombre as sensor_nombre,
                   (SELECT COUNT(*) FROM lecturas l WHERE l.carga_id = c.id) as num_datos
            FROM cargas c
            JOIN sensores s ON c.sensor_id = s.id
            ORDER BY c.fecha_subida DESC LIMIT 50";
    
    $stmt = $pdo->query($sql);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// ==========================================
// H. BORRAR UNA CARGA (NUEVO)
// ==========================================
if ($action === 'delete_upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($_SESSION['rol'] === 'cliente') {
        echo json_encode(['success' => false, 'message' => 'No autorizado']); exit;
    }

    $id = $_POST['id'] ?? 0;
    
    try {
        // Al borrar la carga, el ON DELETE CASCADE de Postgres borra las lecturas solas
        $stmt = $pdo->prepare("DELETE FROM cargas WHERE id = ?");
        $stmt->execute([$id]);
        
        echo json_encode(['success' => true, 'message' => 'Carga y sus datos eliminados correctamente.']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Error al borrar: ' . $e->getMessage()]);
    }
    exit;
}

// ==========================================
// I. ELIMINAR LECTURAS CON PROFUNDIDAD 0 (TODOS LOS INCLINÓMETROS)
// ==========================================
if ($action === 'delete_lecturas_profundidad_cero' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($_SESSION['rol'] === 'cliente') {
        echo json_encode(['success' => false, 'message' => 'No autorizado']); exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM lecturas WHERE profundidad = 0");
        $stmt->execute();
        $deleted = $stmt->rowCount();
        echo json_encode([
            'success' => true,
            'message' => $deleted > 0
                ? "Se han eliminado $deleted registro(s) con profundidad 0."
                : 'No había registros con profundidad 0.',
            'deleted' => $deleted
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Error al borrar: ' . $e->getMessage()]);
    }
    exit;
}

?>