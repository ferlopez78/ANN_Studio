type PlaceholderViewProps = {
  title: string
  description: string
}

export function PlaceholderView(props: PlaceholderViewProps) {
  return (
    <section className="module-grid">
      <article className="card">
        <div className="section-header">
          <div>
            <span className="eyebrow">MVP Next Slice</span>
            <h2>{props.title}</h2>
          </div>
        </div>
        <p className="subtitle">{props.description}</p>
      </article>
    </section>
  )
}
