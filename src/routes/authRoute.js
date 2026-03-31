import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!username || !password || !email) {
      return res
        .status(400)
        .json({ message: "Username , email and password is required!" });
    }
    const isEmail = username.includes("@");

    let existingUSer;

    if (isEmail) {
      existingUSer = await pool.query(
        `SELECT id FROM users WHERE email=$1`,
        [email],
      );
    } else {
      existingUSer = await pool.query(`SELECT id FROM users WHERE username=$1`, [username]);
    }

    if (existingUSer.rows.length) {
      return res.status(409).json({ message: "User already exists!" });
    }

    const hashedPassword = bcrypt.hashSync(password, 8);

    const result = await pool.query(
      `INSERT INTO users(email, username, password) VALUES($1,$2,$3) RETURNING id,username`,
      [email, username, hashedPassword],
    );

    const user = result.rows[0];

    const token = jwt.sign({ id: user.id }, process.env.SECRET_KEY, {
      expiresIn: "1d",
    });
    res.json({ success: true, token: token, userId: user.id });
  } catch (err) {
    console.log(err);
    res.sendStatus(501);
  }
  res.json({ success: true, message: "User registered successfully." });
});

router.post("/forgot_password", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required!" });
    }

    const existingUser = await pool.query(
      `SELECT id FROM users WHERE username=$1`,
      [username],
    );

    if (!existingUser.rows.length) {
      return res.status(404).json({ message: "User doesn't exist!" });
    }

    const userId = existingUser.rows[0].id;
    const hashedPassword = bcrypt.hashSync(password, 8);

    await pool.query(
      `UPDATE users SET password = $1 WHERE id = $2 RETURNING id, username`,
      [hashedPassword, userId],
    );

    // Use return here to stop the function
    return res.json({ success: true, message: "Password updated!" });
  } catch (err) {
    console.log(err);
    // Use return here too
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(`SELECT * FROM users WHERE email=$1`, [
      email,
    ]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).send({ message: "User not found!!" });
    }

    const passwordIsValid = bcrypt.compareSync(password, user.password);

    if (!passwordIsValid) {
      return res.status(401).send({ message: "Invalid password" });
    }

    const token = jwt.sign({ id: user.id }, process.env.SECRET_KEY, {
      expiresIn: "1d",
    });
    res.json({ success: "true", token, userId: user.id });
  } catch (err) {
    console.log(err.message);
    res.sendStatus(501);
  }
});

export default router;
