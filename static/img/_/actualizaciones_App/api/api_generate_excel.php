<?php
// api/api_generate_excel.php

require '../vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Font;
use PhpOffice\PhpSpreadsheet\Cell\DataType;

require_once 'db_config.php';

$input = json_decode(file_get_contents('php://input'), true);

$startTime = $input['startTime'] ?? null;
$endTime = $input['endTime'] ?? null;
$sensores = $input['sensores'] ?? [];

if (!$startTime || !$endTime || empty($sensores)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Faltan parámetros para generar el informe.']);
    exit;
}

$dbconn = get_db_connection();
$placeholders = implode(',', array_map(function($i) { return '$' . ($i + 3); }, array_keys($sensores)));
$query = "
    SELECT sensor_id, timestamp, lectura, temperatura 
    FROM lecturas_sensores 
    WHERE timestamp BETWEEN $1 AND $2 
    AND sensor_id IN ({$placeholders})
    ORDER BY sensor_id, timestamp ASC
";
$params = array_merge([$startTime, $endTime], $sensores);
$result = pg_query_params($dbconn, $query, $params);

if (!$result) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Error al consultar la base de datos.']);
    exit;
}

$data = pg_fetch_all($result);
pg_close($dbconn);

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Datos de Sensores');

$sheet->setCellValue('A1', 'Sensor ID');
$sheet->setCellValue('B1', 'Fecha y Hora');
$sheet->setCellValue('C1', 'Lectura (Deformacion)');
$sheet->setCellValue('D1', 'Temperatura (°C)');

$sheet->getStyle('A1:D1')->getFont()->setBold(true);

$rowNumber = 2;
if (!empty($data)) {
    foreach ($data as $row) {
        $sheet->setCellValue('A' . $rowNumber, $row['sensor_id']);
        $sheet->setCellValue('B' . $rowNumber, date("d/m/Y H:i:s", strtotime($row['timestamp'])));
        
        $sheet->setCellValueExplicit('C' . $rowNumber, $row['lectura'], DataType::TYPE_NUMERIC);
        $sheet->setCellValueExplicit('D' . $rowNumber, $row['temperatura'], DataType::TYPE_NUMERIC);
        
        $sheet->getStyle('C' . $rowNumber)->getNumberFormat()->setFormatCode('0.0000');
        $sheet->getStyle('D' . $rowNumber)->getNumberFormat()->setFormatCode('0.00');

        $rowNumber++;
    }
}

foreach (range('A', 'D') as $columnID) {
    $sheet->getColumnDimension($columnID)->setAutoSize(true);
}

$writer = new Xlsx($spreadsheet);

$filename = 'Informe_Datos_Calsens_' . date('Y-m-d') . '.xlsx';
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment;filename="' . $filename . '"');
header('Cache-Control: max-age=0');

$writer->save('php://output');
exit;
?>