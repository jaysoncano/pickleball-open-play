import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { getPhoto } from "@/lib/db/queries";

/** A player's profile photo. URLs carry `?v=`, so they can cache forever. */
export async function GET(
  req: Request,
  ctx: RouteContext<"/players/[id]/photo">,
) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return new Response("Not found", { status: 404 });
  }
  const photo = await getPhoto(getDb(), id);
  if (!photo) return new Response("Not found", { status: 404 });
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": versioned
        ? "public, max-age=31536000, immutable"
        : "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
