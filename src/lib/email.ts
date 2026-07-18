import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { rrUrl } from "@/lib/rr";

// Email qua AWS SES (tuỳ chọn — thiếu env thì mọi hàm skip im lặng, app vẫn chạy đủ).
// Dùng API HTTPS (SDK sesv2), không cần SMTP. Set SES_CONFIG_SET nếu muốn bounce tracking.

let client: SESv2Client | null = null;
function ses(): SESv2Client | null {
  if (!process.env.SES_ACCESS_KEY_ID || !process.env.SES_SECRET_ACCESS_KEY) return null;
  if (!client) {
    client = new SESv2Client({
      region: process.env.SES_REGION ?? "ap-southeast-2",
      credentials: {
        accessKeyId: process.env.SES_ACCESS_KEY_ID,
        secretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const c = ses();
  if (!c) return false;
  try {
    await c.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.SES_FROM ?? "KryMark <no-reply@localhost>",
        ConfigurationSetName: process.env.SES_CONFIG_SET || undefined,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: "Reset your KryMark password" },
            Body: {
              Text: {
                Data:
`Someone (hopefully you) asked to reset the password for this KryMark account.

Reset it here (link valid for 1 hour):
${resetUrl}

If it wasn't you, just ignore this email — nothing changes.

— KryMark`,
              },
            },
          },
        },
      })
    );
    return true;
  } catch {
    return false;
  }
}

// D5 đúng nghĩa: 1 reporter nhiều note resolved trong 1 đợt = 1 email GỘP
export async function sendBatchResolvedEmail(opts: {
  to: string;
  reporterName?: string;
  items: { id: string; comment: string }[];
  projectName: string;
}): Promise<boolean> {
  const c = ses();
  if (!c) return false;
  const name = opts.reporterName || "there";
  const list = opts.items
    .map((it) => `  • "${it.comment}"\n    Fixed the way you wanted? Yes: ${rrUrl(it.id, true)} · Not quite: ${rrUrl(it.id, false)}`)
    .join("\n\n");
  try {
    await c.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.SES_FROM ?? "KryMark <no-reply@localhost>",
        ConfigurationSetName: process.env.SES_CONFIG_SET || undefined,
        Destination: { ToAddresses: [opts.to] },
        Content: {
          Simple: {
            Subject: {
              Data: `${opts.items.length} of your feedback items on ${opts.projectName} are done ✓`,
            },
            Body: {
              Text: {
                Data:
`Hi ${name},

Good news — these feedback items you left have been resolved:

${list}

Thanks for helping make it better. Feel free to take another look.

— KryMark, on behalf of the ${opts.projectName} team
(One-time notification about your feedback.)`,
              },
            },
          },
        },
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function sendDigestEmail(opts: {
  to: string;
  orgName: string;
  lines: string[];
  origin: string;
}): Promise<boolean> {
  const c = ses();
  if (!c || opts.lines.length === 0) return false;
  try {
    await c.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.SES_FROM ?? "KryMark <no-reply@localhost>",
        ConfigurationSetName: process.env.SES_CONFIG_SET || undefined,
        Destination: { ToAddresses: [opts.to] },
        Content: {
          Simple: {
            Subject: { Data: `KryMark weekly digest — ${opts.orgName}` },
            Body: {
              Text: {
                Data:
`Your KryMark week:

${opts.lines.join("\n")}

Open the dashboard: ${opts.origin}/projects

— KryMark`,
              },
            },
          },
        },
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function sendResolvedEmail(opts: {
  to: string;
  reporterName?: string;
  comment: string;
  pageUrl?: string;
  projectName: string;
  noteId: string;
}): Promise<boolean> {
  const c = ses();
  if (!c) return false;
  const name = opts.reporterName || "there";
  try {
    await c.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.SES_FROM ?? "KryMark <no-reply@localhost>",
        ConfigurationSetName: process.env.SES_CONFIG_SET || undefined,
        Destination: { ToAddresses: [opts.to] },
        Content: {
          Simple: {
            Subject: { Data: `Your feedback on ${opts.projectName} is done ✓` },
            Body: {
              Text: {
                Data:
`Hi ${name},

Good news — the feedback you left has been resolved:

  "${opts.comment}"
${opts.pageUrl ? `\n  Page: ${opts.pageUrl}\n` : ""}
Fixed the way you wanted?
  Yes, looks right: ${rrUrl(opts.noteId, true)}
  Not quite: ${rrUrl(opts.noteId, false)}

Thanks for helping make it better.

— KryMark, on behalf of the ${opts.projectName} team
(This is a one-time notification about your feedback.)`,
              },
            },
          },
        },
      })
    );
    return true;
  } catch {
    return false; // best-effort — không chặn flow resolve
  }
}
