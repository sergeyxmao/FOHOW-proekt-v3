import { pool } from '../db.js';
import {
  getSharedRootPath,
  listFolderDirectories
} from './yandexDiskService.js';

const IGNORED_SHARED_FOLDERS = ['pending'];

/**
 * Синхронизирует таблицу shared_folders с реальными папками на Яндекс.Диске.
 *
 * Алгоритм:
 * 1. Получить список папок на Яндекс.Диске в директории SHARED.
 * 2. Получить список папок из БД.
 * 3. Удалить записи, которых нет на диске.
 * 4. Добавить записи, которые есть на диске, но отсутствуют в БД.
 *
 * @returns {Promise<{ added: string[]; deleted: string[] }>} Итоги синхронизации
 */
export async function syncSharedFoldersWithYandexDisk() {
  const sharedRootPath = getSharedRootPath();

  const realFolders = await listFolderDirectories(sharedRootPath);
  const normalizedRealFolders = realFolders.filter(
    folder => !IGNORED_SHARED_FOLDERS.includes(folder.toLowerCase())
  );

  const dbFoldersResult = await pool.query('SELECT id, name FROM shared_folders');
  const dbFolders = dbFoldersResult.rows.map(row => row.name);

  const foldersToDelete = dbFolders.filter(
    folderName => !normalizedRealFolders.includes(folderName)
  );

  if (foldersToDelete.length > 0) {
    await pool.query('DELETE FROM shared_folders WHERE name = ANY($1)', [foldersToDelete]);
    console.log('[Shared Folders Sync] Удалены устаревшие папки:', foldersToDelete);
  }

  const foldersToAdd = normalizedRealFolders.filter(
    folderName => !dbFolders.includes(folderName)
  );

  for (const folderName of foldersToAdd) {
    await pool.query(
      `INSERT INTO shared_folders (name, created_by, created_at, updated_at)
       VALUES ($1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (name) DO NOTHING`,
      [folderName]
    );
  }

  if (foldersToAdd.length > 0) {
    console.log('[Shared Folders Sync] Добавлены новые папки:', foldersToAdd);
  }

  return { added: foldersToAdd, deleted: foldersToDelete };
}
