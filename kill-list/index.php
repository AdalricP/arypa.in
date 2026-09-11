<?php
declare(strict_types=1);

header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");

$config = require __DIR__ . '/config.php';
if (empty($config['password_hash'])) {
    http_response_code(503);
    exit('This page is not configured.');
}

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
session_name($config['cookie_name']);
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/kill-list/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

function readPhpArray(string $path, array $fallback): array {
    $value = is_file($path) ? require $path : $fallback;
    return is_array($value) ? $value : $fallback;
}

function writePhpArray(string $path, array $value): void {
    $temporary = $path . '.tmp';
    file_put_contents($temporary, "<?php return " . var_export($value, true) . ";\n", LOCK_EX);
    rename($temporary, $path);
}

function csrfToken(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function validCsrf(): bool {
    return isset($_POST['csrf'], $_SESSION['csrf']) && hash_equals($_SESSION['csrf'], (string) $_POST['csrf']);
}

$authStatePath = __DIR__ . '/auth-state.php';
$client = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
$authState = readPhpArray($authStatePath, []);
$now = time();
$attempt = $authState[$client] ?? ['count' => 0, 'until' => 0];
$error = '';

if (($_POST['action'] ?? '') === 'login') {
    if (!validCsrf()) {
        http_response_code(400);
        exit('Bad request.');
    }
    if ($attempt['until'] > $now) {
        $error = 'Too many attempts. Try again later.';
    } elseif (password_verify((string) ($_POST['password'] ?? ''), $config['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['authenticated'] = true;
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        unset($authState[$client]);
        writePhpArray($authStatePath, $authState);
        header('Location: ./', true, 303);
        exit;
    } else {
        $attempt['count']++;
        if ($attempt['count'] >= 5) {
            $attempt = ['count' => 0, 'until' => $now + 900];
        }
        $authState[$client] = $attempt;
        writePhpArray($authStatePath, $authState);
        $error = 'Incorrect password.';
    }
}

if (empty($_SESSION['authenticated'])) {
?><!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Private</title><link rel="stylesheet" href="kill-list.css"></head><body><main class="login"><h1>Private</h1><?php if ($error): ?><p class="error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?><form method="post" autocomplete="off"><input type="hidden" name="action" value="login"><input type="hidden" name="csrf" value="<?= htmlspecialchars(csrfToken(), ENT_QUOTES, 'UTF-8') ?>"><label>Password<input name="password" type="password" required autofocus></label><button type="submit">Enter</button></form></main></body></html><?php
    exit;
}

$statePath = __DIR__ . '/state.php';
$state = readPhpArray($statePath, ['ottovon' => false, 'robotics-engineer' => false]);
if (($_POST['action'] ?? '') === 'save') {
    if (!validCsrf()) {
        http_response_code(400);
        exit('Bad request.');
    }
    $state['ottovon'] = isset($_POST['ottovon']);
    $state['robotics-engineer'] = isset($_POST['robotics-engineer']);
    writePhpArray($statePath, $state);
    header('Location: ./', true, 303);
    exit;
}
if (($_POST['action'] ?? '') === 'logout' && validCsrf()) {
    $_SESSION = [];
    session_destroy();
    header('Location: ./', true, 303);
    exit;
}
?><!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kill list</title><link rel="stylesheet" href="kill-list.css"></head><body><main><div class="topline"><a class="back" href="../">← Aryan Pahwani</a><form method="post"><input type="hidden" name="action" value="logout"><input type="hidden" name="csrf" value="<?= htmlspecialchars(csrfToken(), ENT_QUOTES, 'UTF-8') ?>"><button class="logout" type="submit">Log out</button></form></div><h1>Kill list</h1><p class="intro">Things worth finishing.</p><form method="post"><input type="hidden" name="action" value="save"><input type="hidden" name="csrf" value="<?= htmlspecialchars(csrfToken(), ENT_QUOTES, 'UTF-8') ?>"><ul class="checklist"><li><label><input type="checkbox" name="ottovon" <?= $state['ottovon'] ? 'checked' : '' ?>><span>Establish Ottovon: the automation company.</span></label></li><li><label><input type="checkbox" name="robotics-engineer" <?= $state['robotics-engineer'] ? 'checked' : '' ?>><span>Become one of the best robotics engineers out there.</span></label></li></ul><button type="submit">Save</button></form></main></body></html>
