import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="暂无数据" />);
    expect(screen.getByText("暂无数据")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="空" description="这是描述文本" />);
    expect(screen.getByText("这是描述文本")).toBeInTheDocument();
  });

  it("renders action node when provided", () => {
    render(
      <EmptyState
        title="空"
        action={<button>添加</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "添加" })).toBeInTheDocument();
  });

  it("renders custom icon element when provided", () => {
    render(
      <EmptyState
        title="空"
        icon={<span data-testid="custom-icon">*</span>}
      />,
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
