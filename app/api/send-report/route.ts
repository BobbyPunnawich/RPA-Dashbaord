import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM_EMAIL ?? "RPA Control Center <onboarding@resend.dev>";

export async function POST(req: Request) {
  try {
    const { processName, ownerName, errorMessage, dayLabel, transactionId } = await req.json() as {
      processName:  string;
      ownerName:    string;
      errorMessage: string;
      dayLabel:     string;
      transactionId: string;
    };

    if (!ownerName?.trim()) {
      return NextResponse.json({ error: "No owner assigned to this bot." }, { status: 400 });
    }

    const developer = await prisma.developer.findFirst({ where: { fullName: ownerName } });
    if (!developer) {
      return NextResponse.json({ error: `Developer "${ownerName}" not found in the system.` }, { status: 404 });
    }

    const { error } = await resend.emails.send({
      from: FROM,
      to:   developer.email,
      subject: `[RPA Alert] Issue in ${processName} — ${dayLabel}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:28px;border-radius:12px;">
          <h2 style="color:#f87171;margin-top:0;font-size:18px;">⚠ Bot Issue Report</h2>
          <p style="color:#94a3b8;font-size:14px;margin-bottom:20px;">
            Hi ${developer.fullName}, an issue was detected in the bot you own.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:10px 0;color:#64748b;width:140px;">Process</td>
              <td style="padding:10px 0;color:#e2e8f0;font-weight:600;">${processName}</td>
            </tr>
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:10px 0;color:#64748b;">Date</td>
              <td style="padding:10px 0;color:#e2e8f0;">${dayLabel}</td>
            </tr>
            ${transactionId ? `<tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:10px 0;color:#64748b;">Transaction ID</td>
              <td style="padding:10px 0;color:#e2e8f0;font-family:monospace;">${transactionId}</td>
            </tr>` : ""}
          </table>
          <div style="background:#1e293b;border-left:3px solid #ef4444;border-radius:4px;padding:14px 16px;margin-bottom:24px;">
            <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Error Message</p>
            <p style="color:#fca5a5;font-size:13px;margin:0;white-space:pre-wrap;">${errorMessage}</p>
          </div>
          <p style="color:#475569;font-size:12px;margin:0;">
            Sent from your RPA Control Center. Please investigate at your earliest convenience.
          </p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sentTo: developer.email });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
