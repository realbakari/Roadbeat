import { describe, expect, it } from 'vitest'
import { PANELS } from '../lib/dashboardLayout'
import { PANEL_VIEWS } from './panels'
import { MONITOR_VIEWS } from './panelsMonitor'

describe('panel registry', () => {
  it('has a view for every panel, and no view without a panel', () => {
    const views = { ...PANEL_VIEWS, ...MONITOR_VIEWS }
    expect(PANELS.filter((p) => p.kind !== 'strip').map((p) => p.id).sort()).toEqual(Object.keys(views).sort())
  })
})
