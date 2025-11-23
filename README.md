# ScribeAI - AI-Powered Meeting Transcription App

A full-stack monorepo application for capturing and transcribing audio sessions with real-time AI transcription using Google Gemini.

## Project Structure

```
attack-capital/
├── nextjs/          # Next.js frontend and API routes
├── ws/              # WebSocket server for real-time audio streaming
├── db/              # Prisma database package (shared across workspaces)
├── .env             # Environment variables (root - used by all workspaces)
└── .env.example     # Environment variables template
```

## Features

- 🎙️ **Real-time Audio Transcription**: Capture from microphone or browser tab
- 🤖 **AI-Powered Summaries**: Automatic meeting summaries with key points, action items, and decisions
- 📝 **Session Management**: Save, view, and manage all your transcription sessions
- 🔐 **Secure Authentication**: JWT-based authentication with HTTP-only cookies
- ⚡ **Real-time Updates**: Socket.io for live transcription streaming
- 💾 **Export Capabilities**: Download transcripts and summaries
- 🎨 **Modern UI**: Clean white and blue theme with smooth animations

## Tech Stack

- **Frontend/Backend**: Next.js 15 (App Router, TypeScript, React 19)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Custom JWT authentication
- **Real-time**: Socket.io for WebSocket connections
- **AI**: Google Gemini 2.0 Flash for transcription and summarization
- **Styling**: Tailwind CSS v4
- **Package Manager**: pnpm with workspaces

## Setup Instructions

### Prerequisites

- Node.js 20+
- PostgreSQL database
- pnpm package manager (`npm install -g pnpm`)
- Google Gemini API key ([Get one here](https://ai.google.dev/))

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

   Copy the example file and update with your values:

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your configuration:

   ```env
   # Database Connection
   DATABASE_URL="postgresql://user:password@localhost:5432/database_name?schema=public"

   # Authentication
   JWT_SECRET="your-secure-random-secret-key-here"
   BETTER_AUTH_SECRET="your-better-auth-secret-here"

   # Google Gemini API
   GOOGLE_GEMINI_API_KEY="your-gemini-api-key-here"

   # Server URLs (for CORS and client connections)
   BETTER_AUTH_URL="http://localhost:3000"
   NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
   NEXT_PUBLIC_WS_URL="http://localhost:4000"

   # WebSocket Server Port
   WS_PORT=4000
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

1. **Sign Up**: Create an account at `http://localhost:3000/signup`
2. **Login**: Sign in at `http://localhost:3000/login`
3. **Dashboard**: After login, you'll be redirected to `/dashboard`
4. **Start Recording**: 
   - Click "Start Recording" button
   - Choose audio source (Microphone or Browser Tab)
   - Recording starts automatically
5. **View Transcripts**: Live transcription appears in real-time
6. **Stop & Save**: Stop recording to generate AI summary
7. **View Sessions**: Click any session to see full transcript and summary

## Architecture

### Monorepo Structure

This project uses pnpm workspaces with three packages:

- **nextjs**: Frontend UI and API routes
- **ws**: WebSocket server for real-time audio processing
- **db**: Shared Prisma database client

All packages share a single `.env` file at the root.

### Database Schema

- **User**: User accounts with email and hashed passwords
- **RecordingSession**: Recording metadata (title, duration, status, source type)
- **Transcript**: Chunked transcriptions with timestamps
- **Summary**: AI-generated meeting summaries with key points, action items, decisions, and participants

### Authentication Flow

1. User signs up/logs in via Next.js API routes (`/api/auth/signup`, `/api/auth/login`)
2. Password hashed with bcrypt
3. JWT token generated and stored in HTTP-only cookie
4. Token passed to WebSocket server for authentication
5. Server validates token on each WebSocket connection

### Recording Flow

1. Client initiates recording session via Socket.io
2. Audio captured using MediaRecorder API
3. Audio chunks (20-second intervals) streamed to WebSocket server
4. Server sends chunks to Google Gemini API for transcription
5. Transcripts emitted back to client in real-time
6. Transcripts stored in database with timestamps
7. On stop, server aggregates all transcripts
8. AI generates comprehensive summary with key points, action items, and decisions
9. Session marked as COMPLETED

### Real-time Communication

- **Client → Server**: Audio chunks, session control (start/stop/pause)
- **Server → Client**: Transcription progress, status updates, processing complete
- **Ping/Pong**: Keep-alive mechanism (25s interval, 60s timeout)

## Development Commands

- `pnpm dev` - Start all services in development mode (Next.js + WebSocket server)
- `pnpm build` - Build all workspaces for production
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Prisma Studio (database GUI)
- `pnpm --filter nextjs dev` - Start only Next.js
- `pnpm --filter ws dev` - Start only WebSocket server

## Project Highlights

### Key Technical Decisions

1. **Monorepo with Workspaces**: Shared database client, independent deployments
2. **Single .env File**: Centralized configuration at root
3. **JWT in HTTP-only Cookies**: Secure, XSS-resistant authentication
4. **20-second Audio Chunks**: Balance between real-time updates and API efficiency
5. **WebM Audio Format**: Browser-native, efficient streaming
6. **Gemini 2.0 Flash**: Fast, cost-effective AI transcription

### Performance Optimizations

- Audio chunking with WebM header preservation
- Real-time transcript streaming (no waiting for full recording)
- Efficient Socket.io event handling
- Database indexing on session and user IDs

## Troubleshooting

### Common Issues

**Database connection fails:**
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Run `pnpm db:migrate` to create tables

**WebSocket connection fails:**
- Verify `NEXT_PUBLIC_WS_URL` matches WebSocket server URL
- Check CORS settings in `ws/index.ts`
- Ensure both servers are running

**Transcription not working:**
- Verify `GOOGLE_GEMINI_API_KEY` is valid
- Check browser console for errors
- Ensure microphone/tab permissions granted

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
