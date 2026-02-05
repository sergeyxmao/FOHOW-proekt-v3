# Board Comments (Комментарии)

## Описание

Компонент комментариев позволяет пользователям оставлять, редактировать и удалять текстовые комментарии. Комментарии являются общими для всех досок пользователя, а не привязаны к конкретной доске.

## Файлы

| Файл | Назначение |
|---|---|
| `src/components/Panels/BoardComments.vue` | UI-компонент панели комментариев |
| `src/components/Panels/boardComments.js` | Pinia store для управления состоянием комментариев |

## Локализация

Ключ `discussionMenu.boardComments` используется для заголовка панели:

| Язык | Ключ | Значение |
|---|---|---|
| RU | `discussionMenu.boardComments` | Комментарии |
| EN | `discussionMenu.boardComments` | Comments |
| ZH | `discussionMenu.boardComments` | 评论 |

Файлы локалей: `src/locales/ru.js`, `src/locales/en.js`, `src/locales/zh.js`.

## История изменений

- **2026-02-05**: Переименование "Комментарии к доске" -> "Комментарии", исправлен хардкод заголовка на i18n
