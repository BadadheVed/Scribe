# ScribeAI - AI-Powered Meeting Transcription App

A full-stack application for capturing and transcribing audio sessions with real-time AI transcription using Google Gemini.

## Project Structure

```
attack-capital/
├── nextjs/          # Next.js frontend and API routes
├── ws/              # WebSocket server for real-time streaming
├── db/              # Prisma database package (shared)
└── .env            # Environment variables
```

## Features

- 🎙️ **Real-time Audio Transcription**: Capture from microphone or tab share
- 🤖 **AI-Powered Summaries**: Automatic meeting summaries with key points and action items
- 📝 **Session Management**: Save, view, and export all your transcription sessions
- 🔐 **Secure Authentication**: JWT-based auth with HTTP-only cookies
- ⚡ **Real-time Updates**: Socket.io for live transcription status

## Tech Stack

- **Frontend/Backend**: Next.js 15 (App Router, TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Custom JWT authentication
- **Real-time**: Socket.io for WebSocket connections
- **AI**: Google Gemini API for transcription and summarization
- **Styling**: Tailwind CSS

## Setup Instructions

### Prerequisites

- Node.js 20+
- PostgreSQL database
- pnpm package manager
- Google Gemini API key

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd attack-capital
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   Update `.env` with your configuration:

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/attack?schema=public"
   BETTER_AUTH_SECRET="your-secret-key"
   BETTER_AUTH_URL="http://localhost:3000"
   NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
   NEXT_PUBLIC_WS_URL="http://localhost:4000"
   GOOGLE_GEMINI_API_KEY="your-gemini-api-key"
   JWT_SECRET="your-jwt-secret"
   ```

4. **Setup database**

   ```bash
   pnpm db:migrate
   ```

5. **Start development servers**

   ```bash
   pnpm dev
   ```

   This starts:

   - Next.js on `http://localhost:3000`
   - WebSocket server on `http://localhost:4000`

## Usage

1. **Sign Up**: Create an account at `/signup`
2. **Login**: Sign in at `/login`
3. **Dashboard**: After login, you'll be redirected to `/dashboard`
4. **Start Recording**: Click "Start Recording" to begin transcribing

## Architecture

### Database Schema

- **User**: User accounts
- **Account**: Authentication credentials
- **Session**: Better Auth sessions
- **RecordingSession**: Recording metadata
- **Transcript**: Chunked transcriptions
- **Summary**: AI-generated meeting summaries

### Authentication Flow

1. User signs up/logs in via Next.js API routes
2. JWT token generated and stored in HTTP-only cookie
3. Token passed to WebSocket server for real-time connections
4. Server validates token on each WebSocket connection

### Recording Flow

1. Client initiates recording session
2. Audio chunks streamed via Socket.io
3. Server processes chunks with Gemini API
4. Transcripts stored in database
5. On stop, AI generates summary
6. Session marked as COMPLETED

## Development

- `pnpm dev` - Start all services in development mode
- `pnpm build` - Build for production
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Prisma Studio

## License

MIT
