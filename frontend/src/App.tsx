import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { FundDetail } from "./pages/FundDetail";
import { Backtest } from "./pages/Backtest";
import { Holdings } from "./pages/Holdings";
import { Watchlists } from "./pages/Watchlists";
import { Signals } from "./pages/Signals";
import { Strategies } from "./pages/Strategies";
import { NotFound } from "./pages/NotFound";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
});

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/holdings" element={<Holdings />} />
        <Route path="/watchlists" element={<Watchlists />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/funds/:code" element={<FundDetail />} />
        <Route path="/funds/:code/backtest" element={<Backtest />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
