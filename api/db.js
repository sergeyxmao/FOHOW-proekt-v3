import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  user: 'fohow_user',
  host: 'localhost',
  database: 'fohow_db',
  password: 'lenaXMAO80_sql',
  port: 5432,
});

export async function testDB() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ DB connected:', res.rows[0].now);
  } catch (err) {
    console.error('❌ DB connection error:', err);
  }
}
