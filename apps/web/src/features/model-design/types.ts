import type { ProjectNetworkType } from '../../shared/types/mvp'

export type AnnArchitecture = {
  kind: 'ANN'
  inputSize: number
  hiddenLayers: Array<{
    units: number
    activation: string
    dropout: number
  }>
  outputSize: number
  outputActivation: string
}

export type CnnBlock = {
  filters: number
  kernelSize: number
  stride: number
  poolSize: number
  activation: string
  dropout: number
}

export type CnnArchitecture = {
  kind: 'CNN'
  inputWidth: number
  inputHeight: number
  inputChannels: number
  blocks: CnnBlock[]
  denseUnits: number
  outputSize: number
}

export type ModelArchitecture = AnnArchitecture | CnnArchitecture

export type ModelTrainingConfig = {
  optimizer: string
  scheduler: string
  seed: number
}

export type ModelDesignDraft = {
  id?: string
  name: string
  family: ProjectNetworkType
  projectIds: string[]
  datasetIds: string[]
  architecture: ModelArchitecture
  training: ModelTrainingConfig
}

export type GeneratedModelArtifact = {
  artifactUri?: string
  fileName: string
  payload: string
  generatedAtIso: string
}
