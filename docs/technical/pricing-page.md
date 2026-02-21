# Pricing Page (Страница тарифов)

## Обзор

Публичная страница тарифных планов. Загружает данные из API `/api/plans`, отображает карточки с ценами, функциями и кнопками действий. Доступна без авторизации.

## Файлы

- **[src/views/PricingPage.vue](../../src/views/PricingPage.vue)** — страница с карточками тарифов
- **[src/composables/useUserTariffs.js](../../src/composables/useUserTariffs.js)** — логика форматирования фич, кнопок, оплаты
- **[api/routes/plans.js](../../api/routes/plans.js)** — API эндпоинт `GET /api/plans`

## Источник данных

Все тарифы загружаются из API `GET /api/plans` (таблица `subscription_plans`, `is_public = true`). Хардкод-заглушки отсутствуют — если тариф не возвращается API, он не отображается.

### Поля тарифа из API

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | integer | ID тарифа |
| `name` | string | Название (Гость, Демо, Индивидуальный, Премиум) |
| `code_name` | string | Код (guest, demo, individual, premium) |
| `description` | string? | Описание тарифа |
| `price_monthly` | number? | Цена за месяц |
| `price_yearly` | number? | Цена за год |
| `price_original` | number? | Зачёркнутая цена (старая/рекомендованная) |
| `features` | object | Объект с функциями тарифа |
| `display_order` | integer | Порядок отображения |
| `is_public` | boolean | Публичный ли тариф |

## Функции (features)

### Актуальные фичи в featureLabels

| Ключ | Тип | Описание |
|------|-----|----------|
| `max_boards` | number | Макс. досок (-1 = безлимит) |
| `max_licenses` | number | Макс. лицензий на доске |
| `max_notes` | number | Макс. заметок |
| `max_stickers` | number | Макс. стикеров |
| `max_comments` | number | Макс. комментариев |
| `can_export_png_formats` | array/boolean | Форматы экспорта PNG (["A4", "A3"]) |
| `can_export_html` | boolean/string | Экспорт как веб-страница |
| `can_invite_drawing` | boolean | Режим рисования |
| `can_use_images` | boolean | Библиотека изображений |
| `can_duplicate_boards` | boolean | Дублирование досок |

### Разделение на primary/secondary

- **Primary** (всегда видны): `max_boards`, `max_licenses`, `max_notes`, `max_stickers`
- **Secondary** (раскрываются по кнопке «Подробнее»): `max_comments`, `can_export_png_formats`, `can_export_html`, `can_invite_drawing`, `can_use_images`, `can_duplicate_boards`

## Зачёркнутые цены

Если у тарифа задано поле `price_original` и оно больше `price_monthly`, над текущей ценой отображается зачёркнутая старая цена. Используется для акций и скидок.

```html
<div v-if="plan.price_original && plan.price_original > (plan.price_monthly || 0)" class="plan-price-original">
  <span class="plan-price-original-amount">{{ plan.price_original }}</span>
  <span class="plan-price-original-currency">₽</span>
</div>
```

## Кнопки действий

Логика кнопок определяется в `useUserTariffs.js → getPlanButtonState()`:

- **Guest/Demo** — кнопка не отображается
- **Апгрейд** — разрешён всегда
- **Продление** — доступно за 30 дней до окончания
- **Даунгрейд** — доступен за 30 дней до окончания (отложенная активация)
- **Запланированный тариф** — блокирует все покупки

## См. также

- [docs/technical/composables.md](./composables.md) — документация по composables
- [api/routes/plans.js](../../api/routes/plans.js) — API эндпоинт

## История изменений

### 2026-02-21
- Удалён хардкод-заглушка Demo-плана — теперь загружается из API (`is_public = true` в БД)
- Добавлено отображение зачёркнутых цен (`price_original`)
- API `GET /api/plans` теперь возвращает поле `price_original`
- Удалены мёртвые фичи из `featureLabels` и `importantFeatures` (ранее)
- Актуальный список фич: max_boards, max_licenses, max_notes, max_stickers, max_comments, can_export_png_formats, can_export_html, can_invite_drawing, can_use_images, can_duplicate_boards
