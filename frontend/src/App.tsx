import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavBar } from "./components/NavBar";
import { StatusBar } from "./components/StatusBar";
import { Dashboard } from "./pages/Dashboard";
import { FundDetail } from "./pages/FundDetail";
import { Watchlists } from "./pages/Watchlists";
import { Signals } from "./pages/Signals";
import { Strategies } from "./pages/Strategies";
import { NotFound } from "./pages/NotFound";

const queryClient = new QueryClient();

export function AppRoutes() {
  return (
    <div className="min-h-screen bg-root">
      <NavBar />
      <StatusBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/watchlists" element={<Watchlists />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/funds/:code" element={<FundDetail />} />
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
