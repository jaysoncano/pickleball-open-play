export type Email = { to: string; subject: string; text: string; html: string };

export type MailEnv = {
  /** Resend API key: real delivery. */
  apiKey?: string;
  from?: string;
  /** Local catcher (Supabase's Mailpit), used when there's no API key. */
  mailpitUrl?: string;
};

export type SendResult = { sent: true } | { sent: false; error: string };

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "POP <onboarding@resend.dev>";

/** "POP <pop@x.co>" → { Name: "POP", Email: "pop@x.co" } (Mailpit format). */
export function parseAddress(from: string): { Name: string; Email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { Name: m[1], Email: m[2] } : { Name: "", Email: from.trim() };
}

/**
 * Send an email: through Resend with an API key; otherwise to the local
 * Mailpit inbox (open MAILPIT_URL to read it); otherwise to the server log.
 */
export async function sendEmail(
  email: Email,
  env: MailEnv,
  fetcher: typeof fetch = fetch,
  log: (msg: string) => void = console.info,
): Promise<SendResult> {
  const from = env.from || DEFAULT_FROM;
  if (env.apiKey) {
    return post(fetcher, RESEND_URL, {
      headers: { Authorization: `Bearer ${env.apiKey}` },
      body: {
        from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      },
    });
  }
  if (env.mailpitUrl) {
    const result = await post(
      fetcher,
      `${env.mailpitUrl.replace(/\/$/, "")}/api/v1/send`,
      {
        body: {
          From: parseAddress(env.from || "POP <pop@localhost>"),
          To: [{ Email: email.to }],
          Subject: email.subject,
          Text: email.text,
          HTML: email.html,
        },
      },
    );
    if (result.sent) return result;
    // Keep local testing going: the log still has the code or link.
    log(`[email] Mailpit unreachable. To ${email.to}: ${email.text}`);
    return {
      sent: false,
      error: "Local inbox (Mailpit) is down. Run `npm run db:start`.",
    };
  }
  log(
    `[email] No RESEND_API_KEY or MAILPIT_URL. To ${email.to}: ${email.text}`,
  );
  return { sent: true };
}

async function post(
  fetcher: typeof fetch,
  url: string,
  { headers = {}, body }: { headers?: Record<string, string>; body: unknown },
): Promise<SendResult> {
  try {
    const res = await fetcher(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { sent: true };
    return { sent: false, error: `Email failed (${res.status})` };
  } catch {
    return { sent: false, error: "Email failed. Try again." };
  }
}
