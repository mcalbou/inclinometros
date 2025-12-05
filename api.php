<?php
header('Content-Type: application/json');

// --- 1. CONFIGURACIÓN DE BASE DE DATOS ---
$host = 'localhost';
$db   = 'inclinometros_db';
$user = 'postgres';
$pass = '1234'; // <--- PON TU CONTRASEÑA AQUÍ
$dsn  = "pgsql:host=$host;port=5432;dbname=$db";

try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Error de conexión BD: ' . $e->getMessage()]);
    exit;
}

$action = $_GET['action'] ?? '';

// --- 2. RUTAS API ---

// A. OBTENER SENSORES
if ($action === 'get_sensors') {
    $stmt = $pdo->query("SELECT * FROM sensores ORDER BY nombre");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// B. OBTENER DATOS (LECTURAS)
if ($action === 'get_data') {
    $sensor_id = $_GET['id'] ?? 0;
    
    // Consulta simple, el filtrado de fechas lo haremos preferiblemente en JS o aquí si hay muchos datos
    // Para eficiencia, traemos todo ordenado
    $sql = "SELECT to_char(fecha, 'YYYY-MM-DD') as fecha_str, profundidad, valor_a, valor_b 
            FROM lecturas WHERE sensor_id = :sid ORDER BY fecha ASC, profundidad ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['sid' => $sensor_id]);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($data);
    exit;
}

// C. SUBIDA DE ARCHIVOS (LA PARTE DIFÍCIL: PARSER CSV)
if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $sensor_id = $_POST['sensor_id'] ?? null;
    
    if (!$sensor_id || !isset($_FILES['file'])) {
        echo json_encode(['success' => false, 'message' => 'Faltan datos']);
        exit;
    }

    try {
        $filePath = $_FILES['file']['tmp_name'];
        $content = file_get_contents($filePath);
        
        // Convertir saltos de línea universales
        $lines = preg_split('/\r\n|\r|\n/', $content);
        
        // 1. Buscar cabeceras "Depth;"
        $headerIndices = [];
        foreach ($lines as $i => $line) {
            $clean = trim($line);
            // Regex simple para detectar fecha tipo dd/mm/yyyy en la misma linea que Depth
            if (stripos($clean, 'depth;') === 0 && preg_match('/\d{2}\/\d{2}\/\d{4}/', $clean)) {
                $headerIndices[] = $i;
            }
        }

        if (empty($headerIndices)) {
            throw new Exception("No se encontraron cabeceras válidas (Depth;fecha...).");
        }

        // Definir bloques
        $idx_a = $headerIndices[0];
        $idx_b = count($headerIndices) > 1 ? $headerIndices[1] : null;
        $end_a = $idx_b ? ($idx_b - 2) : count($lines);

        // Array para almacenar datos fusionados: $merged[fecha][profundidad] = [a => val, b => val]
        $mergedData = [];

        // Función auxiliar para procesar bloques
        function processBlock($lines, $start, $end, $axis, &$mergedData) {
            // Leer línea de cabecera para sacar fechas
            $headerLine = trim($lines[$start]);
            $headers = explode(';', $headerLine);
            
            // Mapear índices de columnas a fechas
            $dateMap = [];
            foreach ($headers as $k => $col) {
                if (strtolower($col) !== 'depth' && preg_match('/\d{2}\/\d{2}\/\d{4}/', $col)) {
                    // Convertir fecha dd/mm/yyyy a YYYY-MM-DD para la BD
                    $dt = DateTime::createFromFormat('d/m/Y', $col);
                    if ($dt) $dateMap[$k] = $dt->format('Y-m-d');
                }
            }

            // Leer filas de datos
            for ($i = $start + 1; $i < $end; $i++) {
                if (!isset($lines[$i])) continue;
                $rowStr = trim($lines[$i]);
                if (empty($rowStr)) continue;

                // Importante: Reemplazar comas decimales por puntos antes de parsear
                // Pero solo si es formato europeo. El CSV original usaba ';' como separador
                $row = explode(';', $rowStr);
                
                if (count($row) < 1) continue;

                // Profundidad (reemplazar coma por punto)
                $prof = str_replace(',', '.', $row[0]);
                if (!is_numeric($prof)) continue;
                $prof = floatval($prof);

                foreach ($dateMap as $colIdx => $dateStr) {
                    if (isset($row[$colIdx])) {
                        $val = str_replace(',', '.', $row[$colIdx]);
                        if (is_numeric($val)) {
                            $val = floatval($val);
                            
                            if (!isset($mergedData[$dateStr])) $mergedData[$dateStr] = [];
                            if (!isset($mergedData[$dateStr]["$prof"])) $mergedData[$dateStr]["$prof"] = ['a'=>0, 'b'=>0];
                            
                            $mergedData[$dateStr]["$prof"][$axis] = $val;
                        }
                    }
                }
            }
        }

        // Procesar Bloque A
        processBlock($lines, $idx_a, $end_a, 'a', $mergedData);
        
        // Procesar Bloque B (si existe)
        if ($idx_b) {
            processBlock($lines, $idx_b, count($lines), 'b', $mergedData);
        }

        // 2. Transacción BD
        $pdo->beginTransaction();

        // Borrar datos previos de esas fechas y ese sensor (para evitar duplicados)
        $fechas = array_keys($mergedData);
        if (!empty($fechas)) {
            $placeholders = implode(',', array_fill(0, count($fechas), '?'));
            $sqlDelete = "DELETE FROM lecturas WHERE sensor_id = ? AND fecha IN ($placeholders)";
            $params = array_merge([$sensor_id], $fechas);
            $stmtDel = $pdo->prepare($sqlDelete);
            $stmtDel->execute($params);
        }

        // Insertar nuevos
        $sqlInsert = "INSERT INTO lecturas (sensor_id, fecha, profundidad, valor_a, valor_b) VALUES (?, ?, ?, ?, ?)";
        $stmtIns = $pdo->prepare($sqlInsert);

        $count = 0;
        foreach ($mergedData as $fecha => $profs) {
            foreach ($profs as $profKey => $vals) {
                $stmtIns->execute([$sensor_id, $fecha, $profKey, $vals['a'], $vals['b']]);
                $count++;
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'message' => "Procesados $count registros correctamente."]);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}
?>