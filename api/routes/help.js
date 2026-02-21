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
 * - GET    /api/help/images/:filename   — Раздача изображений (проксирование с Yandex.Disk)
 * - DELETE /api/help/images/:filename   — Удалить изображение (admin)
 */

import { pool } from '../db.js'
import { authenticateToken } from '../middleware/auth.js'
import { checkAdmin } from '../middleware/checkAdmin.js'
import path from 'path'
import { randomBytes } from 'crypto'
import {
  uploadFile,
  deleteFile,
  ensureFolderExists,
  listFolderContents,
  getHelpFolderPath,
  getHelpImagePath
} from '../services/yandexDiskService.js'

/**
 * In-memory кэш download URL с Yandex.Disk.
 * Ключ: filename, значение: { href: string, expiresAt: number }
 * TTL: 1 час (Yandex download URL живут несколько часов)
 */
const downloadUrlCache = new Map()
const DOWNLOAD_URL_TTL_MS = 60 * 60 * 1000 // 1 час

/**
 * Получить download URL для файла, с использованием кэша
 * @param {string} ydPath - Путь к файлу на Yandex.Disk
 * @param {string} cacheKey - Ключ кэша (filename)
 * @returns {Promise<string>} Download URL
 */
async function getDownloadUrl(ydPath, cacheKey) {
  const cached = downloadUrlCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.href
  }

  const downloadEndpoint = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(ydPath)}`
  const response = await fetch(downloadEndpoint, {
    headers: {
      Authorization: `OAuth ${process.env.YANDEX_DISK_TOKEN}`
    }
  })

  if (!response.ok) {
    const err = new Error(`Yandex API: ${response.status} ${response.statusText}`)
    err.status = response.status
    throw err
  }

  const data = await response.json()
  if (!data.href) {
    throw new Error('Yandex API не вернул href для скачивания')
  }

  downloadUrlCache.set(cacheKey, {
    href: data.href,
    expiresAt: Date.now() + DOWNLOAD_URL_TTL_MS
  })

  return data.href
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
                  title_en: { type: 'string' },
                  title_cn: { type: 'string' },
                  sort_order: { type: 'integer' },
                  articles: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        title: { type: 'string' },
                        title_en: { type: 'string' },
                        title_cn: { type: 'string' },
                        content: { type: 'string' },
                        content_en: { type: 'string' },
                        content_cn: { type: 'string' },
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
        'SELECT id, icon, title, title_en, title_cn, sort_order FROM help_categories ORDER BY sort_order ASC, id ASC'
      )

      const artResult = await pool.query(
        'SELECT id, category_id, title, title_en, title_cn, content, content_en, content_cn, sort_order FROM help_articles ORDER BY sort_order ASC, id ASC'
      )

      const articlesByCategory = {}
      for (const art of artResult.rows) {
        if (!articlesByCategory[art.category_id]) {
          articlesByCategory[art.category_id] = []
        }
        articlesByCategory[art.category_id].push({
          id: art.id,
          title: art.title,
          title_en: art.title_en || '',
          title_cn: art.title_cn || '',
          content: art.content || '',
          content_en: art.content_en || '',
          content_cn: art.content_cn || '',
          sort_order: art.sort_order
        })
      }

      const categories = catResult.rows.map(cat => ({
        id: cat.id,
        icon: cat.icon,
        title: cat.title,
        title_en: cat.title_en || '',
        title_cn: cat.title_cn || '',
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
          icon: { type: 'string', minLength: 1, maxLength: 10 },
          title_en: { type: 'string', maxLength: 255 },
          title_cn: { type: 'string', maxLength: 255 }
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
                title_en: { type: 'string' },
                title_cn: { type: 'string' },
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
      const { title, icon, title_en, title_cn } = req.body

      const maxResult = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM help_categories'
      )
      const sortOrder = maxResult.rows[0].next_order

      const result = await pool.query(
        'INSERT INTO help_categories (icon, title, title_en, title_cn, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id, icon, title, title_en, title_cn, sort_order',
        [icon, title, title_en || '', title_cn || '', sortOrder]
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
          sort_order: { type: 'integer' },
          title_en: { type: 'string', maxLength: 255 },
          title_cn: { type: 'string', maxLength: 255 }
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
                title_en: { type: 'string' },
                title_cn: { type: 'string' },
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
      const { title, icon, sort_order, title_en, title_cn } = req.body

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
      if (title_en !== undefined) {
        fields.push(`title_en = $${paramIdx++}`)
        values.push(title_en)
      }
      if (title_cn !== undefined) {
        fields.push(`title_cn = $${paramIdx++}`)
        values.push(title_cn)
      }

      if (fields.length === 0) {
        return reply.code(400).send({ error: 'Нет полей для обновления' })
      }

      values.push(id)
      const result = await pool.query(
        `UPDATE help_categories SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING id, icon, title, title_en, title_cn, sort_order`,
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
      description: 'Удаляет категорию и все её статьи (каскадно). Также удаляет изображения статей с Yandex.Disk.',
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

      // Удаляем изображения статей с Yandex.Disk
      for (const article of articlesResult.rows) {
        await deleteArticleImages(article.id)
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
          title: { type: 'string', minLength: 1, maxLength: 300 },
          title_en: { type: 'string', maxLength: 255 },
          title_cn: { type: 'string', maxLength: 255 }
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
                title_en: { type: 'string' },
                title_cn: { type: 'string' },
                content: { type: 'string' },
                content_en: { type: 'string' },
                content_cn: { type: 'string' },
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
      const { category_id, title, title_en, title_cn } = req.body

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
        'INSERT INTO help_articles (category_id, title, title_en, title_cn, content, content_en, content_cn, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, category_id, title, title_en, title_cn, content, content_en, content_cn, sort_order',
        [category_id, title, title_en || '', title_cn || '', '', '', '', sortOrder]
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
          content: { type: 'string' },
          title_en: { type: 'string', maxLength: 255 },
          title_cn: { type: 'string', maxLength: 255 },
          content_en: { type: 'string' },
          content_cn: { type: 'string' }
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
                title_en: { type: 'string' },
                title_cn: { type: 'string' },
                content: { type: 'string' },
                content_en: { type: 'string' },
                content_cn: { type: 'string' },
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
      const { title, content, title_en, title_cn, content_en, content_cn } = req.body

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
      if (title_en !== undefined) {
        fields.push(`title_en = $${paramIdx++}`)
        values.push(title_en)
      }
      if (title_cn !== undefined) {
        fields.push(`title_cn = $${paramIdx++}`)
        values.push(title_cn)
      }
      if (content_en !== undefined) {
        fields.push(`content_en = $${paramIdx++}`)
        values.push(content_en)
      }
      if (content_cn !== undefined) {
        fields.push(`content_cn = $${paramIdx++}`)
        values.push(content_cn)
      }

      if (fields.length === 0) {
        return reply.code(400).send({ error: 'Нет полей для обновления' })
      }

      values.push(id)
      const result = await pool.query(
        `UPDATE help_articles SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING id, category_id, title, title_en, title_cn, content, content_en, content_cn, sort_order`,
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
      description: 'Удаляет статью и все связанные изображения с Yandex.Disk.',
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

      // Удаляем изображения статьи с Yandex.Disk
      await deleteArticleImages(id)

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
      description: 'Загружает изображение на Yandex.Disk в папку HELP/. Допустимые форматы: JPEG, PNG, WEBP, GIF. Максимум 5MB.',
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

      // Загружаем файл на Yandex.Disk
      const helpFolder = getHelpFolderPath()
      await ensureFolderExists(helpFolder)
      const ydPath = getHelpImagePath(filename)
      await uploadFile(ydPath, buffer, data.mimetype)

      const url = `/api/help/images/${filename}`
      return reply.send({ url })
    } catch (err) {
      console.error('❌ [Help] Ошибка загрузки изображения:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // GET /api/help/images/:filename — Раздача изображений (проксирование с Yandex.Disk)
  // ====================================================
  app.get('/api/help/images/:filename', {
    schema: {
      tags: ['Help'],
      summary: 'Получить изображение помощи',
      description: 'Проксирует файл изображения с Yandex.Disk. Без аутентификации. Download URL кэшируется на 1 час.',
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
      const ydPath = getHelpImagePath(sanitized)

      // Получить download URL (из кэша или Yandex API)
      let href
      try {
        href = await getDownloadUrl(ydPath, sanitized)
      } catch (err) {
        if (err.status === 404) {
          return reply.code(404).send({ error: 'Изображение не найдено' })
        }
        throw err
      }

      // Загрузить файл с временной ссылки Yandex
      const imageResponse = await fetch(href)

      if (!imageResponse.ok) {
        // Если временная ссылка протухла, сбрасываем кэш и пробуем ещё раз
        downloadUrlCache.delete(sanitized)
        const freshHref = await getDownloadUrl(ydPath, sanitized)
        const retryResponse = await fetch(freshHref)

        if (!retryResponse.ok) {
          console.error(`❌ [Help] Ошибка загрузки с Yandex после retry: ${retryResponse.status}`)
          return reply.code(500).send({ error: 'Ошибка загрузки изображения' })
        }

        const retryBuffer = await retryResponse.arrayBuffer()
        const ext = path.extname(sanitized).toLowerCase()
        const mimeMap = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif'
        }
        const contentType = retryResponse.headers.get('content-type') || mimeMap[ext] || 'application/octet-stream'

        reply.header('Content-Type', contentType)
        reply.header('Cache-Control', 'public, max-age=86400')
        reply.header('Content-Length', retryBuffer.byteLength)
        return reply.send(Buffer.from(retryBuffer))
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const ext = path.extname(sanitized).toLowerCase()
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      }
      const contentType = imageResponse.headers.get('content-type') || mimeMap[ext] || 'application/octet-stream'

      reply.header('Content-Type', contentType)
      reply.header('Cache-Control', 'public, max-age=86400')
      reply.header('Content-Length', imageBuffer.byteLength)
      return reply.send(Buffer.from(imageBuffer))
    } catch (err) {
      console.error('❌ [Help] Ошибка раздачи изображения:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })

  // ====================================================
  // POST /api/help/translate — Автоперевод через Yandex Translate API (admin)
  // ====================================================
  app.post('/api/help/translate', {
    preHandler: [authenticateToken, checkAdmin],
    schema: {
      tags: ['Help'],
      summary: 'Автоперевод текста через Yandex Translate API',
      description: 'Переводит текст с русского на указанный язык (en/zh). Требует YANDEX_TRANSLATE_API_KEY и YANDEX_TRANSLATE_FOLDER_ID в env. Только для админа.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['text', 'target_lang'],
        properties: {
          text: { type: 'string', minLength: 1 },
          target_lang: { type: 'string', enum: ['en', 'zh'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            translated_text: { type: 'string' }
          }
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
        503: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (req, reply) => {
    try {
      const apiKey = process.env.YANDEX_TRANSLATE_API_KEY
      const folderId = process.env.YANDEX_TRANSLATE_FOLDER_ID

      if (!apiKey || !folderId) {
        return reply.code(503).send({ error: 'Yandex Translate API не настроен' })
      }

      const { text, target_lang } = req.body

      const response = await fetch('https://translate.api.cloud.yandex.net/translate/v2/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`
        },
        body: JSON.stringify({
          folderId,
          texts: [text],
          sourceLanguageCode: 'ru',
          targetLanguageCode: target_lang
        })
      })

      if (!response.ok) {
        const errBody = await response.text()
        console.error('❌ [Help] Yandex Translate error:', response.status, errBody)
        return reply.code(500).send({ error: 'Ошибка Yandex Translate API' })
      }

      const data = await response.json()
      const translatedText = data.translations?.[0]?.text || ''

      return reply.send({ translated_text: translatedText })
    } catch (err) {
      console.error('❌ [Help] Ошибка автоперевода:', err)
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
      description: 'Удаляет файл изображения с Yandex.Disk.',
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
      const ydPath = getHelpImagePath(sanitized)

      try {
        await deleteFile(ydPath)
      } catch (err) {
        if (err.status === 404) {
          return reply.code(404).send({ error: 'Изображение не найдено' })
        }
        throw err
      }

      // Удаляем из кэша download URL
      downloadUrlCache.delete(sanitized)

      return reply.send({ success: true })
    } catch (err) {
      console.error('❌ [Help] Ошибка удаления изображения:', err)
      return reply.code(500).send({ error: 'Ошибка сервера' })
    }
  })
}

/**
 * Удаляет все изображения статьи с Yandex.Disk
 * @param {number} articleId
 */
async function deleteArticleImages(articleId) {
  try {
    const helpFolder = getHelpFolderPath()
    const files = await listFolderContents(helpFolder)
    const prefix = `article-${articleId}-`
    const articleFiles = files.filter(f => f.name.startsWith(prefix))

    for (const f of articleFiles) {
      const ydPath = getHelpImagePath(f.name)
      await deleteFile(ydPath)
      // Удаляем из кэша download URL
      downloadUrlCache.delete(f.name)
    }
  } catch (err) {
    console.error(`❌ [Help] Ошибка удаления изображений статьи ${articleId}:`, err)
  }
}
