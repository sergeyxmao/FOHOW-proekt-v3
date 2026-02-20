/**
 * Скрипт миграции изображений Help-центра на Yandex.Disk
 *
 * Читает все файлы из api/uploads/help/ и загружает их
 * на Yandex.Disk в папку {YANDEX_DISK_BASE_DIR}/HELP/
 *
 * Запуск: node api/scripts/migrate-help-images.js
 *
 * Особенности:
 * - Если файл уже существует на Yandex.Disk — пропускает
 * - НЕ удаляет локальные файлы (на случай отката)
 * - Логирует прогресс: [1/160] Uploaded article-1-xxx.png
 * - В конце выводит статистику
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Загружаем .env из api/ директории
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const YANDEX_DISK_TOKEN = process.env.YANDEX_DISK_TOKEN
const YANDEX_DISK_BASE_DIR = process.env.YANDEX_DISK_BASE_DIR
const YANDEX_DISK_API_BASE = 'https://cloud-api.yandex.net/v1/disk'

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'help')

if (!YANDEX_DISK_TOKEN) {
  console.error('YANDEX_DISK_TOKEN не задан в .env')
  process.exit(1)
}

if (!YANDEX_DISK_BASE_DIR) {
  console.error('YANDEX_DISK_BASE_DIR не задан в .env')
  process.exit(1)
}

async function makeRequest(endpoint, options = {}) {
  const url = `${YANDEX_DISK_API_BASE}${endpoint}`
  const headers = {
    'Authorization': `OAuth ${YANDEX_DISK_TOKEN}`,
    ...options.headers
  }

  const response = await fetch(url, { ...options, headers })

  if (response.status === 204) return null

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const err = new Error(data?.message || data?.description || `HTTP ${response.status}`)
    err.status = response.status
    throw err
  }

  return data
}

async function checkFileExists(ydPath) {
  try {
    await makeRequest(`/resources?path=${encodeURIComponent(ydPath)}`, { method: 'GET' })
    return true
  } catch (err) {
    if (err.status === 404) return false
    throw err
  }
}

async function ensureFolder(folderPath) {
  const segments = folderPath.split('/').filter(s => s.length > 0)
  let currentPath = ''

  for (const segment of segments) {
    currentPath += '/' + segment
    try {
      await makeRequest(`/resources?path=${encodeURIComponent(currentPath)}`, { method: 'GET' })
    } catch (err) {
      if (err.status === 404) {
        try {
          await makeRequest(`/resources?path=${encodeURIComponent(currentPath)}`, { method: 'PUT' })
          console.log(`  Папка создана: ${currentPath}`)
        } catch (createErr) {
          if (createErr.status !== 409) throw createErr
        }
      } else {
        throw err
      }
    }
  }
}

async function uploadFile(ydPath, buffer, mimeType) {
  const uploadData = await makeRequest(
    `/resources/upload?path=${encodeURIComponent(ydPath)}&overwrite=true`,
    { method: 'GET' }
  )

  if (!uploadData?.href) {
    throw new Error('Не удалось получить URL для загрузки')
  }

  const response = await fetch(uploadData.href, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: buffer
  })

  if (!response.ok) {
    throw new Error(`Ошибка загрузки: ${response.status} ${response.statusText}`)
  }
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  }
  return mimeMap[ext] || 'application/octet-stream'
}

async function migrate() {
  console.log('=== Миграция изображений Help-центра на Yandex.Disk ===')
  console.log(`Источник: ${UPLOADS_DIR}`)
  console.log(`Назначение: ${YANDEX_DISK_BASE_DIR}/HELP/`)
  console.log('')

  // Проверяем наличие исходной папки
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('Папка uploads/help/ не найдена. Нет файлов для миграции.')
    return
  }

  // Получаем список файлов
  const allFiles = fs.readdirSync(UPLOADS_DIR).filter(f => {
    const filePath = path.join(UPLOADS_DIR, f)
    return fs.statSync(filePath).isFile()
  })

  if (allFiles.length === 0) {
    console.log('Папка uploads/help/ пуста. Нет файлов для миграции.')
    return
  }

  console.log(`Найдено файлов: ${allFiles.length}`)
  console.log('')

  // Создаём папку HELP на Yandex.Disk
  const helpFolder = `${YANDEX_DISK_BASE_DIR}/HELP`
  console.log('Создаём папку на Yandex.Disk...')
  await ensureFolder(helpFolder)
  console.log('')

  let uploaded = 0
  let skipped = 0
  let errors = 0

  for (let i = 0; i < allFiles.length; i++) {
    const filename = allFiles[i]
    const localPath = path.join(UPLOADS_DIR, filename)
    const ydPath = `${helpFolder}/${filename}`
    const num = `[${i + 1}/${allFiles.length}]`

    try {
      // Проверяем, есть ли уже файл на Yandex.Disk
      const exists = await checkFileExists(ydPath)
      if (exists) {
        console.log(`${num} Пропущен (уже существует): ${filename}`)
        skipped++
        continue
      }

      // Читаем локальный файл
      const buffer = fs.readFileSync(localPath)
      const mimeType = getMimeType(filename)

      // Загружаем на Yandex.Disk
      await uploadFile(ydPath, buffer, mimeType)

      console.log(`${num} Загружен: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`)
      uploaded++
    } catch (err) {
      console.error(`${num} ОШИБКА: ${filename} — ${err.message}`)
      errors++
    }
  }

  console.log('')
  console.log('=== Результат миграции ===')
  console.log(`Всего файлов:  ${allFiles.length}`)
  console.log(`Загружено:     ${uploaded}`)
  console.log(`Пропущено:     ${skipped}`)
  console.log(`Ошибок:        ${errors}`)

  if (errors > 0) {
    console.log('')
    console.log('Есть ошибки. Перезапустите скрипт для повторной попытки.')
  }

  if (uploaded > 0 || skipped > 0) {
    console.log('')
    console.log('Локальные файлы НЕ удалены (на случай отката).')
    console.log('После проверки работоспособности можно удалить api/uploads/help/ вручную.')
  }
}

migrate().catch(err => {
  console.error('Критическая ошибка миграции:', err)
  process.exit(1)
})
