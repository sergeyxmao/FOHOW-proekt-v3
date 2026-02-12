<?php
// Читаем stdin: JSON {rawBody, signature, secretKey}
$input = json_decode(file_get_contents('php://stdin'), true);
parse_str($input['rawBody'], $data);

// Удаляем signature из данных если есть
unset($data['signature']);

// Приводим все значения к строкам
array_walk_recursive($data, function(&$v) { $v = strval($v); });

// Сортировка ключей рекурсивно
function deep_ksort(&$data) {
    ksort($data, SORT_REGULAR);
    foreach ($data as &$v) {
        if (is_array($v)) deep_ksort($v);
    }
}
deep_ksort($data);

$json = json_encode($data, JSON_UNESCAPED_UNICODE);
$calculated = hash_hmac('sha256', $json, $input['secretKey']);

echo json_encode([
    'valid' => $calculated === $input['signature'],
    'calculated' => $calculated,
    'expected' => $input['signature'],
    'json' => $json
]);
