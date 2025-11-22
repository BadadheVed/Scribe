"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import RecordingControls from "../recording/recording-controls";

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
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ScribeAI
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {user.name?.charAt(0).toUpperCase() ||
                    user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {user.name || user.email}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Hero Section with Gradient */}
          <div className="mb-8 rounded-2xl p-8">
            <h2 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Hello, {user.name || user.email.split('@')[0]}!
            </h2>
            <p className="text-black text-lg">
              Welcome to your ScribeAI dashboard. Start recording to transcribe your meetings.
            </p>
            <button
              onClick={() => setShowRecordingModal(true)}
              className="mt-6 px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-md"
            >
              Start Recording
            </button>
          </div>

          {/* Summary Section */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Summary</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Recording Stats Card */}
              <div className="bg-white border border-gray-200 overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-3">
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
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Recordings
                        </dt>
                        <dd className="text-2xl font-bold text-gray-900">
                          {totalRecordings}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transcription Time Card */}
              <div className="bg-white border border-gray-200 overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="shrink-0 bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-3">
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
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Duration
                        </dt>
                        <dd className="text-2xl font-bold text-gray-900">
                          {Math.floor(totalDuration / 60)} min
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sessions Count Card */}
              <div className="bg-white border border-gray-200 overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="shrink-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-3">
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Active Sessions
                        </dt>
                        <dd className="text-2xl font-bold text-gray-900">
                          {sessions.filter(s => s.status === 'COMPLETED').length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Recent Sessions
            </h2>
            <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-xl">
              {loadingSessions ? (
                <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                  Loading sessions...
                </div>
              ) : sessions.length === 0 ? (
                <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                  No recording sessions yet. Click "Start Recording" to begin!
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <button
                        onClick={() => router.push(`/dashboard/sessions/${session.id}`)}
                        className="w-full px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-medium text-gray-900 truncate">
                              {session.title || "Untitled Recording"}
                            </h3>
                            <div className="mt-2 flex items-center text-sm text-gray-500 gap-4">
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
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {session.sourceType}
                              </span>
                            </div>
                            {session.summary && (
                              <p className="mt-2 text-sm text-gray-600 line-clamp-2">
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
      {showRecordingModal && (
        <RecordingControls
          user={user}
          onClose={handleCloseRecording}
        />
      )}
    </div>
  );
}
