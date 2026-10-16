/* ==========================================================================
   LAZUR-IT — интерактивный слой лендинга
   Без внешних зависимостей. Прогрессивное улучшение: без JS страница работоспособна.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var doc = document;

  /* ------------------------- 1. Пыль пустыни (фон) ------------------------ */
  function initDust() {
    var host = doc.getElementById('dust');
    if (!host || reduceMotion) return;

    var count = window.innerWidth < 700 ? 14 : 26;
    var frag = doc.createDocumentFragment();

    for (var i = 0; i < count; i++) {
      var dot = doc.createElement('span');
      var size = (Math.random() * 2.2 + 1).toFixed(2);
      dot.style.width = size + 'px';
      dot.style.height = size + 'px';
      dot.style.left = (Math.random() * 100).toFixed(2) + '%';
      dot.style.top = (Math.random() * 100).toFixed(2) + '%';
      dot.style.animationDuration = (16 + Math.random() * 22).toFixed(1) + 's';
      dot.style.animationDelay = (-Math.random() * 30).toFixed(1) + 's';
      dot.style.background = Math.random() > 0.55 ? '#d9b45b' : '#5fb6c2';
      frag.appendChild(dot);
    }
    host.appendChild(frag);
  }

  /* ------------------------- 2. Шапка и прогресс -------------------------- */
  function initScrollUI() {
    var header = doc.getElementById('header');
    var progress = doc.getElementById('progress');
    var toTop = doc.getElementById('toTop');
    var ticking = false;

    function update() {
      var y = window.pageYOffset || doc.documentElement.scrollTop;

      if (header) header.classList.toggle('is-stuck', y > 40);
      if (toTop) toTop.classList.toggle('is-visible', y > 600);

      if (progress) {
        var docHeight = doc.documentElement.scrollHeight - window.innerHeight;
        var ratio = docHeight > 0 ? Math.min(y / docHeight, 1) : 0;
        progress.style.transform = 'scaleX(' + ratio + ')';
      }
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });

    update();

    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }
  }

  /* ---------------------------- 3. Мобильное меню ------------------------- */
  function initMenu() {
    var burger = doc.getElementById('burger');
    var panel = doc.getElementById('mobileNav');
    if (!burger || !panel) return;

    function close() {
      panel.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Открыть меню');
      doc.body.style.removeProperty('overflow');
    }

    function open() {
      panel.classList.add('is-open');
      burger.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Закрыть меню');
      doc.body.style.overflow = 'hidden';
    }

    burger.addEventListener('click', function () {
      if (panel.classList.contains('is-open')) { close(); } else { open(); }
    });

    Array.prototype.forEach.call(panel.querySelectorAll('a'), function (link) {
      link.addEventListener('click', close);
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1000) close();
    });
  }

  /* --------------------------- 4. Анимация появления ---------------------- */
  function initReveal() {
    var items = doc.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(items, function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(items, function (el) { observer.observe(el); });
  }

  /* ------------------------ 5. Подсветка активного меню ------------------- */
  function initScrollSpy() {
    var links = doc.querySelectorAll('.nav__link');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var sections = [];

    Array.prototype.forEach.call(links, function (link) {
      var id = link.getAttribute('href');
      if (!id || id.charAt(0) !== '#' || id.length < 2) return;
      var section = doc.querySelector(id);
      if (!section) return;
      map[section.id] = link;
      sections.push(section);
    });

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Array.prototype.forEach.call(links, function (l) { l.classList.remove('is-active'); });
        var active = map[entry.target.id];
        if (active) active.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ----------------------------- 6. Счётчики ------------------------------ */
  function initCounters() {
    var values = doc.querySelectorAll('[data-count]');
    if (!values.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var suffix = el.getAttribute('data-suffix') || '';

      if (reduceMotion) {
        el.textContent = target.toLocaleString('ru-RU') + suffix;
        return;
      }

      var duration = 1400;
      var start = null;

      function frame(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('ru-RU') + suffix;
        if (p < 1) window.requestAnimationFrame(frame);
      }
      window.requestAnimationFrame(frame);
    }

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(values, run);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          run(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    Array.prototype.forEach.call(values, function (el) { observer.observe(el); });
  }

  /* ------------------------- 7. Плавный скролл по якорям ------------------ */
  function initSmoothAnchors() {
    doc.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!link) return;

      var hash = link.getAttribute('href');
      if (!hash || hash === '#') return;

      var target = doc.querySelector(hash);
      if (!target) return;

      e.preventDefault();
      var offset = 78;
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', hash);
    });
  }

  /* ------------------------------- 8. Форма ------------------------------- */
  /* Заявки уходят в Web3Forms (внешний сервис, своего бэкенда не нужно).
     Пока в форме стоит ключ-заглушка, работает прежний вариант — почтовый клиент. */
  function initForm() {
    var form = doc.getElementById('leadForm');
    if (!form) return;

    var okBox = doc.getElementById('formOk');
    var errBox = doc.getElementById('formErr');
    var button = form.querySelector('button[type="submit"]');
    var buttonText = button ? button.querySelector('span') : null;

    /* --- Куда отправлять заявки ---------------------------------------------
       'formsubmit' — работает без регистрации: FormSubmit пришлёт на EMAIL письмо
                      «Activate Form», после клика заявки идут на почту.
       'formspree'  — зарегистрируйтесь на formspree.io, создайте форму и вставьте
                      её ID в FORMSPREE_ID.
       'mailto'     — запасной вариант: готовит письмо и открывает почтовый клиент.
       Web3Forms здесь не используется: его закрывает Cloudflare-челлендж,
       который невозможно пройти из fetch-запроса.
    ------------------------------------------------------------------------- */
    var PROVIDER = 'formsubmit';
    var EMAIL = 'lmax-work@ya.ru';
    var PHONE = '+7 950 876-60-57';
    var FORMSPREE_ID = 'YOUR_FORMSPREE_FORM_ID';

    function message(box, text) {
      [okBox, errBox].forEach(function (b) { if (b) b.hidden = true; });
      if (box) {
        box.textContent = text;
        box.hidden = false;
      }
    }

    function busy(state) {
      if (button) button.disabled = state;
      if (buttonText) buttonText.textContent = state ? 'Отправляю…' : 'Отправить заявку';
    }

    function readFields() {
      return {
        name: (form.elements.name.value || '').trim(),
        company: (form.elements.company.value || '').trim(),
        contact: (form.elements.contact.value || '').trim(),
        type: form.elements.type.value || '—',
        message: (form.elements.message.value || '').trim()
      };
    }

    function validate() {
      var firstInvalid = null;
      [form.elements.name, form.elements.contact, form.elements.message].forEach(function (field) {
        var bad = !field.value.trim();
        field.style.borderColor = bad ? '#c96a6a' : '';
        if (bad && !firstInvalid) firstInvalid = field;
      });
      return firstInvalid;
    }

    function subjectFor(data) {
      return 'Заявка с сайта LAZUR-IT' + (data.company ? ' — ' + data.company : '');
    }

    /* Запасной вариант: подготовить письмо в почтовом клиенте */
    function sendViaMailClient(data) {
      var body = [
        'Имя: ' + data.name,
        'Компания: ' + (data.company || '—'),
        'Способ связи: ' + data.contact,
        'Тип проекта: ' + data.type,
        '',
        'Задача:',
        data.message
      ].join('\n');

      message(okBox, 'Спасибо! Открываю ваш почтовый клиент — письмо уже подготовлено, остаётся нажать «Отправить».');

      window.location.href = 'mailto:' + EMAIL +
        '?subject=' + encodeURIComponent(subjectFor(data)) +
        '&body=' + encodeURIComponent(body);
    }

    /* Основной вариант: отправка через внешний сервис (без своего бэкенда).
       Отправляем FormData: это «простой» запрос, браузер не делает preflight,
       поэтому он проходит с любого статического хостинга. */
    function replyToFor(data) {
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.contact) ? data.contact : '';
    }

    function sendViaService(data) {
      var payload = new FormData();
      var endpoint;

      payload.append('name', data.name);
      payload.append('company', data.company || '—');
      payload.append('contact', data.contact);
      payload.append('project_type', data.type);
      payload.append('message', data.message);
      payload.append('_subject', subjectFor(data));

      /* Если указан e-mail — подставляем его как Reply-To,
         чтобы можно было ответить прямо из почты. */
      var replyTo = replyToFor(data);
      if (replyTo) {
        payload.append('email', replyTo);
        payload.append('_replyto', replyTo);
      }

      if (PROVIDER === 'formspree') {
        endpoint = 'https://formspree.io/f/' + FORMSPREE_ID;
      } else {
        endpoint = 'https://formsubmit.co/ajax/' + EMAIL;
        payload.append('_template', 'table');
        payload.append('_captcha', 'false');
      }

      return fetch(endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: payload
      }).then(function (response) {
        return response.json().catch(function () { return null; });
      }).then(function (result) {
        /* FormSubmit отдаёт признак успеха строкой "true", Formspree — как ok */
        var success = result && (result.success === true || result.success === 'true' || result.ok === true);
        if (!success) {
          throw new Error(result && result.message ? result.message : 'Сервис вернул неожиданный ответ');
        }
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var invalid = validate();
      if (invalid) {
        invalid.focus();
        return;
      }

      var data = readFields();

      /* Сервис не выбран — не теряем заявку, работаем через почтовый клиент */
      if (PROVIDER === 'mailto' || (PROVIDER === 'formspree' && FORMSPREE_ID === 'YOUR_FORMSPREE_FORM_ID')) {
        sendViaMailClient(data);
        return;
      }

      busy(true);

      sendViaService(data).then(function () {
        form.reset();
        message(okBox, 'Спасибо! Заявка отправлена — отвечу в течение рабочего дня.');
      }).catch(function () {
        message(errBox, 'Не удалось отправить заявку. Напишите, пожалуйста, напрямую: ' + EMAIL + ' или ' + PHONE + '.');
      }).then(function () {
        busy(false);
      });
    });

    /* Возврат на сайт после обычной отправки формы (когда JS выключен):
       Web3Forms перекидывает сюда с параметром ?sent=1 — показываем благодарность. */
    if (/[?&]sent=1(&|$)/.test(window.location.search)) {
      message(okBox, 'Спасибо! Заявка отправлена — отвечу в течение рабочего дня.');
      if (history.replaceState) {
        history.replaceState(null, '', window.location.pathname + '#contact');
      }
    }
  }

  /* ------------------------------- 9. Прочее ------------------------------ */
  function initMisc() {
    var year = doc.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());

    Array.prototype.forEach.call(doc.querySelectorAll('[data-print]'), function (btn) {
      btn.addEventListener('click', function () { window.print(); });
    });
  }

  function boot() {
    initDust();
    initScrollUI();
    initMenu();
    initReveal();
    initScrollSpy();
    initCounters();
    initSmoothAnchors();
    initForm();
    initMisc();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
