import { Socket, Server } from "socket.io";
import { prisma, RecordingStatus, AudioSourceType } from "@attack-capital/db";

interface StartRecordingData {
  sourceType: "MICROPHONE" | "TAB_SHARE" | "SCREEN_SHARE";
  title?: string;
}

interface AudioChunkData {
  sessionId: string;
  chunk: string; // Base64 encoded audio chunk
  timestamp: number;
}

interface UpdateStatusData {
  sessionId: string;
  status: "RECORDING" | "PAUSED" | "PROCESSING" | "COMPLETED";
}

export const handleRecordingEvents = (socket: Socket, io: Server) => {
  // Start a new recording session
  socket.on("start-recording", async (data: StartRecordingData, callback) => {
    try {
      const session = await prisma.recordingSession.create({
        data: {
          userId: socket.data.userId,
          title: data.title || `Recording ${new Date().toLocaleString()}`,
          sourceType: data.sourceType as AudioSourceType,
          status: RecordingStatus.RECORDING,
        },
      });

      // Join a room for this session
      socket.join(`session-${session.id}`);

      callback({ success: true, sessionId: session.id, session });
    } catch (error) {
      console.error("Error starting recording:", error);
      callback({ success: false, error: "Failed to start recording" });
    }
  });

  // Handle audio chunk streaming
  socket.on("audio-chunk", async (data: AudioChunkData) => {
    try {
      // Broadcast to room (for potential multi-client scenarios)
      io.to(`session-${data.sessionId}`).emit("audio-chunk-received", {
        timestamp: data.timestamp,
        size: data.chunk.length,
      });

      // Here you would process the chunk:
      // 1. Decode base64 chunk
      // 2. Send to Gemini API for transcription
      // 3. Store transcript in database
      // For now, we'll emit a processing event
      socket.emit("transcription-progress", {
        sessionId: data.sessionId,
        message: "Processing audio chunk...",
      });
    } catch (error) {
      console.error("Error processing audio chunk:", error);
      socket.emit("error", { message: "Failed to process audio chunk" });
    }
  });

  // Update recording status
  socket.on("update-status", async (data: UpdateStatusData, callback) => {
    try {
      const session = await prisma.recordingSession.update({
        where: { id: data.sessionId },
        data: { status: data.status as RecordingStatus },
      });

      // Broadcast status update to all clients in the session room
      io.to(`session-${data.sessionId}`).emit("status-updated", {
        sessionId: data.sessionId,
        status: data.status,
      });

      callback({ success: true, session });
    } catch (error) {
      console.error("Error updating status:", error);
      callback({ success: false, error: "Failed to update status" });
    }
  });

  // Stop recording and trigger processing
  socket.on("stop-recording", async ({ sessionId }, callback) => {
    try {
      // Update session status to PROCESSING
      await prisma.recordingSession.update({
        where: { id: sessionId },
        data: { status: RecordingStatus.PROCESSING },
      });

      io.to(`session-${sessionId}`).emit("status-updated", {
        sessionId,
        status: "PROCESSING",
      });

      // Here you would:
      // 1. Aggregate all transcripts
      // 2. Send to Gemini for summarization
      // 3. Create Summary record
      // 4. Update status to COMPLETED

      // For now, simulate processing
      setTimeout(async () => {
        await prisma.recordingSession.update({
          where: { id: sessionId },
          data: { status: RecordingStatus.COMPLETED },
        });

        io.to(`session-${sessionId}`).emit("processing-complete", {
          sessionId,
          message: "Recording processed successfully",
        });

        socket.leave(`session-${sessionId}`);
      }, 2000);

      callback({ success: true });
    } catch (error) {
      console.error("Error stopping recording:", error);
      callback({ success: false, error: "Failed to stop recording" });
    }
  });

  // Get session details
  socket.on("get-session", async ({ sessionId }, callback) => {
    try {
      const session = await prisma.recordingSession.findUnique({
        where: { id: sessionId },
        include: {
          transcripts: {
            orderBy: { timestamp: "asc" },
          },
          summary: true,
        },
      });

      if (!session) {
        callback({ success: false, error: "Session not found" });
        return;
      }

      callback({ success: true, session });
    } catch (error) {
      console.error("Error fetching session:", error);
      callback({ success: false, error: "Failed to fetch session" });
    }
  });
};
