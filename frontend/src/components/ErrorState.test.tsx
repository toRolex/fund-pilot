import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("renders default message", () => {
    render(<ErrorState />);
    expect(screen.getByText("数据加载失败")).toBeInTheDocument();
  });

  it("renders custom message", () => {
    render(<ErrorState message="自定义错误" />);
    expect(screen.getByText("自定义错误")).toBeInTheDocument();
  });

  it("renders retry button and calls onRetry on click", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const btn = screen.getByRole("button", { name: /重试/ });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("hides retry button when onRetry is omitted", () => {
    render(<ErrorState message="出错啦" />);
    expect(screen.queryByRole("button", { name: /重试/ })).not.toBeInTheDocument();
  });
});
