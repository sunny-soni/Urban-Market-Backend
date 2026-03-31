import express from "express";
import { pool } from "../db.js";
import crudMiddleware from "../middleware/isAdminMiddleware.js";

const router = express.Router();

router.post("/", crudMiddleware, async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;
    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock) VALUES($1,$2,$3,$4) RETURNING name, description, price, stock`,
      [name, description, price, stock],
    );
    res.status(201).json({
      message: "Product added successfully.",
      product: result.rows[0],
    });
  } catch (error) {
    console.log("🚀 ~ error:", error);
    res.status(500).json({ message: "Something went wrong!" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    const search = req.query.search || "";
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    let queryParams = [];
    let filterClause = "";

    if (search) {
      filterClause = " WHERE name ILIKE $1";
      queryParams.push(`%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) FROM products ${filterClause}`;
    const countRes = await pool.query(countQuery, queryParams);
    const totalRows = parseInt(countRes.rows[0].count);

    const userIdx = queryParams.length + 1;
    const limitIdx = queryParams.length + 2;
    const offsetIdx = queryParams.length + 3;

    const dataQuery = `
      SELECT p.*, 
      EXISTS (
          SELECT 1 FROM wishlist w 
          WHERE w.product_id = p.id AND w.user_id = $${userIdx}
      ) AS is_wishlisted FROM products p
      ${filterClause} 
      ORDER BY id DESC 
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    queryParams.push(userId, limit, offset);

    const result = await pool.query(dataQuery, queryParams);

    res.json({
      products: result.rows,
      rows: result.rows.length,
      totalRows: totalRows,
    });
  } catch (error) {
    console.log("🚀 ~ error:", error);
    res.status(500).json({ message: "Something went wrong!" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, 
      EXISTS (
          SELECT 1 FROM wishlist w 
          WHERE w.product_id = p.id AND w.user_id = $1
      ) AS is_wishlisted FROM products p WHERE id=$2`,
      [userId, id],
    );
    const product = result.rows[0];
    res.json({ product });
  } catch (error) {
    console.log("🚀 ~ error:", error);
    res.status(500).json({ message: "Something went wrong!" });
  }
});

router.put("/:id", crudMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock } = req.body;
    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, stock=$4 WHERE id=$5 RETURNING *`,
      [name, description, price, stock, id],
    );
    const updatedProduct = result.rows[0];
    res.json({ updatedProduct });
  } catch (error) {
    console.log("🚀 ~ error:", error);
    res.status(500).json({ message: "Something went wrong!" });
  }
});

router.delete("/:id", crudMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🚀 ~ id:", id);
    await pool.query(`DELETE FROM products WHERE id=$1`, [id]);
    res.status(200).json({ message: "Product deleted successfully." });
  } catch (error) {
    console.log("🚀 ~ error:", error);
    res.status(500).json({ message: "Something went wrong!" });
  }
});

export default router;
