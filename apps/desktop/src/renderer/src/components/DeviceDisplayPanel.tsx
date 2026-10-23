import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_DEVICE_DISPLAY, DISPLAY_AGENT_TYPES,
  type DeviceDisplayConfig, type DeviceDisplaySnapshot, type DeviceStatusV1,
} from '@codepulse/shared'
import './device-display.css'
import { DeviceScreenPreview } from './DeviceScreenPreview'
import displayManifest from '../device-preview/manifest.json'
import { createDeviceDensityPreview, type DevicePreviewSource } from './device-density-preview'

const names = { codex: 'Codex', claude_code: 'Claude', grok: 'Grok' }
export function DeviceDisplayPanel(): JSX.Element {
  const [snapshot, setSnapshot] = useState<DeviceDisplaySnapshot>()
  const [draft, setDraft] = useState<DeviceDisplayConfig>({ ...DEFAULT_DEVICE_DISPLAY, agents: [...DEFAULT_DEVICE_DISPLAY.agents] })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<DeviceStatusV1>()
  const [previewSource, setPreviewSource] = useState<DevicePreviewSource>('live')
  const previewRequest = useRef(0)
  const draftRef = useRef(draft)
  draftRef.current = draft
  useEffect(() => {
    let alive = true
    void window.codepulse.getDeviceDisplay().then(s => { if (alive) { setSnapshot(s); setDraft(s.config) } }).catch(() => { if (alive) setMessage('显示配置暂不可用，请使用统一桌面入口。') })
    const unsubscribe = window.codepulse.onStatus(() => {
      const requested = draftRef.current
      const request = ++previewRequest.current
      void window.codepulse.getDeviceDisplay(requested).then(s => { if (alive && request === previewRequest.current) {
        setSnapshot(s)
        if (JSON.stringify(requested) === JSON.stringify(draftRef.current)) setPreview(s.status)
      } }).catch(() => {})
    })
    return () => { alive = false; unsubscribe() }
  }, [])
  useEffect(() => {
    let alive = true
    const request = ++previewRequest.current
    setPreview(undefined)
    void window.codepulse.getDeviceDisplay(draft).then(s => {
      if (alive && request === previewRequest.current) setPreview(s.status)
    }).catch(() => { if (alive && request === previewRequest.current) setMessage('预览数据暂不可用，请重新选择配置重试。') })
    return () => { alive = false }
  }, [draft])
  const change = (patch: Partial<DeviceDisplayConfig>): void => { setDraft(d => ({ ...d, ...patch })); setMessage('修改尚未应用。') }
  const dirty = snapshot && JSON.stringify(draft) !== JSON.stringify(snapshot.config)
  const apply = async (): Promise<void> => {
    setBusy(true)
    try { const s = await window.codepulse.setDeviceDisplay(draft); setSnapshot(s); setDraft(s.config); setMessage('已保存到电脑，在线设备将尽快应用；正在刷新时会在本轮结束后更新。预览不代表设备已显示。') }
    catch { setMessage('保存失败，设备配置未更改，请重试。') }
    finally { setBusy(false) }
  }
  const sample = useMemo(() => previewSource === 'live' ? undefined : createDeviceDensityPreview(draft, previewSource), [draft, previewSource])
  const previewStatus = draft.mode === 'hud' && sample ? sample : preview
  const showingSample = draft.mode === 'hud' && previewSource !== 'live'
  return <section className="device-display-panel border-t border-line pt-5">
    <fieldset disabled={!snapshot || busy} className="min-w-0">
    <h3 className="text-sm font-semibold text-ink">墨水屏显示</h3>
    <p className="mt-1.5 text-meta leading-5 text-ink-500">同一台设备，HUD 工作与用量看板两种视角。</p>
    <div className="mt-3 flex flex-wrap gap-2">{(['hud', 'usage'] as const).map(mode => <button className="control-btn px-3 py-2" type="button" key={mode} aria-pressed={draft.mode === mode} onClick={() => change({ mode })}>{mode === 'hud' ? 'HUD 工作' : '用量看板'}</button>)}</div>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">{DISPLAY_AGENT_TYPES.map(type => <label key={type} className="flex items-center gap-2"><input type="checkbox" checked={draft.agents.includes(type)} onChange={e => change({ agents: DISPLAY_AGENT_TYPES.filter(t => t === type ? e.target.checked : draft.agents.includes(t)), page: 0 })} />{names[type]}</label>)}</div>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs"><label><input type="checkbox" disabled={draft.mode === 'usage'} checked={draft.showQuota} onChange={e => change({ showQuota: e.target.checked })} /> HUD 显示账户额度</label><label><input type="checkbox" checked={draft.showEnvironment} onChange={e => change({ showEnvironment: e.target.checked })} /> 温度与湿度</label><label>额度 <select value={draft.metric} onChange={e => change({ metric: e.target.value as DeviceDisplayConfig['metric'] })}><option value="remaining">剩余</option><option value="used">已用</option></select></label></div>
    {draft.mode === 'hud' && <div className="mt-4" role="group" aria-label="预览内容">
      <div className="flex flex-wrap items-center gap-2 text-xs"><span>预览内容</span>{(['live', 3, 6, 9] as const).map(source => <button key={source} type="button" className="control-btn px-3 py-2" aria-pressed={previewSource === source} onClick={() => setPreviewSource(source)}>{source === 'live' ? '实时任务' : `${source} 个任务样例`}</button>)}</div>
      {showingSample && <p className="mt-2 text-xs leading-5 text-ink-500" role="status">示例画面：用于检查长标题、待确认和密集布局，不会发送到墨水屏。</p>}
    </div>}
    {previewStatus && <DeviceScreenPreview status={previewStatus} sample={showingSample} />}
    {!showingSample && previewStatus && (previewStatus.threadTotal ?? 0) > 9 && <label className="mt-3 flex items-center gap-2 text-xs">线程页<select value={Math.min(draft.page, Math.ceil((previewStatus.threadTotal ?? 0) / 9) - 1)} onChange={e => change({ page: Number(e.target.value) })}>{Array.from({ length: Math.ceil((previewStatus.threadTotal ?? 0) / 9) }, (_, n) => <option key={n} value={n}>第 {n + 1} 页</option>)}</select>手动切换，不自动轮播</label>}
    <p className="mt-3 text-xs leading-5 text-ink-500">按 HUD 规则排序：Claude → Codex → Grok，同项目相邻，同级先到先得。按线程数量扩展为单列、两列或三列；标题优先，底部保留账户额度汇总，温湿度与网络、电量同列显示在顶栏。纯黑白低闪更新，温湿度小幅变化不单独刷新。</p>
    <p className="mt-2 text-xs text-ink-500">当前画面对应 {displayManifest.firmwareVersion} 固件；旧版设备的字体与布局可能不同。选择模式只改变预览，点击「应用配置」才保存。0.0.18 起状态变化即时响应，配置保存后尽快同步，不再等待 3 分钟；正在刷新时先完成本轮，再取最新画面。旧固件仍使用旧节奏。</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-ink-500" aria-live="polite">{showingSample ? '查看完成后切回「实时任务」再应用配置。' : message || (snapshot?.serverAvailable ? '调整完成后统一应用。' : '设备服务未启用；配置可先保存。')}</span><button className="control-btn px-3 py-2" type="button" disabled={!dirty || busy || showingSample} onClick={() => void apply()}>{busy ? '保存中…' : '应用配置'}</button></div>
    </fieldset>
  </section>
}
