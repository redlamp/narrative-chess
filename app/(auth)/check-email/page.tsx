import Link from "next/link";

type SearchParams = Promise<{ email?: string }>;

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { email } = await searchParams;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight text-foreground">
        Check your{" "}
        <em
          className="font-display italic"
          style={{ color: "var(--oxblood)" }}
        >
          email
        </em>
      </h1>
      <p className="text-foreground/80">
        {email ? (
          <>
            We just sent a confirmation link to{" "}
            <span className="font-mono text-foreground">{email}</span>. Click
            it to finish signing up.
          </>
        ) : (
          "We just sent you a confirmation link. Click it to finish signing up."
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        Email might land in spam on the first try. After confirming you&apos;ll
        be returned to the site, logged in.
      </p>
      <p className="text-sm text-center text-muted-foreground">
        Wrong email?{" "}
        <Link
          href="/sign-up"
          className="text-primary underline-offset-4 hover:underline"
        >
          Start over
        </Link>
      </p>
    </div>
  );
}
