import pg from '../lib/db/node_modules/pg/lib/index.js';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Connecting to Supabase PostgreSQL...');
  await client.connect();
  console.log('Connected successfully!');

  const ddl = `
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text,
      first_name text,
      last_name text,
      image_url text,
      created_at timestamptz DEFAULT now() NOT NULL,
      last_login_at timestamptz DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS datasets (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      name text NOT NULL,
      is_demo boolean DEFAULT false NOT NULL,
      profile jsonb NOT NULL,
      rows jsonb NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_trainings (
      id serial PRIMARY KEY,
      dataset_id text NOT NULL,
      user_id text NOT NULL,
      target_column text NOT NULL,
      best_model text NOT NULL,
      metrics jsonb NOT NULL,
      confusion_matrix jsonb NOT NULL,
      feature_importance jsonb NOT NULL,
      class_distribution jsonb NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prediction_history (
      id serial PRIMARY KEY,
      dataset_id text NOT NULL,
      user_id text NOT NULL,
      condition text NOT NULL,
      confidence double precision NOT NULL,
      model text NOT NULL,
      factors jsonb NOT NULL,
      input_summary jsonb NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rag_query_history (
      id serial PRIMARY KEY,
      user_id text NOT NULL,
      dataset_id text,
      question text NOT NULL,
      answer text NOT NULL,
      retrieved_facts jsonb,
      model_context jsonb,
      sources jsonb,
      created_at timestamptz DEFAULT now() NOT NULL
    );
  `;

  await client.query(ddl);
  console.log('Tables created or verified!');

  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Active tables in Supabase:', res.rows.map(r => r.table_name));

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
