"use client";

interface SessionDetailsProps {
  sessionId: string;
  onClose: () => void;
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

export default function SessionDetailsModal({
  sessionId,
  onClose,
}: SessionDetailsProps) {
  const [session, setSession] = React.useState<SessionData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"summary" | "transcript">(
    "summary"
  );

  React.useEffect(() => {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {loading
                  ? "Loading..."
                  : session?.title || "Untitled Recording"}
              </h2>
              {!loading && session && (
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
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
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg
                className="h-6 w-6"
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

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-8 px-6">
            <button
              onClick={() => setActiveTab("summary")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "summary"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab("transcript")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "transcript"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Transcript
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500 dark:text-gray-400">
                Loading session details...
              </div>
            </div>
          ) : activeTab === "summary" ? (
            <div className="space-y-6">
              {session?.summary ? (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Overview
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {session.summary.fullText}
                    </p>
                  </div>

                  {session.summary.keyPoints.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Key Points
                      </h3>
                      <ul className="space-y-2">
                        {session.summary.keyPoints.map((point, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              {i + 1}.
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {point}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {session.summary.actionItems.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Action Items
                      </h3>
                      <ul className="space-y-2">
                        {session.summary.actionItems.map((item, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="text-green-600 dark:text-green-400">
                              ✓
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {session.summary.decisions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Decisions
                      </h3>
                      <ul className="space-y-2">
                        {session.summary.decisions.map((decision, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="text-purple-600 dark:text-purple-400">
                              →
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {decision}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {session.summary.participants.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Participants
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {session.summary.participants.map((participant, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                          >
                            {participant}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                  No summary available for this session.
                </div>
              )}
            </div>
          ) : (
            <div>
              {session?.transcripts && session.transcripts.length > 0 ? (
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {session.transcripts.map((t) => t.text).join(" ")}
                  </p>
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                  No transcript available for this session.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <div className="flex gap-3">
            {activeTab === "summary" && session?.summary && (
              <button
                onClick={downloadSummary}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Download Summary
              </button>
            )}
            {activeTab === "transcript" &&
              session?.transcripts &&
              session.transcripts.length > 0 && (
                <button
                  onClick={downloadTranscript}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Download Transcript
                </button>
              )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Add React import
import React from "react";
