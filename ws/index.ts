import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "@attack-capital/db";
import { authenticateSocket } from "./middleware/auth";
import { handleRecordingEvents } from "./handlers/recording";

dotenv.config({ path: "../.env" });

const app = express();
const httpServer = createServer(app);

app.use(
  cors({
    origin: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Authentication middleware for Socket.IO
io.use(authenticateSocket);

// Handle socket connections
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}, User: ${socket.data.userId}`);

  // Register recording event handlers
  handleRecordingEvents(socket, io);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.WS_PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on http://localhost:${PORT}`);
});

export { io };
