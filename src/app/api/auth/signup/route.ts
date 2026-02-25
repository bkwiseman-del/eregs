import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);

    await db.user.create({
      data: {
        name,
        email,
        password: hash,
        role: "FLEET_MANAGER",
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    console.error("signup error:", e);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
