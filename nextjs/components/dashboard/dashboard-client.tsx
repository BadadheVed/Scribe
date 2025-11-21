"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import RecordingControls from "../recording/recording-controls";
import SessionDetailsModal from "./session-details-modal";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface RecordingSession {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  duration?: number;
  createdAt: string;
  summary?: {
    fullText: string;
    keyPoints: string[];
    actionItems: string[];
  };
}

export default function DashboardClient({ user }: { user: User }) {
  const router = useRouter();
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection once when dashboard loads
  useEffect(() => {
    console.log("🔌 Initializing WebSocket connection for user:", user.id);

    const socket = io(
      process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000",
      {
        auth: { userId: user.id },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      }
    );

    socket.on("connect", () => {
      console.log("✅ WebSocket connected successfully");
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
    });

    socket.on("error", (error) => {
      console.error("❌ WebSocket error:", error);
    });

    socketRef.current = socket;

    // Cleanup on unmount - don't disconnect, just remove listeners
    return () => {
      console.log(
        "🔌 Cleaning up dashboard socket listeners (keeping connection alive)"
      );
      socket.off("connect");
      socket.off("disconnect");
      socket.off("error");
      // Only disconnect if user is actually leaving (not just hot reload)
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/dashboard")
      ) {
        socket.disconnect();
      }
    };
  }, [user.id]);

  // Fetch user's recording sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch("/api/sessions");
        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions || []);
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
      } finally {
        setLoadingSessions(false);
      }
    };

    fetchSessions();
  }, []);

  const refreshSessions = async () => {
    try {
      const response = await fetch("/api/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Error refreshing sessions:", error);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleCloseRecording = () => {
    setShowRecordingModal(false);
    refreshSessions(); // Refresh sessions list after recording
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  const totalRecordings = sessions.length;
  const totalDuration = sessions.reduce(
    (acc, session) => acc + (session.duration || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                ScribeAI
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  {user.name?.charAt(0).toUpperCase() ||
                    user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {user.name || user.email}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Hello, {user.name || user.email}!
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Welcome to your ScribeAI dashboard. Start recording to transcribe
              your meetings.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Recording Stats Card */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="shrink-0 bg-blue-500 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-white"
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
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total Recordings
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {totalRecordings}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Transcription Time Card */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="shrink-0 bg-green-500 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-white"
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
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total Duration
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {Math.floor(totalDuration / 60)} min
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Start Card */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="shrink-0 bg-purple-500 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Quick Actions
                      </dt>
                      <dd className="mt-1">
                        <button
                          onClick={() => setShowRecordingModal(true)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        >
                          Start Recording →
                        </button>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              Recent Sessions
            </h2>
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
              {loadingSessions ? (
                <div className="px-4 py-5 sm:p-6 text-center text-gray-500 dark:text-gray-400">
                  Loading sessions...
                </div>
              ) : sessions.length === 0 ? (
                <div className="px-4 py-5 sm:p-6 text-center text-gray-500 dark:text-gray-400">
                  No recording sessions yet. Click "Start Recording" to begin!
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <button
                        onClick={() => setSelectedSessionId(session.id)}
                        className="w-full px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                              {session.title || "Untitled Recording"}
                            </h3>
                            <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400 gap-4">
                              <span className="flex items-center gap-1">
                                <svg
                                  className="h-4 w-4"
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
                                {formatDuration(session.duration)}
                              </span>
                              <span className="flex items-center gap-1">
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                {formatDate(session.createdAt)}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                {session.sourceType}
                              </span>
                            </div>
                            {session.summary && (
                              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                {session.summary.fullText}
                              </p>
                            )}
                          </div>
                          <div className="ml-4 shrink-0">
                            <svg
                              className="h-5 w-5 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Recording Controls Modal */}
      {showRecordingModal && socketRef.current && (
        <RecordingControls
          socket={socketRef.current}
          onClose={handleCloseRecording}
        />
      )}

      {/* Session Details Modal */}
      {selectedSessionId && (
        <SessionDetailsModal
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}
