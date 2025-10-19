(function () {
  function show(msg) {
    var box = document.getElementById('diag-overlay');
    if (!box) {
      box = document.createElement('div');
      box.id = 'diag-overlay';
      box.style.position = 'fixed';
      box.style.inset = '12px';
      box.style.zIndex = '99999';
      box.style.background = 'rgba(127, 29, 29, 0.95)';
      box.style.color = '#fff';
      box.style.border = '1px solid #ef4444';
      box.style.borderRadius = '12px';
      box.style.padding = '14px 16px';
      box.style.font = '14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
      box.style.whiteSpace = 'pre-wrap';
      box.style.overflow = 'auto';
      document.body.appendChild(box);
    }
    box.textContent = '⛔ Ошибка загрузки/исполнения JS:\n\n' + msg +
      '\n\nПроверь регистр пути (assets/… не ASSETS/…), и что import указывает на существующий .js файл.';
  }

  window.addEventListener('error', function (e) {
    show((e.message || e.error || 'Unknown error') + (e.filename ? ('\n' + e.filename) : ''));
  });

  window.addEventListener('unhandledrejection', function (e) {
    show('UnhandledPromiseRejection: ' + (e.reason && (e.reason.stack || e.reason.message || e.reason)));
  });

  console.info('[diag] Диагностика подключена');
})();
