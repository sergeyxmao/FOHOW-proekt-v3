export function renderApp() {
  const root = document.getElementById("app");
  root.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "app";

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h1 style="margin:0">Проект запущен ✅</h1>
    <p style="margin-top:8px">Авторизация выполнена. Мы готовы переходить к M2 (панели/кнопки).</p>
    <p style="margin-top:8px">Дальше всё будет так же без зависимостей — чистый HTML/CSS/JS.</p>
  `;

  wrap.appendChild(card);
  root.appendChild(wrap);
}
