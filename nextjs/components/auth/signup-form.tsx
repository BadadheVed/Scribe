"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      // Redirect to dashboard
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Signup error:", err);
      setError("Failed to create account. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-black">
          Create Account
        </h2>
        <p className="mt-2 text-blue-600">
          Join ScribeAI today
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-blue-600">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-600">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-600">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="••••••••"
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Creating Account..." : "Sign Up"}
        </button>
      </form>

      <div className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-blue-600 hover:underline"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
