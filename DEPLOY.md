# Деплой лендинга LAZUR-IT на lazur-it.ru

Коротко: это **статический сайт** — чистый HTML/CSS/JS без сборки и без зависимостей.
Достаточно разложить файлы в корень домена и отдать их веб-сервером.

- Репозиторий: `https://github.com/lbnvwork/lazur-it-landing`, ветка `main`
- Точка входа: `index.html`
- Демо-стенд для сверки: `https://lbnvwork.github.io/lazur-it-landing/`

---

## 1. Состав поставки

```
index.html                 лендинг
assets/css/style.css       все стили
assets/js/main.js          вся клиентская логика (меню, анимации, форма)
assets/img/                логотипы, favicon
robots.txt                 индексация
.nojekyll                  нужен только для GitHub Pages, на обычном хостинге безвреден
deploy/                    НЕ публикуется — служебные файлы для деплоя (см. раздел 6)
```

Каталог `deploy/` в веб-корень класть не нужно.

## 2. Раскладка файлов

Скопировать содержимое репозитория в корень сайта, например `/var/www/lazur-it.ru/`.

nginx, минимальный конфиг:

```nginx
server {
    listen 443 ssl http2;
    server_name lazur-it.ru www.lazur-it.ru;

    root /var/www/lazur-it.ru;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location /assets/ {
        add_header Cache-Control "public, max-age=604800";
    }
}
```

Apache — достаточно `.htaccess` с `DirectoryIndex index.html`, остальное отдаётся по умолчанию.

## 3. HTTPS и www

- Сертификат (Let's Encrypt / certbot) и редирект с `http` на `https` — обязательно.
- Определитесь с каноническим хостом и сделайте редирект: либо `www → без www`, либо наоборот.
- В виджете Turnstile достаточно указать корневой домен `lazur-it.ru` — поддомены
  он покрывает сам (раздел 5). Для домена, которого нет в списке, виджет отдаёт ошибку.

DNS: `A`-запись на IP сервера, при необходимости `CNAME www` на каноническое имя.

## 4. Заголовки безопасности (важно для капчи)

Капча Turnstile грузит скрипт и фрейм с `challenges.cloudflare.com`, а форма отправляет
запросы на `formsubmit.co`. Если на сервере включён `Content-Security-Policy`, он должен
разрешать именно эти источники, иначе форма и капча сломаются:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://challenges.cloudflare.com;
  frame-src https://challenges.cloudflare.com;
  connect-src 'self' https://formsubmit.co https://challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self' https://fonts.gstatic.com;
  base-uri 'self';
  form-action 'self' https://formsubmit.co
```

`'unsafe-inline'` для `style-src` нужен из-за инлайновых стилей виджета Turnstile.
Шрифты подключаются с `fonts.googleapis.com` / `fonts.gstatic.com` — их тоже не блокировать.

Остальные заголовки по желанию: `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`.

## 5. Домены в виджете Turnstile — не забыть

Виджет Turnstile привязан к списку доменов. Открыть:

```
https://dash.cloudflare.com/?to=/:account/turnstile
```

→ выбрать виджет → **Settings** → **Hostname management** → убедиться, что там есть:

- `lazur-it.ru` — этого достаточно: добавленный корневой домен автоматически
  покрывает все поддомены, включая `www.lazur-it.ru`
- `lbnvwork.github.io` — только пока живёт демо на GitHub Pages

Если домена в списке нет, Turnstile вернёт ошибку **110200 «Domain not authorized»** —
посетитель увидит «Ошибка» вместо галочки. Форма при этом **не сломается**: заявка
всё равно уйдёт, а в письме придёт поле `captcha: widget-unavailable`. Это осознанное
поведение — живой клиент важнее идеальной защиты, но такие заявки стоит заметить
и добавить домен.

Коды ошибок на всякий случай — они видны в консоли браузера:

| Код | Что значит |
| --- | --- |
| `110200` | домен не добавлен в Hostname Management |
| `110100`, `110110`, `400020` | site key неверный или не найден |
| `400070` | site key отключён в панели |
| `200500` | фрейм `challenges.cloudflare.com` не загрузился (блокировка или CSP) |
| `110600`, `110620` | истекло время прохождения — посетителю нужно обновить страницу |

Обновить список можно и через API. Важно: `PUT` перезаписывает конфигурацию
виджета целиком, поэтому сначала выгрузите текущую и меняйте только `domains` —
иначе можно случайно сбросить режим виджета (`mode`).

```bash
ACCOUNT_ID=...
TOKEN=...            # API-токен с правом Account → Turnstile → Edit
SITEKEY=0x4AAAAAAFYLhAKy0EwbUott

# 1. посмотреть текущий конфиг (mode, name, domains)
curl -s "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/challenges/widgets/$SITEKEY" \
  --header "Authorization: Bearer $TOKEN"

# 2. отправить тот же конфиг с дополненным списком доменов
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/challenges/widgets/$SITEKEY" \
  --request PUT \
  --header "Authorization: Bearer $TOKEN" \
  --json '{
    "name": "<как в ответе шага 1>",
    "mode": "<как в ответе шага 1>",
    "domains": ["lazur-it.ru", "lbnvwork.github.io"]
  }'
```

## 6. Опционально: серверная проверка капчи (рекомендуется)

По умолчанию заявки уходят из браузера напрямую в сервис **FormSubmit** — бэкенд не нужен.
Капча при этом проверяется только на клиенте: она отсекает обычных спам-ботов, но не того,
кто бьёт запросами мимо страницы.

Если на хостинге есть **PHP 8+** (curl, mbstring) — можно включить полноценную проверку:

1. Скопировать `deploy/send.php` в корень сайта под именем `send.php`.
2. Задать секрет Turnstile одним из способов:
   - переменная окружения `TURNSTILE_SECRET` (php-fpm pool или vhost), **или**
   - файл `turnstile-secret.php` рядом с `send.php`, возвращающий строку:
     ```php
     <?php return '0x4AAAAAAA...';   // ваш secret key из панели Cloudflare
     ```
   Файл с секретом **не коммитить** — он уже добавлен в `.gitignore`.
3. В `assets/js/main.js` указать путь к приёмнику:
   ```js
   var LEAD_ENDPOINT = '/send.php';
   ```
4. Убедиться, что с сервера уходит почта (`sendmail`/MTA) и для домена настроены
   **SPF и DKIM** — иначе письма уедут в спам.
5. Проверить:
   ```bash
   # без токена — ожидаем 400
   curl -i -X POST https://lazur-it.ru/send.php -d 'name=test&contact=test&message=test'
   # с формы на сайте — 200 и {"ok":true}
   ```

Что это даёт: сервер сам вызывает Siteverify и не пропускает заявку без валидного токена,
то есть защита работает и против прямых запросов на endpoint.

## 7. Чек-лист приёмки

- [ ] `https://lazur-it.ru/` отдаёт 200 и лендинг
- [ ] `https://lazur-it.ru/assets/css/style.css` и `/assets/js/main.js` — 200
- [ ] `http://` редиректит на `https://`, лишний `www` — на канонический домен
- [ ] В hero виден скарабей, крылья медленно взмахивают
- [ ] В блоке «Контакты» под полями появился виджет капчи (тёмный, на русском)
- [ ] Заполнение и отправка формы → зелёное «Спасибо! Заявка отправлена»
- [ ] Письмо пришло на `lmax-work@ya.ru` (проверить и папку «Спам»)
- [ ] В консоли браузера нет ошибок CSP/CORS
- [ ] Телефон и e-mail кликаются, ссылка на Telegram открывается
- [ ] Вёрстка не разъезжается на 390 px и на 1440 px

Если виджет капчи не появился — почти всегда дело в домене (раздел 5) или в CSP (раздел 4).

## 8. Что в репозитории намеренно отсутствует

- **Secret key Turnstile** — только на сервере (переменная окружения или `turnstile-secret.php`).
- **Коммерческое предложение в PDF** и его исходник — держатся отдельно от публичного кода
  (там банковские реквизиты), на деплой не влияют.
