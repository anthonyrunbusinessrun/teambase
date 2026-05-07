import { TopBar } from "@/components/layout/TopBar";
import { WorldClock } from "@/components/clocks/WorldClock";

const CLOCKS = [
  { city: "Austin", timezone: "America/Chicago", flag: "🇺🇸" },
  { city: "Manila", timezone: "Asia/Manila", flag: "🇵🇭" },
  { city: "Cebu", timezone: "Asia/Manila", flag: "🇵🇭" },
  { city: "UTC", timezone: "UTC", flag: "🌐" },
] as const;

export const metadata = { title: "Clocks" };

export default function ClocksPage() {
  return (
    <>
      <TopBar title="World clocks" />
      <main className="px-5 pt-4 pb-6">
        <div className="space-y-3">
          {CLOCKS.map((clock) => (
            <WorldClock key={clock.city} {...clock} />
          ))}
        </div>
      </main>
    </>
  );
}
