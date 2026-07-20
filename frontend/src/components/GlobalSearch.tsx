import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import type { SearchResult } from "@/types";

const BASE = "/api";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await fetchJSON<SearchResult[]>(
          `/funds/search?q=${encodeURIComponent(query)}`,
        );
        setResults(data);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);
  useEffect(() => {
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [handleOutsideClick]);

  const handleSelect = (_fund: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    // ponytail: both go to /watchlists; split to /funds/:code when detail page exists
    navigate("/watchlists");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i < results.length - 1 ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i > 0 ? i - 1 : 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 bg-root border border-gray-700 px-3 py-1.5">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-white outline-none placeholder:text-gray-500 text-sm"
          placeholder="搜索基金"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          aria-label="搜索基金"
          autoComplete="off"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setIsOpen(false);
            }}
            aria-label="清除搜索"
          >
            <X size={14} className="text-gray-400" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full bg-surface border border-gray-700 shadow-lg max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-3 text-gray-500 text-sm text-center">
              未找到匹配的基金
            </div>
          ) : (
            results.map((fund, i) => (
              <button
                key={fund.code}
                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-700 ${
                  i === selectedIndex ? "bg-gray-700" : ""
                }`}
                onClick={() => handleSelect(fund)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white font-mono text-sm">{fund.code}</span>
                  <span className="text-gray-400 text-sm truncate max-w-[180px]">
                    {fund.name}
                  </span>
                </div>
                {fund.is_watched ? (
                  <span className="text-xs text-blue-400 shrink-0">已关注</span>
                ) : (
                  <span className="text-xs text-gray-500 shrink-0">未关注</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
