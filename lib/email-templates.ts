import type { Email } from "./email";

// Email HTML: tables and inline styles only, so it renders the same in
// Gmail, Apple Mail, and Outlook. Colors match the app (globals.css).
const C = {
  page: "#fffaf2",
  ink: "#241c47",
  muted: "#6b6584",
  line: "#efe9f7",
  fuchsia: "#d946ef",
  fuchsiaDark: "#a21caf",
  sky: "#38bdf8",
  skySoft: "#e0f2fe",
  lime: "#bef264",
  limeInk: "#365314",
  amber: "#fef3c7",
  amberInk: "#78350f",
};
const FONT =
  "'Fredoka','Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

const e = escapeHtml;

/** A pill-shaped label, e.g. "PAID". */
function badge(label: string, bg: string, color: string): string {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:${color};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${e(label)}</span>`;
}

/** The app's chunky button: bright face with a darker bottom edge. */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 0"><tr><td style="border-radius:16px;background:${C.fuchsia};border-bottom:4px solid ${C.fuchsiaDark}"><a href="${e(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:17px;font-weight:700;color:#ffffff;text-decoration:none">${e(label)}</a></td></tr></table>`;
}

/** Label/value rows, like a ticket stub. */
function details(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows
    .map(
      ([label, value], i) =>
        `<tr><td style="padding:12px 0;${i ? `border-top:1px dashed ${C.line};` : ""}color:${C.muted};font-size:14px">${e(label)}</td><td style="padding:12px 0;${i ? `border-top:1px dashed ${C.line};` : ""}text-align:right;color:${C.ink};font-size:15px;font-weight:700">${e(value)}</td></tr>`,
    )
    .join("")}</table>`;
}

/** Numbered next steps. */
function steps(items: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto">${items
    .map(
      (item, i) =>
        `<tr><td style="padding:6px 12px 6px 0;vertical-align:top"><span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:999px;background:${C.skySoft};color:#0369a1;font-size:13px;font-weight:700;text-align:center">${i + 1}</span></td><td style="padding:8px 0;color:${C.ink};font-size:15px">${e(item)}</td></tr>`,
    )
    .join("")}</table>`;
}

/**
 * The shared frame: hidden preview text, a gradient header with the POP
 * wordmark, a white card for the content, and a small footer.
 */
function layout({
  preheader,
  emoji,
  title,
  body,
  footer,
}: {
  preheader: string;
  emoji: string;
  title: string;
  body: string;
  footer: string;
}): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(title)}</title></head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};color:${C.ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="border-radius:28px 28px 0 0;background:${C.fuchsia};background-image:linear-gradient(135deg,${C.fuchsia} 0%,#a78bfa 55%,${C.sky} 100%);padding:28px 32px 56px;text-align:center">
<div style="font-size:30px;font-weight:800;letter-spacing:1px;color:#ffffff">POP<span style="color:${C.lime}">.</span></div>
<div style="margin-top:2px;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.85)">Pickleball Open Play</div>
</td></tr>
<tr><td style="padding:0 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:-40px;background:#ffffff;border-radius:24px;box-shadow:0 20px 50px -25px rgba(36,28,71,0.35)"><tr><td style="padding:32px 28px;text-align:center">
<div style="font-size:44px;line-height:1">${emoji}</div>
<h1 style="margin:12px 0 0;font-size:26px;line-height:1.25;font-weight:700;color:${C.ink}">${e(title)}</h1>
${body}
</td></tr></table></td></tr>
<tr><td style="padding:24px 32px;text-align:center;color:${C.muted};font-size:13px;line-height:1.6">${footer}<br>POP · Pickleball Open Play</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (html: string, extra = "") =>
  `<p style="margin:12px 0 0;color:${C.muted};font-size:16px;line-height:1.55;${extra}">${html}</p>`;

/** One box per digit of a code. */
function codeBoxes(code: string): string {
  return code
    .split("")
    .map(
      (d) =>
        `<td style="padding:0 3px"><div style="width:44px;height:56px;line-height:56px;border-radius:14px;background:${C.skySoft};border-bottom:3px solid ${C.sky};font-size:30px;font-weight:700;color:${C.ink};text-align:center">${e(d)}</div></td>`,
    )
    .join("");
}

export function verificationEmail(
  to: string,
  playerName: string,
  code: string,
  minutes: number,
): Email {
  const digits = codeBoxes(code);
  return {
    to,
    subject: `${code} is your POP verification code`,
    text: `Your code to edit ${playerName}'s POP profile is ${code}. It expires in ${minutes} minutes. If you didn't ask for it, ignore this email.`,
    html: layout({
      preheader: `${code} is your code. It expires in ${minutes} minutes.`,
      emoji: "🔐",
      title: "Your verification code",
      body: `${p(`Enter this code to update <b style="color:${C.ink}">${e(playerName)}</b>'s POP profile.`)}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 8px"><tr>${digits}</tr></table>
<div style="margin-top:12px">${badge(`Expires in ${minutes} min`, C.amber, C.amberInk)}</div>`,
      footer:
        "Didn't ask for this code? You can ignore this email. Nobody can change the profile without it.",
    }),
  };
}

export type Receipt = {
  to: string;
  name: string;
  playDate: string;
  /** "6:00 PM – 8:00 PM" */
  time: string;
  /** The open play's level range, e.g. "Novice – Intermediate". */
  rank: string;
  /** "Sunrise Courts · Makati"; absent for open plays without one. */
  venue?: string;
  /** Partner's name; absent when signed up alone. */
  partner?: string;
  /** The pair's entry, paid in full; absent when signed up alone. */
  entry?: { amount: string; method: string; reference: string };
  receiptNo: string;
  /**
   * One-tap link that confirms the email and opens the profile. Only for
   * paid pairs: editing opens once payment is confirmed.
   */
  profileLink?: string;
};

export function receiptEmail(r: Receipt): Email {
  const paid = r.entry;
  const rows: [string, string][] = [
    ["Open play", r.playDate],
    ["Time", r.time],
    ...(r.venue ? ([["Venue", r.venue]] as [string, string][]) : []),
    ["Rank", r.rank],
    ["Partner", r.partner ?? "Desk will pair you"],
    ...(paid
      ? ([
          ["Entry for the pair", paid.amount],
          ["Paid by", paid.method],
          ...(paid.reference ? [["Reference", paid.reference]] : []),
        ] as [string, string][])
      : []),
    ["Receipt no.", r.receiptNo],
  ];
  const textLines = rows.map(([k, v]) => `${k}: ${v}`);
  const status = paid
    ? badge("Paid in full", C.lime, C.limeInk)
    : badge("Looking for a partner", C.amber, C.amberInk);
  const intro = paid
    ? `You and <b style="color:${C.ink}">${e(r.partner ?? "your partner")}</b> are on the list. See you on court!`
    : "You're on the list. The desk will pair you with a partner, then the pair pays one entry.";

  return {
    to: r.to,
    subject: paid
      ? `🎾 You're in! POP open play on ${r.playDate}`
      : `🤝 You're signed up for POP open play on ${r.playDate}`,
    text: `Hi ${r.name}, you're registered!\n\n${textLines.join("\n")}\n\n${r.profileLink ? `Confirm your email and add your photo and info: ${r.profileLink}\n(This link works for 7 days.)` : "Your profile opens once your pair's payment is confirmed."}`,
    html: layout({
      preheader: paid
        ? `Receipt ${r.receiptNo}: ${paid.amount} for open play on ${r.playDate}.`
        : `Signed up for ${r.playDate}. We'll find you a partner.`,
      emoji: paid ? "🎾" : "🤝",
      title: `You're in, ${r.name.split(" ")[0]}!`,
      body: `${p(intro)}
<div style="margin-top:16px">${status}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-radius:18px;background:${C.page};border:2px dashed ${C.line}"><tr><td style="padding:4px 20px;text-align:left">${details(rows)}</td></tr></table>
${
  r.profileLink
    ? `<h2 style="margin:28px 0 8px;font-size:18px;color:${C.ink}">Before you play</h2>
${steps(["Confirm your email", "Add your photo and info", "Check the board for your court"])}
<div style="margin-top:20px">${button(r.profileLink, "Confirm email & update profile")}</div>
${p("This link works for 7 days.", "font-size:13px")}`
    : p(
        "Your profile opens once your pair's payment is confirmed at the booth.",
      )
}`,
      footer: "Questions about your entry? Ask at the management booth.",
    }),
  };
}

/** The code a new host enters to verify their email and open their account. */
export function hostCodeEmail(
  to: string,
  username: string,
  code: string,
  minutes: number,
): Email {
  return {
    to,
    subject: `${code} is your POP host verification code`,
    text: `Your code to verify the POP host account ${username} is ${code}. It expires in ${minutes} minutes. If you didn't sign up, ignore this email.`,
    html: layout({
      preheader: `${code} is your code. It expires in ${minutes} minutes.`,
      emoji: "🎾",
      title: "Verify your host account",
      body: `${p(`Enter this code to finish setting up <b style="color:${C.ink}">${e(username)}</b>. Then you can schedule and run your own open plays.`)}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 8px"><tr>${codeBoxes(code)}</tr></table>
<div style="margin-top:12px">${badge(`Expires in ${minutes} min`, C.amber, C.amberInk)}</div>`,
      footer:
        "Didn't sign up? You can ignore this email. The account stays locked without the code.",
    }),
  };
}

export type HostInvite = {
  to: string;
  /** Username of the host who sent it. */
  from: string;
  /** "Tue, Oct 27 · 6:00 PM – 8:00 PM" */
  when: string;
  /** "Sunrise Courts · Makati", or empty. */
  venue: string;
  /** Host sign-up, with the email filled in. */
  signupLink: string;
};

/** An invitation to help host an open play, for someone without an account. */
export function hostInviteEmail(r: HostInvite): Email {
  const rows: [string, string][] = [
    ["Open play", r.when],
    ...(r.venue ? ([["Venue", r.venue]] as [string, string][]) : []),
    ["Invited by", r.from],
  ];
  return {
    to: r.to,
    subject: `🎾 ${r.from} invited you to host a POP open play`,
    text: [
      `${r.from} invited you to help host a POP open play.`,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      `Sign up as a host with this email (${r.to}) to accept: ${r.signupLink}`,
    ].join("\n"),
    html: layout({
      preheader: `${r.from} invited you to help host an open play.`,
      emoji: "🤝",
      title: "You're invited to host",
      body: `${p(`<b style="color:${C.ink}">${e(r.from)}</b> wants you to help run this open play: register pairs, confirm payments, check players in, and run the courts.`)}
<div style="margin:20px 0 4px;text-align:left">${details(rows)}</div>
${p(`Sign up as a host with <b style="color:${C.ink}">${e(r.to)}</b>. Once you verify it, the open play is on your list.`)}
${button(r.signupLink, "Sign up & accept")}`,
      footer: "Not expecting this? You can ignore it; nothing happens.",
    }),
  };
}
