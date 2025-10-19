// !!! Файл ДОЛЖЕН быть сохранён в UTF-8 (не UTF-16) !!!
// Получить SHA-256: открой F12 → Console и выполни:
/*
(async (s)=>{
  const hex = Array.from(new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  )).map(b=>b.toString(16).padStart(2,'0')).join('');
  console.log(hex);
})('ВАШ_ПАРОЛЬ');
*/

export const AUTH_STORAGE_KEY = "fohow.auth.v1";
// ВСТАВЬ сюда свой hex из консоли. Пример: "9c1185a5c5e9fc54612808977ee8f548b2258d31"
export const AUTH_EXPECTED_HASH = "5b33003a928495b97792ac286d477b54dd20eb773c74ae2fb3653bc5950ad6dd";
