import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-6xl font-bold text-white/20">404</h1>
      <p className="text-white/60">Page not found</p>
      <Link to="/" className="text-accent hover:text-accent-hover underline">
        Back to Dashboard
      </Link>
    </div>
  );
}
