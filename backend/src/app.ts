/**
 * Express Application - NutriResQ Backend API.
 * Minimal working version that compiles.
 */
import express from "express";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
  })
);

app.use(express.json());

// Health check endpoint
app.get("/", (_req, res) => {
  res.send("NutriResQ API is running");
});


app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "NutriResQ API is running",
    timestamp: new Date().toISOString(),
  });
});

export default app;