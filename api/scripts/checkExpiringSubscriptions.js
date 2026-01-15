import { pool } from '../db.js';
import { sendTelegramMessage } from '../utils/telegramService.js';
import { getSubscriptionExpiringMessage } from '../templates/telegramTemplates.js';

/**
 * Проверка истекающих подписок и отправка уведомлений
 * Отправляет за 7, 3 и 1 день до истечения
 */
async function checkExpiringSubscriptions() {
  console.log('\n🔍 Проверка истекающих подписок...', new Date().toISOString());

  try {
    // Найти подписки, истекающие через 7, 3 или 1 день
    const result = await pool.query(`
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.telegram_chat_id,
        u.subscription_expires_at,
        sp.name as plan_name,
        CEIL(EXTRACT(EPOCH FROM (u.subscription_expires_at - NOW())) / 86400) as days_left
      FROM users u
      JOIN subscription_plans sp ON u.plan_id = sp.id
      WHERE 
        u.telegram_chat_id IS NOT NULL
        AND u.subscription_expires_at IS NOT NULL
        AND u.subscription_expires_at > NOW()
        AND sp.code_name != 'guest'
        AND CEIL(EXTRACT(EPOCH FROM (u.subscription_expires_at - NOW())) / 86400) IN (7, 3, 1)
    `);

    if (result.rows.length === 0) {
      console.log('✅ Нет подписок, требующих уведомления');
      return;
    }

    console.log(`📋 Найдено подписок для уведомления: ${result.rows.length}`);

    // Отправить уведомления
    for (const user of result.rows) {
      const daysLeft = Math.ceil(user.days_left);
      
      console.log(`\n👤 ${user.full_name} (${user.email})`);
      console.log(`   Осталось дней: ${daysLeft}`);
      console.log(`   План: ${user.plan_name}`);

      try {
        const expiresDate = new Date(user.subscription_expires_at)
          .toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });

        const message = getSubscriptionExpiringMessage(
          user.full_name || 'Пользователь',
          daysLeft,
          expiresDate,
          process.env.FRONTEND_URL + '/pricing'
        );

        await sendTelegramMessage(user.telegram_chat_id, message.text, {
          parse_mode: message.parse_mode,
          reply_markup: message.reply_markup
        });

        console.log(`   ✅ Уведомление отправлено`);

      } catch (error) {
        console.error(`   ❌ Ошибка отправки уведомления: ${error.message}`);
      }
    }

    console.log('\n✅ Проверка завершена\n');

  } catch (error) {
    console.error('❌ Ошибка проверки подписок:', error);
  } finally {
    await pool.end();
  }
}

// Запуск
checkExpiringSubscriptions();

