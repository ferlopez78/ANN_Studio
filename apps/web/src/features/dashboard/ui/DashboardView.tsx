import type { KpiCard, RunRecord } from '../../../shared/types/mvp'

type DashboardViewProps = {
  kpiCards: KpiCard[]
  recentRuns: RunRecord[]
  alerts: string[]
  queueLength: number
  modelsCount: number
  pendingDatasets: number
  onOpenRuns: () => void
  onOpenDatasets: () => void
  onOpenRegistry: () => void
}

export function DashboardView(props: DashboardViewProps) {
  return (
    <>
      <section className="kpi-grid">
        {props.kpiCards.map((kpi) => (
          <article key={kpi.label} className="card kpi-card">
            <span className="card-label">{kpi.label}</span>
            <strong className="card-value">{kpi.value}</strong>
            <span className="card-foot">{kpi.foot}</span>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="card runs-card">
          <div className="section-header">
            <div>
              <span className="eyebrow">Operations</span>
              <h2>Recent Runs</h2>
            </div>
            <button className="btn btn-secondary" onClick={props.onOpenRuns}>
              Open Runs
            </button>
          </div>

          <div className="runs-table">
            <div className="table-head">
              <span>Run</span>
              <span>Project</span>
              <span>Type</span>
              <span>Status</span>
              <span>Progress</span>
              <span>Updated</span>
            </div>

            {props.recentRuns.map((run) => (
              <div className="table-row" key={run.id}>
                <span className="run-name">{run.name}</span>
                <span>{run.project}</span>
                <span>{run.model}</span>
                <span>
                  <span className={`status status-${run.status.toLowerCase()}`}>{run.status}</span>
                </span>
                <span>{run.progress}%</span>
                <span>{run.updated}</span>
              </div>
            ))}
          </div>
        </article>

        <div className="side-panels">
          <article className="card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Attention</span>
                <h2>Alerts</h2>
              </div>
              <span className="pill">{props.alerts.length} open</span>
            </div>

            <ul className="alert-list">
              {props.alerts.map((alert) => (
                <li key={alert}>{alert}</li>
              ))}
            </ul>
          </article>

          <article className="card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Shortcuts</span>
                <h2>Quick Actions</h2>
              </div>
            </div>

            <div className="action-grid">
              <button className="btn btn-secondary full" onClick={props.onOpenRuns}>
                New Run
              </button>
              <button className="btn btn-secondary full" onClick={props.onOpenDatasets}>
                Import Dataset
              </button>
              <button className="btn btn-secondary full" onClick={props.onOpenRegistry}>
                Register Candidate
              </button>
            </div>
          </article>

          <article className="card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Today</span>
                <h2>Overview</h2>
              </div>
            </div>

            <div className="mini-stats">
              <div className="mini-stat">
                <span>Queue Length</span>
                <strong>{props.queueLength}</strong>
              </div>
              <div className="mini-stat">
                <span>Models Registered</span>
                <strong>{props.modelsCount}</strong>
              </div>
              <div className="mini-stat">
                <span>Pending Datasets</span>
                <strong>{props.pendingDatasets}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  )
}
