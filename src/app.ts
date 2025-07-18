import dotenv from "dotenv";
dotenv.config();

import express, { Express } from "express";
import cors from "cors";
import { connectDB } from "./config/database";
import authRoutes from "./routes/authRoutes";
import couponRoutes from "./routes/couponRoutes";
import storeRoutes from "./routes/storeRoutes";
import userCouponRoutes from "./routes/userCouponRoutes";
import eventRoutes from "./routes/eventRoutes";
import eventParticipationRoutes from "./routes/eventParticipationRoutes";
// import eventTaskRoutes from "./routes/eventTaskRoutes";
import taskRoutes from "./routes/taskRoutes";

// Modelos de Mongoose
import "./models/user";
import "./models/coupon";
import "./models/event";
import "./models/eventParticipation";
// import "./models/eventTask";
import "./models/userTaskCompletion";
import "./models/task";

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

// Endpoint de prueba para verificar que el servidor esté funcionando
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running', timestamp: new Date().toISOString() });
});

// Rutas
app.use("/api", authRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/user-coupons", userCouponRoutes);
app.use("/api", eventRoutes);
app.use("/api", eventParticipationRoutes);
// app.use("/api", eventTaskRoutes);
app.use("/api", taskRoutes);

// Conexión y arranque
const PORT = parseInt(process.env.PORT || "3000", 10);

// conectar en local
//  connectDB().then(() => {
//    app.listen(PORT, "0.0.0.0", () => {
//      console.log(`🚀 Server running on port ${PORT}`);
//    });
//  });

//conectar en vercel
connectDB();
export default app;