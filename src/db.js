import pkg from "pg";
const { Pool } = pkg;

const isProduction = process.env.NODE_ENV === "production";

export const pool = new Pool(
  isProduction
    ? {
        connectionString: process.env.DATABASE_URL, // Supabase (Render)
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        host: "localhost",
        user: "postgres",
        password: "pranjal",
        database: "invoicing",
        port: 5432,
      }
);