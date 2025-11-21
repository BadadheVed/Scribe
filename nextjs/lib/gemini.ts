import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  timestamp: number;
}

export interface SummaryResult {
  fullText: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  participants: string[];
}

/**
 * Transcribe audio chunk using Gemini API
 */
export async function transcribeAudioChunk(
  audioBuffer: Buffer,
  timestamp: number
): Promise<TranscriptionResult> {
  try {
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
    const text = response.text();

    return {
      text: text.trim(),
      timestamp,
      confidence: 0.95, // Gemini doesn't provide confidence scores, using default
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error("Failed to transcribe audio chunk");
  }
}

/**
 * Generate meeting summary from full transcript using Gemini
 */
export async function generateSummary(
  fullTranscript: string
): Promise<SummaryResult> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
Analyze the following meeting transcript and provide a comprehensive summary in JSON format:

${fullTranscript}

Return a JSON object with the following structure:
{
  "fullText": "A concise summary of the entire meeting (2-3 paragraphs)",
  "keyPoints": ["Array of key discussion points and topics covered"],
  "actionItems": ["Array of specific action items and tasks mentioned"],
  "decisions": ["Array of decisions that were made during the meeting"],
  "participants": ["Array of participant names mentioned in the conversation"]
}

Be thorough but concise. Extract only factual information from the transcript.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse summary response");
    }

    const summary: SummaryResult = JSON.parse(jsonMatch[0]);
    return summary;
  } catch (error) {
    console.error("Summary generation error:", error);
    throw new Error("Failed to generate summary");
  }
}

/**
 * Stream transcription for real-time updates (future enhancement)
 */
export async function streamTranscription(
  audioStream: ReadableStream,
  onTranscript: (text: string, timestamp: number) => void
): Promise<void> {
  // This would implement streaming transcription
  // For now, we'll use chunked approach in the socket handler
  throw new Error("Streaming transcription not yet implemented");
}
