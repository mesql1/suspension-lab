export function Panel({ title, eyebrow, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-header">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}
