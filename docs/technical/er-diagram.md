# ER-диаграмма базы данных

## Описание
Интерактивная визуализация структуры базы данных FOHOW Interactive Board (33 таблицы, 47 связей).

## Расположение файлов
- Исходный файл: docs/er-diagram.html
- Публичная копия: public/er-diagram.html
- Вкладка в админке: src/views/AdminPanel.vue (вкладка "ER-диаграмма")

## Как использовать
1. Войти в админ-панель (/admin)
2. Перейти на вкладку "ER-диаграмма"
3. Навигация: колесо мыши — масштаб, перетаскивание фона — перемещение
4. Перетаскивание таблиц — переставить
5. Наведение на таблицу — подсветка всех связей
6. Фильтры вверху — показать только определённую группу таблиц
7. Поиск — найти таблицу по имени

## Группы таблиц
- Ядро (синий): users, subscription_plans, favorites, relationships, user_verifications
- Доски (зелёный): boards, board_folders, board_folder_items, board_anchors, stickers, notes, user_comments
- Подписки (фиолетовый): tribute_subscriptions, subscription_history, demo_trials, promo_codes, promo_code_usages, pending_tribute_webhooks
- Чат (оранжевый): fogrup_chats, fogrup_chat_participants, fogrup_messages, fogrup_notifications
- Изображения (розовый): image_library, shared_folders, image_rename_audit
- Системные (серый): active_sessions, feature_usage, email_verification_codes, verified_emails, password_resets, telegram_link_codes, system_logs, personal_id_counter

## Технические детали
- Полностью автономный HTML-файл (inline CSS + JS, без зависимостей)
- SVG-рендеринг с программной отрисовкой
- Данные захардкожены (при изменении структуры БД — обновить вручную)

## Обновление при изменениях в БД
При добавлении/изменении таблиц нужно обновить объект данных в файле er-diagram.html

## История изменений
- 2026-02-07: Создана ER-диаграмма (33 таблицы, 47 связей)
