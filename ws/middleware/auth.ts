import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "@attack-capital/db";

interface JWTPayload {
  userId: string;
  email: string;
}

export const authenticateSocket = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    // Get userId directly from handshake auth (passed from client)
    const userId = socket.handshake.auth.userId;

    if (!userId) {
      return next(new Error("Authentication error: No userId provided"));
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    // Attach user data to socket
    socket.data.userId = user.id;
    socket.data.userEmail = user.email;
    socket.data.userName = user.name;

    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication error: Invalid token"));
  }
};
