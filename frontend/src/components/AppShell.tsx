import { NavLink, Outlet } from "react-router-dom";
import { GlobalSearch } from "./GlobalSearch";
import { StatusBar } from "./StatusBar";

const NAV_ITEMS = [
  { to: "/", label: "仪表盘", icon: "▰" },
  { to: "/watchlists", label: "观察列表", icon: "☰" },
  { to: "/funds/000001", label: "基金详情", icon: "◉" },
  { to: "/strategies", label: "策略", icon: "▤" },
  { to: "/holdings", label: "持仓", icon: "▣" },
];

export function AppShell() {
  return (
    <div
      className="app-shell"
      style={{
        display: "grid",
        gridTemplateColumns: "var(--sidebar-w) 1fr",
        gridTemplateRows: "var(--topbar-h) 1fr var(--statusbar-h)",
        height: "100vh",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          gridRow: "1 / 3",
          gridColumn: 1,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            fontSize: "var(--fs-tiny)",
            fontWeight: 700,
            color: "var(--muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            borderBottom: "1px solid var(--border)",
          }}
        >
          基金信号
        </div>
        <nav style={{ display: "flex", flexDirection: "column", padding: "var(--space-2) 0" }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm border-l-2 transition-all ${
                  isActive
                    ? "text-[var(--fg)] bg-[var(--accent-muted)] border-l-[var(--accent)]"
                    : "text-[var(--fg-2)] border-l-transparent hover:bg-[var(--hover)] hover:text-[var(--fg)]"
                }`
              }
            >
              <span style={{ width: 20, textAlign: "center", fontSize: 14, opacity: ".7" }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header
        style={{
          gridRow: 1,
          gridColumn: 2,
          display: "flex",
          alignItems: "center",
          padding: "0 var(--space-4)",
          borderBottom: "1px solid var(--border)",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ flex: 1, maxWidth: 400 }}>
          <GlobalSearch />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--fs-tiny)",
            color: "var(--fg-2)",
            marginLeft: "auto",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              background: "var(--signal-buy)",
              display: "inline-block",
            }}
          />
          <span>运行中</span>
        </div>
      </header>

      {/* Page content */}
      <main
        style={{
          gridRow: 2,
          gridColumn: 2,
          overflowY: "auto",
          position: "relative",
        }}
      >
        <Outlet />
      </main>

      {/* Statusbar footer */}
      <footer
        style={{
          gridRow: 3,
          gridColumn: "1 / 3",
          display: "flex",
          alignItems: "center",
          padding: "0 var(--space-4)",
          borderTop: "1px solid var(--border)",
          fontSize: "var(--fs-tiny)",
          color: "var(--muted)",
          background: "var(--surface)",
        }}
      >
        <StatusBar />
      </footer>
    </div>
  );
}
