import { pool } from '../../db.js';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import {
  getPendingVerifications,
  approveVerification,
  rejectVerification
} from '../../services/verificationService.js';
/**
 * Регистрация маршрутов модерации верификации
 * @param {import('fastify').FastifyInstance} app - Экземпляр Fastify
 */
export function registerAdminVerificationsRoutes(app) {
  /**
   * Получить список заявок на верификацию
   * GET /api/admin/verifications/pending
   */
  app.get('/api/admin/verifications/pending', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      console.log('[ADMIN] Запрос списка заявок на верификацию, admin_id=' + req.user.id);
      const verifications = await getPendingVerifications();
      console.log(`[ADMIN] Найдено заявок на верификацию: ${verifications.length}`);
      return reply.send({
        success: true,
        items: verifications,
        total: verifications.length
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения списка заявок:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
  /**
   * Одобрить заявку на верификацию
   * POST /api/admin/verifications/:id/approve
   */
  app.post('/api/admin/verifications/:id/approve', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const verificationId = parseInt(req.params.id, 10);
      console.log(`[ADMIN] Запрос на одобрение верификации: verification_id=${verificationId}, admin_id=${adminId}`);
      // Валидация ID
      if (!Number.isInteger(verificationId) || verificationId <= 0) {
        return reply.code(400).send({ error: 'Некорректный ID заявки' });
      }
      await approveVerification(verificationId, adminId);
      console.log(`[ADMIN] ✅ Верификация одобрена: verification_id=${verificationId}`);
      return reply.send({
        success: true,
        message: 'Заявка одобрена. Пользователь верифицирован.'
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка одобрения верификации:', err);
      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка: ${err.message}`
        : 'Не удалось одобрить заявку. Попробуйте позже.';
      return reply.code(500).send({ error: errorMessage });
    }
  });
  /**
   * Отклонить заявку на верификацию
   * POST /api/admin/verifications/:id/reject
   */
  app.post('/api/admin/verifications/:id/reject', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      const adminId = req.user.id;
      const verificationId = parseInt(req.params.id, 10);
      const { rejection_reason } = req.body;
      console.log(`[ADMIN] Запрос на отклонение верификации: verification_id=${verificationId}, admin_id=${adminId}`);
      // Валидация ID
      if (!Number.isInteger(verificationId) || verificationId <= 0) {
        return reply.code(400).send({ error: 'Некорректный ID заявки' });
      }
      // Валидация причины отклонения
      if (!rejection_reason || !rejection_reason.trim()) {
        return reply.code(400).send({ error: 'Необходимо указать причину отклонения' });
      }
      await rejectVerification(verificationId, adminId, rejection_reason.trim());
      console.log(`[ADMIN] ✅ Верификация отклонена: verification_id=${verificationId}`);
      return reply.send({
        success: true,
        message: 'Заявка отклонена. Пользователю отправлено уведомление.'
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка отклонения верификации:', err);
      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка: ${err.message}`
        : 'Не удалось отклонить заявку. Попробуйте позже.';
      return reply.code(500).send({ error: errorMessage });
    }
  });
  /**
   * Получить архив верификации (одобренные и отклонённые)
   * GET /api/admin/verifications/archive
   */
  app.get('/api/admin/verifications/archive', {
    preHandler: [authenticateToken, requireAdmin]
  }, async (req, reply) => {
    try {
      console.log('[ADMIN] Запрос архива верификации, admin_id=' + req.user.id);
      const result = await pool.query(
        `SELECT
          v.id,
          v.user_id,
          v.full_name,
          v.referral_link,
          v.status,
          v.rejection_reason,
          v.submitted_at,
          v.processed_at,
          u.personal_id,
          u.email,
          u.username,
          (SELECT username FROM users WHERE id = v.processed_by) as processed_by_username
         FROM user_verifications v
         JOIN users u ON v.user_id = u.id
         WHERE v.status IN ('approved', 'rejected')
         ORDER BY v.processed_at DESC
         LIMIT 100`,
        []
      );
      console.log(`[ADMIN] Найдено записей в архиве: ${result.rows.length}`);
      return reply.send({
        success: true,
        items: result.rows,
        total: result.rows.length
      });
    } catch (err) {
      console.error('[ADMIN] Ошибка получения архива верификации:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}
