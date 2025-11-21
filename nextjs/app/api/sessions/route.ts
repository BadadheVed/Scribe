import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@attack-capital/db";

// GET /api/sessions - Get all sessions for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await prisma.recordingSession.findMany({
      where: { userId: user.id },
      include: {
        transcripts: {
          select: { id: true, timestamp: true },
        },
        summary: {
          select: { id: true, keyPoints: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create a new recording session
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, sourceType } = body;

    const session = await prisma.recordingSession.create({
      data: {
        userId: user.id,
        title: title || `Recording ${new Date().toLocaleString()}`,
        sourceType: sourceType || "MICROPHONE",
        status: "RECORDING",
      },
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
