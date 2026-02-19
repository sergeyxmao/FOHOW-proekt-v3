/**
 * Маршруты Help-центра
 * - GET    /api/help/categories         — Все категории со статьями
 * - POST   /api/help/categories         — Создать категорию (admin)
 * - PUT    /api/help/categories/:id     — Обновить категорию (admin)
 * - DELETE /api/help/categories/:id     — Удалить категорию (admin)
 * - POST   /api/help/articles           — Создать статью (admin)
 * - PUT    /api/help/articles/:id       — Обновить статью (admin)
 * - DELETE /api/help/articles/:id       — Удалить статью (admin)
 * - POST   /api/help/articles/:id/images — Загрузить изображение (admin)
 * - GET    /api/help/images/:filename   — Раздача изображений
 * - DELETE /api/help/images/:filename   — Удалить изображение (admin)
 */

import { pool } from '../db.js'
import { authenticateToken } from '../middleware/auth.js'
import { checkAdmin } from '../middleware/checkAdmin.js'
import path from 'path'
import fs from 'fs'
import { randomBytes } from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'help')

/** Создаёт папку uploads/help если не существует */
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
}

/**
 * Регистрация маршрутов Help-центра
 * @param {import('fastify').FastifyInstance} app
 */
export function registerHelpRoutes(app) {

  // ====================================================
  // GET /api/help/categories — Все категории со статьями
  // ====================================================
  app.get('/api/help/categories', {
    preHandler: [authenticateToken],
    schema: {
      tags: ['Help'],
      summary: 'Получить все категории помощи со статьями',
      description: 'Возвращает дерево категорий и статей для Help-центра',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  icon: { type: 'string' },
                  title: { type: 'string' },
                  sort_order: { type: 'integer' },
                  articles: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        title: { type: 'string' },
                        content: { type: 'string' },
                        sort_order: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const catResult = await pool.query(
        'SELECT id, icon, title, sort_order FROM help_categories ORDER BY sort_order ASC, id ASC'
      )

      const artResult = await pool.query(
        'SELECT id, category_id, title, content, sort_order FROM help_articles ORDER BY sort_order ASC, id ASC'
      )

      const articlesByCategory = {}
      for (const art of artResult.rows) {
        if (!articlesByCategory[art.category_id]) {
          articlesByCategory[art.category_id] = []
        }
        articlesByCategory[art.category_id].push({
          id: art.id,
          title: art.title,
          content: art.content || '',
          sort_order: art.sort_order
        })
      }

      const categories = catResult.rows.map(cat => ({
        id: cat.id,
        icon: cat.icon,
        title: cat.title,
        sort_order: cat.sort_order,
        articles: articlesByCategory[cat.id] || []
      }))

      return reply.send({ categories })
    } catch (err) {
      console.error('❌ [Help] Ошибка получения категорий:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // POST /api/help/categories — Создать категорию (admin)
  // ====================================================
  app.post('/api/help/categories', {
    preHandler: [authenticateToken, checkAdmin],
    schema: {
      tags: ['Help'],
      summary: 'Создать категорию помощи',
      description: 'Создаёт новую категорию. sort_order = MAX + 1. Только для админа.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'icon'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          icon: { type: 'string', minLength: 1, maxLength: 10 }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            category: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                icon: { type: 'string' },
                title: { type: 'string' },
                sort_order: { type: 'integer' }
              }
            }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { title, icon } = req.body

      const maxResult = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM help_categories'
      )
      const sortOrder = maxResult.rows[0].next_order

      const result = await pool.query(
        'INSERT INTO help_categories (icon, title, sort_order) VALUES ($1, $2, $3) RETURNING id, icon, title, sort_order',
        [icon, title, sortOrder]
      )

      return reply.code(201).send({ category: result.rows[0] })
    } catch (err) {
      console.error('❌ [Help] Ошибка создания категории:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // PUT /api/help/categories/:id — Обновить категорию
  // ====================================================
  app.put('/api/help/categories/:id', {
    preHandler: [authenticateToken, checkAdmin],
    schema: {
      tags: ['Help'],
      summary: 'Обновить категорию помощи',
      description: 'Обновляет title, icon и/или sort_order категории. Только для админа.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          icon: { type: 'string', minLength: 1, maxLength: 10 },
          sort_order: { type: 'integer' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            category: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                icon: { type: 'string' },
                title: { type: 'string' },
                sort_order: { type: 'integer' }
              }
            }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { id } = req.params
      const { title, icon, sort_order } = req.body

      // Собираем поля для обновления
      const fields = []
      const values = []
      let paramIdx = 1

      if (title !== undefined) {
        fields.push(`title = $${paramIdx++}`)
        values.push(title)
      }
      if (icon !== undefined) {
        fields.push(`icon = $${paramIdx++}`)
        values.push(icon)
      }
      if (sort_order !== undefined) {
        fields.push(`sort_order = $${paramIdx++}`)
        values.push(sort_order)
      }

      if (fields.length === 0) {
        return reply.code(400).send({ error: 'Нет полей для обновления' })
      }

      values.push(id)
      const result = await pool.query(
        `UPDATE help_categories SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING id, icon, title, sort_order`,
        values
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Категория не найдена' })
      }

      return reply.send({ category: result.rows[0] })
    } catch (err) {
      console.error('❌ [Help] Ошибка обновления категории:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // DELETE /api/help/categories/:id — Удалить категорию
  // ====================================================
  app.delete('/api/help/categories/:id', {
    preHandler: [authenticateToken, checkAdmin],
    schema: {
      tags: ['Help'],
      summary: 'Удалить категорию помощи',
      description: 'Удаляет категорию и все её статьи (каскадно). Также удаляет изображения статей из uploads/help/.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { id } = req.params

      // Получаем все статьи категории для удаления их изображений
      const articlesResult = await pool.query(
        'SELECT id FROM help_articles WHERE category_id = $1',
        [id]
      )

      // Удаляем изображения статей из файловой системы
      ensureUploadsDir()
      for (const article of articlesResult.rows) {
        deleteArticleImages(article.id)
      }

      // Удаляем категорию (статьи удалятся каскадно)
      const result = await pool.query(
        'DELETE FROM help_categories WHERE id = $1 RETURNING id',
        [id]
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Категория не найдена' })
      }

      return reply.send({ success: true })
    } catch (err) {
      console.error('❌ [Help] Ошибка удаления категории:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // POST /api/help/articles — Создать статью (admin)
  // ====================================================
  app.post('/api/help/articles', {
    preHandler: [authenticateToken, checkAdmin],
    schema: {
      tags: ['Help'],
      summary: 'Создать статью помощи',
      description: 'Создаёт новую статью в указанной категории. content = пустая строка, sort_order = MAX + 1.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['category_id', 'title'],
        properties: {
          category_id: { type: 'integer' },
          title: { type: 'string', minLength: 1, maxLength: 300 }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            article: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                category_id: { type: 'integer' },
                title: { type: 'string' },
                content: { type: 'string' },
                sort_order: { type: 'integer' }
              }
            }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { category_id, title } = req.body

      // Проверяем что категория существует
      const catCheck = await pool.query(
        'SELECT id FROM help_categories WHERE id = $1',
        [category_id]
      )
      if (catCheck.rows.length === 0) {
        return reply.code(400).send({ error: 'Категория не найдена' })
      }

      const maxResult = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM help_articles WHERE category_id = $1',
        [category_id]
      )
      const sortOrder = maxResult.rows[0].next_order

      const result = await pool.query(
        'INSERT INTO help_articles (category_id, title, content, sort_order) VALUES ($1, $2, $3, $4) RETURNING id, category_id, title, content, sort_order',
        [category_id, title, '', sortOrder]
      )

      return reply.code(201).send({ article: result.rows[0] })
    } catch (err) {
      console.error('❌ [Help] Ошибка создания статьи:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // PUT /api/help/articles/:id — Обновить статью (admin)
  // ====================================================
  app.put('/api/help/articles/:id', {
    preHandler: [authenticateToken, checkAdmin],
    schema: {
      tags: ['Help'],
      summary: 'Обновить статью помощи',
      description: 'Обновляет title и/или content статьи. Поле content содержит HTML из contenteditable.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 300 },
          content: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            article: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                category_id: { type: 'integer' },
                title: { type: 'string' },
                content: { type: 'string' },
                sort_order: { type: 'integer' }
              }
            }
          }
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { id } = req.params
      const { title, content } = req.body

      const fields = []
      const values = []
      let paramIdx = 1

      if (title !== undefined) {
        fields.push(`title = $${paramIdx++}`)
        values.push(title)
      }
      if (content !== undefined) {
        fields.push(`content = $${paramIdx++}`)
        values.push(content)
      }

      if (fields.length === 0) {
        return reply.code(400).send({ error: 'Нет полей для обновления' })
      }

      values.push(id)
      const result = await pool.query(
        `UPDATE help_articles SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING id, category_id, title, content, sort_order`,
        values
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Статья не найдена' })
      }

      return reply.send({ article: result.rows[0] })
    } catch (err) {
      console.error('❌ [Help] Ошибка обновления статьи:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // DELETE /api/help/articles/:id — Удалить статью
  // ====================================================
  app.delete('/api/help/articles/:id', {
    preHandler: [authenticateToken, checkAdmin],
    schema: {
      tags: ['Help'],
      summary: 'Удалить статью помощи',
      description: 'Удаляет статью и все связанные изображения из uploads/help/.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { id } = req.params

      // Удаляем изображения статьи
      ensureUploadsDir()
      deleteArticleImages(id)

      const result = await pool.query(
        'DELETE FROM help_articles WHERE id = $1 RETURNING id',
        [id]
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Статья не найдена' })
      }

      return reply.send({ success: true })
    } catch (err) {
      console.error('❌ [Help] Ошибка удаления статьи:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // POST /api/help/articles/:id/images — Загрузить изображение
  // ====================================================
  app.post('/api/help/articles/:id/images', {
    preHandler: [authenticateToken, checkAdmin],
    schema: {
      tags: ['Help'],
      summary: 'Загрузить изображение для статьи помощи',
      description: 'Загружает изображение в api/uploads/help/. Допустимые форматы: JPEG, PNG, WEBP, GIF. Максимум 5MB.',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            url: { type: 'string' }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const articleId = req.params.id

      // Проверяем существование статьи
      const artCheck = await pool.query(
        'SELECT id FROM help_articles WHERE id = $1',
        [articleId]
      )
      if (artCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Статья не найдена' })
      }

      const data = await req.file()
      if (!data) {
        return reply.code(400).send({ error: 'Файл не предоставлен' })
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedMimes.includes(data.mimetype)) {
        return reply.code(400).send({ error: 'Разрешены только изображения (JPEG, PNG, WEBP, GIF)' })
      }

      // Читаем файл в буфер
      const chunks = []
      for await (const chunk of data.file) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)

      if (buffer.length > 5 * 1024 * 1024) {
        return reply.code(400).send({ error: 'Максимальный размер файла: 5MB' })
      }

      // Генерируем имя файла
      const extMap = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif'
      }
      const ext = extMap[data.mimetype] || '.png'
      const random = randomBytes(2).toString('hex')
      const timestamp = Date.now()
      const filename = `article-${articleId}-${timestamp}-${random}${ext}`

      // Сохраняем файл
      ensureUploadsDir()
      const filePath = path.join(UPLOADS_DIR, filename)
      fs.writeFileSync(filePath, buffer)

      const url = `/api/help/images/${filename}`
      return reply.send({ url })
    } catch (err) {
      console.error('❌ [Help] Ошибка загрузки изображения:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // GET /api/help/images/:filename — Раздача изображений
  // ====================================================
  app.get('/api/help/images/:filename', {
    schema: {
      tags: ['Help'],
      summary: 'Получить изображение помощи',
      description: 'Отдаёт файл изображения из uploads/help/. Без аутентификации.',
      params: {
        type: 'object',
        properties: {
          filename: { type: 'string' }
        }
      },
      response: {
        404: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { filename } = req.params

      // Защита от path traversal
      const sanitized = path.basename(filename)
      const filePath = path.join(UPLOADS_DIR, sanitized)

      if (!fs.existsSync(filePath)) {
        return reply.code(404).send({ error: 'Изображение не найдено' })
      }

      const ext = path.extname(sanitized).toLowerCase()
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      }
      const contentType = mimeMap[ext] || 'application/octet-stream'

      reply.header('Content-Type', contentType)
      reply.header('Cache-Control', 'public, max-age=86400')
      return reply.send(fs.readFileSync(filePath))
    } catch (err) {
      console.error('❌ [Help] Ошибка раздачи изображения:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // DELETE /api/help/images/:filename — Удалить изображение
  // ====================================================
  app.delete('/api/help/images/:filename', {
    preHandler: [authenticateToken, checkAdmin],
    schema: {
      tags: ['Help'],
      summary: 'Удалить изображение помощи',
      description: 'Удаляет файл изображения из uploads/help/.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          filename: { type: 'string' }
        }
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const { filename } = req.params
      const sanitized = path.basename(filename)
      const filePath = path.join(UPLOADS_DIR, sanitized)

      if (!fs.existsSync(filePath)) {
        return reply.code(404).send({ error: 'Изображение не найдено' })
      }

      fs.unlinkSync(filePath)
      return reply.send({ success: true })
    } catch (err) {
      console.error('❌ [Help] Ошибка удаления изображения:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })
}

/**
 * Удаляет все изображения статьи из файловой системы
 * @param {number} articleId
 */
function deleteArticleImages(articleId) {
  try {
    const prefix = `article-${articleId}-`
    const files = fs.readdirSync(UPLOADS_DIR)
    for (const file of files) {
      if (file.startsWith(prefix)) {
        fs.unlinkSync(path.join(UPLOADS_DIR, file))
      }
    }
  } catch (err) {
    console.error(`❌ [Help] Ошибка удаления изображений статьи ${articleId}:`, err)
  }
}
