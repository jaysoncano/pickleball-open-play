import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { signOutPlayer } from "@/app/actions";
import { Loading } from "@/components/loading";
import { PhotoForm } from "@/components/profile/photo-form";
import { LoginSettings } from "@/components/profile/login-settings";
import { ProfileForm } from "@/components/profile/profile-form";
import { profileEditor } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import {
  getPlayer,
  getPlayerPrivate,
  hasPaidRegistration,
} from "@/lib/db/queries";
import { photoUrl } from "@/lib/profile/forms";
import { missingSteps, PROFILE_STEPS } from "@/lib/profile/status";

export const metadata: Metadata = {
  title: "Edit profile",
  robots: { index: false },
};

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-6";

export default function EditPage({ params }: PageProps<"/players/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <Suspense fallback={<Loading />}>
        <Edit params={params} />
      </Suspense>
    </main>
  );
}

async function Edit({
  params,
}: Pick<PageProps<"/players/[id]/edit">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [player, secret, editor] = await Promise.all([
    getPlayer(db, id),
    getPlayerPrivate(db, id),
    profileEditor(id),
  ]);
  if (!player || !secret) notFound();

  if (editor && !editor.admin && !(await hasPaidRegistration(db, id))) {
    return (
      <section className={CARD}>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>⏳</span> Almost there
        </h1>
        <p className="mt-2 text-ink/60">
          Your profile opens once the admin confirms your open play payment at
          the booth. You&apos;ll get a receipt email with a link right after.
        </p>
        <Link
          href={`/players/${id}`}
          className="mt-4 inline-block font-semibold text-fuchsia-600"
        >
          ← Back to profile
        </Link>
      </section>
    );
  }

  if (!editor) {
    return (
      <section className={CARD}>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>🔒</span> Verify it&apos;s you
        </h1>
        <p className="mt-2 text-ink/60">
          To edit {player.name}&apos;s info, scan the profile QR code from an
          admin and verify your email.
        </p>
        <Link
          href={`/players/${id}`}
          className="mt-4 inline-block font-semibold text-fuchsia-600"
        >
          ← Back to profile
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap gap-4">
          {editor.admin && (
            <Link
              href="/admin/players"
              className="rounded-xl font-semibold text-ink/60 hover:text-fuchsia-600"
            >
              ← Player desk
            </Link>
          )}
          <Link
            href={`/players/${id}`}
            className="rounded-xl font-semibold text-ink/60 hover:text-fuchsia-600"
          >
            View profile
          </Link>
        </span>
        {!editor.admin && (
          <form action={signOutPlayer}>
            <button
              type="submit"
              className="min-h-11 rounded-xl px-3 font-semibold text-ink/50 hover:text-rose-600"
            >
              Sign out
            </button>
          </form>
        )}
      </div>
      <header>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>✏️</span> {player.name}&apos;s info
        </h1>
        <p className="text-ink/60">
          Everything except email and phone shows on the public profile.
          {editor.admin && " You're editing as an admin."}
        </p>
      </header>
      <Checklist
        missing={missingSteps({
          hasEmail: Boolean(secret.email),
          firstName: player.firstName,
          lastName: player.lastName,
          hasPhoto: Boolean(player.photoUpdatedAt),
        })}
      />
      <section aria-labelledby="photo-title" className={CARD}>
        <h2 id="photo-title" className="mb-3 font-display text-xl font-bold">
          Photo
        </h2>
        <PhotoForm
          playerId={id}
          name={player.name}
          src={photoUrl(id, player.photoUpdatedAt)}
        />
      </section>
      <section aria-labelledby="info-title" className={CARD}>
        <h2 id="info-title" className="mb-3 font-display text-xl font-bold">
          Basic info
        </h2>
        <ProfileForm
          playerId={id}
          emailLocked={!editor.admin}
          emailConfirmed={Boolean(secret.emailConfirmedAt)}
          initial={{
            firstName: player.firstName,
            lastName: player.lastName,
            email: secret.email ?? "",
            phone: secret.phone,
            homeClub: player.homeClub,
            bio: player.bio,
            hand: player.hand ?? "",
          }}
        />
      </section>
      <section aria-labelledby="login-title" className={CARD}>
        <h2 id="login-title" className="font-display text-xl font-bold">
          <span aria-hidden>🔑</span> Sign-in
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          Pick a username and password to sign in without an email code.
        </p>
        <LoginSettings
          playerId={id}
          username={secret.username}
          hasPassword={secret.hasPassword}
        />
      </section>
    </>
  );
}

/** Setup progress, so new players know what's left. */
function Checklist({ missing }: { missing: string[] }) {
  if (missing.length === 0) {
    return (
      <p
        role="status"
        className="rounded-2xl bg-lime-100 px-4 py-3 font-semibold text-lime-900"
      >
        ✓ Your profile is complete. Keep it fresh any time.
      </p>
    );
  }
  return (
    <ol
      aria-label="Profile setup"
      className="flex flex-wrap gap-2 rounded-2xl bg-white/80 p-3 ring-2 ring-white"
    >
      {PROFILE_STEPS.map((step) => {
        const done = !missing.includes(step);
        return (
          <li
            key={step}
            className={`rounded-full px-3 py-1 text-sm font-bold ${done ? "bg-lime-200 text-lime-900" : "bg-amber-100 text-amber-900"}`}
          >
            <span aria-hidden>{done ? "✓" : "○"}</span> {step}
          </li>
        );
      })}
    </ol>
  );
}
