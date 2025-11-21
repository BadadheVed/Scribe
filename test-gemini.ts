import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GOOGLE_GEMINI_API_KEY not found in environment");
  process.exit(1);
}

console.log("🔑 API Key found:", apiKey.substring(0, 10) + "...");

async function testGeminiConnection() {
  try {
    console.log("\n🚀 Testing Gemini API connection...\n");

    const genAI = new GoogleGenerativeAI(apiKey!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Test 1: Simple text generation
    console.log("Test 1: Text Generation");
    const result = await model.generateContent("Say hello in one sentence.");
    const text = result.response.text();
    console.log("✅ Response:", text);

    // Test 2: Simulated transcription prompt
    console.log("\nTest 2: Transcription Simulation");
    const transcriptionPrompt = `You are a transcription AI. Convert this simulated audio description to text:
    
Audio: "Hello, this is a test recording. I am speaking clearly and slowly."

Respond with just the transcribed text.`;

    const transcriptionResult = await model.generateContent(
      transcriptionPrompt
    );
    const transcription = transcriptionResult.response.text();
    console.log("✅ Transcription:", transcription);

    // Test 3: Summary generation
    console.log("\nTest 3: Summary Generation");
    const summaryPrompt = `Summarize this meeting transcript and extract key points:

"We discussed the new feature implementation. John suggested using React hooks. Sarah mentioned the deadline is next Friday. We decided to have daily standups at 10 AM. Action items: John will create the component, Sarah will review the design."

Provide:
1. A brief summary
2. Key points (as bullet points)
3. Action items
4. Decisions made`;

    const summaryResult = await model.generateContent(summaryPrompt);
    const summary = summaryResult.response.text();
    console.log("✅ Summary:\n", summary);

    console.log("\n✅ All tests passed! Gemini API is working correctly.\n");
  } catch (error: any) {
    console.error("\n❌ Error testing Gemini API:");
    console.error("Message:", error.message);
    if (error.response) {
      console.error("Response:", error.response);
    }
    process.exit(1);
  }
}

testGeminiConnection();
