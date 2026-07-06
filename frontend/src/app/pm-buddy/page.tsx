import { PmBuddyChat } from "@/components/PmBuddyChat";

export default function PmBuddyPage() {
  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-screen md:max-h-screen p-4 md:px-10 md:pt-6 md:pb-5 overflow-hidden">
      <header className="shrink-0 mb-4">
        <h1 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-on-surface">
          PM Buddy
        </h1>
        <p className="text-[14px] text-on-surface-variant mt-1 max-w-2xl">
          Evidence-backed copilot focused on why users struggle with meaningful discovery and why listening still leans on repeat playlists, familiar artists, and previously discovered tracks.
        </p>
      </header>
      <PmBuddyChat />
    </div>
  );
}
