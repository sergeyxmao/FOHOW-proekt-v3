<script setup>
import { ref, computed } from 'vue'

const activeChannel = ref('telegram')
const selectedId = ref(null)

const telegramTemplates = [
  {
    id: 'welcome',
    name: 'Приветствие',
    trigger: 'Регистрация нового пользователя',
    params: ['userName', 'demoDays', 'dashboardUrl'],
    preview: `Здравствуйте, *Иван*!

Рады видеть вас! 🚀

Мы активировали для вас *7‑дневный демо‑доступ* с полным набором премиум‑функций.

✨ *Что вы получаете:*

• Безлимитные доски
• Безлимитное количество лицензий на одной доске
• Безлимитное количество заметок на одной доске
• Безлимитное количество стикеров на одной доске
• Безлимитные комментарии
• Библиотеку изображений с возможностью создать свою собственную библиотеку
• Скачать доску (структуру) как изображение (в формате A4, A3, A2, A1)
• Поделиться доской (структурой) как веб‑страницей
• Дублирование досок
• Режим рисования`,
    buttons: ['🚀 Перейти в личный кабинет', '📢 MarketingFohow']
  },
  {
    id: 'subscription-expiring',
    name: 'Подписка истекает',
    trigger: 'Cron: ежедневно 09:00 МСК (за 7, 3, 1 день)',
    params: ['userName', 'daysLeft', 'expirationDate', 'renewUrl'],
    preview: `Здравствуйте, *Иван*!

Ваша подписка скоро заканчивается!

🗓 *Осталось:* 3 дня
📅 *Дата окончания:* 15.03.2026

Продлите подписку сейчас, чтобы не потерять доступ к премиум‑функциям! 🚀`,
    buttons: ['🔄 Продлить подписку', '📢 MarketingFohow']
  },
  {
    id: 'subscription-expired',
    name: 'Подписка истекла',
    trigger: 'Cron: ежедневно 01:00 МСК',
    params: ['userName', 'pricingUrl'],
    preview: `🧾 Здравствуйте, *Иван*!

К сожалению, срок действия вашей премиум‑подписки истёк.

🪪 *Переход на гостевой тариф*
Ваш аккаунт автоматически переведён на гостевой тариф.

✅ *Что сейчас доступно:*
• До 3‑х досок
• До 10 стикеров
• До 10 заметок и комментариев
• Скачать доску (структуру) как изображение (в формате A4)

⭐ *Хотите вернуть все возможности?*`,
    buttons: ['⭐ Выбрать тариф', '📢 MarketingFohow']
  },
  {
    id: 'subscription-activated-premium',
    name: 'Подписка активирована (Премиум)',
    trigger: 'Оплата через Tribute',
    params: ['userName', 'planName', 'amount', 'currency', 'expiresDate'],
    preview: `✅ *Подписка активирована!*

Здравствуйте, *Иван*!

🙏 Спасибо за оплату!

━━━━━━━━━━━━━━━━━━━━
🧾 *Детали подписки:*
💎 Тариф: *Премиум*
💰 Стоимость: *990 RUB*
📅 Действует до: *15.04.2026*
━━━━━━━━━━━━━━━━━━━━

🚀 *Ваши возможности:*
• Безлимитное количество досок
• Безлимитное количество стикеров
• Безлимитное количество заметок и комментариев
• До 100 папок
• Библиотека изображений
• Скачать доску (структуру) как изображение (в формате A4, A3, A2, A1)
• Поделиться доской (структурой) как веб‑страницей
• Дублирование досок
• Режим рисования`,
    buttons: ['👤 В профиль', '📢 MarketingFohow']
  },
  {
    id: 'subscription-activated-individual',
    name: 'Подписка активирована (Индивидуальный)',
    trigger: 'Оплата через Tribute',
    params: ['userName', 'planName', 'amount', 'currency', 'expiresDate'],
    preview: `✅ *Подписка активирована!*

Здравствуйте, *Иван*!

🙏 Спасибо за оплату!

━━━━━━━━━━━━━━━━━━━━
🧾 *Детали подписки:*
💎 Тариф: *Индивидуальный*
💰 Стоимость: *490 RUB*
📅 Действует до: *15.04.2026*
━━━━━━━━━━━━━━━━━━━━

🚀 *Ваши возможности:*
• До 18 интерактивных досок
• До 100 стикеров
• До 100 заметок и комментариев
• До 9 папок
• Библиотека изображений
• Скачать доску (структуру) как изображение (в формате A4, A3, A2, A1)
• Поделиться доской (структурой) как веб‑страницей
• Дублирование досок
• Режим рисования`,
    buttons: ['👤 В профиль', '📢 MarketingFohow']
  },
  {
    id: 'subscription-renewed-premium',
    name: 'Подписка продлена (Премиум)',
    trigger: 'Автоматическое продление через Tribute',
    params: ['userName', 'planName', 'amount', 'currency', 'expiresDate'],
    preview: `🧩 *Подписка продлена!*

Здравствуйте, *Иван*!

Оплата успешно прошла. ✅

━━━━━━━━━━━━━━━━━━━━
💎 Тариф: *Премиум*
💰 Сумма: *990 RUB*
📅 Действует до: *15.05.2026*
━━━━━━━━━━━━━━━━━━━━

🚀 *Ваши возможности:*
• Безлимитное количество досок
• Безлимитное количество стикеров
• Безлимитное количество заметок и комментариев
• До 100 папок
• Библиотека изображений
• Скачать доску (структуру) как изображение (в формате A4, A3, A2, A1)
• Поделиться доской (структурой) как веб‑страницей
• Дублирование досок
• Режим рисования`,
    buttons: ['👤 В профиль', '📢 MarketingFohow']
  },
  {
    id: 'subscription-renewed-individual',
    name: 'Подписка продлена (Индивидуальный)',
    trigger: 'Автоматическое продление через Tribute',
    params: ['userName', 'planName', 'amount', 'currency', 'expiresDate'],
    preview: `🧩 *Подписка продлена!*

Здравствуйте, *Иван*!

Оплата успешно прошла. ✅

━━━━━━━━━━━━━━━━━━━━
💎 Тариф: *Индивидуальный*
💰 Сумма: *490 RUB*
📅 Действует до: *15.05.2026*
━━━━━━━━━━━━━━━━━━━━

🚀 *Ваши возможности:*
• До 18 интерактивных досок
• До 100 стикеров
• До 100 заметок и комментариев
• До 9 папок
• Библиотека изображений
• Скачать доску (структуру) как изображение (в формате A4, A3, A2, A1)
• Поделиться доской (структурой) как веб‑страницей
• Дублирование досок
• Режим рисования`,
    buttons: ['👤 В профиль', '📢 MarketingFohow']
  },
  {
    id: 'promo-applied',
    name: 'Промокод применён',
    trigger: 'Активация промокода',
    params: ['userName', 'promoCode', 'planName', 'expiresDate'],
    preview: `✅ *Промокод DEMO2026 применён!*

Здравствуйте, *Иван*!

━━━━━━━━━━━━━━━━━━━━
💎 Тариф: *Индивидуальный*
💰 Стоимость: *0 RUB (Промокод)*
📅 Действует до: *15.04.2026*
━━━━━━━━━━━━━━━━━━━━

Приятной работы! 🎨`,
    buttons: ['👤 В профиль', '📢 MarketingFohow']
  },
  {
    id: 'verification-approved',
    name: 'Верификация одобрена',
    trigger: 'Одобрение заявки администратором',
    params: ['personalId', 'profileUrl'],
    preview: `✅ Поздравляем! Ваша заявка на верификацию одобрена!

⭐ Компьютерный номер 123456 успешно верифицирован.

Теперь ваш профиль отмечен значком верификации.`,
    buttons: ['👤 В профиль', '📢 MarketingFohow']
  },
  {
    id: 'verification-revoked',
    name: 'Верификация снята',
    trigger: 'Изменение компьютерного номера',
    params: ['profileUrl'],
    preview: `⚠️ Ваш статус верификации был снят из-за изменения компьютерного номера или представительства.`,
    buttons: ['👤 В профиль', '📢 MarketingFohow']
  },
  {
    id: 'verification-auto-rejected',
    name: 'Верификация авто-отклонена',
    trigger: 'Номер уже верифицирован другим',
    params: ['personalId', 'profileUrl'],
    preview: `❌ Ваша заявка на верификацию отклонена

Номер 123456 уже верифицирован другим пользователем.

Если это ваш номер, обратитесь в поддержку.`,
    buttons: ['📞 Поддержка', '👤 В профиль', '📢 MarketingFohow']
  },
  {
    id: 'verification-rejected',
    name: 'Верификация отклонена',
    trigger: 'Отклонение заявки администратором',
    params: ['rejectionReason', 'profileUrl'],
    preview: `❌ Ваша заявка на верификацию отклонена

Причина: Данные не соответствуют требованиям.

Вы можете подать новую заявку через 24 часа.`,
    buttons: ['👤 В профиль', '📢 MarketingFohow']
  },
  {
    id: 'telegram-disconnected',
    name: 'Telegram отключён',
    trigger: 'Пользователь отвязал Telegram',
    params: ['userName', 'profileUrl'],
    preview: `🔕 *Уведомления отключены*

Здравствуйте, *Иван*!

⚠️ *Теперь вы не будете получать:*
• Напоминания о сроках подписки
• Уведомления о продлении
• Информацию об истечении
• Важные обновления

💡 Включите снова в настройках профиля.`,
    buttons: ['👤 В профиль', '📢 MarketingFohow']
  }
]

const emailTemplates = [
  {
    id: 'email-welcome',
    name: 'Приветствие',
    trigger: 'Регистрация',
    subject: 'Добро пожаловать в FOHOW',
    params: ['userName', 'demoDays', 'dashboardUrl'],
    headerEmoji: '🚀', headerText: 'Рады видеть вас!',
    sections: [
      { type: 'text', content: 'Мы активировали для вас 7‑дневный демо‑доступ с полным набором премиум‑функций.' },
      { type: 'list', title: '✨ Что вы получаете:', items: ['Безлимитные доски', 'Безлимитное количество лицензий на одной доске', 'Безлимитное количество заметок на одной доске', 'Безлимитное количество стикеров на одной доске', 'Безлимитные комментарии', 'Библиотеку изображений с возможностью создать свою собственную библиотеку', 'Скачать доску (структуру) как изображение (в формате A4, A3, A2, A1)', 'Поделиться доской (структурой) как веб‑страницей', 'Дублирование досок', 'Режим рисования'] },
      { type: 'button', text: '🚀 Перейти в личный кабинет' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-verification-code',
    name: 'Код подтверждения',
    trigger: 'Подтверждение email',
    subject: 'Код подтверждения — FOHOW',
    params: ['code'],
    headerEmoji: '✉️', headerText: 'Подтверждение Email',
    sections: [
      { type: 'text', content: 'Ваш код подтверждения:' },
      { type: 'code', content: '482 916' },
      { type: 'text', content: 'Код действителен 10 минут.' }
    ]
  },
  {
    id: 'email-password-reset',
    name: 'Сброс пароля',
    trigger: 'Запрос восстановления',
    subject: 'Сброс пароля — FOHOW',
    params: ['resetUrl'],
    headerEmoji: '🔑', headerText: 'Сброс пароля',
    sections: [
      { type: 'text', content: 'Вы запросили восстановление доступа к учётной записи.' },
      { type: 'button', text: 'Сбросить пароль' },
      { type: 'text', content: 'Ссылка действует 1 час.' }
    ]
  },
  {
    id: 'email-password-changed',
    name: 'Пароль изменён',
    trigger: 'Смена пароля',
    subject: '🔐 Пароль изменён',
    params: ['formattedDate', 'locationString'],
    headerEmoji: '🔐', headerText: 'Пароль изменён',
    sections: [
      { type: 'text', content: 'Ваш пароль был успешно изменён.' },
      { type: 'table', rows: [['Дата:', '11.02.2026 14:30 (МСК)'], ['Место:', 'Москва, Россия']] },
      { type: 'warning', content: '⚠️ Если вы не меняли пароль, свяжитесь с поддержкой!' },
      { type: 'button', text: '📞 Поддержка' },
      { type: 'button', text: '👤 В профиль' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-sub-expiring',
    name: 'Подписка истекает',
    trigger: 'Cron: ежедневно 09:00',
    subject: 'Подписка истекает',
    params: ['userName', 'daysLeft', 'expirationDate', 'renewUrl'],
    headerEmoji: '⏰', headerText: 'FOHOW',
    sections: [
      { type: 'text', content: 'Ваша подписка скоро заканчивается!' },
      { type: 'highlight', color: '#e53e3e', title: '🗓 Осталось: 3 дня', content: '📅 Дата окончания: 15.03.2026' },
      { type: 'text', content: 'Продлите подписку сейчас, чтобы не потерять доступ к премиум‑функциям! 🚀' },
      { type: 'button', text: '🔄 Продлить подписку' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-sub-expired',
    name: 'Подписка истекла',
    trigger: 'Cron: ежедневно 01:00',
    subject: 'Подписка истекла',
    params: ['userName', 'pricingUrl'],
    headerEmoji: '🧾', headerText: 'FOHOW',
    sections: [
      { type: 'text', content: 'К сожалению, срок действия вашей премиум‑подписки истёк.' },
      { type: 'highlight', color: '#667eea', title: '🪪 Переход на гостевой тариф', content: 'Ваш аккаунт автоматически переведён на гостевой тариф.' },
      { type: 'list', title: '✅ Что сейчас доступно:', items: ['До 3‑х досок', 'До 10 стикеров', 'До 10 заметок и комментариев', 'Скачать доску (структуру) как изображение (в формате A4)'] },
      { type: 'text', content: '⭐ Хотите вернуть все возможности?' },
      { type: 'button', text: '⭐ Выбрать тариф' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-sub-new-premium',
    name: 'Подписка активирована (Премиум)',
    trigger: 'Оплата через Tribute',
    subject: '✅ Подписка активирована',
    params: ['userName', 'planName', 'amount', 'currency', 'expiresDate'],
    headerEmoji: '✅', headerText: 'Подписка активирована!',
    sections: [
      { type: 'text', content: '🙏 Спасибо за оплату!' },
      { type: 'table', rows: [['💎 Тариф:', 'Премиум'], ['💰 Стоимость:', '990 RUB'], ['📅 Действует до:', '15.04.2026']] },
      { type: 'list', title: '🚀 Ваши возможности:', items: ['Безлимитное количество досок', 'Безлимитное количество стикеров', 'Безлимитное количество заметок и комментариев', 'До 100 папок', 'Библиотека изображений', 'Скачать доску (структуру) как изображение (в формате A4, A3, A2, A1)', 'Поделиться доской (структурой) как веб‑страницей', 'Дублирование досок', 'Режим рисования'] },
      { type: 'button', text: '👤 В профиль' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-sub-new-individual',
    name: 'Подписка активирована (Индивидуальный)',
    trigger: 'Оплата через Tribute',
    subject: '✅ Подписка активирована',
    params: ['userName', 'planName', 'amount', 'currency', 'expiresDate'],
    headerEmoji: '✅', headerText: 'Подписка активирована!',
    sections: [
      { type: 'text', content: '🙏 Спасибо за оплату!' },
      { type: 'table', rows: [['💎 Тариф:', 'Индивидуальный'], ['💰 Стоимость:', '490 RUB'], ['📅 Действует до:', '15.04.2026']] },
      { type: 'list', title: '🚀 Ваши возможности:', items: ['До 18 интерактивных досок', 'До 100 стикеров', 'До 100 заметок и комментариев', 'До 9 папок', 'Библиотека изображений', 'Скачать доску (структуру) как изображение (в формате A4, A3, A2, A1)', 'Поделиться доской (структурой) как веб‑страницей', 'Дублирование досок', 'Режим рисования'] },
      { type: 'button', text: '👤 В профиль' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-sub-renewed-premium',
    name: 'Подписка продлена (Премиум)',
    trigger: 'Автопродление',
    subject: '🧩 Подписка продлена',
    params: ['userName', 'planName', 'amount', 'currency', 'expiresDate'],
    headerEmoji: '🧩', headerText: 'Подписка продлена!',
    sections: [
      { type: 'text', content: 'Оплата успешно прошла. ✅' },
      { type: 'table', rows: [['💎 Тариф:', 'Премиум'], ['💰 Сумма:', '990 RUB'], ['📅 Действует до:', '15.05.2026']] },
      { type: 'list', title: '🚀 Ваши возможности:', items: ['Безлимитное количество досок', 'Безлимитное количество стикеров', 'Безлимитное количество заметок и комментариев', 'До 100 папок', 'Библиотека изображений', 'Скачать доску (структуру) как изображение (в формате A4, A3, A2, A1)', 'Поделиться доской (структурой) как веб‑страницей', 'Дублирование досок', 'Режим рисования'] },
      { type: 'button', text: '👤 В профиль' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-sub-renewed-individual',
    name: 'Подписка продлена (Индивидуальный)',
    trigger: 'Автопродление',
    subject: '🧩 Подписка продлена',
    params: ['userName', 'planName', 'amount', 'currency', 'expiresDate'],
    headerEmoji: '🧩', headerText: 'Подписка продлена!',
    sections: [
      { type: 'text', content: 'Оплата успешно прошла. ✅' },
      { type: 'table', rows: [['💎 Тариф:', 'Индивидуальный'], ['💰 Сумма:', '490 RUB'], ['📅 Действует до:', '15.05.2026']] },
      { type: 'list', title: '🚀 Ваши возможности:', items: ['До 18 интерактивных досок', 'До 100 стикеров', 'До 100 заметок и комментариев', 'До 9 папок', 'Библиотека изображений', 'Скачать доску (структуру) как изображение (в формате A4, A3, A2, A1)', 'Поделиться доской (структурой) как веб‑страницей', 'Дублирование досок', 'Режим рисования'] },
      { type: 'button', text: '👤 В профиль' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-sub-promo',
    name: 'Промокод применён',
    trigger: 'Активация промокода',
    subject: '✅ Промокод применён',
    params: ['userName', 'promoCode', 'planName', 'expiresDate'],
    headerEmoji: '✅', headerText: 'Промокод применён!',
    sections: [
      { type: 'text', content: 'Промокод DEMO2026 успешно активирован.' },
      { type: 'table', rows: [['Тариф:', 'Индивидуальный'], ['Стоимость:', '0 RUB'], ['До:', '15.04.2026']] },
      { type: 'button', text: '👤 В профиль' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-verif-approved',
    name: 'Верификация одобрена',
    trigger: 'Одобрение администратором',
    subject: 'Верификация одобрена',
    params: ['userName', 'personalId', 'profileUrl'],
    headerEmoji: '✅', headerText: 'FOHOW',
    sections: [
      { type: 'highlight', color: '#48bb78', title: '🎉 Поздравляем!', content: 'Номер 123456 верифицирован.' },
      { type: 'text', content: 'Ваш профиль отмечен значком верификации.' },
      { type: 'button', text: '👤 В профиль' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-verif-revoked',
    name: 'Верификация снята',
    trigger: 'Изменение номера',
    subject: 'Верификация снята',
    params: ['userName', 'profileUrl'],
    headerEmoji: '⚠️', headerText: 'FOHOW',
    sections: [
      { type: 'highlight', color: '#ed8936', title: '', content: 'Статус верификации снят из-за изменения номера.' },
      { type: 'text', content: 'Вы можете подать новую заявку.' },
      { type: 'button', text: '👤 В профиль' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-verif-auto-rejected',
    name: 'Верификация авто-отклонена',
    trigger: 'Дубликат номера',
    subject: 'Заявка отклонена',
    params: ['userName', 'personalId', 'profileUrl'],
    headerEmoji: '❌', headerText: 'FOHOW',
    sections: [
      { type: 'highlight', color: '#e53e3e', title: '', content: 'Номер 123456 уже верифицирован другим пользователем.' },
      { type: 'button', text: '📞 Поддержка' },
      { type: 'button', text: '👤 В профиль' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  },
  {
    id: 'email-verif-rejected',
    name: 'Верификация отклонена',
    trigger: 'Отклонение администратором',
    subject: 'Заявка отклонена',
    params: ['userName', 'rejectionReason', 'profileUrl'],
    headerEmoji: '❌', headerText: 'FOHOW',
    sections: [
      { type: 'text', content: 'Заявка на верификацию отклонена.' },
      { type: 'highlight', color: '#ff9800', title: 'Причина:', content: 'Данные не соответствуют требованиям.' },
      { type: 'text', content: 'Новая заявка возможна через 24 часа.' },
      { type: 'button', text: '👤 В профиль' },
      { type: 'button', text: '📢 MarketingFohow' }
    ]
  }
]

const currentTemplates = computed(() =>
  activeChannel.value === 'telegram' ? telegramTemplates : emailTemplates
)

const selectedTemplate = computed(() => {
  if (!selectedId.value) return null
  return currentTemplates.value.find(t => t.id === selectedId.value) || null
})

const switchChannel = (ch) => {
  activeChannel.value = ch
  selectedId.value = null
}

const selectTemplate = (id) => {
  selectedId.value = id
}
</script>

<template>
  <div class="notif">
    <!-- Верхняя панель: переключатель каналов -->
    <div class="notif__top">
      <button
        :class="['notif__ch', { 'notif__ch--on': activeChannel === 'telegram' }]"
        @click="switchChannel('telegram')"
      >
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M21.543 2.47a1.25 1.25 0 0 0-1.303-.193L3.154 9.53c-.5.214-.82.7-.798 1.23.022.53.38.99.897 1.16l4.72 1.566 1.837 5.52c.18.54.68.905 1.25.923h.04c.56 0 1.06-.34 1.26-.86l1.68-4.32 4.66 3.54c.22.17.49.26.76.26.17 0 .34-.03.5-.1.39-.16.68-.5.78-.91l3.18-13.42c.13-.54-.12-1.1-.6-1.36Z" fill="currentColor"/></svg>
        TG ({{ telegramTemplates.length }})
      </button>
      <button
        :class="['notif__ch', { 'notif__ch--on': activeChannel === 'email' }]"
        @click="switchChannel('email')"
      >
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/></svg>
        Email ({{ emailTemplates.length }})
      </button>
    </div>

    <!-- Двухпанельный layout -->
    <div class="notif__panels">
      <!-- Левая панель: список -->
      <div class="notif__list">
        <button
          v-for="t in currentTemplates"
          :key="t.id"
          :class="['notif__item', { 'notif__item--on': selectedId === t.id }]"
          @click="selectTemplate(t.id)"
        >
          <span class="notif__item-name">{{ t.name }}</span>
          <span class="notif__item-trigger">{{ t.trigger }}</span>
        </button>
      </div>

      <!-- Правая панель: превью -->
      <div class="notif__preview">
        <template v-if="selectedTemplate">
          <!-- Метаданные -->
          <div class="notif__meta">
            <div class="notif__meta-row">
              <span class="notif__meta-label">Параметры:</span>
              <span v-for="p in selectedTemplate.params" :key="p" class="notif__tag">{{ p }}</span>
            </div>
            <div v-if="activeChannel === 'email' && selectedTemplate.subject" class="notif__meta-row">
              <span class="notif__meta-label">Тема:</span>
              <span class="notif__meta-val">{{ selectedTemplate.subject }}</span>
            </div>
          </div>

          <!-- Telegram превью -->
          <div v-if="activeChannel === 'telegram'" class="tg-wrap">
            <div class="tg-bubble">
              <pre class="tg-text">{{ selectedTemplate.preview }}</pre>
              <div v-if="selectedTemplate.buttons?.length" class="tg-buttons">
                <span v-for="b in selectedTemplate.buttons" :key="b" class="tg-btn">{{ b }}</span>
              </div>
            </div>
          </div>

          <!-- Email превью -->
          <div v-if="activeChannel === 'email'" class="em-wrap">
            <div class="em-box">
              <div class="em-header">
                <span class="em-header__emoji">{{ selectedTemplate.headerEmoji }}</span>
                <span class="em-header__title">{{ selectedTemplate.headerText }}</span>
              </div>
              <div class="em-content">
                <template v-for="(s, i) in selectedTemplate.sections" :key="i">
                  <p v-if="s.type === 'text'" class="em-text">{{ s.content }}</p>
                  <div v-if="s.type === 'highlight'" class="em-hl" :style="{ borderLeftColor: s.color }">
                    <strong v-if="s.title" class="em-hl__title" :style="{ color: s.color }">{{ s.title }}</strong>
                    <p class="em-hl__text">{{ s.content }}</p>
                  </div>
                  <div v-if="s.type === 'warning'" class="em-warn"><p>{{ s.content }}</p></div>
                  <div v-if="s.type === 'code'" class="em-code">{{ s.content }}</div>
                  <div v-if="s.type === 'list'" class="em-list-block">
                    <p v-if="s.title" class="em-list-title">{{ s.title }}</p>
                    <ul class="em-list"><li v-for="item in s.items" :key="item">{{ item }}</li></ul>
                  </div>
                  <table v-if="s.type === 'table'" class="em-table">
                    <tr v-for="row in s.rows" :key="row[0]">
                      <td class="em-table__l">{{ row[0] }}</td>
                      <td class="em-table__v">{{ row[1] }}</td>
                    </tr>
                  </table>
                  <div v-if="s.type === 'button'" class="em-btn-wrap">
                    <span class="em-btn">{{ s.text }}</span>
                  </div>
                </template>
              </div>
              <div class="em-footer">
                <p>С уважением, <strong>Команда MarketingFohow</strong></p>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="notif__empty">
          Выберите шаблон слева
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notif {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  min-height: 400px;
}

/* Верхняя панель */
.notif__top {
  display: flex;
  gap: 8px;
  padding-bottom: 12px;
  flex-shrink: 0;
}

.notif__ch {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: #fff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.notif__ch:hover {
  border-color: rgba(255, 193, 7, 0.5);
}

.notif__ch--on {
  background: #ffc107;
  color: #000;
  border-color: rgba(255, 193, 7, 0.8);
}

/* Двухпанельный layout */
.notif__panels {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

/* Левая панель */
.notif__list {
  width: 240px;
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,0.1) transparent;
}

.notif__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: rgba(15, 23, 42, 0.03);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.notif__item:hover {
  background: rgba(255, 193, 7, 0.08);
  border-color: rgba(255, 193, 7, 0.3);
}

.notif__item--on {
  background: rgba(255, 193, 7, 0.12);
  border-color: #ffc107;
}

.notif__item-name {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}

.notif__item-trigger {
  font-size: 11px;
  color: #64748b;
  line-height: 1.3;
}

/* Правая панель */
.notif__preview {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,0.1) transparent;
}

.notif__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 14px;
  color: #94a3b8;
}

/* Метаданные */
.notif__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.notif__meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.notif__meta-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}

.notif__tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 193, 7, 0.12);
  color: #92400e;
  font-family: monospace;
}

.notif__meta-val {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
}

/* Telegram */
.tg-wrap {
  padding: 14px;
  background: #e5ddd5;
  border-radius: 10px;
}

.tg-bubble {
  max-width: 440px;
  background: #fff;
  border-radius: 0 10px 10px 10px;
  padding: 8px 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.tg-text {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.45;
  color: #111;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.tg-buttons {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(0,0,0,0.06);
}

.tg-btn {
  display: block;
  text-align: center;
  padding: 5px 10px;
  border-radius: 5px;
  background: rgba(0, 136, 204, 0.08);
  color: #0088cc;
  font-size: 12px;
  font-weight: 600;
}

/* Email */
.em-wrap {
  padding: 12px;
  background: #f7fafc;
  border-radius: 10px;
}

.em-box {
  max-width: 460px;
  margin: 0 auto;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
}

.em-header {
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  padding: 20px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.em-header__emoji { font-size: 22px; }
.em-header__title { color: #3a2800; font-size: 16px; font-weight: 700; }

.em-content { padding: 20px 18px; }

.em-text {
  font-size: 13px;
  line-height: 1.5;
  color: #4a5568;
  margin: 0 0 10px 0;
}

.em-hl {
  background: #f7fafc;
  border-left: 3px solid #667eea;
  padding: 10px 12px;
  margin: 10px 0;
  border-radius: 0 5px 5px 0;
}

.em-hl__title { display: block; font-size: 13px; margin-bottom: 4px; }
.em-hl__text { font-size: 12px; color: #2d3748; margin: 0; line-height: 1.4; }

.em-warn {
  background: #fff3cd;
  padding: 10px 12px;
  border-radius: 6px;
  border-left: 3px solid #ffc107;
  margin: 10px 0;
}

.em-warn p { font-size: 12px; color: #664d03; margin: 0; line-height: 1.4; }

.em-code {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 8px;
  color: #4CAF50;
  text-align: center;
  margin: 16px 0;
}

.em-list-block { margin: 10px 0; }
.em-list-title { font-size: 13px; font-weight: 600; color: #2d3748; margin: 0 0 6px 0; }
.em-list { font-size: 12px; color: #4a5568; line-height: 1.7; margin: 0; padding-left: 18px; }

.em-table {
  width: 100%;
  margin: 10px 0;
  background: #f9f9f9;
  border-radius: 6px;
  border-collapse: collapse;
}

.em-table td { padding: 6px 12px; font-size: 12px; }
.em-table__l { color: #64748b; }
.em-table__v { font-weight: 700; color: #0f172a; }

.em-btn-wrap { text-align: center; margin: 14px 0; }

.em-btn {
  display: inline-block;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #3a2800;
  padding: 8px 22px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
}

.em-footer {
  background: #f7fafc;
  padding: 14px 18px;
  text-align: center;
  border-top: 1px solid #e2e8f0;
}

.em-footer p { font-size: 12px; color: #718096; margin: 0; }
</style>
