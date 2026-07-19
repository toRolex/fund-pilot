import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GlobalSearch } from "./GlobalSearch";

function renderSearch() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <GlobalSearch />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("GlobalSearch", () => {
  it("renders search input", () => {
    renderSearch();
    expect(screen.getByPlaceholderText("搜索基金")).toBeInTheDocument();
  });

  it("shows results with watched marker after debounce", async () => {
    const results = [
      { code: "000001", name: "测试基金A", type: "股票型", is_watched: true },
    ];
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(results), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderSearch();
    const input = screen.getByPlaceholderText("搜索基金");
    fireEvent.change(input, { target: { value: "000001" } });

    await waitFor(() => {
      expect(screen.getByText("000001")).toBeInTheDocument();
      expect(screen.getByText("已关注")).toBeInTheDocument();
    });
  }, 10000);

  it("shows unwatched marker", async () => {
    const results = [
      { code: "999999", name: "新基金", is_watched: false },
    ];
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(results), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderSearch();
    const input = screen.getByPlaceholderText("搜索基金");
    fireEvent.change(input, { target: { value: "999999" } });

    await waitFor(() => {
      expect(screen.getByText("未关注")).toBeInTheDocument();
    });
  }, 10000);

  it("shows empty state when no results", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderSearch();
    const input = screen.getByPlaceholderText("搜索基金");
    fireEvent.change(input, { target: { value: "不存在" } });

    await waitFor(() => {
      expect(screen.getByText("未找到匹配的基金")).toBeInTheDocument();
    });
  }, 10000);

  it("navigates to /watchlists on click and clears input", async () => {
    const results = [
      { code: "000001", name: "测试基金A", type: "股票型", is_watched: true },
    ];
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(results), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderSearch();
    const input = screen.getByPlaceholderText("搜索基金");
    fireEvent.change(input, { target: { value: "000001" } });

    await waitFor(() => {
      expect(screen.getByText("000001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("000001"));
    expect(input).toHaveValue("");
  }, 10000);

  it("closes dropdown on Escape", async () => {
    const results = [
      { code: "000001", name: "测试基金A", is_watched: true },
    ];
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(results), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderSearch();
    const input = screen.getByPlaceholderText("搜索基金");
    fireEvent.change(input, { target: { value: "000001" } });

    await waitFor(() => {
      expect(screen.getByText("000001")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("000001")).not.toBeInTheDocument();
    });
  }, 10000);

  it("navigates on Enter after keyboard selection", async () => {
    const results = [
      { code: "000001", name: "测试基金A", is_watched: true },
    ];
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(results), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderSearch();
    const input = screen.getByPlaceholderText("搜索基金");
    fireEvent.change(input, { target: { value: "000001" } });

    await waitFor(() => {
      expect(screen.getByText("000001")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("");
  }, 10000);
});
