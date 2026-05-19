import { TopBar } from "@/components/layout/top-bar";

export default function Loading() {
  return (
    <>
      <TopBar />
      <main className="container py-8 max-w-4xl relative z-10">
        <div className="h-3 w-24 rounded bg-bone-200 animate-pulse-soft mb-3" />
        <div className="h-10 w-2/3 rounded bg-bone-200 animate-pulse-soft mb-3" />
        <div className="h-4 w-1/2 rounded bg-bone-200 animate-pulse-soft" />
      </main>
    </>
  );
}
