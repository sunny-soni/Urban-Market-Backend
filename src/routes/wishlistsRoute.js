import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.post("/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const productId = req.params.id;
    const result = await pool.query(
      `INSERT INTO wishlist (user_id, product_id) VALUES($1,$2) RETURNING user_id, product_id`,
      [userId, productId],
    );
    res.status(201).json({
      message: "Product wishlisted successfully.",
      product: result.rows[0],
    });
  } catch (error) {
    console.log("🚀 ~ error:", error);
    res.status(500).json({ message: "Something went wrong!" });
  }
});

router.get("/", async (req, res) => {
  try {
    const search = req.query.search || "";
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    let queryParams = [];
    let filterClause = "";

    if (search) {
      filterClause = " WHERE name ILIKE $1";
      queryParams.push(`%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) FROM wishlist ${filterClause}`;
    const countRes = await pool.query(countQuery, queryParams);
    const totalRows = parseInt(countRes.rows[0].count);

    const limitIdx = queryParams.length + 1;
    const offsetIdx = queryParams.length + 2;

    const dataQuery = `
      SELECT p.* FROM wishlist w LEFT JOIN products p ON w.product_id = p.id 
      ${filterClause} 
      ORDER BY id DESC 
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    queryParams.push(limit, offset);

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

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    await pool.query(
      `DELETE FROM wishlist WHERE product_id=$1 AND user_id=$2`,
      [id, userId],
    );
    res
      .status(200)
      .json({ message: "Product removed from wishlist successfully." });
  } catch (error) {
    console.log("🚀 ~ error:", error);
    res.status(500).json({ message: "Something went wrong!" });
  }
});

export default router;
