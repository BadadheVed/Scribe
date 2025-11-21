import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@attack-capital/db";
import bcrypt from "bcryptjs";
import { setAuthCookie } from "@/lib/auth";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signupSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Create user and account
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        emailVerified: true,
        accounts: {
          create: {
            providerId: "credential",
            accountId: validatedData.email,
            password: hashedPassword,
          },
        },
      },
    });

    // Set auth cookie with JWT
    const token = await setAuthCookie(user.id, user.email);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
