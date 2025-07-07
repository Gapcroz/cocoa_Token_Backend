import dotenv from "dotenv";
dotenv.config();

import express, { Express } from "express";
import cors from "cors";
import { connectDB } from "./config/database";
import authRoutes from "./routes/authRoutes";
import couponRoutes from "./routes/couponRoutes";

// Modelos de Mongoose
import "./models/user";
import "./models/coupon";

const app: Express = express();

// Get allowed origins from .env and split them into an array
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

app.use(
  cors({
    origin: allowedOrigins, // Use the array of origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// Rutas
app.use("/api", authRoutes);
app.use("/api/coupons", couponRoutes);

// Conexión y arranque
const PORT = parseInt(process.env.PORT || "3000", 10);

// conectar en local
// connectDB().then(() => {
//   app.listen(PORT, "0.0.0.0", () => {
//     console.log(`🚀 Server running on port ${PORT}`);
//   });
// });

//conectar en vercel
connectDB();
export default app;