import { useMemo, useState } from 'react'

import { downloadModelArtifact } from '../services/artifactStorage'
import type { GeneratedModelArtifact, ModelDesignDraft } from '../types'
import type { DatasetRecord, ModelVersion, ProjectNetworkType, ProjectRecord } from '../../../shared/types/mvp'
import { AssociationPicker } from '../../../shared/ui/AssociationPicker'

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

type AnnLayerForm = {
  units: string
  activation: string
  dropout: string
}

type CnnBlockForm = {
  filters: string
  kernelSize: string
  stride: string
  poolSize: string
  activation: string
  dropout: string
}

type FormState = {
  id: string | null
  name: string
  family: ProjectNetworkType
  selectedProjectIds: string[]
  selectedDatasetIds: string[]
  annInputSize: string
  annHiddenLayers: AnnLayerForm[]
  annOutputSize: string
  annOutputActivation: string
  cnnInputWidth: string
  cnnInputHeight: string
  cnnInputChannels: string
  cnnBlocks: CnnBlockForm[]
  cnnDenseUnits: string
  cnnOutputSize: string
  optimizer: string
  scheduler: string
  seed: string
}

type ParsedModelPayload = {
  architecture?: Record<string, unknown>
  training?: Record<string, unknown>
  projectIds?: string[]
  datasetIds?: string[]
  family?: ProjectNetworkType
}

const familyOptions: ProjectNetworkType[] = ['ANN Binary', 'ANN Multiclass', 'CNN Vision']
const optimizerOptions = ['AdamW', 'Adam', 'SGD', 'RMSprop', 'NAdam', 'Adagrad']
const schedulerOptions = ['CosineAnnealing', 'ReduceLROnPlateau', 'StepLR', 'OneCycleLR', 'ExponentialLR']
const annActivationOptions = ['ReLU', 'LeakyReLU', 'ELU', 'GELU', 'Tanh', 'Sigmoid']
const annOutputActivationOptions = ['Sigmoid', 'Softmax', 'Linear']
const cnnActivationOptions = ['ReLU', 'LeakyReLU', 'ELU', 'GELU', 'Swish', 'Mish']

function isCnnFamily(family: ProjectNetworkType): boolean {
  return family === 'CNN Vision'
}

function defaultAnnLayer(units = '128'): AnnLayerForm {
  return {
    units,
    activation: 'ReLU',
    dropout: '0.20',
  }
}

function defaultCnnBlock(filters = '32'): CnnBlockForm {
  return {
    filters,
    kernelSize: '3',
    stride: '1',
    poolSize: '2',
    activation: 'ReLU',
    dropout: '0.10',
  }
}

function buildInitialFormState(): FormState {
  return {
    id: null,
    name: '',
    family: 'ANN Binary',
    selectedProjectIds: [],
    selectedDatasetIds: [],
    annInputSize: '64',
    annHiddenLayers: [defaultAnnLayer('128'), defaultAnnLayer('64')],
    annOutputSize: '1',
    annOutputActivation: 'Sigmoid',
    cnnInputWidth: '224',
    cnnInputHeight: '224',
    cnnInputChannels: '3',
    cnnBlocks: [defaultCnnBlock('32'), defaultCnnBlock('64')],
    cnnDenseUnits: '256',
    cnnOutputSize: '10',
    optimizer: 'AdamW',
    scheduler: 'CosineAnnealing',
    seed: '42',
  }
}

function toPositiveInt(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.floor(parsed)
}

function toDropout(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 1) {
    return null
  }

  return parsed
}

function parseModelPayload(model: ModelVersion): ParsedModelPayload {
  if (!model.ptPayload) {
    return {}
  }

  try {
    const parsed = JSON.parse(model.ptPayload) as ParsedModelPayload
    return parsed
  } catch {
    return {}
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  return value as Record<string, unknown>
}

function asString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return fallback
}

function parseAnnLayerForms(architecture: Record<string, unknown>, training: Record<string, unknown>): AnnLayerForm[] {
  const hiddenRaw = architecture.hiddenLayers
  if (!Array.isArray(hiddenRaw) || hiddenRaw.length === 0) {
    return [defaultAnnLayer('128'), defaultAnnLayer('64')]
  }

  const fallbackActivation = asString(training.activation, 'ReLU')
  const fallbackDropout = asString(training.dropout, '0.20')

  return hiddenRaw.map((item) => {
    if (typeof item === 'number') {
      return {
        units: String(item),
        activation: fallbackActivation,
        dropout: fallbackDropout,
      }
    }

    const layerRecord = asRecord(item)

    return {
      units: asString(layerRecord.units, '64'),
      activation: asString(layerRecord.activation, fallbackActivation),
      dropout: asString(layerRecord.dropout, fallbackDropout),
    }
  })
}

function parseCnnBlockForms(architecture: Record<string, unknown>, training: Record<string, unknown>): CnnBlockForm[] {
  const blocksRaw = architecture.blocks
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) {
    return [defaultCnnBlock('32')]
  }

  const fallbackActivation = asString(training.activation, 'ReLU')
  const fallbackDropout = asString(training.dropout, '0.10')

  return blocksRaw.map((item) => {
    const block = asRecord(item)

    return {
      filters: asString(block.filters, '32'),
      kernelSize: asString(block.kernelSize, '3'),
      stride: asString(block.stride, '1'),
      poolSize: asString(block.poolSize, '2'),
      activation: asString(block.activation, fallbackActivation),
      dropout: asString(block.dropout, fallbackDropout),
    }
  })
}

function buildFormStateFromModel(model: ModelVersion): FormState {
  const fallback = buildInitialFormState()
  const payload = parseModelPayload(model)
  const architecture = asRecord(payload.architecture)
  const training = asRecord(payload.training)
  const family = (payload.family ?? model.family) as ProjectNetworkType

  return {
    ...fallback,
    id: model.id,
    name: model.name,
    family: familyOptions.includes(family) ? family : fallback.family,
    selectedProjectIds: payload.projectIds ?? model.projectIds ?? [],
    selectedDatasetIds: payload.datasetIds ?? model.datasetIds ?? [],
    annInputSize: asString(architecture.inputSize, fallback.annInputSize),
    annHiddenLayers: parseAnnLayerForms(architecture, training),
    annOutputSize: asString(architecture.outputSize, fallback.annOutputSize),
    annOutputActivation: asString(architecture.outputActivation, fallback.annOutputActivation),
    cnnInputWidth: asString(architecture.inputWidth, fallback.cnnInputWidth),
    cnnInputHeight: asString(architecture.inputHeight, fallback.cnnInputHeight),
    cnnInputChannels: asString(architecture.inputChannels, fallback.cnnInputChannels),
    cnnBlocks: parseCnnBlockForms(architecture, training),
    cnnDenseUnits: asString(architecture.denseUnits, fallback.cnnDenseUnits),
    cnnOutputSize: asString(architecture.outputSize, fallback.cnnOutputSize),
    optimizer: asString(training.optimizer, fallback.optimizer),
    scheduler: asString(training.scheduler, fallback.scheduler),
    seed: asString(training.seed, fallback.seed),
  }
}

function ArchitecturePreview({ formState }: { formState: FormState }) {
  if (isCnnFamily(formState.family)) {
    return (
      <div className="architecture-preview">
        <div className="architecture-preview-row">
          <span className="chip chip-readonly">
            Input {formState.cnnInputWidth}x{formState.cnnInputHeight}x{formState.cnnInputChannels}
          </span>
          <span className="chip chip-readonly">Blocks {formState.cnnBlocks.length}</span>
          <span className="chip chip-readonly">Dense {formState.cnnDenseUnits}</span>
          <span className="chip chip-readonly">Output {formState.cnnOutputSize}</span>
        </div>
        <div className="architecture-meta-grid">
          {formState.cnnBlocks.map((block, index) => (
            <div key={`preview-cnn-${index}`} className="architecture-meta-card">
              <strong>Conv Block {index + 1}</strong>
              <span>Filters: {block.filters}</span>
              <span>Kernel: {block.kernelSize}</span>
              <span>Stride: {block.stride}</span>
              <span>Pool: {block.poolSize}</span>
              <span>Activation: {block.activation}</span>
              <span>Dropout: {block.dropout}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const layerSizes = [
    formState.annInputSize,
    ...formState.annHiddenLayers.map((layer) => layer.units),
    formState.annOutputSize,
  ].map((value) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
  })

  const width = 620
  const height = 240
  const marginX = 50
  const marginY = 24
  const columnGap = (width - marginX * 2) / (layerSizes.length - 1)

  return (
    <div className="architecture-preview">
      <svg viewBox={`0 0 ${width} ${height}`} className="architecture-svg" role="img" aria-label="ANN architecture preview">
        {layerSizes.map((size, columnIndex) => {
          const x = marginX + columnIndex * columnGap
          const visibleNodes = Math.min(7, size)
          const verticalGap = visibleNodes > 1 ? (height - marginY * 2) / (visibleNodes - 1) : 0

          return Array.from({ length: visibleNodes }).map((_, nodeIndex) => {
            const y = marginY + nodeIndex * verticalGap

            if (columnIndex < layerSizes.length - 1) {
              const nextVisible = Math.min(7, layerSizes[columnIndex + 1])
              const nextX = marginX + (columnIndex + 1) * columnGap
              const nextGap = nextVisible > 1 ? (height - marginY * 2) / (nextVisible - 1) : 0

              return (
                <g key={`${columnIndex}-${nodeIndex}`}>
                  {Array.from({ length: nextVisible }).map((__, nextIndex) => {
                    const nextY = marginY + nextIndex * nextGap
                    return (
                      <line
                        key={`${columnIndex}-${nodeIndex}-${nextIndex}`}
                        x1={x}
                        y1={y}
                        x2={nextX}
                        y2={nextY}
                        className="architecture-line"
                      />
                    )
                  })}
                  <circle cx={x} cy={y} r="4.5" className="architecture-node" />
                </g>
              )
            }

            return <circle key={`${columnIndex}-${nodeIndex}`} cx={x} cy={y} r="4.5" className="architecture-node" />
          })
        })}
      </svg>
      <div className="architecture-labels">
        <span>Input {formState.annInputSize}</span>
        <span>Hidden {formState.annHiddenLayers.length}</span>
        <span>Output {formState.annOutputSize}</span>
      </div>
      <div className="architecture-meta-grid">
        <div className="architecture-meta-card">
          <strong>Input Layer</strong>
          <span>Units: {formState.annInputSize}</span>
        </div>
        {formState.annHiddenLayers.map((layer, index) => (
          <div key={`preview-ann-${index}`} className="architecture-meta-card">
            <strong>Hidden Layer {index + 1}</strong>
            <span>Units: {layer.units}</span>
            <span>Activation: {layer.activation}</span>
            <span>Dropout: {layer.dropout}</span>
          </div>
        ))}
        <div className="architecture-meta-card">
          <strong>Output Layer</strong>
          <span>Units: {formState.annOutputSize}</span>
          <span>Activation: {formState.annOutputActivation}</span>
        </div>
      </div>
    </div>
  )
}

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

  function buildDraftFromForm(): ModelDesignDraft | null {
    const name = formState.name.trim()
    if (!name || formState.selectedProjectIds.length === 0) {
      return null
    }

    const seed = Number(formState.seed)
    if (!Number.isFinite(seed)) {
      return null
    }

    if (isCnnFamily(formState.family)) {
      const inputWidth = toPositiveInt(formState.cnnInputWidth)
      const inputHeight = toPositiveInt(formState.cnnInputHeight)
      const inputChannels = toPositiveInt(formState.cnnInputChannels)
      const denseUnits = toPositiveInt(formState.cnnDenseUnits)
      const outputSize = toPositiveInt(formState.cnnOutputSize)

      const blocks = formState.cnnBlocks
        .map((block) => ({
          filters: toPositiveInt(block.filters),
          kernelSize: toPositiveInt(block.kernelSize),
          stride: toPositiveInt(block.stride),
          poolSize: toPositiveInt(block.poolSize),
          activation: block.activation.trim(),
          dropout: toDropout(block.dropout),
        }))
        .filter(
          (block): block is {
            filters: number
            kernelSize: number
            stride: number
            poolSize: number
            activation: string
            dropout: number
          } =>
            block.filters !== null &&
            block.kernelSize !== null &&
            block.stride !== null &&
            block.poolSize !== null &&
            block.dropout !== null &&
            block.activation.length > 0,
        )

      if (!inputWidth || !inputHeight || !inputChannels || !denseUnits || !outputSize || blocks.length === 0) {
        return null
      }

      return {
        id: formState.id ?? undefined,
        name,
        family: formState.family,
        projectIds: formState.selectedProjectIds,
        datasetIds: formState.selectedDatasetIds,
        architecture: {
          kind: 'CNN',
          inputWidth,
          inputHeight,
          inputChannels,
          blocks,
          denseUnits,
          outputSize,
        },
        training: {
          optimizer: formState.optimizer,
          scheduler: formState.scheduler,
          seed,
        },
      }
    }

    const inputSize = toPositiveInt(formState.annInputSize)
    const outputSize = toPositiveInt(formState.annOutputSize)
    const hiddenLayers = formState.annHiddenLayers
      .map((layer) => ({
        units: toPositiveInt(layer.units),
        activation: layer.activation.trim(),
        dropout: toDropout(layer.dropout),
      }))
      .filter(
        (layer): layer is { units: number; activation: string; dropout: number } =>
          layer.units !== null && layer.dropout !== null && layer.activation.length > 0,
      )

    if (!inputSize || !outputSize || hiddenLayers.length === 0 || formState.annOutputActivation.trim().length === 0) {
      return null
    }

    return {
      id: formState.id ?? undefined,
      name,
      family: formState.family,
      projectIds: formState.selectedProjectIds,
      datasetIds: formState.selectedDatasetIds,
      architecture: {
        kind: 'ANN',
        inputSize,
        hiddenLayers,
        outputSize,
          outputActivation: formState.annOutputActivation,
      },
      training: {
        optimizer: formState.optimizer,
        scheduler: formState.scheduler,
        seed,
      },
    }
  }

  async function submitModel(): Promise<void> {
    const draft = buildDraftFromForm()
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

  function renderTabs() {
    return (
      <div className="model-tabs" role="tablist" aria-label="Model creation steps">
        <button className={`model-tab ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}>
          1. Type And Links
        </button>
        <button className={`model-tab ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}>
          2. Layer Builder
        </button>
        <button className={`model-tab ${step === 3 ? 'active' : ''}`} onClick={() => setStep(3)}>
          3. Optimizer And Scheduler
        </button>
      </div>
    )
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

        {renderTabs()}

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
