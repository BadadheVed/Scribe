"use client";

import { useState, useRef, useEffect } from "react";
import { Socket } from "socket.io-client";

interface RecordingControlsProps {
  onClose: () => void;
  socket: Socket;
}

type RecordingStatus =
  | "idle"
  | "recording"
  | "paused"
  | "processing"
  | "completed";
type SourceType = "microphone" | "tab";

export default function RecordingControls({
  onClose,
  socket,
}: RecordingControlsProps) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [sourceType, setSourceType] = useState<SourceType>("microphone");
  const [duration, setDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const durationRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const lastSentTimestampRef = useRef<number>(-1);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket event listeners
  useEffect(() => {
    console.log("🎧 Setting up socket event listeners");
    console.log("🔌 Socket connected:", socket.connected);

    socket.on("connect", () => {
      console.log("✅ Socket reconnected during recording");
    });

    socket.on("disconnect", (reason) => {
      console.warn("⚠️ Socket disconnected during recording:", reason);
    });

    socket.on("transcription-progress", (data) => {
      console.log("\n📝 [Client] Transcription received:", data);
      console.log(`   Timestamp: ${data.timestamp}s`);
      console.log(`   Text: "${data.text}"`);

      if (data.text) {
        setTranscript((prev) => {
          const updated = prev ? prev + " " + data.text : data.text;
          console.log(`   Updated transcript length: ${updated.length} chars`);
          console.log(`   Full transcript: "${updated}"\n`);
          return updated;
        });
      } else {
        console.warn("   ⚠️ No text in transcription data\n");
      }
    });

    socket.on("status-updated", (data) => {
      console.log("🔄 Status updated:", data);
    });

    socket.on("processing-complete", (data) => {
      console.log("✅ Processing complete:", data);
      console.log("📊 Summary data:", JSON.stringify(data.summary, null, 2));
      if (data.summary) {
        console.log("📊 Summary fullText:", data.summary.fullText);
        console.log("📊 Summary keyPoints:", data.summary.keyPoints);
        setSummaryData(data.summary);
      } else {
        console.warn("⚠️ No summary data received");
      }
      setStatus("completed");
      setShowSaveDialog(true);
    });

    socket.on("error", (data) => {
      console.error("❌ Socket error:", data);
      setError(data.message);
    });

    // Cleanup listeners when component unmounts
    return () => {
      console.log("🧹 Cleaning up socket event listeners");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("transcription-progress");
      socket.off("status-updated");
      socket.off("processing-complete");
      socket.off("error");
    };
  }, [socket]);

  // Timer for duration
  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          durationRef.current = newDuration; // Keep ref in sync
          return newDuration;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  const startRecording = async (source: SourceType) => {
    try {
      setError("");
      setSourceType(source);
      let stream: MediaStream;

      if (source === "tab") {
        // Request tab audio capture - must include video for browser compatibility
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Required for tab audio capture
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          } as any,
        });

        // Check if audio track exists
        const audioTrack = displayStream.getAudioTracks()[0];
        if (!audioTrack) {
          // Stop video track since we don't need it
          displayStream.getVideoTracks().forEach((track) => track.stop());
          throw new Error(
            "No audio track available. Make sure to check 'Share audio' when selecting the tab."
          );
        }

        // Create new stream with only audio track
        stream = new MediaStream([audioTrack]);

        // Stop video track as we only need audio
        displayStream.getVideoTracks().forEach((track) => track.stop());
      } else {
        // Request microphone
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        });
      }

      streamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle data available - accumulate chunks and send complete WebM files
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const currentTimestamp = durationRef.current;

          console.log(
            `\n🎬 [MediaRecorder] Data available: ${event.data.size} bytes at ${currentTimestamp}s`
          );

          // Add chunk to accumulator
          chunksRef.current.push(event.data);

          // Send whenever ondataavailable fires (controlled by timeslice=30000)
          // Create complete WebM from all chunks (includes headers)
          const completeBlob = new Blob(chunksRef.current, {
            type: "audio/webm",
          });

          console.log(
            `\n📤 [Client] Sending complete audio: ${completeBlob.size} bytes (${chunksRef.current.length} chunks) at ${currentTimestamp}s`
          );

          if (sessionIdRef.current && socket && socket.connected) {
            const currentSessionId = sessionIdRef.current;

            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Audio = reader.result as string;
              const base64Data = base64Audio.split(",")[1];

              console.log(
                `📡 [Client] Emitting audio-chunk to server (${base64Data.length} bytes base64)`
              );
              console.log(`   Session ID: ${currentSessionId}`);
              console.log(`   Timestamp: ${currentTimestamp}s`);
              console.log(
                `   Total chunks combined: ${chunksRef.current.length}\n`
              );

              socket.emit("audio-chunk", {
                sessionId: currentSessionId,
                chunk: base64Data,
                timestamp: currentTimestamp,
              });

              // Keep chunks for next interval (includes headers)
            };

            reader.readAsDataURL(completeBlob);
          }
        }
      };

      // Create recording session
      if (socket) {
        socket.emit(
          "start-recording",
          {
            sourceType: source === "tab" ? "TAB_SHARE" : "MICROPHONE",
            title: `${
              source === "tab" ? "Tab" : "Mic"
            } Recording ${new Date().toLocaleString()}`,
          },
          (response: any) => {
            if (response.success) {
              setSessionId(response.sessionId);
              sessionIdRef.current = response.sessionId;
              console.log("Recording session created:", response.sessionId);
              console.log("Starting MediaRecorder with 20-second timeslice\n");

              // Start recording with 20-second timeslice
              // This will trigger ondataavailable every 20 seconds
              // Larger chunks are needed for Gemini API to process audio properly
              mediaRecorder.start(20000);
              setStatus("recording");
              setDuration(0);
              durationRef.current = 0; // Reset duration ref
              chunksRef.current = []; // Clear chunks array
              lastSentTimestampRef.current = -1; // Reset last sent timestamp
              setTranscript("");

              // Start keep-alive ping to prevent socket timeout
              pingIntervalRef.current = setInterval(() => {
                if (socket.connected) {
                  console.log("💓 Sending keep-alive ping");
                  socket.emit("ping", { sessionId: response.sessionId });
                }
              }, 5000); // Ping every 5 seconds
            } else {
              setError("Failed to create recording session");
            }
          }
        );
      }
    } catch (err: any) {
      console.error("Error starting recording:", err);
      if (err.name === "NotAllowedError") {
        setError("Permission denied. Please allow access to capture audio.");
      } else {
        setError("Failed to start recording: " + err.message);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.pause();
      setStatus("paused");

      if (socket && sessionIdRef.current) {
        socket.emit("update-status", {
          sessionId: sessionIdRef.current,
          status: "PAUSED",
        });
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && status === "paused") {
      mediaRecorderRef.current.resume();
      setStatus("recording");

      if (socket && sessionIdRef.current) {
        socket.emit("update-status", {
          sessionId: sessionIdRef.current,
          status: "RECORDING",
        });
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setStatus("processing");

      // Clear keep-alive ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Handle stop event
      mediaRecorderRef.current.onstop = async () => {
        console.log("🛑 Recording stopped, sending final status to server");

        // Stop recording session
        if (socket && sessionIdRef.current) {
          socket.emit(
            "stop-recording",
            { sessionId: sessionIdRef.current, duration: duration },
            (response: any) => {
              if (response.success) {
                console.log("✅ Recording stopped successfully");
              }
            }
          );
        }

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };
    }
  };

  const exitRecording = () => {
    if (status === "recording" || status === "paused") {
      stopRecording();
    } else {
      onClose();
    }
  };

  const handleSaveSession = async () => {
    if (!sessionTitle.trim()) {
      setError("Please enter a title for your recording");
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: sessionTitle }),
      });

      if (response.ok) {
        console.log("✅ Session saved with title:", sessionTitle);
        setShowSaveDialog(false);
        onClose();
      } else {
        setError("Failed to save session");
      }
    } catch (err) {
      console.error("Error saving session:", err);
      setError("Failed to save session");
    }
  };

  const handleDiscardSession = async () => {
    try {
      if (sessionIdRef.current) {
        await fetch(`/api/sessions/${sessionIdRef.current}`, {
          method: "DELETE",
        });
        console.log("🗑️ Session discarded");
      }
      onClose();
    } catch (err) {
      console.error("Error discarding session:", err);
      onClose();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  if (status === "idle") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Start Recording
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Choose your audio source:
          </p>

          <div className="space-y-4">
            <button
              onClick={() => startRecording("microphone")}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Microphone
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Record from your microphone
                </p>
              </div>
            </button>

            <button
              onClick={() => startRecording("tab")}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Browser Tab
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Capture audio from a tab (Meet, Zoom, etc.)
                </p>
              </div>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-6 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Floating control bar
  return (
    <>
      {/* Transcript Box - Above floating bar */}
      {(status === "recording" || status === "paused") && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Live Transcript
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {transcript
                  ? `${
                      transcript.split(" ").filter((w) => w.length > 0).length
                    } words`
                  : "Waiting for audio..."}
              </span>
            </div>
            <div className="text-sm text-gray-900 dark:text-white leading-relaxed max-h-32 overflow-y-auto">
              {transcript ||
                "Listening... Transcript will appear here after 20 seconds of audio."}
            </div>
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Save Recording
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your recording has been processed successfully!
            </p>

            {/* Always show summary section */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700">
              {summaryData ? (
                <>
                  {summaryData.fullText && (
                    <div className="text-gray-700 dark:text-gray-300 mb-3">
                      <strong className="text-base text-gray-900 dark:text-white">
                        Summary:
                      </strong>
                      <p className="mt-1 text-gray-800 dark:text-gray-200">
                        {summaryData.fullText}
                      </p>
                    </div>
                  )}
                  {summaryData.keyPoints &&
                    summaryData.keyPoints.length > 0 && (
                      <div className="mt-3">
                        <strong className="text-gray-900 dark:text-white">
                          Key Points:
                        </strong>
                        <ul className="list-disc list-inside mt-1 text-gray-700 dark:text-gray-300 space-y-1">
                          {summaryData.keyPoints
                            .slice(0, 3)
                            .map((point: string, i: number) => (
                              <li key={i}>{point}</li>
                            ))}
                          {summaryData.keyPoints.length > 3 && (
                            <li className="text-blue-600 dark:text-blue-400 font-medium">
                              +{summaryData.keyPoints.length - 3} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  {summaryData.actionItems &&
                    summaryData.actionItems.length > 0 && (
                      <div className="mt-3">
                        <strong className="text-gray-900 dark:text-white">
                          Action Items:
                        </strong>
                        <ul className="list-disc list-inside mt-1 text-gray-700 dark:text-gray-300 space-y-1">
                          {summaryData.actionItems
                            .slice(0, 3)
                            .map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          {summaryData.actionItems.length > 3 && (
                            <li className="text-blue-600 dark:text-blue-400 font-medium">
                              +{summaryData.actionItems.length - 3} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    Summary is being generated... If this takes too long, the
                    recording might have been too short.
                  </p>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recording Title
              </label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="e.g., Team Meeting - Product Launch"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSaveSession()}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveSession}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Save Recording
              </button>
              <button
                onClick={handleDiscardSession}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating control bar */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-gray-900 text-white rounded-full shadow-2xl px-6 py-3 flex items-center gap-6">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                status === "recording"
                  ? "bg-red-500 animate-pulse"
                  : status === "paused"
                  ? "bg-yellow-500"
                  : "bg-blue-500"
              }`}
            />
            <span className="text-sm font-medium">
              {status === "recording"
                ? "Recording"
                : status === "paused"
                ? "Paused"
                : "Processing"}
            </span>
          </div>

          {/* Timer - More visible */}
          <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-xl font-mono font-bold">
              {formatTime(duration)}
            </div>
          </div>

          {/* Source type */}
          <div className="text-xs bg-gray-800 px-3 py-1.5 rounded-lg font-medium">
            {sourceType === "tab" ? "🎵 Tab Audio" : "🎤 Microphone"}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {status === "recording" && (
              <button
                onClick={pauseRecording}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                title="Pause"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              </button>
            )}

            {status === "paused" && (
              <button
                onClick={resumeRecording}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                title="Resume"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            )}

            {(status === "recording" || status === "paused") && (
              <button
                onClick={stopRecording}
                className="p-2 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                title="Stop"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
              </button>
            )}

            <button
              onClick={exitRecording}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors ml-2"
              title="Exit"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
