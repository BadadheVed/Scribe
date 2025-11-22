"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SessionDetailsProps {
  sessionId: string;
}

interface SessionData {
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
    decisions: string[];
    participants: string[];
  };
  transcripts?: Array<{
    text: string;
    timestamp: number;
  }>;
}

export default function SessionDetailsClient({
  sessionId,
}: SessionDetailsProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"summary" | "transcript">(
    "summary"
  );

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setSession(data.session);
        }
      } catch (error) {
        console.error("Error fetching session:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const downloadTranscript = () => {
    if (!session) return;

    const fullTranscript =
      session.transcripts?.map((t) => t.text).join(" ") || "";

    const blob = new Blob([fullTranscript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.title || "transcript"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSummary = () => {
    if (!session?.summary) return;

    const summaryText = `
${session.title}
${formatDate(session.createdAt)}
Duration: ${formatDuration(session.duration)}

SUMMARY
${session.summary.fullText}

KEY POINTS
${session.summary.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

ACTION ITEMS
${session.summary.actionItems.map((p, i) => `${i + 1}. ${p}`).join("\n")}

DECISIONS
${session.summary.decisions.map((p, i) => `${i + 1}. ${p}`).join("\n")}

PARTICIPANTS
${session.summary.participants.join(", ")}
`.trim();

    const blob = new Blob([summaryText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.title || "summary"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Loading session details...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Session not found</p>
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium mb-4 transition-colors"
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {session.title || "Untitled Recording"}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
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
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab("summary")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "summary"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab("transcript")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "transcript"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Transcript
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "summary" ? (
          <div className="space-y-8">
            {session.summary ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Overview
                    </h2>
                    <button
                      onClick={downloadSummary}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Download Summary
                    </button>
                  </div>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    {session.summary.fullText}
                  </p>
                </div>

                {session.summary.keyPoints.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      Key Points
                    </h3>
                    <ul className="space-y-3">
                      {session.summary.keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-blue-600 font-semibold flex-shrink-0">
                            {i + 1}.
                          </span>
                          <span className="text-gray-700">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {session.summary.actionItems.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      Action Items
                    </h3>
                    <ul className="space-y-3">
                      {session.summary.actionItems.map((item, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-green-600 flex-shrink-0">
                            ✓
                          </span>
                          <span className="text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {session.summary.decisions.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      Decisions
                    </h3>
                    <ul className="space-y-3">
                      {session.summary.decisions.map((decision, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-purple-600 flex-shrink-0">
                            →
                          </span>
                          <span className="text-gray-700">{decision}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {session.summary.participants.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      Participants
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {session.summary.participants.map((participant, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                        >
                          {participant}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-500 py-12">
                No summary available for this session.
              </div>
            )}
          </div>
        ) : (
          <div>
            {session.transcripts && session.transcripts.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Full Transcript
                  </h2>
                  <button
                    onClick={downloadTranscript}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Download Transcript
                  </button>
                </div>
                <div className="prose max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-lg">
                    {session.transcripts.map((t) => t.text).join(" ")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                No transcript available for this session.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
