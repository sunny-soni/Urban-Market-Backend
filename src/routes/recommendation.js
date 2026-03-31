import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    const search = req.query.search || "";
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Parameters for the query
    let queryParams = [userId]; // $1 is always userId
    let filterClause = "";

    if (search) {
      filterClause = " AND p.name ILIKE $2";
      queryParams.push(`%${search}%`);
    }

    // 1. Get total count for pagination
    // Note: We only count products the user HASN'T bought yet
    const countQuery = `
      SELECT COUNT(*) FROM products p
      WHERE NOT EXISTS (
          SELECT 1 FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = p.id AND o.user_id = $1
      ) ${filterClause}`;

    const countRes = await pool.query(countQuery, queryParams);
    const totalRows = parseInt(countRes.rows[0].count);

    // 2. Prepare dynamic indices for Limit and Offset
    const limitIdx = queryParams.length + 1;
    const offsetIdx = queryParams.length + 2;
    queryParams.push(limit, offset);

    // 3. The Big Integrated Query
    const integratedQuery = `
      WITH UserFavoriteCategory AS (
          SELECT p.category, COUNT(*) as purchase_count
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          JOIN products p ON p.id = oi.product_id
          WHERE o.user_id = $1
          GROUP BY p.category
          ORDER BY purchase_count DESC
          LIMIT 1
      )
      SELECT p.*, 
      -- Check if in wishlist
      EXISTS (
          SELECT 1 FROM wishlist w 
          WHERE w.product_id = p.id AND w.user_id = $1
      ) AS is_wishlisted 
      FROM products p
      -- Filter out already purchased items
      WHERE NOT EXISTS (
          SELECT 1 FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = p.id AND o.user_id = $1
      ) 
      ${filterClause} -- Search filter
      ORDER BY 
          (p.category = (SELECT category FROM UserFavoriteCategory)) DESC, 
          p.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await pool.query(integratedQuery, queryParams);

    res.json({
      products: result.rows,
      rows: result.rows.length,
      totalRows: totalRows,
    });
  } catch (error) {
    console.error("🚀 ~ Integration Error:", error);
    res.status(500).json({ message: "Something went wrong!" });
  }
});

export default router;
