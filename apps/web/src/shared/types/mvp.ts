export type DatasetType = 'Tabular' | 'Computer Vision'
export type DatasetStatus = 'Ready' | 'Pending Validation'
export type RunStatus = 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Review'
export type ProjectNetworkType = 'ANN Binary' | 'ANN Multiclass' | 'CNN Vision' | 'Custom Detector'
export type PtArtifactStatus = 'Not Created' | 'Created'
export type ProjectStatus = 'Draft' | 'Active' | 'Paused' | 'Archived'
export type ClientStatus = 'active' | 'inactive'

export type ClientRecord = {
  id: string
  code: string
  name: string
  status: ClientStatus
  notes?: string
  updated: string
}

export type DatasetRecord = {
  id: string
  name: string
  type: DatasetType
  versions: number
  status: DatasetStatus
  updated: string
}

export type RunTrainingConfig = {
  trainFileName: string
  trainSheet: string
  valFileName: string
  valSheet: string
  labelColumn: string
  epochs: number
  batchSize: number
  learningRate: number
  earlyStopping: boolean
  earlyStoppingPatience: number
}

export type RunEpochTelemetry = {
  epoch: number
  trainLoss: number
  valLoss: number
  trainPrecision: number
  valPrecision: number
  learningRate: number
  layerActivations: number[]
  confusionMatrix: number[][]
}

export type RunLiveMonitor = {
  currentEpoch: number
  totalEpochs: number
  bestValLoss: number
  staleEpochs: number
  earlyStopTriggered: boolean
  layerNames: string[]
  history: RunEpochTelemetry[]
  lastLearningRate: number
  lastTrainPrecision: number
  lastValPrecision: number
  confusionMatrix: number[][]
}

export type RunRecord = {
  id: string
  name: string
  project: string
  model: string
  status: RunStatus
  progress: number
  updated: string
  datasetId: string
  backendRunId?: string
  backendStatusMessages?: Array<{
    timestampUtc: string
    level: 'info' | 'warning' | 'error'
    message: string
  }>
  backendPreprocessingSummary?: {
    numericScaling: string
    categoricalEncoding: string
    numericMissingStrategy: string
    categoricalMissingStrategy: string
    rawNumericFeatureCount: number
    rawCategoricalFeatureCount: number
    expandedCategoricalFeatureCount: number
    suggestedInputLayerSize: number
  }
  artifactFileName?: string
  artifactDownloadUrl?: string
  trainingConfig?: RunTrainingConfig
  monitor?: RunLiveMonitor
}

export type ModelVersion = {
  id: string
  name: string
  family: string
  version: string
  sourceRunId: string
  qualityScore: number
  registered: string
  projectIds?: string[]
  datasetIds?: string[]
  ptFileName?: string
  ptArtifactUri?: string
  ptGeneratedAt?: string
  ptPayload?: string
}

export type ProjectRecord = {
  id: string
  code?: string
  clientId?: string
  clientName?: string
  name: string
  createdOn: string
  status: ProjectStatus
  networkType: ProjectNetworkType
  ptStatus: PtArtifactStatus
  datasetIds: string[]
  modelIds: string[]
  modelCombinations: string[]
  updated: string
}

export type KpiCard = {
  label: string
  value: string | number
  foot: string
}
