import Link from "next/link";

export default function NotFound() {
  return (
    <div className="cf-root flex min-h-screen flex-col items-center justify-center bg-cf-bg px-4 text-center font-cf text-cf-text">
      <p className="caption-2 text-cf-violet">Error 404</p>
      <h1 className="heading-3 mt-4 text-cf-text">This page does not exist</h1>
      <p className="body-3 mt-3 max-w-md text-cf-muted">
        The link you followed points to something that is not here. The CreatorFlow
        home page has everything in one place.
      </p>
      <Link href="/" className="cf-btn cf-btn-primary mt-8 button-lg">
        Back to home
      </Link>
    </div>
  );
}
