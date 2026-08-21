import { Feather } from "@expo/vector-icons"
import { toDateKey } from "@/utils/date"

/**
 * Curated one-tap prompts for the AI chat. `{date}` is replaced with today's
 * date key when the preset is sent.
 */
export type AiPreset = {
  id: string
  title: string
  subtitle: string
  icon: string
  prompt: string
}

export const AI_PRESETS: AiPreset[] = [
  {
    id: "daily-review",
    title: "Daily review",
    subtitle: "Summary of today + one suggestion",
    icon: "bar-chart-2",
    prompt:
      "Review my diary for {date}. Give me a short summary of calories and macros compared to my goals, and suggest one small improvement.",
  },
  {
    id: "protein-check",
    title: "Protein check",
    subtitle: "How am I doing on protein today?",
    icon: "activity",
    prompt:
      "How is my protein intake looking today ({date})? Which meals were lowest in protein, and what could I add to reach my goal?",
  },
  {
    id: "plan-dinner",
    title: "Plan dinner",
    subtitle: "Search + log after I approve",
    icon: "shopping-bag",
    prompt:
      "Suggest a balanced dinner of about 600 kcal and 40 g protein using search_foods for real nutrition. Then log it for me after I approve.",
  },
  {
    id: "week-review",
    title: "Week in review",
    subtitle: "Last 7 days of eating",
    icon: "calendar",
    prompt:
      "Summarize my last 7 days of eating: average calories and protein, days I logged, and any patterns worth noticing.",
  },
  {
    id: "log-snack",
    title: "Log a snack",
    subtitle: "I ate something, log it",
    icon: "coffee",
    prompt:
      "I had a snack worth about 250 kcal. Use search_foods to find a realistic option, then log it for today ({date}) after I approve.",
  },
  {
    id: "reset-goals",
    title: "Reset my goals",
    subtitle: "1800 kcal, 140 g protein",
    icon: "flag",
    prompt: "Update my daily goals to 1800 kcal, 140 g protein, 180 g carbs and 60 g fat.",
  },
]

/** Fill dynamic slots (for example{date}) and return the final prompt. */
export function presetPrompt(preset: AiPreset): string {
  return preset.prompt.replaceAll("{date}", toDateKey())
}
