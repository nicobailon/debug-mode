import { parseProgressStatus } from "../lib/progress.js";

export async function status(args: string[]): Promise<void> {
  const track = args[0];

  if (track !== "track-a" && track !== "track-b") {
    console.error("Usage: debug-mode status <track-a|track-b>");
    console.error("");
    console.error("Example:");
    console.error("  debug-mode status track-a");
    console.error("  debug-mode status track-b");
    process.exit(1);
  }

  try {
    const result = await parseProgressStatus(track);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error reading progress status:", error);
    process.exit(1);
  }
}
