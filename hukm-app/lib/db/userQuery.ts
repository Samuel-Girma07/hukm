import { Pool } from 'pg';
import { env } from '../env';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      // Recommended settings for serverless environments (like Next.js API/Actions)
      max: 10, // Max number of connections
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
    });
  }
  return pool;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export const userQuery = {
  /**
   * Find a user by their email address.
   */
  async findByEmail(email: string): Promise<UserRow | null> {
    const res = await getPool().query<UserRow>(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    return res.rows[0] || null;
  },

  /**
   * Find a user by their ID.
   */
  async findById(id: string): Promise<UserRow | null> {
    const res = await getPool().query<UserRow>(
      'SELECT * FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    return res.rows[0] || null;
  },

  /**
   * Create a new user with the given email and password hash.
   */
  async create(email: string, passwordHash: string): Promise<UserRow> {
    const res = await getPool().query<UserRow>(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
      [email, passwordHash]
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to create user');
    return row;
  },
};
