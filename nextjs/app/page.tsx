import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-gray-900">
      <main className="flex flex-col items-center justify-center flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          ScribeAI
        </h1>

        <p className="mt-3 text-2xl text-gray-600 max-w-2xl">
          AI-powered audio transcription and meeting notes. Never miss an
          important detail again.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6 mt-12">
          <Link
            href="/login"
            className="px-8 py-3 text-lg font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-colors shadow-lg"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="px-8 py-3 text-lg font-semibold text-blue-600 border-2 border-blue-600 rounded-full hover:bg-blue-50 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </main>
    </div>
  );
}
