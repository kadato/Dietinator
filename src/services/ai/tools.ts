import type { AiToolSchema } from "@/types"

/**
 * One AI-accessible capability. Tools run against the on-device SQLite
 * database (diary, goals, food cache), so the assistant works fully offline
 * and mirrors the "in-app assistant tools are the MCP surface" idea from the
 * web server's /mcp endpoint.
 */
export type AiToolDefinition = {
  name: string
  description: string
  schema: AiToolSchema
  /** Tools that permanently modify data — the chat UI asks before running. */
  destructive?: boolean
  /** Tools that never modify data (hint for agents / MCP annotations). */
  readOnly?: boolean
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

export class AiToolRegistry {
  private readonly toolsByName = new Map<string, AiToolDefinition>()

  constructor(tools: AiToolDefinition[]) {
    for (const tool of tools) {
      this.toolsByName.set(tool.name.toLowerCase(), tool)
    }
  }

  getAll(): AiToolDefinition[] {
    return [...this.toolsByName.values()]
  }

  get(name: string): AiToolDefinition | undefined {
    return this.toolsByName.get(name.toLowerCase())
  }

  isDestructive(name: string): boolean {
    return this.toolsByName.get(name.toLowerCase())?.destructive === true
  }
}

export function stringSchema(description: string): Record<string, unknown> {
  return { type: "string", description }
}

export function numberSchema(description: string): Record<string, unknown> {
  return { type: "number", description }
}
