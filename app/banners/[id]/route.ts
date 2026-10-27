import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { getBanner } from "@/lib/db/queries";

/** An open play's banner. URLs carry `?v=`, so they can cache forever. */
export async function GET(req: Request, ctx: RouteContext<"/banners/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return new Response("Not found", { status: 404 });
  }
  const banner = await getBanner(getDb(), id);
  if (!banner) return new Response("Not found", { status: 404 });
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(Buffer.from(banner.data), {
    headers: {
      "Content-Type": banner.mime,
      "Cache-Control": versioned
        ? "public, max-age=31536000, immutable"
        : "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
