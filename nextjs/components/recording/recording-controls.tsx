"use client";

import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";

interface RecordingControlsProps {
  onClose: () => void;
  userId: string;
}

type RecordingStatus = "idle" | "recording" | "paused" | "processing";
type SourceType = "microphone" | "tab";

export default function RecordingControls({
  onClose,
  userId,
}: RecordingControlsProps) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [sourceType, setSourceType] = useState<SourceType>("microphone");
  const [duration, setDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [error, setError] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null); // Add ref for sessionId

  // Initialize socket connection
  useEffect(() => {
    if (!userId) {
      setError("Not authenticated");
      return;
    }

    const socket = io(
      process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000",
      {
        auth: { userId },
      }
    );

    socket.on("connect", () => {
      console.log("Socket connected");
    });

    socket.on("transcription-progress", (data) => {
      console.log("Transcription progress:", data);
      if (data.text) {
        setTranscript((prev) => prev + " " + data.text);
      }
    });

    socket.on("status-updated", (data) => {
      console.log("Status updated:", data);
    });

    socket.on("processing-complete", (data) => {
      console.log("Processing complete:", data);
      setStatus("idle");
    });

    socket.on("error", (data) => {
      console.error("Socket error:", data);
      setError(data.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  // Timer for duration
  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
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
      chunksRef.current = [];

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Create recording session
      if (socketRef.current) {
        socketRef.current.emit(
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
              sessionIdRef.current = response.sessionId; // Store in ref too
              console.log("Recording session created:", response.sessionId);

              // Start sending chunks after session is created
              chunkIntervalRef.current = setInterval(() => {
                if (chunksRef.current.length > 0 && sessionIdRef.current) {
                  sendAudioChunk();
                }
              }, 30000);
            } else {
              setError("Failed to create recording session");
            }
          }
        );
      }

      // Start recording
      mediaRecorder.start();
      setStatus("recording");
      setDuration(0);
      setTranscript("");
    } catch (err: any) {
      console.error("Error starting recording:", err);
      if (err.name === "NotAllowedError") {
        setError("Permission denied. Please allow access to capture audio.");
      } else {
        setError("Failed to start recording: " + err.message);
      }
    }
  };

  const sendAudioChunk = async () => {
    const currentSessionId = sessionIdRef.current;
    if (
      chunksRef.current.length === 0 ||
      !currentSessionId ||
      !socketRef.current
    )
      return;

    const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
    const reader = new FileReader();

    reader.onloadend = () => {
      const base64Audio = reader.result as string;
      const base64Data = base64Audio.split(",")[1];

      socketRef.current?.emit("audio-chunk", {
        sessionId: currentSessionId,
        chunk: base64Data,
        timestamp: duration,
      });

      // Clear chunks after sending
      chunksRef.current = [];
    };

    reader.readAsDataURL(audioBlob);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.pause();
      setStatus("paused");

      if (socketRef.current && sessionIdRef.current) {
        socketRef.current.emit("update-status", {
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

      if (socketRef.current && sessionIdRef.current) {
        socketRef.current.emit("update-status", {
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

      // Send final chunk
      mediaRecorderRef.current.onstop = async () => {
        // Send remaining chunks
        if (chunksRef.current.length > 0) {
          await sendAudioChunk();
        }

        // Stop recording session
        if (socketRef.current && sessionIdRef.current) {
          socketRef.current.emit(
            "stop-recording",
            { sessionId: sessionIdRef.current },
            (response: any) => {
              if (response.success) {
                console.log("Recording stopped successfully");
              }
            }
          );
        }

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Clear intervals
        if (chunkIntervalRef.current) {
          clearInterval(chunkIntervalRef.current);
          chunkIntervalRef.current = null;
        }
      };
    }
  };

  const exitRecording = () => {
    if (status === "recording" || status === "paused") {
      stopRecording();
    }
    onClose();
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

        {/* Timer */}
        <div className="text-lg font-mono font-bold">
          {formatTime(duration)}
        </div>

        {/* Source type */}
        <div className="text-xs bg-gray-800 px-2 py-1 rounded">
          {sourceType === "tab" ? "Tab Audio" : "Microphone"}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {status === "recording" && (
            <button
              onClick={pauseRecording}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              title="Pause"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
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
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
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
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
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

        {/* Transcript preview */}
        {transcript && (
          <div className="max-w-md text-xs bg-gray-800 px-4 py-2 rounded-lg max-h-20 overflow-y-auto">
            <div className="text-gray-400 mb-1">Live Transcript:</div>
            <div className="text-white">{transcript}</div>
          </div>
        )}
      </div>
    </div>
  );
}
