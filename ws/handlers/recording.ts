import { Socket, Server } from "socket.io";
import { prisma, RecordingStatus, AudioSourceType } from "@attack-capital/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

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

  socket.on("audio-chunk", async (data: AudioChunkData) => {
    try {
      console.log(`\n[Audio Chunk] Received from client`);
      console.log(`   Session ID: ${data.sessionId}`);
      console.log(`   Timestamp: ${data.timestamp}s`);
      console.log(`   Size: ${data.chunk.length} bytes (base64)\n`);

      io.to(`session-${data.sessionId}`).emit("audio-chunk-received", {
        timestamp: data.timestamp,
        size: data.chunk.length,
      });

      const audioBuffer = Buffer.from(data.chunk, "base64");

      let transcriptionText = "";
      let confidence = 0.95;

      try {
        console.log(
          `[Gemini] Requesting transcription for chunk at ${data.timestamp}s (${audioBuffer.length} bytes)...`
        );

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Convert audio buffer to base64
        const audioBase64 = audioBuffer.toString("base64");

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: "audio/webm",
              data: audioBase64,
            },
          },
          "Transcribe this audio accurately. Return only the transcribed text without any additional formatting or explanation.",
        ]);

        const response = await result.response;
        transcriptionText = response.text().trim();

        console.log(
          `[Gemini] Response received for ${data.timestamp}s:`,
          transcriptionText
        );
      } catch (transcriptionError) {
        console.error(
          `[Gemini] Transcription error at ${data.timestamp}s:`,
          transcriptionError
        );
        transcriptionText = `[Transcription failed at ${data.timestamp}s]`;
        confidence = 0;
      }

      // Emit transcription progress to client
      console.log(`
[Server] Emitting transcription to client...`);
      console.log(`   Session: ${data.sessionId}`);
      console.log(`   Timestamp: ${data.timestamp}s`);
      console.log(`   Text: "${transcriptionText}"`);

      socket.emit("transcription-progress", {
        sessionId: data.sessionId,
        message: "Processing audio chunk...",
        text: transcriptionText,
        timestamp: data.timestamp,
      });

      console.log(`[Server] Transcription emitted successfully\n`);

      // 3. Store transcript in database
      await prisma.transcript.create({
        data: {
          sessionId: data.sessionId,
          text: transcriptionText,
          timestamp: data.timestamp,
          confidence,
        },
      });
    } catch (error) {
      console.error("Error processing audio chunk:", error);
      socket.emit("error", { message: "Failed to process audio chunk" });
    }
  });

  // Update recording status
  socket.on("update-status", async (data: UpdateStatusData, callback?) => {
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

      if (callback) callback({ success: true, session });
    } catch (error) {
      console.error("Error updating status:", error);
      if (callback)
        callback({ success: false, error: "Failed to update status" });
    }
  });

  // Stop recording and trigger processing
  socket.on("stop-recording", async ({ sessionId, duration }, callback) => {
    try {
      // Update session status to PROCESSING and save duration
      await prisma.recordingSession.update({
        where: { id: sessionId },
        data: {
          status: RecordingStatus.PROCESSING,
          duration: duration || 0,
        },
      });

      io.to(`session-${sessionId}`).emit("status-updated", {
        sessionId,
        status: "PROCESSING",
      });

      // Process the recording:
      // 1. Aggregate all transcripts
      const transcripts = await prisma.transcript.findMany({
        where: { sessionId },
        orderBy: { timestamp: "asc" },
      });

      const fullTranscript = transcripts.map((t) => t.text).join(" ");

      // 2. Send to Gemini for summarization
      let summaryData = null;
      try {
        console.log(
          `\n[Gemini] Generating summary for session ${sessionId}...`
        );
        console.log(
          `   Transcript length: ${fullTranscript.length} characters`
        );

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
Analyze the following transcript and provide a comprehensive summary in JSON format:

${fullTranscript}

Return a JSON object with the following structure:
{
  "fullText": "A concise summary of the entire content (2-3 paragraphs)",
  "keyPoints": ["Array of key discussion points and topics covered"],
  "actionItems": ["Array of specific action items and tasks mentioned"],
  "decisions": ["Array of decisions that were made"],
  "participants": ["Array of participant names mentioned in the conversation"]
}

Be thorough but concise. Extract only factual information from the transcript.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log(`[Gemini] Summary response received`);

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          summaryData = JSON.parse(jsonMatch[0]);

          // 3. Create Summary record
          await prisma.summary.create({
            data: {
              sessionId,
              fullText: summaryData.fullText || "No summary generated",
              keyPoints: summaryData.keyPoints || [],
              actionItems: summaryData.actionItems || [],
              decisions: summaryData.decisions || [],
              participants: summaryData.participants || [],
            },
          });

          console.log(
            `[Summary] Saved to database for session ${sessionId}`
          );
          console.log(
            `   Full Text: ${summaryData.fullText?.substring(0, 100)}...`
          );
          console.log(`   Key Points: ${summaryData.keyPoints?.length || 0}`);
          console.log(
            `   Action Items: ${summaryData.actionItems?.length || 0}`
          );
        }
      } catch (summaryError) {
        console.error(`[Summary] Error generating summary:`, summaryError);
        // Create a basic summary even if AI fails
        await prisma.summary.create({
          data: {
            sessionId,
            fullText: fullTranscript,
            keyPoints: [],
            actionItems: [],
            decisions: [],
            participants: [],
          },
        });
      }

      // 4. Update status to COMPLETED
      await prisma.recordingSession.update({
        where: { id: sessionId },
        data: { status: RecordingStatus.COMPLETED },
      });

      console.log(
        `\n[Recording] Session ${sessionId} completed successfully\n`
      );

      io.to(`session-${sessionId}`).emit("processing-complete", {
        sessionId,
        message: "Recording processed successfully",
        summary: summaryData,
      });

      socket.leave(`session-${sessionId}`);

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

  // Keep-alive ping handler
  socket.on("ping", (data) => {
    // Simply acknowledge to keep connection alive
    socket.emit("pong", { timestamp: Date.now() });
  });
};
