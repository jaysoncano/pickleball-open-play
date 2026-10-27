import QRCode from "qrcode";

/** Where a player's QR code points: the email check for their profile. */
export function claimUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/claim/${token}`;
}

/** This site's origin from request headers (honours a proxy's forwarding). */
export function originFrom(headers: Headers): string {
  const host =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto =
    headers.get("x-forwarded-proto") ??
    (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** The QR code as an SVG string, sized by its container. */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#241c47", light: "#ffffff" },
  });
}
