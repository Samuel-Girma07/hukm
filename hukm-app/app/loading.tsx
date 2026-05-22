import { LoadingSkeleton } from "@/components/LoadingSkeleton";

export default function Loading(): React.ReactElement {
  return (
    <div className="mx-auto max-w-3xl">
      <LoadingSkeleton />
    </div>
  );
}
