import { TurnState, type AgentRuntimeState, type StatusSnapshot } from '@codepulse/shared'

/** HUD 1.4 supports these renderers; newer providers stay visible in the full console. */
export const HUD_AGENT_TYPES = new Set(['claude_code', 'codex', 'grok', 'kimi'])

function rowKey(agent: AgentRuntimeState): string {
  return JSON.stringify([agent.agentType, agent.workspacePath ?? '', agent.externalSessionId ?? ''])
}

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

  setRetention(value: unknown): boolean {
    if (typeof value !== 'number' || ![10, 30, 60, 120, 240].includes(value)) return false
    this.retentionMinutes = value
    return true
  }

  dismiss(snapshot: StatusSnapshot, type: unknown, workspace?: string, session?: string): boolean {
    const rows = snapshot.agents.filter(
      (agent) =>
        agent.agentType === type &&
        agent.workspacePath === workspace &&
        (!session || agent.externalSessionId === session),
    )
    for (const agent of rows) this.hidden.set(rowKey(agent), activityKey(agent))
    return rows.length > 0
  }

  snapshot(source: StatusSnapshot, now = Date.now()): StatusSnapshot {
    const retained = new Set<string>()
    const agents = source.agents
      .filter((agent) => HUD_AGENT_TYPES.has(agent.agentType))
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
