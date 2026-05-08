import { TopBar } from "@/components/layout/TopBar";
import { WorldClock } from "@/components/clocks/WorldClock";

export const metadata = { title: "World Clocks" };

const CLOCKS = [
  { city: "Austin",        timezone: "America/Chicago",     flag: "🇺🇸", region: "Central Time (HQ)" },
  { city: "New York",      timezone: "America/New_York",    flag: "🇺🇸", region: "Eastern Time" },
  { city: "Los Angeles",   timezone: "America/Los_Angeles", flag: "🇺🇸", region: "Pacific Time" },
  { city: "London",        timezone: "Europe/London",       flag: "🇬🇧", region: "GMT / BST" },
  { city: "Dubai",         timezone: "Asia/Dubai",          flag: "🇦🇪", region: "Gulf Standard Time" },
  { city: "Singapore",     timezone: "Asia/Singapore",      flag: "🇸🇬", region: "Singapore Time" },
  { city: "Manila",        timezone: "Asia/Manila",         flag: "🇵🇭", region: "Philippine Time" },
  { city: "Saipan",        timezone: "Pacific/Saipan",      flag: "🇲🇵", region: "Chamorro Standard Time" },
  { city: "UTC",           timezone: "UTC",                 flag: "🌐", region: "Coordinated Universal" },
] as const;

export default function ClocksPage() {
  return (
    <>
      <TopBar title="World Clocks" subtitle="9 global timezones" />
      <div className="page-content">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {CLOCKS.map((clock) => (
            <WorldClock key={clock.city} {...clock} />
          ))}
        </div>
      </div>
    </>
  );
}
