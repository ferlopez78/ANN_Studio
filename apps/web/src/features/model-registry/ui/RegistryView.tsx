import type { ModelVersion, RunRecord } from '../../../shared/types/mvp'

type RegistryViewProps = {
  models: ModelVersion[]
  registrableRuns: RunRecord[]
  onRegister: (runId: string) => void
}

export function RegistryView(props: RegistryViewProps) {
  return (
    <section className="module-grid">
      <article className="card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Promotion</span>
            <h2>Register From Completed Runs</h2>
          </div>
        </div>
        {props.registrableRuns.length === 0 ? (
          <p className="subtitle">No completed or review-ready runs available for registration.</p>
        ) : (
          <div className="stack-list">
            {props.registrableRuns.map((run) => (
              <div key={run.id} className="stack-item">
                <div>
                  <strong>{run.name}</strong>
                  <p className="muted-text">{run.model}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => props.onRegister(run.id)}>
                  Register
                </button>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Catalog</span>
            <h2>Model Registry</h2>
          </div>
        </div>
        <div className="simple-table">
          <div className="simple-table-head">
            <span>Name</span>
            <span>Family</span>
            <span>Version</span>
            <span>Quality</span>
          </div>
          {props.models.map((model) => (
            <div key={model.id} className="simple-table-row">
              <span>{model.name}</span>
              <span>{model.family}</span>
              <span>{model.version}</span>
              <span>{model.qualityScore}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
