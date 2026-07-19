import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, X, ArrowUpDown, Trash2 } from "lucide-react";
import type { Fund } from "@/types";

const BASE = "/api";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 bg-gray-800 rounded" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-lg mb-2">关注列表为空</p>
      <p className="text-sm">搜索基金代码或名称，添加你的第一支基金</p>
    </div>
  );
}

export function Watchlists() {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState("code");
  const [sortDir, setSortDir] = useState("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Fund[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: funds, isLoading, isError, refetch } = useQuery<Fund[]>({
    queryKey: ["funds", sortBy, sortDir],
    queryFn: () => fetchJSON(`/funds?sort_by=${sortBy}&sort_dir=${sortDir}`),
  });

  const removeMutation = useMutation({
    mutationFn: (code: string) =>
      fetch(`${BASE}/funds/${code}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funds"] });
      setRemoveConfirm(null);
    },
  });

  // Search with debounce
  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchJSON<Fund[]>(
          `/funds/search?q=${encodeURIComponent(value)}`,
        );
        setSearchResults(results);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleAddFund = async (code: string) => {
    try {
      await fetch(`${BASE}/funds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      queryClient.invalidateQueries({ queryKey: ["funds"] });
      setSearchQuery("");
      setSearchResults([]);
      setShowDropdown(false);
    } catch {
      // ponytail: toast/snackbar if UX requires it
    }
  };

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown size={14} className="text-gray-500" />;
    return <span className="text-blue-400">{sortDir === "asc" ? " ▲" : " ▼"}</span>;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">关注列表</h1>

      {/* Search + Add */}
      <div ref={searchRef} className="relative mb-6">
        <div className="flex items-center gap-2 bg-surface border border-gray-700 rounded-lg px-3 py-2">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            className="flex-1 bg-transparent text-white outline-none placeholder:text-gray-500"
            placeholder="搜索基金代码或名称"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchResults([]); setShowDropdown(false); }}>
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Search dropdown */}
        {showDropdown && (
          <div className="absolute z-10 top-full mt-1 w-full bg-surface border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="p-3 text-gray-500 text-sm text-center">
                未找到匹配的基金
              </div>
            ) : (
              searchResults.map((fund) => (
                <button
                  key={fund.code}
                  className="w-full text-left px-3 py-2 text-white hover:bg-gray-700 flex justify-between items-center"
                  onClick={() => handleAddFund(fund.code)}
                >
                  <span>{fund.code}</span>
                  <span className="text-gray-400 text-sm">{fund.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Content area */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-red-400 mb-4">加载失败，请重试</p>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      ) : !funds || funds.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-sm">
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white select-none"
                  onClick={() => toggleSort("code")}
                >
                  <span className="flex items-center gap-1">
                    基金代码 <SortIcon column="code" />
                  </span>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white select-none"
                  onClick={() => toggleSort("name")}
                >
                  <span className="flex items-center gap-1">
                    基金名称 <SortIcon column="name" />
                  </span>
                </th>
                <th className="py-3 px-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => (
                <tr key={fund.code} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 px-4 text-white font-mono">{fund.code}</td>
                  <td className="py-3 px-4 text-gray-300">{fund.name}</td>
                  <td className="py-3 px-4">
                    {removeConfirm === fund.code ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">确认删除？</span>
                        <button
                          className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          onClick={() => removeMutation.mutate(fund.code)}
                          disabled={removeMutation.isPending}
                        >
                          确认
                        </button>
                        <button
                          className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500"
                          onClick={() => setRemoveConfirm(null)}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        className="text-red-400 hover:text-red-300"
                        onClick={() => setRemoveConfirm(fund.code)}
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
