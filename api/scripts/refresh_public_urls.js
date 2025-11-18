import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const YANDEX_TOKEN = process.env.YANDEX_DISK_TOKEN;

async function publishFile(path) {
  const url = `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(path)}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `OAuth ${YANDEX_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to publish: ${response.status}`);
  }

  const metaUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}`;
  const metaResponse = await fetch(metaUrl, {
    headers: {
      'Authorization': `OAuth ${YANDEX_TOKEN}`
    }
  });

  const meta = await metaResponse.json();
  
  return {
    public_url: meta.file || meta.public_url,
    preview_url: meta.preview || meta.file || meta.public_url
  };
}

async function refreshAllUrls() {
  try {
    const result = await pool.query(
      `SELECT id, yandex_path FROM image_library WHERE yandex_path IS NOT NULL`
    );

    console.log(`Найдено изображений: ${result.rows.length}`);

    for (const row of result.rows) {
      try {
        console.log(`Обновление #${row.id}: ${row.yandex_path}`);
        
        const urls = await publishFile(row.yandex_path);
        
        await pool.query(
          `UPDATE image_library SET public_url = $1, preview_url = $2 WHERE id = $3`,
          [urls.public_url, urls.preview_url, row.id]
        );
        
        console.log(`✅ Обновлено #${row.id}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`❌ Ошибка для #${row.id}:`, err.message);
      }
    }

    console.log('Готово!');
  } catch (err) {
    console.error('Ошибка:', err);
  } finally {
    await pool.end();
  }
}

refreshAllUrls();
