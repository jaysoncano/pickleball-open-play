import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  hostCodeEmail,
  hostInviteEmail,
  receiptEmail,
  verificationEmail,
  type Receipt,
} from "./email-templates";

describe("verificationEmail", () => {
  const mail = verificationEmail("a@x.co", "Ana <3", "042913", 10);

  it("puts the code in the subject, text, and one box per digit", () => {
    expect(mail.subject).toBe("042913 is your POP verification code");
    expect(mail.text).toContain("042913");
    expect(mail.text).toContain("10 minutes");
    for (const d of "042913") expect(mail.html).toContain(`>${d}</div>`);
    expect(mail.html).toContain("Expires in 10 min");
  });

  it("is a full branded page with escaped names", () => {
    expect(mail.html).toMatch(/^<!doctype html>/);
    expect(mail.html).toContain("Pickleball Open Play");
    expect(mail.html).toContain("Ana &lt;3");
    expect(mail.html).not.toContain("Ana <3");
  });
});

describe("receiptEmail", () => {
  const base: Receipt = {
    to: "a@x.co",
    name: "Ana Dela Cruz",
    playDate: "Tuesday, October 27, 2026",
    time: "6:00 PM – 8:00 PM",
    rank: "Novice – Intermediate",
    venue: "Sunrise Courts · Makati",
    partner: "Ben <b>",
    entry: { amount: "₱300.00", method: "E-wallet" },
    receiptNo: "AB12CD34",
    profileLink: "https://pop.app/confirm/t?x=1&y=2",
  };

  it("shows a paid pair's ticket and the confirm button", () => {
    const mail = receiptEmail(base);
    expect(mail.subject).toBe(
      "🎾 You're in! POP open play on Tuesday, October 27, 2026",
    );
    expect(mail.text).toContain("Partner: Ben <b>");
    expect(mail.text).toContain("Time: 6:00 PM – 8:00 PM");
    expect(mail.text).toContain("Rank: Novice – Intermediate");
    expect(mail.text).toContain("Venue: Sunrise Courts · Makati");
    expect(mail.text).toContain("Entry for the pair: ₱300.00");
    expect(mail.text).toContain("Paid by: E-wallet");
    expect(mail.text).toContain("https://pop.app/confirm/t?x=1&y=2");
    expect(mail.html).toContain("You&#39;re in, Ana!");
    expect(mail.html).toContain("Paid in full");
    expect(mail.html).toContain("Ben &lt;b&gt;");
    expect(mail.html).toContain('href="https://pop.app/confirm/t?x=1&amp;y=2"');
    expect(mail.html).toContain("Confirm email &amp; update profile");
  });

  it("leaves out a missing venue", () => {
    const mail = receiptEmail({ ...base, venue: undefined });
    expect(mail.text).not.toContain("Venue");
  });

  it("leaves out the profile button until paid", () => {
    const mail = receiptEmail({ ...base, profileLink: undefined });
    expect(mail.html).not.toContain("Confirm email &amp; update profile");
    expect(mail.text).toContain("Your profile opens once");
  });

  it("tells a solo player the desk will pair them", () => {
    const mail = receiptEmail({
      ...base,
      partner: undefined,
      entry: undefined,
    });
    expect(mail.subject).toContain("You're signed up");
    expect(mail.text).toContain("Partner: Desk will pair you");
    expect(mail.text).not.toContain("Entry for the pair");
    expect(mail.html).toContain("Looking for a partner");
    expect(mail.html).toContain("then the pair pays one entry");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("host emails", () => {
  it("sends a new host their code", () => {
    const mail = hostCodeEmail("h@x.co", "hana<>", "123456", 10);
    expect(mail.subject).toBe("123456 is your POP host verification code");
    expect(mail.text).toContain("hana<>");
    expect(mail.html).toContain("hana&lt;&gt;");
    for (const d of "123456") expect(mail.html).toContain(`>${d}</div>`);
  });

  it("invites someone to host, with a sign-up link", () => {
    const invite = {
      to: "cy@x.co",
      from: "hana",
      when: "Tue, Oct 27 · 6:00 PM – 8:00 PM",
      venue: "Sunrise Courts · Makati",
      signupLink: "https://pop.app/host/signup?email=cy%40x.co",
    };
    const mail = hostInviteEmail(invite);
    expect(mail.subject).toBe("🎾 hana invited you to host a POP open play");
    expect(mail.text).toContain("Venue: Sunrise Courts · Makati");
    expect(mail.text).toContain(invite.signupLink);
    expect(mail.html).toContain("Sign up &amp; accept");
    expect(hostInviteEmail({ ...invite, venue: "" }).text).not.toContain(
      "Venue",
    );
  });
});
