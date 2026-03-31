import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.post("/create", async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.userId;
    const requestBody = req.body;
    await client.query("BEGIN");

    const cartRes = await client.query(
      `SELECT c.product_id, c.quantity, p.price, p.stock
             FROM cart_items AS c JOIN products AS p ON p.id = c.product_id
             WHERE c.user_id = $1`,
      [userId],
    );

    const cartItems = cartRes.rows;

    if (!cartItems.length) {
      throw new Error("Cart is empty!");
    }

    for (let item of cartItems) {
      if (item.quantity > item.stock) {
        throw new Error("Insufficient stock.");
      }
    }

    const orderTotal = cartItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0,
    );
    console.log("🚀 ~ orderTotal:", orderTotal);

    const orderRes = await client.query(
      `INSERT INTO orders (user_id, total, full_name, address, mobile, mode_of_payment, payment_id, payment_status) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        userId,
        orderTotal,
        requestBody.full_name,
        requestBody.address,
        requestBody.mobile,
        requestBody.mode_of_payment,
        requestBody.paymentId,
        requestBody.payment_status,
      ],
    );

    const orderId = orderRes.rows[0].id;

    for (let item of cartItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id,quantity, price) VALUES($1,$2,$3,$4)`,
        [orderId, item.product_id, item.quantity, item.price],
      );

      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2`,
        [item.quantity, item.product_id],
      );
    }
    await client.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);

    await client.query("COMMIT");
    res.status(201).json({ message: "Order placed successfully", orderId });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    const result = await pool.query(
      `SELECT o.*, 
       (
         SELECT json_agg(json_build_object(
           'product_id', oi.product_id,
           'quantity', oi.quantity,
           'price', oi.price,
           'name', p.name
         ))
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = o.id
       ) AS items
       FROM orders o
       WHERE o.user_id = $1
       ORDER BY o.id DESC`,
      [userId],
    );

    res.status(200).json({ orders: result.rows, message: "Orders list" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/admin", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        o.*, 
        u.username, 
        u.email,
        (
         SELECT json_agg(json_build_object(
           'product_id', oi.product_id,
           'quantity', oi.quantity,
           'price', oi.price,
           'name', p.name
         ))
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = o.id
       ) AS items
      FROM orders AS o 
      INNER JOIN users AS u ON o.user_id = u.id 
      ORDER BY o.created_at DESC`,
    );

    res.status(200).json({ orders: result.rows, message: "Orders list" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/admin/:id", async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  if (!status || status.trim() === "") {
    return res.status(400).json({ error: "Status value is required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (status !== "cancelled") {
      const result = await client.query(
        `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
        [status, orderId],
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Order not found" });
      }

      await client.query("COMMIT");
      return res.status(200).json({
        message: "System registry updated successfully",
        order: result.rows[0],
      });
    } else {
      const currentOrderCheck = await client.query(
        "SELECT status FROM orders WHERE id = $1 FOR UPDATE",
        [orderId],
      );

      if (currentOrderCheck.rows[0]?.status === "cancelled") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Order is already cancelled" });
      }

      const orderProduct = await client.query(
        `SELECT quantity, product_id FROM order_items WHERE order_id = $1`,
        [orderId],
      );

      const products = orderProduct.rows;
      for (let item of products) {
        await client.query(
          `UPDATE products SET stock = stock + $1 WHERE id = $2`,
          [item.quantity, item.product_id],
        );
      }

      const result = await client.query(
        `UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING *`,
        [orderId],
      );

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Order cancelled and stock restored",
        order: result.rows[0],
      });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cancellation Error:", error);
    res
      .status(500)
      .json({ message: "Transaction failed", error: error.message });
  } finally {
    client.release();
  }
});

export default router;
