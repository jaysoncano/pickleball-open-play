import { ImageResponse } from "next/og";
import { LOGO_DATA_URI } from "@/lib/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the logo, full-bleed (iOS rounds the corners). */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #bef264, #34d399)",
      }}
    >
      <img src={LOGO_DATA_URI} width={180} height={180} alt="" />
    </div>,
    size,
  );
}
