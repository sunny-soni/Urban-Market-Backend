import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { user_id, product_id, quantity } = req.body;
    await pool.query(
      `INSERT INTO cart_items(user_id, product_id, quantity) VALUES($1,$2,$3)
      ON CONFLICT(user_id, product_id)
      DO UPDATE
      SET quantity = cart_items.quantity + EXCLUDED.quantity`,
      [user_id, product_id, quantity]    
    );
    res.status(201).json({ message: "Item added to cart successfully" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong!" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    const result = await pool.query(
      `SELECT p.id, p.name, p.price, c.quantity FROM cart_items c JOIN products
       p ON p.id = c.product_id WHERE c.user_id=$1`,
      [userId]
    );
    const products = result.rows;
    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong!" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const { quantity } = req.body;
    const userId = req.userId;
    await pool.query(
      `UPDATE cart_items SET quantity=$1 WHERE product_id=$2 AND user_id=$3`,
      [quantity, productId, userId]
    );
    res.json({ message: "Cart updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong!" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.userId;

    const result = await pool.query(
      `DELETE FROM cart_items 
       WHERE product_id = $1 AND user_id = $2
       RETURNING product_id`,
      [productId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    res.status(200).json({
      message: "Item removed from cart",
      productId,
    });
  } catch (error) {
    console.error("Delete cart item error:", error);
    res.status(500).json({ message: "Something went wrong!" });
  }
});

export default router;
