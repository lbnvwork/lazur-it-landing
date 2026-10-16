<?php
declare(strict_types=1);

/**
 * Приёмник заявок с лендинга LAZUR-IT.
 *
 * Что делает:
 *   1) отсекает спам-ботов ловушкой (_honey) и проверкой Origin;
 *   2) проверяет токен Cloudflare Turnstile через Siteverify;
 *   3) отправляет заявку письмом на LEAD_TO.
 *
 * Куда положить: в корень сайта рядом с index.html (например /send.php).
 * Секрет Turnstile задаётся ОДНИМ из двух способов:
 *   - переменная окружения  TURNSTILE_SECRET=0x4AAAAAAA...
 *   - файл turnstile-secret.php рядом, который возвращает строку с секретом
 *     (`<?php return '0x4AAAAAAA...';`) — этот файл должен быть вне git.
 *
 * Требования: PHP 8+, включённые расширения curl и mbstring, рабочий sendmail.
 */

const LEAD_TO   = 'lmax-work@ya.ru';          // куда присылать заявки
const LEAD_FROM = 'no-reply@lazur-it.ru';     // от кого (домен должен быть ваш)
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/* Домены, с которых разрешено отправлять заявки. Пустой массив — проверку
   Origin не выполняем (на случай кривых прокси). */
const ALLOWED_HOSTS = ['lazur-it.ru', 'www.lazur-it.ru', 'lbnvwork.github.io'];

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $code, bool $ok, string $message = ''): void
{
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function field(array $data, string $key, int $max): string
{
    $value = (string) ($data[$key] ?? '');
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = strip_tags(trim($value));
    return mb_substr($value, 0, $max);
}

/* ----------------------------- 1. Вход и мусор ---------------------------- */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, false, 'Method not allowed');
}

if (ALLOWED_HOSTS !== []) {
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '');
    if ($origin !== '') {
        $host = strtolower((string) parse_url($origin, PHP_URL_HOST));
        if (!in_array($host, ALLOWED_HOSTS, true)) {
            respond(403, false, 'Источник не разрешён');
        }
    }
}

$raw  = (string) file_get_contents('php://input');
$data = $_POST;
if ($data === [] && $raw !== '') {
    $json = json_decode($raw, true);
    if (is_array($json)) {
        $data = $json;
    }
}

/* Ловушка для ботов: поле скрыто в форме, человек его не заполняет.
   Отвечаем «успех», чтобы бот не понял, что его раскусили. */
if (field($data, '_honey', 100) !== '') {
    respond(200, true);
}

$name    = field($data, 'name', 200);
$company = field($data, 'company', 200);
$contact = field($data, 'contact', 200);
$type    = field($data, 'project_type', 200);
$message = field($data, 'message', 5000);
$token   = field($data, 'captcha_token', 3000);

if ($name === '' || $contact === '' || $message === '') {
    respond(422, false, 'Заполните обязательные поля');
}

/* --------------------------- 2. Проверка капчи --------------------------- */

$secret = (string) (getenv('TURNSTILE_SECRET') ?: '');
if ($secret === '' && is_file(__DIR__ . '/turnstile-secret.php')) {
    $secret = (string) require __DIR__ . '/turnstile-secret.php';
}
if ($secret === '') {
    respond(500, false, 'Секрет Turnstile не настроен на сервере');
}

if ($token === '') {
    respond(400, false, 'Подтвердите, пожалуйста, что вы не робот');
}

$ch = curl_init(SITEVERIFY);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query([
        'secret'   => $secret,
        'response' => $token,
        'remoteip' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
]);
$verdict  = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !is_string($verdict)) {
    respond(502, false, 'Не удалось проверить капчу, попробуйте ещё раз');
}

$result = json_decode($verdict, true);
if (!is_array($result) || ($result['success'] ?? false) !== true) {
    respond(400, false, 'Проверка «я не робот» не пройдена. Обновите страницу и попробуйте снова');
}

/* ------------------------------ 3. Письмо -------------------------------- */

$subject = 'Заявка с сайта LAZUR-IT' . ($company !== '' ? ' — ' . $company : '');

$body = "Имя: {$name}\n"
      . 'Компания: ' . ($company !== '' ? $company : '—') . "\n"
      . "Способ связи: {$contact}\n"
      . "Тип проекта: {$type}\n"
      . "\nЗадача:\n{$message}\n";

$headers = [
    'From: LAZUR-IT <' . LEAD_FROM . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
];

$replyTo = filter_var($contact, FILTER_VALIDATE_EMAIL);
if ($replyTo !== false) {
    $headers[] = 'Reply-To: ' . $replyTo;
}

$sent = mail(
    LEAD_TO,
    '=?UTF-8?B?' . base64_encode($subject) . '?=',
    $body,
    implode("\r\n", $headers)
);

if (!$sent) {
    respond(502, false, 'Не удалось отправить заявку, напишите напрямую: lmax-work@ya.ru');
}

respond(200, true, 'Спасибо! Заявка отправлена');
