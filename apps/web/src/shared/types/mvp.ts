export type DatasetType = 'Tabular' | 'Computer Vision'
export type DatasetStatus = 'Ready' | 'Pending Validation'
export type RunStatus = 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Review'
export type ProjectNetworkType = 'ANN Binary' | 'ANN Multiclass' | 'CNN Vision' | 'Custom Detector'
export type PtArtifactStatus = 'Not Created' | 'Created'
export type ProjectStatus = 'Draft' | 'Active' | 'Paused' | 'Archived'

export type DatasetRecord = {
  id: string
  name: string
  type: DatasetType
  versions: number
  status: DatasetStatus
  updated: string
}

export type RunTrainingConfig = {
  selectedFile: string
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
