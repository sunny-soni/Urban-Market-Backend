import pkg from "pg";

const { Pool } = pkg;

export const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: "pranjal",
  database: "invoicing",
  port: 5432,
});
