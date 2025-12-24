<?php
// Секретный ключ - ВСТАВЬТЕ СЮДА СГЕНЕРИРОВАННЫЙ КЛЮЧ
$secret = '81ddd34d65370f178685ade4eb1f087ab6aecacf32fe16add9029d4d0202c50e';

// Логирование запросов
$logFile = '/var/log/fohow-proekt-webhook.log';

// Получение данных от GitHub
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';

// Логирование попытки
file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "Webhook triggered\n", FILE_APPEND);

// Проверка подписи
if (!empty($signature)) {
    $expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    
    if (hash_equals($expected, $signature)) {
        // Подпись верна - запускаем обновление
        exec('sudo /usr/local/bin/fohow_deploy.sh > /dev/null 2>&1 &');
        file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "✅ Update triggered successfully\n", FILE_APPEND);
        http_response_code(200);
        echo json_encode(['status' => 'success', 'message' => 'Update triggered']);
    } else {
        // Неверная подпись
        file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "❌ Invalid signature\n", FILE_APPEND);
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Invalid signature']);
    }
} else {
    // Подпись отсутствует
    file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "❌ No signature provided\n", FILE_APPEND);
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No signature']);
}
?>
