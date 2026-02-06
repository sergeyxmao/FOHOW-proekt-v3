/**
 * Маршруты аутентификации и авторизации
 * - POST /api/verification-code - Генерация проверочного кода (антибот)
 * - POST /api/register - Регистрация
 * - POST /api/login - Авторизация
 * - POST /api/logout - Выход
 * - POST /api/verify-email - Подтверждение email
 * - POST /api/resend-verification-code - Повторная отправка кода
 * - POST /api/forgot-password - Восстановление пароля
 * - POST /api/reset-password - Сброс пароля
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createVerificationSession } from '../services/emailVerificationService.js';

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

/**
 * Валидация формата представительства (office)
 * @param {string} office - Код представительства
 * @returns {boolean} true если формат корректен
 */
function validateOffice(office) {
  const pattern = /^[A-Z]{3}\d{2,3}$/;
  return pattern.test(office);
}

/**
 * Валидация формата компьютерного номера (personal_id)
 * @param {string} personalId - Компьютерный номер
 * @param {string} office - Код представительства
 * @returns {boolean} true если формат корректен
 */
function validatePersonalId(personalId, office) {
  if (!personalId || !office) return false;

  const normalizedOffice = office.trim().toUpperCase();
  if (!validateOffice(normalizedOffice)) return false;

  if (!personalId.startsWith(normalizedOffice)) return false;
  const suffix = personalId.substring(normalizedOffice.length);
  return /^\d{9}$/.test(suffix);
}

/**
 * Генерация уникального personal_id для нового пользователя
 * @param {Object} client - Клиент PostgreSQL (в рамках транзакции)
 * @returns {Promise<string>} Уникальный personal_id
 */
async function generateUniquePersonalId(client) {
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    // 1. Получить текущий счётчик с блокировкой
    const counterResult = await client.query(
      'SELECT last_issued_number FROM personal_id_counter WHERE id = 1 FOR UPDATE'
    );

    if (counterResult.rows.length === 0) {
      throw new Error('Счётчик personal_id не инициализирован в базе данных');
    }

    let nextNumber = counterResult.rows[0].last_issued_number + 1;

    // 2. Сгенерировать номер в формате RUY00XXXXXXXXX
    const personalId = `RUY00${String(nextNumber).padStart(9, '0')}`;

    // 3. Проверить, свободен ли этот номер
    const existingUser = await client.query(
      'SELECT id FROM users WHERE personal_id = $1',
      [personalId]
    );

    if (existingUser.rows.length === 0) {
      // Номер свободен! Обновить счётчик и вернуть номер
      await client.query(
        'UPDATE personal_id_counter SET last_issued_number = $1, updated_at = NOW() WHERE id = 1',
        [nextNumber]
      );

      console.log(`✅ Выдан свободный номер: ${personalId}`);
      return personalId;
    }

    // Номер занят, пробуем следующий
    console.log(`⚠️ Номер ${personalId} занят, пропускаем...`);

    // Обновить счётчик, чтобы в следующий раз начать со следующего номера
    await client.query(
      'UPDATE personal_id_counter SET last_issued_number = $1, updated_at = NOW() WHERE id = 1',
      [nextNumber]
    );

    attempts++;
  }

  throw new Error('Не удалось сгенерировать уникальный personal_id после ' + maxAttempts + ' попыток');
}

/**
 * Регистрация маршрутов аутентификации
 * @param {import('fastify').FastifyInstance} app - экземпляр Fastify
 */
export function registerAuthRoutes(app) {

  // === ГЕНЕРАЦИЯ ПРОВЕРОЧНОГО КОДА (АНТИБОТ) ===
  app.post('/api/verification-code', {
    schema: {
      tags: ['Auth'],
      summary: 'Генерация проверочного кода (антибот)',
      description: 'Создаёт сессию верификации с токеном и кодом для защиты от ботов при регистрации.',
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Токен сессии верификации' },
            code: { type: 'string', description: 'Проверочный код' }
          }
        },
        429: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { message: { type: 'string' } }
        }
      }
    },
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '5 minutes',
        errorResponseBuilder: () => ({ error: 'Слишком много попыток. Попробуйте позже.' })
      }
    }
  }, async (req, reply) => {
    try {
      const { token, code } = await createVerificationSession();
      return reply.send({ token, code });
    } catch (err) {
      req.log.error('❌ Ошибка генерации проверочного кода:', err);
      return reply.code(500).send({ message: 'Не удалось создать проверочный код' });
    }
  });

  // === РЕГИСТРАЦИЯ ===
  app.post('/api/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Регистрация нового пользователя',
      description: 'Создаёт аккаунт по email и паролю. Если email не верифицирован — обновляет пароль. Требуется последующая верификация email.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Email пользователя' },
          password: { type: 'string', minLength: 6, description: 'Пароль (минимум 6 символов)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            requiresLogin: { type: 'boolean' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            field: { type: 'string' },
            accountExists: { type: 'boolean' }
          }
        },
        429: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({ error: 'Слишком много попыток. Попробуйте позже.' })
      }
    }
  }, async (req, reply) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email и пароль обязательны' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Проверить, есть ли email в verified_emails (постоянное хранилище)
      const verifiedEmailCheck = await client.query(
        'SELECT email FROM verified_emails WHERE email = $1',
        [email]
      );

      if (verifiedEmailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return reply.code(400).send({
          error: 'Данный аккаунт уже есть в системе. Войдите в него или, если вы забыли пароль, нажмите "Восстановить пароль".',
          field: 'email',
          accountExists: true
        });
      }

      // 2. Проверить, есть ли уже пользователь с таким email
      const existingUser = await client.query(
        'SELECT id, email_verified FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        const user = existingUser.rows[0];

        if (user.email_verified) {
          await client.query('ROLLBACK');
          return reply.code(400).send({
            error: 'Данный аккаунт уже есть в системе. Войдите в него или, если вы забыли пароль, нажмите "Восстановить пароль".',
            field: 'email',
            accountExists: true
          });
        } else {
          // Email НЕ верифицирован - разрешить повторную регистрацию
          const hash = await bcrypt.hash(password, 10);

          await client.query(
            'UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2',
            [hash, email]
          );

          await client.query('COMMIT');

          return reply.send({
            success: true,
            message: 'Вы зарегистрировались. Войдите под своими данными.',
            requiresLogin: true
          });
        }
      }

      // 3. Создать нового пользователя БЕЗ тарифа
      const hash = await bcrypt.hash(password, 10);

      // Настройки конфиденциальности по умолчанию
      const defaultSearchSettings = {
        username: false,
        phone: false,
        city: false,
        country: false,
        office: false,
        personal_id: false,
        telegram_user: false,
        instagram_profile: false
      };

      const insertResult = await client.query(
        `INSERT INTO users (email, password, email_verified, created_at, search_settings)
         VALUES ($1, $2, FALSE, NOW(), $3)
         RETURNING id, email`,
        [email, hash, JSON.stringify(defaultSearchSettings)]
      );

      const newUser = insertResult.rows[0];

      console.log(`✅ Пользователь создан (email не верифицирован): ${newUser.email}`);

      await client.query('COMMIT');

      return reply.send({
        success: true,
        message: 'Вы зарегистрировались. Войдите под своими данными.',
        requiresLogin: true
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Ошибка регистрации:', error);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    } finally {
      client.release();
    }
  });

  // === АВТОРИЗАЦИЯ ===
  app.post('/api/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Авторизация пользователя',
      description: 'Вход по email и паролю. Возвращает JWT-токен и данные пользователя. Если email не верифицирован — отправляет код подтверждения.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Email пользователя' },
          password: { type: 'string', minLength: 6, description: 'Пароль' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            token: { type: 'string', description: 'JWT-токен (7 дней)' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                email: { type: 'string' },
                username: { type: 'string' },
                role: { type: 'string' },
                plan_id: { type: 'integer', nullable: true }
              }
            },
            requiresVerification: { type: 'boolean', description: 'Email не подтверждён — нужна верификация' },
            email: { type: 'string' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        429: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({ error: 'Слишком много попыток. Попробуйте позже.' })
      }
    }
  }, async (req, reply) => {
    console.log('[DEBUG /api/login ENTRY] === Вход в обработчик ===');
    console.log('[DEBUG /api/login] req.body:', req.body);
    console.log('[DEBUG /api/login] req.body type:', typeof req.body);

    const { email, password } = req.body;
    console.log('[DEBUG /api/login] Распаковано:', {
      email,
      hasPassword: !!password,
      passwordLength: password?.length
    });

    if (!email || !password) {
      console.log('[DEBUG /api/login] Отсутствуют email или пароль');
      return reply.code(400).send({ error: 'Email и пароль обязательны' });
    }

    try {
      console.log('[DEBUG /api/login] Ищем пользователя в БД:', email);
      // 1. Найти пользователя
      // SELECT * необходим — password нужен для bcrypt.compare
      // password удаляется через delete user.password перед отправкой клиенту
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

      if (result.rows.length === 0) {
        return reply.code(401).send({ error: 'Неверный email или пароль' });
      }

      const user = result.rows[0];

      // 2. Проверить пароль
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return reply.code(401).send({ error: 'Неверный email или пароль' });
      }

      // 3. Проверить, верифицирован ли email
      if (!user.email_verified) {
        // Генерировать 6-значный код
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Сохранить код в БД
        await pool.query(
          `INSERT INTO email_verification_codes (email, code, expires_at, ip_address)
           VALUES ($1, $2, NOW() + INTERVAL '10 minutes', $3)`,
          [email, code, req.ip]
        );

        // Отправить код на email
        const { sendVerificationEmail } = await import('../utils/emailService.js');
        await sendVerificationEmail(email, code);

        console.log(`📧 Код подтверждения отправлен на ${email}: ${code}`);

        return reply.send({
          requiresVerification: true,
          email: email,
          message: 'На ваш email отправлен код подтверждения. Введите его для завершения входа.'
        });
      }

      // 4. Email верифицирован - продолжить с выдачей токена
      console.log(`[LOGIN] Успешная аутентификация для пользователя ID: ${user.id}`);

      // === УПРАВЛЕНИЕ СЕССИЯМИ ===
      let sessionLimit = null;
      const isAdmin = user.role === 'admin';

      // Проверяем лимит сессий только если у пользователя есть тариф
      if (user.plan_id != null) {
        const planResult = await pool.query(
          `SELECT session_limit
           FROM subscription_plans
           WHERE id = $1`,
          [user.plan_id]
        );

        if (planResult.rows.length > 0 && planResult.rows[0].session_limit != null) {
          sessionLimit = planResult.rows[0].session_limit;
          console.log(`[LOGIN] Тариф найден. Лимит сессий: ${sessionLimit}`);
        } else {
          console.log(`[LOGIN] Тариф с ID ${user.plan_id} не найден или не имеет лимита сессий.`);
        }
      } else {
        console.log(`[LOGIN] У пользователя нет тарифа (plan_id = NULL). Пропускаем проверку лимита сессий.`);
      }

      // Если установлен лимит сессий и пользователь не админ
      if (!isAdmin && sessionLimit && !isNaN(sessionLimit) && sessionLimit > 0) {
        const sessionsCountResult = await pool.query(
          'SELECT COUNT(*) as count FROM active_sessions WHERE user_id = $1',
          [user.id]
        );

        const activeSessionsCount = parseInt(sessionsCountResult.rows[0].count, 10);
        console.log(`[LOGIN] Активных сессий: ${activeSessionsCount}`);

        if (activeSessionsCount >= sessionLimit) {
          console.log(`[LOGIN] Лимит превышен. Удаляем старую сессию.`);
          await pool.query(
            `DELETE FROM active_sessions
             WHERE id IN (
               SELECT id FROM active_sessions
               WHERE user_id = $1
               ORDER BY created_at ASC
               LIMIT 1
             )`,
            [user.id]
          );
        }
      } else {
        console.log(`[LOGIN] Проверка лимита сессий пропущена (админ или нет лимита).`);
      }

      // Удаляем хэш пароля перед отправкой
      delete user.password;

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const decodedToken = jwt.decode(token);
      const expiresAt = new Date(decodedToken.exp * 1000);

      // Извлекаем signature из токена
      const tokenParts = token.split('.');
      const tokenSignature = tokenParts.length === 3 ? tokenParts[2] : token;

      // Создаем новую сессию
      await pool.query(
        `INSERT INTO active_sessions (user_id, token_signature, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, tokenSignature, req.ip, req.headers['user-agent'] || null, expiresAt]
      );

      console.log(`[LOGIN] Сессия создана.`);

      return reply.send({
        success: true,
        token,
        user: user
      });

    } catch (err) {
      console.error('[DEBUG /api/login CATCH] === Поймана ошибка ===');
      console.error('[DEBUG /api/login CATCH] Тип ошибки:', err.name);
      console.error('[DEBUG /api/login CATCH] Сообщение:', err.message);
      console.error('[DEBUG /api/login CATCH] Стек:', err.stack);
      console.error('[DEBUG /api/login CATCH] Код ошибки:', err.code);

      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNFOUND') {
        return reply.code(500).send({ error: 'Ошибка подключения к базе данных' });
      }
      if (err.name === 'JsonWebTokenError') {
        return reply.code(500).send({ error: 'Ошибка создания токена авторизации' });
      }

      const errorMessage = process.env.NODE_ENV === 'development'
        ? `Ошибка сервера: ${err.message}`
        : 'Ошибка сервера. Попробуйте позже';

      return reply.code(500).send({ error: errorMessage });
    }
  });

  // === ВЫХОД (LOGOUT) ===
  app.post('/api/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Выход из системы',
      description: 'Удаляет текущую сессию пользователя из active_sessions.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' } }
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
    preHandler: [authenticateToken]
  }, async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return reply.code(401).send({ error: 'Токен не предоставлен' });
      }

      // Извлекаем signature из JWT токена (последняя часть после второй точки)
      const tokenParts = token.split('.');
      const tokenSignature = tokenParts.length === 3 ? tokenParts[2] : token;

      const result = await pool.query(
        'DELETE FROM active_sessions WHERE token_signature = $1 RETURNING id',
        [tokenSignature]
      );

      if (result.rowCount > 0) {
        console.log(`[LOGOUT] Сессия удалена для пользователя ID: ${req.user.id}`);
      } else {
        console.log(`[LOGOUT] Сессия не найдена для пользователя ID: ${req.user.id}`);
      }

      return reply.send({ success: true });
    } catch (err) {
      console.error('❌ Ошибка выхода:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ПОВТОРНАЯ ОТПРАВКА КОДА ПОДТВЕРЖДЕНИЯ ===
  app.post('/api/resend-verification-code', {
    schema: {
      tags: ['Auth'],
      summary: 'Повторная отправка кода подтверждения',
      description: 'Генерирует новый 6-значный код и отправляет на email. Кулдаун 30 секунд между отправками.',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Email пользователя' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        429: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            waitTime: { type: 'integer', description: 'Секунд до повторной отправки' }
          }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '5 minutes',
        errorResponseBuilder: () => ({ error: 'Слишком много попыток. Попробуйте позже.' })
      }
    }
  }, async (req, reply) => {
    const { email } = req.body;

    try {
      if (!email) {
        return reply.code(400).send({ error: 'Email обязателен' });
      }

      // Проверить кулдаун (30 секунд) - используем SQL для корректного сравнения времени
      const lastCode = await pool.query(
        `SELECT
           EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_since_last
         FROM email_verification_codes
         WHERE email = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [email]
      );

      if (lastCode.rows.length > 0) {
        const secondsSinceLastSent = parseFloat(lastCode.rows[0].seconds_since_last);

        if (secondsSinceLastSent < 30) {
          const waitTime = Math.ceil(30 - secondsSinceLastSent);
          return reply.code(429).send({
            error: `Пожалуйста, подождите ${waitTime} секунд перед повторной отправкой кода`,
            waitTime: waitTime
          });
        }
      }

      // Генерировать новый код
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      await pool.query(
        `INSERT INTO email_verification_codes (email, code, expires_at, ip_address)
         VALUES ($1, $2, NOW() + INTERVAL '10 minutes', $3)`,
        [email, code, req.ip]
      );

      const { sendVerificationEmail } = await import('../utils/emailService.js');
      await sendVerificationEmail(email, code);

      console.log(`📧 Повторная отправка кода на ${email}: ${code}`);

      return reply.send({
        success: true,
        message: 'Новый код подтверждения отправлен на ваш email'
      });

    } catch (error) {
      console.error('❌ Ошибка повторной отправки кода:', error);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === ПРОВЕРКА КОДА И АКТИВАЦИЯ АККАУНТА ===
  app.post('/api/verify-email', {
    schema: {
      tags: ['Auth'],
      summary: 'Подтверждение email',
      description: 'Проверяет 6-значный код, активирует аккаунт, назначает Демо-тариф (7 дней) и генерирует personal_id.',
      body: {
        type: 'object',
        required: ['email', 'code'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Email пользователя' },
          code: { type: 'string', description: '6-значный код подтверждения' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            token: { type: 'string', description: 'JWT-токен' },
            message: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                email: { type: 'string' },
                role: { type: 'string' },
                personal_id: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            field: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        429: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '5 minutes',
        errorResponseBuilder: () => ({ error: 'Слишком много попыток. Попробуйте позже.' })
      }
    }
  }, async (req, reply) => {
    const { email, code } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Проверить код
      const codeResult = await client.query(
        `SELECT * FROM email_verification_codes
         WHERE email = $1
           AND code = $2
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [email, code]
      );

      if (codeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.code(400).send({
          error: 'Неверный или истёкший код подтверждения',
          field: 'code'
        });
      }

      // 2. Получить пользователя
      const userResult = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Пользователь не найден' });
      }

      const user = userResult.rows[0];

      // 3. Отметить код как использованный (если ещё не был использован)
      if (!codeResult.rows[0].used) {
        await client.query(
          'UPDATE email_verification_codes SET used = TRUE, used_at = NOW() WHERE id = $1',
          [codeResult.rows[0].id]
        );
      }

      const demoTrialResult = await client.query(
        'SELECT 1 FROM demo_trials WHERE user_id = $1',
        [user.id]
      );
      const demoTrialExists = demoTrialResult.rows.length > 0;

      if (user.email_verified || demoTrialExists) {
        const verifiedToken = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        await client.query('COMMIT');

        return reply.send({
          success: true,
          token: verifiedToken,
          message: demoTrialExists
            ? 'Демо-тариф уже активирован'
            : 'Email уже подтверждён',
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            personal_id: user.personal_id
          }
        });
      }

      // 4. Получить Демо-тариф
      const demoPlanResult = await client.query(
        "SELECT id FROM subscription_plans WHERE code_name = 'demo'"
      );

      if (demoPlanResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.code(500).send({ error: 'Демо-тариф не найден в системе' });
      }

      const demoPlanId = demoPlanResult.rows[0].id;

      // 5. Генерировать personal_id (только если отсутствует)
      const personalId = user.personal_id ?? await generateUniquePersonalId(client);

      // 6. Активировать аккаунт
      const activationResult = await client.query(`
        UPDATE users
        SET email_verified = TRUE,
            plan_id = COALESCE(plan_id, $1),
            subscription_started_at = COALESCE(subscription_started_at, NOW()),
            subscription_expires_at = COALESCE(subscription_expires_at, NOW() + INTERVAL '7 days'),
            personal_id = COALESCE(personal_id, $2)
        WHERE id = $3
          AND email_verified = FALSE
        RETURNING personal_id
      `, [demoPlanId, personalId, user.id]);

      if (activationResult.rowCount === 0) {
        const refreshedUserResult = await client.query(
          'SELECT personal_id FROM users WHERE id = $1',
          [user.id]
        );
        const refreshedPersonalId = refreshedUserResult.rows[0]?.personal_id ?? user.personal_id;

        const verifiedToken = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        await client.query('COMMIT');

        return reply.send({
          success: true,
          token: verifiedToken,
          message: 'Email уже подтверждён',
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            personal_id: refreshedPersonalId
          }
        });
      }

      // 7. Создать запись в demo_trials
      await client.query(
        `INSERT INTO demo_trials (user_id, started_at, converted_to_paid)
         VALUES ($1, NOW(), false)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id]
      );

      // 8. Создать запись в subscription_history
      await client.query(
        `INSERT INTO subscription_history (user_id, plan_id, start_date, end_date, source, amount_paid, currency)
         SELECT $1, $2, NOW(), NOW() + INTERVAL '7 days', 'email_verification', 0.00, 'RUB'
         WHERE NOT EXISTS (
           SELECT 1
           FROM subscription_history
           WHERE user_id = $1
             AND source = 'email_verification'
         )`,
        [user.id, demoPlanId]
      );

      // 9. Добавить email в постоянное хранилище
      await client.query(
        `INSERT INTO verified_emails (email, user_id, notes)
         VALUES ($1, $2, 'Verified via email confirmation')
         ON CONFLICT (email) DO NOTHING`,
        [email, user.id]
      );

      console.log(`✅ Email подтверждён для ${email}, присвоен Демо-тариф и номер ${personalId}`);

      // 10. Создать JWT токен
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      await client.query('COMMIT');

      return reply.send({
        success: true,
        token: token,
        message: 'Email успешно подтверждён! Добро пожаловать!',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          personal_id: personalId
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Ошибка верификации email:', error);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    } finally {
      client.release();
    }
  });

  // === ЗАБЫЛИ ПАРОЛЬ ===
  app.post('/api/forgot-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Запрос на восстановление пароля',
      description: 'Отправляет ссылку для сброса пароля на email. Кулдаун 60 секунд. Токен действует 1 час.',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Email пользователя' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        429: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            waitTime: { type: 'integer', description: 'Секунд до повторного запроса' }
          }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    },
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({ error: 'Слишком много попыток. Попробуйте позже.' })
      }
    }
  }, async (req, reply) => {
    const { email } = req.body;

    if (!email) {
      return reply.code(400).send({ error: 'Email обязателен' });
    }

    try {
      const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

      if (result.rows.length === 0) {
        return reply.send({ success: true, message: 'Если email существует, письмо будет отправлено' });
      }

      const userId = result.rows[0].id;

      // Проверить cooldown (60 секунд между запросами) - используем SQL для корректной работы с timezone
      const cooldownCheck = await pool.query(
        `SELECT
           EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_since_last
         FROM password_resets
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (cooldownCheck.rows.length > 0) {
        const secondsSinceLast = parseFloat(cooldownCheck.rows[0].seconds_since_last);
        if (secondsSinceLast < 60) {
          const waitTime = Math.ceil(60 - secondsSinceLast);
          return reply.code(429).send({
            error: `Пожалуйста, подождите ${waitTime} секунд перед повторным запросом`,
            waitTime
          });
        }
      }

      const token = jwt.sign({ userId, type: 'reset' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      await pool.query(
        `INSERT INTO password_resets (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [userId, token]
      );

      const { sendPasswordResetEmail } = await import('../utils/emailService.js');
      await sendPasswordResetEmail(email, token);

      return reply.send({ success: true, message: 'Инструкции отправлены на email' });
    } catch (err) {
      console.error('❌ Ошибка forgot-password:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // === СБРОС ПАРОЛЯ ===
  app.post('/api/reset-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Сброс пароля',
      description: 'Устанавливает новый пароль по токену из email. Токен одноразовый.',
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string', description: 'Токен сброса пароля из email' },
          newPassword: { type: 'string', minLength: 6, description: 'Новый пароль (минимум 6 символов)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } }
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } }
        }
      }
    }
  }, async (req, reply) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return reply.code(400).send({ error: 'Токен и новый пароль обязательны' });
    }

    if (newPassword.length < 6) {
      return reply.code(400).send({ error: 'Пароль должен быть минимум 6 символов' });
    }

    try {
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return reply.code(400).send({ error: 'Недействительный или истекший токен' });
      }

      // Проверяем токен и его срок действия в SQL для корректной работы с timezone
      const resetResult = await pool.query(
        `SELECT user_id, expires_at, expires_at < NOW() as is_expired
         FROM password_resets WHERE token = $1`,
        [token]
      );

      if (resetResult.rows.length === 0) {
        return reply.code(400).send({ error: 'Токен не найден' });
      }

      const { user_id, is_expired } = resetResult.rows[0];

      if (is_expired) {
        await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);
        return reply.code(400).send({ error: 'Токен истек' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user_id]);
      await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);

      return reply.send({ success: true, message: 'Пароль успешно изменен' });
    } catch (err) {
      console.error('❌ Ошибка reset-password:', err);
      return reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });
}

// Экспортируем вспомогательные функции для использования в других модулях
export { validateOffice, validatePersonalId, generateUniquePersonalId };
