# Настройка аутентификации почты (SPF/DKIM/DMARC)

> **Дата настройки:** 2 февраля 2026
> **Домен:** marketingfohow.ru
> **Почтовый ящик:** noreply@marketingfohow.ru
> **SMTP-сервер:** smtp.beget.com (Beget хостинг)

---

## Зачем это нужно

Без настройки SPF, DKIM и DMARC письма с домена `marketingfohow.ru` попадали в спам у получателей. Эти три механизма позволяют почтовым сервисам (Gmail, Яндекс, Mail.ru) проверить подлинность отправителя.

| Технология | Назначение |
|------------|-----------|
| **SPF** | Указывает, какие серверы имеют право отправлять почту от имени домена |
| **DKIM** | Добавляет цифровую подпись к каждому письму для проверки целостности |
| **DMARC** | Определяет политику обработки писем, не прошедших проверку SPF/DKIM |

---

## Текущие DNS-записи

### SPF (была настроена ранее)

```
Тип: TXT
Хост: marketingfohow.ru
Значение: v=spf1 redirect=beget.com
```

### DKIM (включена поддержкой Beget)

```
Тип: TXT
Хост: beget._domainkey.marketingfohow.ru
Значение: v=DKIM1;k=rsa;t=s;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDYnrKeY9ZXyO9RzUFxI5V59C/UI46qanNAqDpAmoyt8wmeTa+2D2Q9gjHphp+Bp0FbPFh1T9ag7GZapaWIq1u0JTs0962uXQL1OIcSFUCKg4KtBHWPW2b2IauIeNxV34NKZpucTlte3vPZA7weR1ht99tLGjpHsUh61MdXvcabzQIDAQAB
```

**Селектор DKIM:** `beget`

### DMARC (добавлена вручную)

```
Тип: TXT
Хост: _dmarc.marketingfohow.ru
Значение: v=DMARC1; p=none; rua=mailto:noreply@marketingfohow.ru
```

**Политика:** `p=none` — мягкая (письма доставляются, отчёты присылаются на указанный email)

---

## Где управляются записи

- **Панель управления:** https://cp.beget.com
- **Раздел:** Домены и поддомены → marketingfohow.ru → Редактировать DNS
- **DKIM:** Включается только через поддержку Beget (тикет в разделе "Помощь и поддержка")

---

## Проверка работоспособности

### Онлайн-сервисы

| Что проверить | Ссылка |
|---------------|--------|
| SPF | https://mxtoolbox.com/spf.aspx → ввести `marketingfohow.ru` |
| DKIM | https://mxtoolbox.com/dkim.aspx → домен `marketingfohow.ru`, селектор `beget` |
| DMARC | https://mxtoolbox.com/dmarc.aspx → ввести `marketingfohow.ru` |

### Командная строка

```bash
# Проверка SPF
nslookup -type=txt marketingfohow.ru

# Проверка DKIM
nslookup -type=txt beget._domainkey.marketingfohow.ru

# Проверка DMARC
nslookup -type=txt _dmarc.marketingfohow.ru
```

### Проверка письма

1. Отправить письмо с платформы (регистрация, сброс пароля) на Gmail
2. Открыть письмо → три точки → "Показать оригинал"
3. Проверить заголовки:
   - `SPF: PASS`
   - `DKIM: PASS`
   - `DMARC: PASS`

---

## Конфигурация почты в проекте

**Файл:** `api/.env`

```env
EMAIL_HOST=smtp.beget.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=noreply@marketingfohow.ru
EMAIL_PASSWORD=<пароль от ящика>
EMAIL_FROM=noreply@marketingfohow.ru
```

**Сервис отправки:** `api/utils/email.js`, `api/utils/emailService.js`

---

## Возможные улучшения (на будущее)

### Ужесточение DMARC-политики

После 2-4 недель стабильной работы можно изменить политику:

```
# Текущая (мягкая)
v=DMARC1; p=none; rua=mailto:noreply@marketingfohow.ru

# Средняя (подозрительные письма в спам)
v=DMARC1; p=quarantine; rua=mailto:noreply@marketingfohow.ru

# Строгая (подозрительные письма отклоняются)
v=DMARC1; p=reject; rua=mailto:noreply@marketingfohow.ru
```

Изменение делается в DNS: _dmarc.marketingfohow.ru → редактировать TXT-запись.

---

## Troubleshooting

### Письма всё ещё попадают в спам

1. Проверить заголовки письма — все три проверки должны быть PASS
2. Проверить репутацию IP: https://mxtoolbox.com/blacklists.aspx
3. Убедиться что EMAIL_FROM совпадает с реальным доменом

### DKIM перестал работать

1. Проверить запись: `nslookup -type=txt beget._domainkey.marketingfohow.ru`
2. Если запись пропала — написать в поддержку Beget

### Нужно изменить DKIM

Только через поддержку Beget — самостоятельно изменить нельзя.

---

## История изменений

| Дата | Изменение |
|------|-----------|
| 02.02.2026 | Добавлена DMARC-запись, включён DKIM через поддержку Beget |
