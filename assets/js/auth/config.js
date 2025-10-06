// ВАЖНО: замените значение ниже на реальный SHA-256 (hex) вашего пароля
// Как получить (в консоли браузера):
// (async (s)=>{const hex=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');console.log(hex);})('ВАШ_ПАРОЛЬ')

export const AUTH_STORAGE_KEY = "fohow.auth.v1";
export const AUTH_EXPECTED_HASH = "5b33003a928495b97792ac286d477b54dd20eb773c74ae2fb3653bc5950ad6dd
";
