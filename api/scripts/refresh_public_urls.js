import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '/var/www/FOHOW-proekt-v3/api/.env' });

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
  // Получить метаданные файла
  const metaUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}`;

  const metaResponse = await fetch(metaUrl, {
    headers: {
      'Authorization': `OAuth ${YANDEX_TOKEN}`
    }
  });

  if (!metaResponse.ok) {
    throw new Error(`Failed to get metadata: ${metaResponse.status}`);
  }

  const meta = await metaResponse.json();

  // Если файл не опубликован, опубликовать его
  if (!meta.public_url) {
    const publishUrl = `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(path)}`;

    const publishResponse = await fetch(publishUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `OAuth ${YANDEX_TOKEN}`
      }
    });

    if (!publishResponse.ok) {
      throw new Error(`Failed to publish: ${publishResponse.status}`);
    }

    // Получить метаданные снова после публикации
    const newMetaResponse = await fetch(metaUrl, {
      headers: {
        'Authorization': `OAuth ${YANDEX_TOKEN}`
      }
    });

    const newMeta = await newMetaResponse.json();
    const publicKey = newMeta.public_key || newMeta.public_url;

    // Получить preview через публичную ссылку
    const previewUrl = await getPreviewUrl(publicKey);

    return {
      public_url: newMeta.public_url,
      preview_url: previewUrl
    };
  }

  const publicKey = meta.public_key || meta.public_url;
  const previewUrl = await getPreviewUrl(publicKey);

  return {
    public_url: meta.public_url,
    preview_url: previewUrl
  };
}

async function getPreviewUrl(publicKey) {
  // Получить информацию о публичном файле с preview
  const publicUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(publicKey)}&preview_size=S&preview_crop=false`;

  const response = await fetch(publicUrl);

  if (!response.ok) {
    throw new Error(`Failed to get preview: ${response.status}`);
  }

  const data = await response.json();
  return data.preview || data.file || publicKey;
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
