import { useMemo, useState, type ReactNode } from 'react'

type AssociationOption = {
  id: string
  label: string
  meta?: string
}

type AssociationPickerProps = {
  title: string
  description: string
  buttonLabel: string
  modalTitle: string
  searchLabel: string
  searchPlaceholder: string
  emptySearchMessage: string
  selectedIds: string[]
  options: AssociationOption[]
  selectionMode?: 'multiple' | 'single'
  disabled?: boolean
  onChange: (ids: string[]) => void
  children?: ReactNode
}

const helperPageSize = 8

function applySelection(
  list: string[],
  value: string,
  checked: boolean,
  mode: 'multiple' | 'single',
): string[] {
  if (mode === 'single') {
    return checked ? [value] : []
  }

  if (checked) {
    if (list.includes(value)) {
      return list
    }

    return [...list, value]
  }

  return list.filter((item) => item !== value)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderHighlightedText(value: string, query: string) {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return value
  }

  const pattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'ig')
  const parts = value.split(pattern)

  return parts.map((part, index) => {
    if (part.toLowerCase() === normalizedQuery.toLowerCase()) {
      return (
        <mark key={`${part}-${index}`} className="association-highlight">
          {part}
        </mark>
      )
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

export function AssociationPicker(props: AssociationPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const selectedOptions = useMemo(
    () => props.options.filter((option) => props.selectedIds.includes(option.id)),
    [props.options, props.selectedIds],
  )

  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) {
      return props.options
    }

    return props.options.filter((option) => {
      return option.label.toLowerCase().includes(term) || (option.meta ?? '').toLowerCase().includes(term)
    })
  }, [props.options, query])

  const totalPages = Math.max(1, Math.ceil(filteredOptions.length / helperPageSize))
  const activePage = Math.min(page, totalPages)

  const pageOptions = useMemo(() => {
    const start = (activePage - 1) * helperPageSize
    return filteredOptions.slice(start, start + helperPageSize)
  }, [activePage, filteredOptions])

  const selectionMode = props.selectionMode ?? 'multiple'

  return (
    <div className="selection-panel">
      <h3>{props.title}</h3>
      <p className="muted-text">{props.description}</p>

      <div className="association-row">
        <button
          className="btn btn-secondary"
          onClick={() => {
            setOpen(true)
            setPage(1)
          }}
          disabled={props.disabled}
        >
          {props.buttonLabel}
        </button>
        <span className="muted-text">{props.selectedIds.length} selected</span>
      </div>

      {selectedOptions.length > 0 ? (
        <div className="association-grid">
          {selectedOptions.map((option) => (
            <span key={option.id} className="chip chip-readonly">
              {option.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted-text">No selections yet.</p>
      )}

      {props.children ? <div className="association-children">{props.children}</div> : null}

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="modal-card modal-card-helper" onClick={(event) => event.stopPropagation()}>
            <div className="section-header modal-header">
              <div>
                <span className="eyebrow">Association Helper</span>
                <h3>{props.modalTitle}</h3>
              </div>
              <button className="btn btn-secondary mini-btn modal-close" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="modal-toolbar">
              <label className="field">
                {props.searchLabel}
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                  placeholder={props.searchPlaceholder}
                />
              </label>
            </div>

            <div className="association-list">
              {pageOptions.length === 0 ? (
                <p className="muted-text">{props.emptySearchMessage}</p>
              ) : (
                pageOptions.map((option) => (
                  <label key={option.id} className="association-item">
                    <input
                      type="checkbox"
                      checked={props.selectedIds.includes(option.id)}
                      onChange={(event) =>
                        props.onChange(applySelection(props.selectedIds, option.id, event.target.checked, selectionMode))
                      }
                    />
                    <span>
                      <strong>{renderHighlightedText(option.label, query)}</strong>
                      {option.meta && (
                        <span className="association-item-meta">{renderHighlightedText(option.meta, query)}</span>
                      )}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="association-pagination">
              <button
                className="btn btn-secondary mini-btn"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={activePage === 1}
              >
                Prev
              </button>
              <span className="muted-text">
                Page {activePage} / {totalPages}
              </span>
              <button
                className="btn btn-secondary mini-btn"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={activePage === totalPages}
              >
                Next
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
