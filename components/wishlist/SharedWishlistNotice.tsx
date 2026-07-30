import Link from "next/link";

export function SharedWishlistNotice({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta?: { label: string; href: string };
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-6 font-semibold text-brand hover:text-brand-dark"
        >
          {cta.label}
        </Link>
      )}
    </main>
  );
}
