import { useMemo, useState } from 'react'

import type { ClientRecord, ClientStatus } from '../../../shared/types/mvp'

type ClientFormInput = {
  name: string
  status: ClientStatus
  notes?: string
}

type ClientsViewProps = {
  clients: ClientRecord[]
  onCreateClient: (input: ClientFormInput) => Promise<void>
  onUpdateClient: (input: ClientFormInput & { id: string }) => Promise<void>
  onDeleteClient: (clientId: string) => Promise<void>
}

type ClientViewMode = 'list' | 'create' | 'edit'
type ClientSortField = 'code' | 'name' | 'status' | 'updated'
type SortDirection = 'asc' | 'desc'

type ClientFormState = {
  id: string | null
  code?: string
  name: string
  status: ClientStatus
  notes: string
}

function buildEmptyClientFormState(): ClientFormState {
  return {
    id: null,
    name: '',
    status: 'active',
    notes: '',
  }
}

function buildFormStateFromClient(client: ClientRecord): ClientFormState {
  return {
    id: client.id,
    code: client.code,
    name: client.name,
    status: client.status,
    notes: client.notes ?? '',
  }
}

const pageSizeOptions = [5, 10, 20]

export function ClientsView(props: ClientsViewProps) {
  const [viewMode, setViewMode] = useState<ClientViewMode>('list')
  const [clientForm, setClientForm] = useState<ClientFormState>(() => buildEmptyClientFormState())
  const [errorMessage, setErrorMessage] = useState('')
  const [sortField, setSortField] = useState<ClientSortField>('updated')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const sortedClients = useMemo(() => {
    const next = [...props.clients]
    next.sort((a, b) => {
      let base = 0
      if (sortField === 'code') {
        base = a.code.localeCompare(b.code)
      } else if (sortField === 'name') {
        base = a.name.localeCompare(b.name)
      } else if (sortField === 'status') {
        base = a.status.localeCompare(b.status)
      } else {
        base = a.updated.localeCompare(b.updated)
      }
      return sortDirection === 'asc' ? base : -base
    })
    return next
  }, [props.clients, sortDirection, sortField])

  const totalPages = Math.max(1, Math.ceil(sortedClients.length / pageSize))
  const activePage = Math.min(currentPage, totalPages)
  const paginatedClients = useMemo(() => {
    const start = (activePage - 1) * pageSize
    return sortedClients.slice(start, start + pageSize)
  }, [activePage, pageSize, sortedClients])

  function openCreateClient(): void {
    setClientForm(buildEmptyClientFormState())
    setErrorMessage('')
    setViewMode('create')
  }

  function openEditClient(client: ClientRecord): void {
    setClientForm(buildFormStateFromClient(client))
    setErrorMessage('')
    setViewMode('edit')
  }

  function backToList(): void {
    setViewMode('list')
  }

  async function handleSaveClient(): Promise<void> {
    const name = clientForm.name.trim()
    if (!name) {
      return
    }

    try {
      if (clientForm.id) {
        await props.onUpdateClient({
          id: clientForm.id,
          name,
          status: clientForm.status,
          notes: clientForm.notes.trim() || undefined,
        })
      } else {
        await props.onCreateClient({
          name,
          status: clientForm.status,
          notes: clientForm.notes.trim() || undefined,
        })
      }

      setClientForm(buildEmptyClientFormState())
      setViewMode('list')
      setCurrentPage(1)
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to persist client')
    }
  }

  async function handleDeleteClient(clientId: string): Promise<void> {
    try {
      await props.onDeleteClient(clientId)
      if (clientForm.id === clientId) {
        setClientForm(buildEmptyClientFormState())
        setViewMode('list')
      }
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to archive client')
    }
  }

  function renderForm() {
    const isEditing = viewMode === 'edit'

    return (
      <article className="card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Client Management</span>
            <h2>{isEditing ? 'Edit Client' : 'Create Client'}</h2>
          </div>
          <button className="btn btn-secondary" onClick={backToList}>
            Back To List
          </button>
        </div>

        <div className="form-grid form-grid-2">
          {isEditing && (
            <label className="field">
              Client Code
              <input value={clientForm.code ?? ''} readOnly />
            </label>
          )}
          <label className="field">
            Client Name
            <input value={clientForm.name} onChange={(event) => setClientForm((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label className="field">
            Status
            <select value={clientForm.status} onChange={(event) => setClientForm((prev) => ({ ...prev, status: event.target.value as ClientStatus }))}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
          <label className="field">
            Notes
            <input value={clientForm.notes} onChange={(event) => setClientForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </label>
        </div>

        <button className="btn btn-primary" onClick={() => void handleSaveClient()}>
          {isEditing ? 'Update Client' : 'Save Client'}
        </button>

        {errorMessage && <p className="muted-text">{errorMessage}</p>}
      </article>
    )
  }

  function renderList() {
    return (
      <article className="card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Client Inventory</span>
            <h2>Registered Clients</h2>
          </div>
          <button className="btn btn-primary" onClick={openCreateClient}>
            Create Client
          </button>
        </div>

        <div className="projects-table">
          <div className="projects-head">
            <span>Code</span>
            <span>Name</span>
            <span>Status</span>
            <span>Updated</span>
            <span>Actions</span>
          </div>
          {paginatedClients.map((client) => (
            <div className="projects-row" key={client.id}>
              <span>{client.code}</span>
              <span>{client.name}</span>
              <span>{client.status}</span>
              <span>{client.updated}</span>
              <span className="table-actions">
                <button className="btn btn-secondary mini-btn" onClick={() => openEditClient(client)}>
                  Edit
                </button>
                <button className="btn btn-secondary mini-btn btn-danger" onClick={() => void handleDeleteClient(client.id)}>
                  Archive
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className="pagination-row">
          <div className="pagination-controls">
            <label className="field pagination-size">
              Sort By
              <select
                value={sortField}
                onChange={(event) => {
                  setSortField(event.target.value as ClientSortField)
                  setCurrentPage(1)
                }}
              >
                <option value="updated">Updated</option>
                <option value="code">Code</option>
                <option value="name">Name</option>
                <option value="status">Status</option>
              </select>
            </label>

            <label className="field pagination-size">
              Order
              <select
                value={sortDirection}
                onChange={(event) => {
                  setSortDirection(event.target.value as SortDirection)
                  setCurrentPage(1)
                }}
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </label>

            <button
              className="btn btn-secondary mini-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={activePage === 1}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                className={`btn mini-btn ${pageNumber === activePage ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCurrentPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              className="btn btn-secondary mini-btn"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={activePage === totalPages}
            >
              Next
            </button>
          </div>

          <label className="field pagination-size">
            Rows
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setCurrentPage(1)
              }}
            >
              {pageSizeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errorMessage && <p className="muted-text">{errorMessage}</p>}
      </article>
    )
  }

  return (
    <section className="module-grid">
      {viewMode === 'list' ? renderList() : renderForm()}
    </section>
  )
}
