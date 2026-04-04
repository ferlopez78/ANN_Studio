import type { ModelDesignDraft } from '../types'
import type { ModelVersion, ProjectNetworkType } from '../../../shared/types/mvp'

export type AnnLayerForm = {
  units: string
  activation: string
  dropout: string
}

export type CnnBlockForm = {
  filters: string
  kernelSize: string
  stride: string
  poolSize: string
  activation: string
  dropout: string
}

export type FormState = {
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

export const familyOptions: ProjectNetworkType[] = ['ANN Binary', 'ANN Multiclass', 'CNN Vision']
export const optimizerOptions = ['AdamW', 'Adam', 'SGD', 'RMSprop', 'NAdam', 'Adagrad']
export const schedulerOptions = ['CosineAnnealing', 'ReduceLROnPlateau', 'StepLR', 'OneCycleLR', 'ExponentialLR']
export const annActivationOptions = ['ReLU', 'LeakyReLU', 'ELU', 'GELU', 'Tanh', 'Sigmoid']
export const annOutputActivationOptions = ['Sigmoid', 'Softmax', 'Linear']
export const cnnActivationOptions = ['ReLU', 'LeakyReLU', 'ELU', 'GELU', 'Swish', 'Mish']

export function isCnnFamily(family: ProjectNetworkType): boolean {
  return family === 'CNN Vision'
}

export function defaultAnnLayer(units = '128'): AnnLayerForm {
  return {
    units,
    activation: 'ReLU',
    dropout: '0.20',
  }
}

export function defaultCnnBlock(filters = '32'): CnnBlockForm {
  return {
    filters,
    kernelSize: '3',
    stride: '1',
    poolSize: '2',
    activation: 'ReLU',
    dropout: '0.10',
  }
}

export function buildInitialFormState(): FormState {
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
    return JSON.parse(model.ptPayload) as ParsedModelPayload
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

export function buildFormStateFromModel(model: ModelVersion): FormState {
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

export function buildDraftFromForm(formState: FormState): ModelDesignDraft | null {
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
