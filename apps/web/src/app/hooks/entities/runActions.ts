import type { DatasetRecord, RunEpochTelemetry, RunRecord, RunStatus } from '../../../shared/types/mvp'
import type { Dispatch, SetStateAction } from 'react'

export type CreateRunInput = {
  name: string
  project: string
  model: string
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
  backendStatus?: 'queued' | 'running' | 'completed' | 'failed'
  backendEpochHistory?: RunEpochTelemetry[]
  backendArtifactFileName?: string
  backendArtifactDownloadUrl?: string
}

type Context = {
  datasets: DatasetRecord[]
  runs: RunRecord[]
  setRuns: Dispatch<SetStateAction<RunRecord[]>>
  nextId: (prefix: string) => string
  toTimeLabel: () => string
  compactIsoDate: (value: Date) => string
}

function firstFiveToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase()
}

function buildLayerNames(model: string): string[] {
  if (model === 'ANN Multiclass') {
    return ['Input', 'Dense 1', 'Dense 2', 'Dense 3', 'Output']
  }

  return ['Input', 'Dense 1', 'Dense 2', 'Output']
}

export function createRunActions(context: Context) {
  function createRun(input: CreateRunInput): void {
    const project = input.project.trim()
    const dataset = context.datasets.find((item) => item.id === input.datasetId)
    const datasetName = dataset?.name ?? ''
    const trainFileName = input.trainFileName.trim()
    const trainSheet = input.trainSheet.trim()
    const valFileName = input.valFileName.trim()
    const valSheet = input.valSheet.trim()
    const labelColumn = input.labelColumn.trim()

    const namePrefix = `${firstFiveToken(project)}_${firstFiveToken(datasetName)}_${context.compactIsoDate(new Date())}`
    const expression = new RegExp(`^${namePrefix}_RUN_(\\d{2})$`)
    const lastRunNumber = context.runs.reduce((max, run) => {
      const match = run.name.match(expression)
      if (!match) {
        return max
      }

      return Math.max(max, Number(match[1]))
    }, 0)

    let runNumber = lastRunNumber + 1
    while (context.runs.some((run) => run.name === `${namePrefix}_RUN_${String(runNumber).padStart(2, '0')}`)) {
      runNumber += 1
    }
    const fallbackName = `${namePrefix}_RUN_${String(runNumber).padStart(2, '0')}`
    const backendName = input.name.trim()
    const name = backendName && !context.runs.some((run) => run.name === backendName) ? backendName : fallbackName

    if (
      !name ||
      !project ||
      !dataset ||
      !trainFileName ||
      !trainSheet ||
      !valFileName ||
      !valSheet ||
      !labelColumn ||
      input.epochs <= 0 ||
      input.batchSize <= 0 ||
      input.learningRate <= 0 ||
      (input.earlyStopping && input.earlyStoppingPatience <= 0)
    ) {
      return
    }

    const layerNames = buildLayerNames(input.model)
    const totalEpochs = Math.floor(input.epochs)
    const backendHistory = input.backendEpochHistory ?? []
    const hasBackendHistory = backendHistory.length > 0
    const normalizedBackendStatus: RunStatus =
      input.backendStatus === 'completed'
        ? 'Completed'
        : input.backendStatus === 'failed'
          ? 'Failed'
          : input.backendStatus === 'running'
            ? 'Running'
            : 'Queued'
    const resolvedStatus: RunStatus = normalizedBackendStatus
    const currentEpoch = hasBackendHistory ? backendHistory[backendHistory.length - 1].epoch : 0
    const latest = hasBackendHistory ? backendHistory[backendHistory.length - 1] : null
    const initialProgress =
      hasBackendHistory && totalEpochs > 0
        ? Math.min(100, Math.round((currentEpoch / totalEpochs) * 100))
        : resolvedStatus === 'Completed'
          ? 100
          : resolvedStatus === 'Running'
            ? 12
            : 0

    const newRun: RunRecord = {
      id: context.nextId('run'),
      name,
      project,
      model: input.model,
      status: resolvedStatus,
      progress: initialProgress,
      updated: `Today ${context.toTimeLabel()}`,
      datasetId: input.datasetId,
      backendRunId: input.backendRunId,
      backendStatusMessages: input.backendStatusMessages ?? [],
      backendPreprocessingSummary: input.backendPreprocessingSummary,
      artifactFileName: input.backendArtifactFileName,
      artifactDownloadUrl: input.backendArtifactDownloadUrl,
      trainingConfig: {
        trainFileName,
        trainSheet,
        valFileName,
        valSheet,
        labelColumn,
        epochs: totalEpochs,
        batchSize: Math.floor(input.batchSize),
        learningRate: Number(input.learningRate),
        earlyStopping: input.earlyStopping,
        earlyStoppingPatience: Math.floor(input.earlyStoppingPatience),
      },
      monitor: {
        currentEpoch,
        totalEpochs,
        bestValLoss: hasBackendHistory ? Math.min(...backendHistory.map((item) => item.valLoss)) : Number.POSITIVE_INFINITY,
        staleEpochs: 0,
        earlyStopTriggered: false,
        layerNames,
        history: hasBackendHistory ? backendHistory : [],
        lastLearningRate: latest ? Number(latest.learningRate) : Number(input.learningRate),
        lastTrainPrecision: latest ? Number(latest.trainPrecision) : 0,
        lastValPrecision: latest ? Number(latest.valPrecision) : 0,
        confusionMatrix: latest
          ? latest.confusionMatrix
          : input.model === 'ANN Multiclass'
            ? [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
            : [[0, 0], [0, 0]],
      },
    }

    context.setRuns((prev) => [newRun, ...prev])
  }

  function syncRunWithBackend(
    runId: string,
    payload: {
      status: 'queued' | 'running' | 'completed' | 'failed'
      statusMessages: Array<{
        timestampUtc: string
        level: 'info' | 'warning' | 'error'
        message: string
      }>
      preprocessingSummary?: {
        numericScaling: string
        categoricalEncoding: string
        numericMissingStrategy: string
        categoricalMissingStrategy: string
        rawNumericFeatureCount: number
        rawCategoricalFeatureCount: number
        expandedCategoricalFeatureCount: number
        suggestedInputLayerSize: number
      }
      artifactDownloadUrl?: string | null
      artifactFileName?: string
      epochHistory?: RunEpochTelemetry[]
    },
  ): void {
    context.setRuns((prev) =>
      prev.map((run) => {
        if (run.id !== runId) {
          return run
        }

        const mappedStatus: RunStatus =
          payload.status === 'completed'
            ? 'Completed'
            : payload.status === 'failed'
              ? 'Failed'
              : payload.status === 'running'
                ? 'Running'
                : 'Queued'

        const backendHistory = payload.epochHistory ?? run.monitor?.history ?? []
        const lastEpoch = backendHistory.length > 0 ? backendHistory[backendHistory.length - 1] : null
        const totalEpochs = Math.max(run.trainingConfig?.epochs ?? 0, run.monitor?.totalEpochs ?? 0, lastEpoch?.epoch ?? 0)
        const currentEpoch = lastEpoch?.epoch ?? run.monitor?.currentEpoch ?? 0
        const progress =
          mappedStatus === 'Completed'
            ? 100
            : totalEpochs > 0
              ? Math.min(99, Math.round((currentEpoch / totalEpochs) * 100))
              : mappedStatus === 'Running'
                ? Math.max(run.progress, 12)
                : 0

        const nextMonitor = run.monitor
          ? {
              ...run.monitor,
              currentEpoch,
              totalEpochs,
              history: backendHistory,
              lastLearningRate: lastEpoch ? Number(lastEpoch.learningRate) : run.monitor.lastLearningRate,
              lastTrainPrecision: lastEpoch ? Number(lastEpoch.trainPrecision) : run.monitor.lastTrainPrecision,
              lastValPrecision: lastEpoch ? Number(lastEpoch.valPrecision) : run.monitor.lastValPrecision,
              confusionMatrix: lastEpoch ? lastEpoch.confusionMatrix : run.monitor.confusionMatrix,
              bestValLoss:
                backendHistory.length > 0
                  ? Math.min(...backendHistory.map((item) => item.valLoss))
                  : run.monitor.bestValLoss,
              earlyStopTriggered:
                mappedStatus === 'Completed' &&
                Boolean(run.trainingConfig?.earlyStopping) &&
                totalEpochs > 0 &&
                currentEpoch < totalEpochs,
            }
          : run.monitor

        return {
          ...run,
          status: mappedStatus,
          progress,
          updated: `Today ${context.toTimeLabel()}`,
          backendStatusMessages: payload.statusMessages,
          backendPreprocessingSummary: payload.preprocessingSummary ?? run.backendPreprocessingSummary,
          artifactDownloadUrl: payload.artifactDownloadUrl ?? run.artifactDownloadUrl,
          artifactFileName: payload.artifactFileName ?? run.artifactFileName,
          monitor: nextMonitor,
        }
      }),
    )
  }

  return {
    createRun,
    syncRunWithBackend,
  }
}
