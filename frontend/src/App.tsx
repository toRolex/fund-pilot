import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavBar } from "./components/NavBar";
import { Dashboard } from "./pages/Dashboard";
import { Holdings } from "./pages/Holdings";
import { Watchlists } from "./pages/Watchlists";
import { Signals } from "./pages/Signals";
import { Strategies } from "./pages/Strategies";
import { NotFound } from "./pages/NotFound";

const queryClient = new QueryClient();

export function AppRoutes() {
  return (
    <div className="min-h-screen bg-root">
      <NavBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/holdings" element={<Holdings />} />
        <Route path="/watchlists" element={<Watchlists />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
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
