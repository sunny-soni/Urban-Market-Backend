import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoute.js";
import authMiddleware from "./middleware/authMiddleware.js";
import productRoutes from "./routes/productRoute.js";
import cartRoutes from "./routes/cartRoute.js";
import orderRoutes from "./routes/orderRoute.js";
import wishlistRoutes from "./routes/wishlistsRoute.js";
import paymentRoute from "./routes/payment.js";
import chatRoute from "./routes/chat.js"
import recommendationRoute from "./routes/recommendation.js"
import { pool } from "../db.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://urban-market-steel.vercel.app/",
    ],
    credentials: true,
  }),
);

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "OK",
      db: "connected",
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      db: "disconnected",
      error: err.message,
    });
  }
});

app.use("/auth", authRoutes);
app.use("/product", authMiddleware, productRoutes);
app.use("/cart", authMiddleware, cartRoutes);
app.use("/order", authMiddleware, orderRoutes);
app.use("/wishlist", authMiddleware, wishlistRoutes);
app.use("/api/payments", authMiddleware, paymentRoute);
app.use("/api/recommendations", authMiddleware, recommendationRoute);
app.use("/api/chat", chatRoute);

app.listen(PORT, () => {
  console.log(`Server has started at port ${PORT}`);
});
