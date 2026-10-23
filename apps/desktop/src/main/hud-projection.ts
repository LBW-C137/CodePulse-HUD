import {
  TurnState,
  workspaceKey,
  type AgentRuntimeState,
  type StatusSnapshot,
} from '@codepulse/shared'
import { HudWorkspaces, hudRowKey, hudWorkspacePath, isHudProjectRoot } from './hud-workspaces.js'

/** HUD 1.4 supports these renderers; newer providers stay visible in the full console. */
export const HUD_AGENT_TYPES = new Set(['claude_code', 'codex', 'grok', 'kimi'])

const rowKey = hudRowKey

/** Quota/timestamp refreshes do not resurrect a card dismissed in this surface. */
function activityKey(agent: AgentRuntimeState): string {
  return JSON.stringify([
    agent.externalTurnId,
    agent.turnStartedAt,
    agent.state,
    agent.toolCallCount,
    agent.activity,
    agent.lastUserPrompt,
    agent.lastAssistantMessage,
  ])
}

/** Presentation state only. The canonical hub, dashboard and device API are never mutated. */
export class HudProjection {
  private hidden = new Map<string, string>()
  private retentionMinutes = 60
  private workspaces: HudWorkspaces

  constructor(path?: string, onError?: (error: unknown) => void) {
    this.workspaces = new HudWorkspaces(path, onError)
  }

  /** Resolve a displayed project back to canonical sessions, not their tool cwd.
   * Nested workspaces may be coalesced into a parent card by the HUD renderer.
   * Pathless "read all" keeps the existing provider-wide acknowledgement contract.
   */
  rowsForProject(source: StatusSnapshot, type: unknown, workspace?: string): AgentRuntimeState[] {
    const path = workspaceKey(hudWorkspacePath(workspace))
    const rows = this.workspaces.project(
      source.agents.filter((agent) => HUD_AGENT_TYPES.has(agent.agentType)),
    )
    const keys = new Set(
      rows
        .filter((agent) => {
          if (agent.agentType !== type) return false
          const candidate = workspaceKey(agent.workspacePath)
          return (
            !path ||
            candidate === path ||
            (isHudProjectRoot(path) && candidate.startsWith(`${path}/`))
          )
        })
        .map(rowKey),
    )
    return source.agents.filter((agent) => keys.has(rowKey(agent)))
  }

  setRetention(value: unknown): boolean {
    if (typeof value !== 'number' || ![10, 30, 60, 120, 240].includes(value)) return false
    this.retentionMinutes = value
    return true
  }

  dismiss(snapshot: StatusSnapshot, type: unknown, workspace?: string, session?: string): boolean {
    const rows = session
      ? snapshot.agents.filter(
          (agent) => agent.agentType === type && agent.externalSessionId === session,
        )
      : this.rowsForProject(snapshot, type, workspace).filter(
          (agent) => workspace || !hudWorkspacePath(agent.workspacePath),
        )
    for (const agent of rows) this.hidden.set(rowKey(agent), activityKey(agent))
    return rows.length > 0
  }

  snapshot(source: StatusSnapshot, now = Date.now()): StatusSnapshot {
    const retained = new Set<string>()
    const agents = this.workspaces
      .project(source.agents.filter((agent) => HUD_AGENT_TYPES.has(agent.agentType)))
      .map((agent) => {
        const key = rowKey(agent)
        retained.add(key)
        const hiddenActivity = this.hidden.get(key)
        if (hiddenActivity && hiddenActivity !== activityKey(agent)) this.hidden.delete(key)
        const quiet =
          agent.state === TurnState.IDLE ||
          agent.state === TurnState.CANCELLED ||
          ((
            [
              TurnState.DONE,
              TurnState.ERROR,
              TurnState.TIMEOUT,
              TurnState.USAGE_LIMITED,
            ] as string[]
          ).includes(agent.state) &&
            !agent.unread)
        const expired =
          quiet && now - (agent.terminalAt ?? agent.lastEventAt) >= this.retentionMinutes * 60_000
        return this.hidden.has(key) || expired ? { ...agent, taskHidden: true } : agent
      })
    for (const key of this.hidden.keys()) if (!retained.has(key)) this.hidden.delete(key)
    return { ...source, agents }
  }
}
