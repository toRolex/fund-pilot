import { Link } from "react-router-dom";
import { GlobalSearch } from "./GlobalSearch";

export function NavBar() {
  return (
    <nav className="sticky top-0 z-40 bg-surface border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link to="/" className="text-white font-bold text-lg shrink-0">
          Fund Signal
        </Link>
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>
      </div>
    </nav>
  );
}
