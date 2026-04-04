import { useMemo, useState } from 'react'

import { downloadModelArtifact } from '../services/artifactStorage'
import type { GeneratedModelArtifact, ModelDesignDraft } from '../types'
import type { DatasetRecord, ModelVersion, ProjectNetworkType, ProjectRecord } from '../../../shared/types/mvp'
import { AssociationPicker } from '../../../shared/ui/AssociationPicker'
import { ArchitecturePreview } from './ArchitecturePreview'
import { ModelDesignWizardTabs } from './ModelDesignWizardTabs'
import {
  annActivationOptions,
  annOutputActivationOptions,
  buildDraftFromForm,
  buildFormStateFromModel,
  buildInitialFormState,
  cnnActivationOptions,
  defaultAnnLayer,
  defaultCnnBlock,
  familyOptions,
  isCnnFamily,
  optimizerOptions,
  schedulerOptions,
  type AnnLayerForm,
  type CnnBlockForm,
  type FormState,
} from './modelDesignFormUtils'

type ModelDesignViewProps = {
  projects: ProjectRecord[]
  datasets: DatasetRecord[]
  models: ModelVersion[]
  onCreateDesignedModel: (input: ModelDesignDraft) => Promise<GeneratedModelArtifact | null>
  onUpdateDesignedModel: (input: ModelDesignDraft & { id: string }) => Promise<GeneratedModelArtifact | null>
  onDeleteDesignedModel: (modelId: string) => Promise<void>
}

type ModelViewMode = 'list' | 'create' | 'edit'
type WizardStep = 1 | 2 | 3

export function ModelDesignView(props: ModelDesignViewProps) {
  const [viewMode, setViewMode] = useState<ModelViewMode>('list')
  const [step, setStep] = useState<WizardStep>(1)
  const [formState, setFormState] = useState<FormState>(() => buildInitialFormState())
  const [message, setMessage] = useState('')
  const [previewModelId, setPreviewModelId] = useState<string | null>(null)

  const designedModels = useMemo(() => props.models.filter((model) => model.sourceRunId === 'design-studio'), [props.models])

  const projectOptions = useMemo(
    () => props.projects.map((project) => ({ id: project.id, label: project.name, meta: project.networkType })),
    [props.projects],
  )

  const datasetOptions = useMemo(
    () => props.datasets.map((dataset) => ({ id: dataset.id, label: dataset.name, meta: dataset.type })),
    [props.datasets],
  )

  const previewModel = useMemo(
    () => designedModels.find((model) => model.id === previewModelId) ?? null,
    [designedModels, previewModelId],
  )

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  function resetToCreate(): void {
    setFormState(buildInitialFormState())
    setViewMode('create')
    setStep(1)
    setMessage('')
  }

  function openEdit(model: ModelVersion): void {
    setFormState(buildFormStateFromModel(model))
    setViewMode('edit')
    setStep(1)
    setMessage('')
  }

  function goToList(): void {
    setViewMode('list')
    setStep(1)
    setMessage('')
  }

  function addAnnHiddenLayer(): void {
    setFormState((prev) => ({
      ...prev,
      annHiddenLayers: [...prev.annHiddenLayers, defaultAnnLayer('64')],
    }))
  }

  function removeAnnHiddenLayer(index: number): void {
    setFormState((prev) => ({
      ...prev,
      annHiddenLayers: prev.annHiddenLayers.filter((_, layerIndex) => layerIndex !== index),
    }))
  }

  function updateAnnHiddenLayer(index: number, key: keyof AnnLayerForm, value: string): void {
    setFormState((prev) => ({
      ...prev,
      annHiddenLayers: prev.annHiddenLayers.map((layer, layerIndex) =>
        layerIndex === index ? { ...layer, [key]: value } : layer,
      ),
    }))
  }

  function addCnnBlock(): void {
    setFormState((prev) => ({
      ...prev,
      cnnBlocks: [...prev.cnnBlocks, defaultCnnBlock('64')],
    }))
  }

  function removeCnnBlock(index: number): void {
    setFormState((prev) => ({
      ...prev,
      cnnBlocks: prev.cnnBlocks.filter((_, blockIndex) => blockIndex !== index),
    }))
  }

  function updateCnnBlock(index: number, key: keyof CnnBlockForm, value: string): void {
    setFormState((prev) => ({
      ...prev,
      cnnBlocks: prev.cnnBlocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, [key]: value } : block,
      ),
    }))
  }

  function buildDraftFromCurrentForm(): ModelDesignDraft | null {
    return buildDraftFromForm(formState)
  }

  async function submitModel(): Promise<void> {
    const draft = buildDraftFromCurrentForm()
    if (!draft) {
      setMessage('Complete all required fields and ensure each layer has valid configuration values.')
      return
    }

    if (viewMode === 'edit' && formState.id) {
      const artifact = await props.onUpdateDesignedModel({ ...draft, id: formState.id })
      if (!artifact) {
        setMessage('Could not update model with current configuration.')
        return
      }

      setMessage(`Model updated and artifact ${artifact.fileName} downloaded.`)
      await downloadModelArtifact({
        artifactUri: artifact.artifactUri,
        fallbackFileName: artifact.fileName,
        fallbackPayload: artifact.payload,
      })
      goToList()
      return
    }

    const artifact = await props.onCreateDesignedModel(draft)
    if (!artifact) {
      setMessage('Model creation failed. Verify selected project and architecture values.')
      return
    }

    setMessage(`Model created and artifact ${artifact.fileName} downloaded.`)
    await downloadModelArtifact({
      artifactUri: artifact.artifactUri,
      fallbackFileName: artifact.fileName,
      fallbackPayload: artifact.payload,
    })
    goToList()
  }

  function renderStepOne() {
    return (
      <>
        <div className="form-grid form-grid-2">
          <label className="field">
            Model Name
            <input value={formState.name} onChange={(event) => updateField('name', event.target.value)} />
          </label>
          <label className="field">
            Model Type
            <select
              value={formState.family}
              onChange={(event) => updateField('family', event.target.value as ProjectNetworkType)}
            >
              {familyOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="selection-grid">
          <AssociationPicker
            title="Linked Projects"
            description="Select one or many projects to attach this model design."
            buttonLabel="Search Projects"
            modalTitle="Find And Select Projects"
            searchLabel="Search Project"
            searchPlaceholder="Search by project name or network type"
            emptySearchMessage="No projects match your search."
            selectedIds={formState.selectedProjectIds}
            options={projectOptions}
            disabled={props.projects.length === 0}
            onChange={(ids) => updateField('selectedProjectIds', ids)}
          />

          <AssociationPicker
            title="Linked Datasets"
            description="Select datasets that define lineage for this model."
            buttonLabel="Search Datasets"
            modalTitle="Find And Select Datasets"
            searchLabel="Search Dataset"
            searchPlaceholder="Search by dataset name or type"
            emptySearchMessage="No datasets match your search."
            selectedIds={formState.selectedDatasetIds}
            options={datasetOptions}
            disabled={props.datasets.length === 0}
            onChange={(ids) => updateField('selectedDatasetIds', ids)}
          />
        </div>
      </>
    )
  }

  function renderStepTwo() {
    return (
      <>
        {isCnnFamily(formState.family) ? (
          <div className="form-grid">
            <div className="form-grid form-grid-2">
              <label className="field">
                Input Width
                <input value={formState.cnnInputWidth} onChange={(event) => updateField('cnnInputWidth', event.target.value)} />
              </label>
              <label className="field">
                Input Height
                <input value={formState.cnnInputHeight} onChange={(event) => updateField('cnnInputHeight', event.target.value)} />
              </label>
              <label className="field">
                Input Channels
                <input
                  value={formState.cnnInputChannels}
                  onChange={(event) => updateField('cnnInputChannels', event.target.value)}
                />
              </label>
              <label className="field">
                Dense Units
                <input value={formState.cnnDenseUnits} onChange={(event) => updateField('cnnDenseUnits', event.target.value)} />
              </label>
              <label className="field">
                Output Units
                <input value={formState.cnnOutputSize} onChange={(event) => updateField('cnnOutputSize', event.target.value)} />
              </label>
            </div>

            <div className="model-blocks">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Convolution Blocks</span>
                  <h3>Configure Block By Block</h3>
                </div>
                <button className="btn btn-secondary mini-btn" onClick={addCnnBlock}>
                  Add Conv Block
                </button>
              </div>

              {formState.cnnBlocks.map((block, index) => (
                <div key={`cnn-${index}`} className="form-grid form-grid-2 model-block-row">
                  <label className="field">
                    Filters
                    <input value={block.filters} onChange={(event) => updateCnnBlock(index, 'filters', event.target.value)} />
                  </label>
                  <label className="field">
                    Kernel Size
                    <input
                      value={block.kernelSize}
                      onChange={(event) => updateCnnBlock(index, 'kernelSize', event.target.value)}
                    />
                  </label>
                  <label className="field">
                    Stride
                    <input value={block.stride} onChange={(event) => updateCnnBlock(index, 'stride', event.target.value)} />
                  </label>
                  <label className="field">
                    Pool Size
                    <input value={block.poolSize} onChange={(event) => updateCnnBlock(index, 'poolSize', event.target.value)} />
                  </label>
                  <label className="field">
                    Activation
                    <select
                      value={block.activation}
                      onChange={(event) => updateCnnBlock(index, 'activation', event.target.value)}
                    >
                      {cnnActivationOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Dropout
                    <input value={block.dropout} onChange={(event) => updateCnnBlock(index, 'dropout', event.target.value)} />
                  </label>
                  <button
                    className="btn btn-danger mini-btn"
                    onClick={() => removeCnnBlock(index)}
                    disabled={formState.cnnBlocks.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="form-grid">
            <div className="form-grid form-grid-2">
              <label className="field">
                Input Size
                <input value={formState.annInputSize} onChange={(event) => updateField('annInputSize', event.target.value)} />
              </label>
              <label className="field">
                Output Size
                <input value={formState.annOutputSize} onChange={(event) => updateField('annOutputSize', event.target.value)} />
              </label>
              <label className="field">
                Output Activation
                <select
                  value={formState.annOutputActivation}
                  onChange={(event) => updateField('annOutputActivation', event.target.value)}
                >
                  {annOutputActivationOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="model-blocks">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Hidden Layers</span>
                  <h3>Configure Layer By Layer</h3>
                </div>
                <button className="btn btn-secondary mini-btn" onClick={addAnnHiddenLayer}>
                  Add Hidden Layer
                </button>
              </div>

              {formState.annHiddenLayers.map((layer, index) => (
                <div key={`ann-${index}`} className="form-grid form-grid-2 model-block-row">
                  <label className="field">
                    Units
                    <input value={layer.units} onChange={(event) => updateAnnHiddenLayer(index, 'units', event.target.value)} />
                  </label>
                  <label className="field">
                    Activation
                    <select
                      value={layer.activation}
                      onChange={(event) => updateAnnHiddenLayer(index, 'activation', event.target.value)}
                    >
                      {annActivationOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Dropout
                    <input
                      value={layer.dropout}
                      onChange={(event) => updateAnnHiddenLayer(index, 'dropout', event.target.value)}
                    />
                  </label>
                  <button
                    className="btn btn-danger mini-btn"
                    onClick={() => removeAnnHiddenLayer(index)}
                    disabled={formState.annHiddenLayers.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card architecture-card">
          <div className="section-header">
            <div>
              <span className="eyebrow">Real-Time Representation</span>
              <h3>Detailed Layer Visualization</h3>
            </div>
          </div>
          <ArchitecturePreview formState={formState} />
        </div>
      </>
    )
  }

  function renderStepThree() {
    return (
      <div className="form-grid form-grid-2">
        <label className="field">
          Optimizer
          <select value={formState.optimizer} onChange={(event) => updateField('optimizer', event.target.value)}>
            {optimizerOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Scheduler
          <select value={formState.scheduler} onChange={(event) => updateField('scheduler', event.target.value)}>
            {schedulerOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Seed
          <input value={formState.seed} onChange={(event) => updateField('seed', event.target.value)} />
        </label>
      </div>
    )
  }

  function renderWizard() {
    const actionLabel = viewMode === 'edit' ? 'Update Model And Regenerate .pt' : 'Create Model And Generate .pt'

    return (
      <article className="card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Model Workspace</span>
            <h2>{viewMode === 'edit' ? 'Edit Model Design' : 'Create Model Design'}</h2>
          </div>
          <button className="btn btn-secondary" onClick={goToList}>
            Back To Models List
          </button>
        </div>

        <ModelDesignWizardTabs step={step} onChangeStep={setStep} />

        {step === 1 && renderStepOne()}
        {step === 2 && renderStepTwo()}
        {step === 3 && renderStepThree()}

        <div className="model-design-actions">
          <div className="table-actions">
            <button
              className="btn btn-secondary"
              disabled={step === 1}
              onClick={() =>
                setStep((prev) => {
                  if (prev === 1) {
                    return 1
                  }

                  if (prev === 2) {
                    return 1
                  }

                  return 2
                })
              }
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              disabled={step === 3}
              onClick={() =>
                setStep((prev) => {
                  if (prev === 1) {
                    return 2
                  }

                  if (prev === 2) {
                    return 3
                  }

                  return 3
                })
              }
            >
              Next
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => void submitModel()}>
            {actionLabel}
          </button>
          {message && <p className="muted-text model-design-message">{message}</p>}
        </div>
      </article>
    )
  }

  function renderList() {
    return (
      <article className="card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Model Inventory</span>
            <h2>Created Models</h2>
          </div>
          <button className="btn btn-primary" onClick={resetToCreate}>
            Create Model
          </button>
        </div>

        {designedModels.length === 0 ? (
          <p className="subtitle">No designed models yet. Start with Create Model.</p>
        ) : (
          <div className="simple-table">
            <div className="simple-table-head simple-table-head-model-design-extended">
              <span>Name</span>
              <span>Family</span>
              <span>Version</span>
              <span>Projects</span>
              <span>Artifact</span>
              <span>Actions</span>
            </div>
            {designedModels.map((model) => (
              <div key={model.id} className="simple-table-row simple-table-row-model-design-extended">
                <span>{model.name}</span>
                <span>{model.family}</span>
                <span>{model.version}</span>
                <span>{model.projectIds?.length ?? 0}</span>
                <span>{model.ptFileName ?? 'n/a'}</span>
                <span className="table-actions">
                  <button className="btn btn-secondary mini-btn" onClick={() => setPreviewModelId(model.id)}>
                    Graph
                  </button>
                  <button className="btn btn-secondary mini-btn" onClick={() => openEdit(model)}>
                    Edit
                  </button>
                  <button className="btn btn-danger mini-btn" onClick={() => void props.onDeleteDesignedModel(model.id)}>
                    Remove
                  </button>
                  <button
                    className="btn btn-secondary mini-btn"
                    onClick={() =>
                      void downloadModelArtifact({
                        artifactUri: model.ptArtifactUri,
                        fallbackFileName: model.ptFileName,
                        fallbackPayload: model.ptPayload,
                      })
                    }
                    disabled={!model.ptFileName || (!model.ptArtifactUri && !model.ptPayload)}
                  >
                    Download
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    )
  }

  return (
    <section className="module-grid">
      {viewMode === 'list' ? renderList() : renderWizard()}

      {previewModel && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setPreviewModelId(null)}>
          <div className="modal-card modal-card-detail" onClick={(event) => event.stopPropagation()}>
            <div className="section-header modal-header">
              <div>
                <span className="eyebrow">Model Representation</span>
                <h3>{previewModel.name}</h3>
              </div>
              <button className="btn btn-secondary mini-btn modal-close" onClick={() => setPreviewModelId(null)}>
                Close
              </button>
            </div>
            <ArchitecturePreview formState={buildFormStateFromModel(previewModel)} />
          </div>
        </div>
      )}
    </section>
  )
}
