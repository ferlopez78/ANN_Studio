import { useMemo, useState } from 'react'

import type {
  DatasetRecord,
  ModelVersion,
  ProjectNetworkType,
  ProjectRecord,
  ProjectStatus,
} from '../../../shared/types/mvp'
import { AssociationPicker } from '../../../shared/ui/AssociationPicker'

type ProjectFormInput = {
  name: string
  createdOn: string
  status: ProjectStatus
  networkType: ProjectNetworkType
  datasetIds: string[]
  modelIds: string[]
  modelCombinations: string[]
}

type ProjectsViewProps = {
  projects: ProjectRecord[]
  datasets: DatasetRecord[]
  models: ModelVersion[]
  onCreateProject: (input: ProjectFormInput) => void
  onUpdateProject: (input: ProjectFormInput & { id: string }) => void
  onUpdateProjectStatus: (projectId: string, status: ProjectStatus) => void
  onDeleteProject: (projectId: string) => void
}

type ProjectViewMode = 'list' | 'create' | 'edit'

type ProjectFormState = {
  id: string | null
  name: string
  createdOn: string
  status: ProjectStatus
  networkType: ProjectNetworkType
  selectedDatasetIds: string[]
  selectedModelIds: string[]
  combinationDraft: string
  modelCombinations: string[]
}

const networkOptions: ProjectNetworkType[] = ['ANN Binary', 'ANN Multiclass', 'CNN Vision', 'Custom Detector']
const statusOptions: ProjectStatus[] = ['Draft', 'Active', 'Paused', 'Archived']
const pageSizeOptions = [5, 10, 20]
const defaultProjectDate = new Date().toISOString().slice(0, 10)

function buildEmptyFormState(): ProjectFormState {
  return {
    id: null,
    name: '',
    createdOn: defaultProjectDate,
    status: 'Draft',
    networkType: 'ANN Binary',
    selectedDatasetIds: [],
    selectedModelIds: [],
    combinationDraft: '',
    modelCombinations: [],
  }
}

function buildFormStateFromProject(project: ProjectRecord): ProjectFormState {
  return {
    id: project.id,
    name: project.name,
    createdOn: project.createdOn,
    status: project.status,
    networkType: project.networkType,
    selectedDatasetIds: project.datasetIds,
    selectedModelIds: project.modelIds,
    combinationDraft: '',
    modelCombinations: project.modelCombinations,
  }
}

export function ProjectsView(props: ProjectsViewProps) {
  const [viewMode, setViewMode] = useState<ProjectViewMode>('list')
  const [formState, setFormState] = useState<ProjectFormState>(() => buildEmptyFormState())
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [detailsProjectId, setDetailsProjectId] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(props.projects.length / pageSize))
  const activePage = Math.min(currentPage, totalPages)

  const paginatedProjects = useMemo(() => {
    const start = (activePage - 1) * pageSize
    return props.projects.slice(start, start + pageSize)
  }, [activePage, pageSize, props.projects])

  const detailsProject = useMemo(
    () => props.projects.find((project) => project.id === detailsProjectId) ?? null,
    [detailsProjectId, props.projects],
  )

  const detailsDatasetNames = useMemo(() => {
    if (!detailsProject) {
      return []
    }

    return detailsProject.datasetIds.map(
      (datasetId) => props.datasets.find((dataset) => dataset.id === datasetId)?.name ?? datasetId,
    )
  }, [detailsProject, props.datasets])

  const detailsModelNames = useMemo(() => {
    if (!detailsProject) {
      return []
    }

    return detailsProject.modelIds.map((modelId) => props.models.find((model) => model.id === modelId)?.name ?? modelId)
  }, [detailsProject, props.models])

  const datasetOptions = useMemo(
    () => props.datasets.map((dataset) => ({ id: dataset.id, label: dataset.name, meta: dataset.type })),
    [props.datasets],
  )

  const modelOptions = useMemo(
    () => props.models.map((model) => ({ id: model.id, label: model.name, meta: `${model.family} | ${model.version}` })),
    [props.models],
  )

  function openCreateView(): void {
    setFormState(buildEmptyFormState())
    setViewMode('create')
  }

  function openEditView(project: ProjectRecord): void {
    setFormState(buildFormStateFromProject(project))
    setViewMode('edit')
  }

  function goToList(): void {
    setViewMode('list')
  }

  function updateForm<K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]): void {
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  function addCombination(): void {
    const candidate = formState.combinationDraft.trim()
    if (!candidate) {
      return
    }

    setFormState((prev) => ({
      ...prev,
      modelCombinations: prev.modelCombinations.includes(candidate) ? prev.modelCombinations : [...prev.modelCombinations, candidate],
      combinationDraft: '',
    }))
  }

  function generateCombinationFromSelection(): void {
    if (formState.selectedModelIds.length < 2) {
      return
    }

    const generated = formState.selectedModelIds
      .map((modelId) => props.models.find((model) => model.id === modelId)?.name ?? modelId)
      .join(' + ')

    setFormState((prev) => ({
      ...prev,
      modelCombinations: prev.modelCombinations.includes(generated) ? prev.modelCombinations : [...prev.modelCombinations, generated],
    }))
  }

  function handleSubmit(): void {
    const payload: ProjectFormInput = {
      name: formState.name,
      createdOn: formState.createdOn,
      status: formState.status,
      networkType: formState.networkType,
      datasetIds: formState.selectedDatasetIds,
      modelIds: formState.selectedModelIds,
      modelCombinations: formState.modelCombinations,
    }

    if (viewMode === 'edit' && formState.id) {
      props.onUpdateProject({ id: formState.id, ...payload })
    } else {
      props.onCreateProject(payload)
    }

    if (formState.name.trim() && formState.createdOn.trim()) {
      setFormState(buildEmptyFormState())
      setViewMode('list')
      setCurrentPage(1)
    }
  }

  function renderForm() {
    const title = viewMode === 'edit' ? 'Edit Project' : 'Register New Project'
    const actionLabel = viewMode === 'edit' ? 'Update Project' : 'Save Project'

    return (
      <article className="card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Project Onboarding</span>
            <h2>{title}</h2>
          </div>
          <button className="btn btn-secondary" onClick={goToList}>
            Back To List
          </button>
        </div>

        <div className="form-grid form-grid-2">
          <label className="field">
            Project Name
            <input value={formState.name} onChange={(event) => updateForm('name', event.target.value)} />
          </label>
          <label className="field">
            Creation Date
            <input
              type="date"
              value={formState.createdOn}
              onChange={(event) => updateForm('createdOn', event.target.value)}
            />
          </label>
          <label className="field">
            Project Status
            <select
              value={formState.status}
              onChange={(event) => updateForm('status', event.target.value as ProjectStatus)}
            >
              {statusOptions.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Network Type
            <select
              value={formState.networkType}
              onChange={(event) => updateForm('networkType', event.target.value as ProjectNetworkType)}
            >
              {networkOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="selection-grid">
          <AssociationPicker
            title="Datasets for this project"
            description="Use search helper and keep selected datasets in a compact grid below."
            buttonLabel="Search Datasets"
            modalTitle="Find And Select Datasets"
            searchLabel="Search Dataset"
            searchPlaceholder="Search by dataset name or type"
            emptySearchMessage="No datasets match your search."
            selectedIds={formState.selectedDatasetIds}
            options={datasetOptions}
            disabled={props.datasets.length === 0}
            onChange={(ids) => updateForm('selectedDatasetIds', ids)}
          />

          <AssociationPicker
            title="Models for this project"
            description="Find and select one or many pretrained models with search."
            buttonLabel="Search Models"
            modalTitle="Find And Select Models"
            searchLabel="Search Model"
            searchPlaceholder="Search by model name, family, or version"
            emptySearchMessage="No models match your search."
            selectedIds={formState.selectedModelIds}
            options={modelOptions}
            disabled={props.models.length === 0}
            onChange={(ids) => updateForm('selectedModelIds', ids)}
          >
            <div className="combination-row">
              <input
                value={formState.combinationDraft}
                onChange={(event) => updateForm('combinationDraft', event.target.value)}
                placeholder="Example: risk-ann + fallback-detector"
              />
              <button className="btn btn-secondary" onClick={addCombination}>
                Add
              </button>
              <button
                className="btn btn-secondary"
                onClick={generateCombinationFromSelection}
                disabled={formState.selectedModelIds.length < 2}
              >
                Auto Combine
              </button>
            </div>

            {formState.modelCombinations.length > 0 && (
              <div className="chip-list">
                {formState.modelCombinations.map((item) => (
                  <button
                    key={item}
                    className="chip"
                    onClick={() =>
                      updateForm(
                        'modelCombinations',
                        formState.modelCombinations.filter((entry) => entry !== item),
                      )
                    }
                  >
                    {item} x
                  </button>
                ))}
              </div>
            )}
          </AssociationPicker>
        </div>

        <button className="btn btn-primary" onClick={handleSubmit}>
          {actionLabel}
        </button>
      </article>
    )
  }

  function renderList() {
    return (
      <article className="card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Project Inventory</span>
            <h2>Registered Projects</h2>
          </div>
          <button className="btn btn-primary" onClick={openCreateView}>
            Create Project
          </button>
        </div>

        <div className="projects-table">
          <div className="projects-head">
            <span>Project</span>
            <span>Created</span>
            <span>Status</span>
            <span>Network</span>
            <span>.pt Artifact</span>
            <span>Datasets</span>
            <span>Models</span>
            <span>Actions</span>
          </div>
          {paginatedProjects.map((project) => (
            <div key={project.id} className="projects-row">
              <span className="run-name">{project.name}</span>
              <span>{project.createdOn}</span>
              <span>
                <select
                  className="inline-select"
                  value={project.status}
                  onChange={(event) => props.onUpdateProjectStatus(project.id, event.target.value as ProjectStatus)}
                >
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </span>
              <span>{project.networkType}</span>
              <span>
                <span className={`status status-${project.ptStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                  {project.ptStatus}
                </span>
              </span>
              <span>{project.datasetIds.length}</span>
              <span>{project.modelIds.length}</span>
              <span className="table-actions">
                <button className="btn btn-secondary mini-btn" onClick={() => setDetailsProjectId(project.id)}>
                  Details
                </button>
                <button className="btn btn-secondary mini-btn" onClick={() => openEditView(project)}>
                  Edit
                </button>
                <button className="btn btn-secondary mini-btn btn-danger" onClick={() => props.onDeleteProject(project.id)}>
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className="pagination-row">
          <div className="pagination-controls">
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
      </article>
    )
  }

  return (
    <section className="module-grid">
      {viewMode === 'list' ? renderList() : renderForm()}

      {detailsProject && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDetailsProjectId(null)}>
          <div className="modal-card modal-card-detail" onClick={(event) => event.stopPropagation()}>
            <div className="section-header modal-header">
              <div>
                <span className="eyebrow">Project Details</span>
                <h3>{detailsProject.name}</h3>
              </div>
              <button className="btn btn-secondary mini-btn modal-close" onClick={() => setDetailsProjectId(null)}>
                Close
              </button>
            </div>

            <div className="project-detail-grid modal-stat-grid">
              <div>
                <strong>Created:</strong> {detailsProject.createdOn}
              </div>
              <div>
                <strong>Status:</strong> {detailsProject.status}
              </div>
              <div>
                <strong>Network:</strong> {detailsProject.networkType}
              </div>
              <div>
                <strong>.pt Artifact:</strong>{' '}
                <span className={`status status-${detailsProject.ptStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                  {detailsProject.ptStatus}
                </span>
              </div>
              <div>
                <strong>Updated:</strong> {detailsProject.updated}
              </div>
            </div>

            <div className="project-detail-lists">
              <div>
                <h4>Datasets</h4>
                {detailsDatasetNames.length === 0 ? (
                  <p className="muted-text">No datasets linked.</p>
                ) : (
                  <ul className="plain-list">
                    {detailsDatasetNames.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4>Models</h4>
                {detailsModelNames.length === 0 ? (
                  <p className="muted-text">No models linked.</p>
                ) : (
                  <ul className="plain-list">
                    {detailsModelNames.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4>Combinations</h4>
                {detailsProject.modelCombinations.length === 0 ? (
                  <p className="muted-text">No combinations defined.</p>
                ) : (
                  <ul className="plain-list">
                    {detailsProject.modelCombinations.map((combination) => (
                      <li key={combination}>{combination}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
