interface LoadingSkeletonProps {
  variant?: "analysis" | "chat";
}

export function LoadingSkeleton({
  variant = "analysis",
}: LoadingSkeletonProps): React.ReactElement {
  if (variant === "chat") return <ChatSkeleton />;
  return <AnalysisSkeleton />;
}

function AnalysisSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="skeleton h-5 w-32" />
        <div className="mt-3 skeleton h-7 w-3/4" />
        <div className="mt-2 skeleton h-4 w-1/2" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-4 w-20" />
            <div className="mt-3 space-y-2">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-11/12" />
              <div className="skeleton h-3 w-10/12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatSkeleton(): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="card max-w-[80%] space-y-2 p-3">
          <div className="skeleton h-3 w-48" />
          <div className="skeleton h-3 w-32" />
        </div>
      </div>
      <div className="flex justify-start">
        <div className="card max-w-[80%] space-y-2 p-3">
          <div className="skeleton h-3 w-64" />
          <div className="skeleton h-3 w-48" />
          <div className="skeleton h-3 w-56" />
        </div>
      </div>
    </div>
  );
}
