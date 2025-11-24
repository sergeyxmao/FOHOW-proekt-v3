import { pool } from './db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('📊 Applying migration 023_add_board_folders_features.sql...');

    const migrationPath = join(__dirname, 'migrations', '023_add_board_folders_features.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('✅ Migration applied successfully!');

    // Verify the migration
    const result = await pool.query(`
      SELECT code_name, features->>'max_folders' as max_folders
      FROM subscription_plans
      ORDER BY id
    `);

    console.log('\n📋 Subscription plans with max_folders:');
    result.rows.forEach(row => {
      console.log(`  ${row.code_name}: ${row.max_folders} folders`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  }
}

runMigration();
