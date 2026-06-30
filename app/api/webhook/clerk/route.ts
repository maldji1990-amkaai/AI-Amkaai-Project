import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Webhook } from "svix";

export async function POST(req: Request) {
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") || "",
    "svix-timestamp": req.headers.get("svix-timestamp") || "",
    "svix-signature": req.headers.get("svix-signature") || "",
  };

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");
  let event: any;

  try {
    event = wh.verify(payload, headers);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type === "user.created") {
    const { id, email_addresses, first_name, last_name } = event.data;
    const email = email_addresses?.[0]?.email_address;

    await db.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email,
        name: `${first_name || ""} ${last_name || ""}`.trim() || null,
        plan: "FREE",
        credits: 0,
      },
    });

    console.log(`✅ User created in DB: ${email}`);
  }

  return NextResponse.json({ success: true });
}