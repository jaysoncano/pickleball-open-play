import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { getGroupLogo } from "@/lib/db/queries";

/** A host group's logo. URLs carry `?v=`, so they can cache forever. */
export async function GET(
  req: Request,
  ctx: RouteContext<"/groups/[id]/logo">,
) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return new Response("Not found", { status: 404 });
  }
  const logo = await getGroupLogo(getDb(), id);
  if (!logo) return new Response("Not found", { status: 404 });
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(Buffer.from(logo.data), {
    headers: {
      "Content-Type": logo.mime,
      "Cache-Control": versioned
        ? "public, max-age=31536000, immutable"
        : "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
