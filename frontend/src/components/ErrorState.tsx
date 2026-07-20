interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "数据加载失败", onRetry }: Props) {
  return (
    <div className="error-state visible">
      <div className="error-icon">&#9650;</div>
      <div className="error-title">{message}</div>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  );
}
