import { useEffect, useMemo, useState } from 'react'

import { LocalModelArtifactGenerator } from '../../features/model-design/services/artifactGenerator'
import {
  buildModelArtifactUri,
  removeModelArtifact,
  storeModelArtifact,
} from '../../features/model-design/services/artifactStorage'
import type { GeneratedModelArtifact, ModelDesignDraft } from '../../features/model-design/types'
import { menuItems } from '../../shared/config/navigation'
import { initialDatasets, initialModels, initialProjects, initialRuns } from '../../shared/config/seeds'
import { loadFromDatabase, saveToDatabase } from '../../shared/lib/browserDb'
import type {
  DatasetRecord,
  DatasetType,
  KpiCard,
  ModelVersion,
  ProjectNetworkType,
  ProjectRecord,
  ProjectStatus,
  RunEpochTelemetry,
  RunLiveMonitor,
  RunRecord,
  RunStatus,
} from '../../shared/types/mvp'

export type MenuItem = (typeof menuItems)[number]

type CreateRunInput = {
  name: string
  project: string
  model: string
  datasetId: string
  selectedFile: string
  epochs: number
  batchSize: number
  learningRate: number
  earlyStopping: boolean
  earlyStoppingPatience: number
}

type CreateDatasetInput = {
  name: string
  type: DatasetType
  projectIds: string[]
}

type UpdateDatasetInput = {
  id: string
  name: string
  type: DatasetType
  projectIds: string[]
}

type CreateProjectInput = {
  name: string
  createdOn: string
  status: ProjectStatus
  networkType: ProjectNetworkType
  datasetIds: string[]
  modelIds: string[]
  modelCombinations: string[]
}

type UpdateProjectInput = {
  id: string
  name: string
  createdOn: string
  networkType: ProjectNetworkType
  datasetIds: string[]
  modelIds: string[]
  modelCombinations: string[]
}

const DATASETS_KEY = 'annstudio_datasets'
const RUNS_KEY = 'annstudio_runs'
const MODELS_KEY = 'annstudio_models'
const PROJECTS_KEY = 'annstudio_projects'
let idSequence = 1000
const artifactGenerator = new LocalModelArtifactGenerator()

function nextId(prefix: string): string {
  idSequence += 1
  return `${prefix}-${idSequence}`
}

function toTimeLabel(): string {
  const now = new Date()
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function compactIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10).replace(/-/g, '')
}

function ensureUniqueId(baseId: string, prefix: string, used: Set<string>): string {
  const seed = baseId.trim() || nextId(prefix)
  if (!used.has(seed)) {
    used.add(seed)
    return seed
  }

  let index = 2
  let candidate = `${seed}-${index}`
  while (used.has(candidate)) {
    index += 1
    candidate = `${seed}-${index}`
  }

  used.add(candidate)
  return candidate
}

function normalizeWithUniqueIds<T extends { id: string }>(
  items: T[],
  prefix: string,
): { items: T[]; idMap: Map<string, string> } {
  const used = new Set<string>()
  const idMap = new Map<string, string>()

  const normalized = items.map((item) => {
    const next = ensureUniqueId(item.id, prefix, used)
    if (!idMap.has(item.id)) {
      idMap.set(item.id, next)
    }

    return {
      ...item,
      id: next,
    }
  })

  return { items: normalized, idMap }
}

function sanitizeHydratedStore(input: {
  datasets: DatasetRecord[]
  runs: RunRecord[]
  models: ModelVersion[]
  projects: ProjectRecord[]
}): {
  datasets: DatasetRecord[]
  runs: RunRecord[]
  models: ModelVersion[]
  projects: ProjectRecord[]
} {
  const normalizedDatasets = normalizeWithUniqueIds(input.datasets, 'ds')
  const normalizedRuns = normalizeWithUniqueIds(input.runs, 'run')
  const normalizedModels = normalizeWithUniqueIds(input.models, 'mdl')
  const normalizedProjects = normalizeWithUniqueIds(input.projects, 'prj')

  const runs = normalizedRuns.items.map((run) => ({
    ...run,
    datasetId: normalizedDatasets.idMap.get(run.datasetId) ?? run.datasetId,
  }))

  const models = normalizedModels.items.map((model) => ({
    ...model,
    sourceRunId: normalizedRuns.idMap.get(model.sourceRunId) ?? model.sourceRunId,
    datasetIds: normalizeIds((model.datasetIds ?? []).map((id) => normalizedDatasets.idMap.get(id) ?? id)),
    projectIds: normalizeIds((model.projectIds ?? []).map((id) => normalizedProjects.idMap.get(id) ?? id)),
  }))

  const projects = normalizedProjects.items.map((project) => ({
    ...project,
    datasetIds: normalizeIds(project.datasetIds.map((id) => normalizedDatasets.idMap.get(id) ?? id)),
    modelIds: normalizeIds(project.modelIds.map((id) => normalizedModels.idMap.get(id) ?? id)),
  }))

  return {
    datasets: normalizedDatasets.items,
    runs,
    models,
    projects,
  }
}

function getNextRunStatus(current: RunStatus): RunStatus {
  if (current === 'Queued') return 'Running'
  if (current === 'Running') return 'Completed'
  if (current === 'Completed') return 'Review'
  if (current === 'Review') return 'Failed'
  return 'Queued'
}

function normalizeIds(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildLayerNames(model: string): string[] {
  if (model === 'ANN Multiclass') {
    return ['Input', 'Dense 1', 'Dense 2', 'Dense 3', 'Output']
  }

  return ['Input', 'Dense 1', 'Dense 2', 'Output']
}

function generateConfusionMatrix(model: string, precision: number): number[][] {
  const safePrecision = clamp(precision, 0.2, 0.999)

  if (model === 'ANN Multiclass') {
    const totalPerClass = 100
    const tpA = Math.round(totalPerClass * safePrecision)
    const tpB = Math.round(totalPerClass * (safePrecision - 0.03))
    const tpC = Math.round(totalPerClass * (safePrecision - 0.05))

    const offA = totalPerClass - tpA
    const offB = totalPerClass - tpB
    const offC = totalPerClass - tpC

    return [
      [tpA, Math.round(offA * 0.55), Math.round(offA * 0.45)],
      [Math.round(offB * 0.48), tpB, Math.round(offB * 0.52)],
      [Math.round(offC * 0.42), Math.round(offC * 0.58), tpC],
    ]
  }

  const positives = 120
  const negatives = 120
  const tp = Math.round(positives * safePrecision)
  const tn = Math.round(negatives * (safePrecision - 0.02))
  const fn = positives - tp
  const fp = negatives - tn

  return [
    [tn, fp],
    [fn, tp],
  ]
}

function advanceRunEpoch(run: RunRecord): RunRecord {
  if (!run.monitor || !run.trainingConfig || run.status !== 'Running') {
    return run
  }

  const nextEpoch = run.monitor.currentEpoch + 1
  const totalEpochs = run.monitor.totalEpochs

  const decay = Math.exp(-nextEpoch / Math.max(2, totalEpochs * 0.32))
  const overfitPressure =
    nextEpoch > totalEpochs * 0.65 ? ((nextEpoch - totalEpochs * 0.65) / Math.max(1, totalEpochs * 0.35)) * 0.08 : 0
  const noise = (((nextEpoch * 13) % 7) - 3) / 400

  const trainLoss = clamp(1.2 * decay + 0.03 + noise, 0.01, 2)
  const valLoss = clamp(trainLoss + 0.035 + overfitPressure + noise / 2, 0.01, 2)
  const trainPrecision = clamp(1 - trainLoss * 0.62, 0.35, 0.999)
  const valPrecision = clamp(trainPrecision - 0.025 - overfitPressure * 0.8, 0.3, 0.999)

  const cosineDecay = 0.15 + 0.85 * 0.5 * (1 + Math.cos((Math.PI * nextEpoch) / Math.max(1, totalEpochs)))
  const learningRate = Number((run.trainingConfig.learningRate * cosineDecay).toFixed(6))

  const layerActivations = run.monitor.layerNames.map((_, layerIndex) =>
    Number(clamp(0.18 + ((Math.sin((nextEpoch + 1) * (layerIndex + 1) * 0.9) + 1) / 2) * 0.72, 0.05, 0.98).toFixed(3)),
  )

  const confusionMatrix = generateConfusionMatrix(run.model, valPrecision)
  const epochTelemetry: RunEpochTelemetry = {
    epoch: nextEpoch,
    trainLoss: Number(trainLoss.toFixed(4)),
    valLoss: Number(valLoss.toFixed(4)),
    trainPrecision: Number(trainPrecision.toFixed(4)),
    valPrecision: Number(valPrecision.toFixed(4)),
    learningRate,
    layerActivations,
    confusionMatrix,
  }

  const bestValLoss = Math.min(run.monitor.bestValLoss, valLoss)
  const improved = valLoss < run.monitor.bestValLoss - 0.0001
  const staleEpochs = improved ? 0 : run.monitor.staleEpochs + 1

  const shouldEarlyStop =
    run.trainingConfig.earlyStopping &&
    staleEpochs >= run.trainingConfig.earlyStoppingPatience &&
    nextEpoch >= Math.min(8, totalEpochs)

  const reachedEnd = nextEpoch >= totalEpochs
  const completed = shouldEarlyStop || reachedEnd
  const progress = completed ? 100 : Math.round((nextEpoch / totalEpochs) * 100)

  const nextMonitor: RunLiveMonitor = {
    ...run.monitor,
    currentEpoch: nextEpoch,
    bestValLoss: Number(bestValLoss.toFixed(4)),
    staleEpochs,
    earlyStopTriggered: shouldEarlyStop,
    history: [...run.monitor.history, epochTelemetry],
    lastLearningRate: learningRate,
    lastTrainPrecision: Number(trainPrecision.toFixed(4)),
    lastValPrecision: Number(valPrecision.toFixed(4)),
    confusionMatrix,
  }

  return {
    ...run,
    status: completed ? 'Completed' : 'Running',
    progress,
    updated: `Today ${toTimeLabel()}`,
    monitor: nextMonitor,
  }
}

export function useMvpStore() {
  const [activeView, setActiveView] = useState<MenuItem>('Dashboard')
  const [datasets, setDatasets] = useState<DatasetRecord[]>(initialDatasets)
  const [runs, setRuns] = useState<RunRecord[]>(initialRuns)
  const [models, setModels] = useState<ModelVersion[]>(initialModels)
  const [projects, setProjects] = useState<ProjectRecord[]>(initialProjects)
  const [hydrated, setHydrated] = useState(false)
  const [idRepairApplied, setIdRepairApplied] = useState(false)

  useEffect(() => {
    let mounted = true

    async function hydrateStore() {
      const [savedDatasets, savedRuns, savedModels, savedProjects] = await Promise.all([
        loadFromDatabase(DATASETS_KEY, initialDatasets),
        loadFromDatabase(RUNS_KEY, initialRuns),
        loadFromDatabase(MODELS_KEY, initialModels),
        loadFromDatabase(PROJECTS_KEY, initialProjects),
      ])

      const sanitized = sanitizeHydratedStore({
        datasets: savedDatasets,
        runs: savedRuns,
        models: savedModels,
        projects: savedProjects,
      })

      if (!mounted) {
        return
      }

      setDatasets(sanitized.datasets)
      setRuns(sanitized.runs)
      setModels(sanitized.models)
      setProjects(sanitized.projects)
      setHydrated(true)
    }

    void hydrateStore()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    void saveToDatabase(DATASETS_KEY, datasets)
  }, [datasets, hydrated])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    void saveToDatabase(RUNS_KEY, runs)
  }, [runs, hydrated])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    void saveToDatabase(MODELS_KEY, models)
  }, [models, hydrated])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    void saveToDatabase(PROJECTS_KEY, projects)
  }, [projects, hydrated])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    const intervalId = window.setInterval(() => {
      setRuns((prev) => prev.map((run) => advanceRunEpoch(run)))
    }, 900)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [hydrated])

  useEffect(() => {
    if (!hydrated || idRepairApplied) {
      return
    }

    const sanitized = sanitizeHydratedStore({
      datasets,
      runs,
      models,
      projects,
    })

    setDatasets(sanitized.datasets)
    setRuns(sanitized.runs)
    setModels(sanitized.models)
    setProjects(sanitized.projects)
    setIdRepairApplied(true)
  }, [datasets, hydrated, idRepairApplied, models, projects, runs])

  const completedRuns = runs.filter((run) => run.status === 'Completed').length
  const runningRuns = runs.filter((run) => run.status === 'Running').length
  const successRate = runs.length > 0 ? Math.round((completedRuns / runs.length) * 100) : 0
  const readyDatasets = datasets.filter((dataset) => dataset.status === 'Ready').length
  const pendingDatasets = datasets.filter((dataset) => dataset.status === 'Pending Validation').length
  const queueLength = runs.filter((run) => run.status === 'Queued').length
  const registryCandidates = runs.filter((run) => run.status === 'Review').length
  const recentRuns = runs.slice(0, 6)
  const registrableRuns = runs.filter((run) => run.status === 'Completed' || run.status === 'Review')

  const kpiCards = useMemo<KpiCard[]>(
    () => [
      {
        label: 'Running Jobs',
        value: runningRuns,
        foot: 'Live training executions',
      },
      {
        label: 'Runs Completed',
        value: completedRuns,
        foot: `${successRate}% success rate`,
      },
      {
        label: 'Datasets Ready',
        value: readyDatasets,
        foot: `${datasets.length} datasets tracked`,
      },
      {
        label: 'Registry Candidates',
        value: registryCandidates,
        foot: 'Awaiting governance decision',
      },
    ],
    [completedRuns, datasets.length, readyDatasets, registryCandidates, runningRuns, successRate],
  )

  const alerts = useMemo(() => {
    const list: string[] = []

    const failedCount = runs.filter((run) => run.status === 'Failed').length
    if (failedCount > 0) {
      list.push(`${failedCount} failed run(s) require triage.`)
    }

    if (pendingDatasets > 0) {
      list.push(`${pendingDatasets} dataset(s) are pending validation.`)
    }

    if (registryCandidates > 0) {
      list.push(`${registryCandidates} run(s) are ready for model registration.`)
    }

    if (list.length === 0) {
      list.push('No critical alerts. Platform status is healthy.')
    }

    return list
  }, [pendingDatasets, registryCandidates, runs])

  function createDataset(input: CreateDatasetInput): void {
    const name = input.name.trim()
    const projectIds = Array.from(new Set(input.projectIds.filter((projectId) => projectId.trim().length > 0)))

    if (!name || projectIds.length === 0) {
      return
    }

    const newDataset: DatasetRecord = {
      id: `${nextId('ds')}-${name.toLowerCase().replace(/\s+/g, '-').slice(0, 12)}`,
      name,
      type: input.type,
      versions: 1,
      status: 'Ready',
      updated: `Today ${toTimeLabel()}`,
    }

    setDatasets((prev) => [newDataset, ...prev])
    setProjects((prev) =>
      prev.map((project) => {
        if (!projectIds.includes(project.id)) {
          return project
        }

        if (project.datasetIds.includes(newDataset.id)) {
          return project
        }

        return {
          ...project,
          datasetIds: [...project.datasetIds, newDataset.id],
          updated: `Today ${toTimeLabel()}`,
        }
      }),
    )
  }

  function updateDataset(input: UpdateDatasetInput): void {
    const name = input.name.trim()
    const projectIds = Array.from(new Set(input.projectIds.filter((projectId) => projectId.trim().length > 0)))

    if (!name || projectIds.length === 0) {
      return
    }

    setDatasets((prev) =>
      prev.map((dataset) => {
        if (dataset.id !== input.id) {
          return dataset
        }

        return {
          ...dataset,
          name,
          type: input.type,
          updated: `Today ${toTimeLabel()}`,
        }
      }),
    )

    setProjects((prev) =>
      prev.map((project) => {
        const shouldInclude = projectIds.includes(project.id)
        const alreadyIncluded = project.datasetIds.includes(input.id)

        if (shouldInclude && !alreadyIncluded) {
          return {
            ...project,
            datasetIds: [...project.datasetIds, input.id],
            updated: `Today ${toTimeLabel()}`,
          }
        }

        if (!shouldInclude && alreadyIncluded) {
          return {
            ...project,
            datasetIds: project.datasetIds.filter((datasetId) => datasetId !== input.id),
            updated: `Today ${toTimeLabel()}`,
          }
        }

        return project
      }),
    )
  }

  function deleteDataset(datasetId: string): void {
    setDatasets((prev) => prev.filter((dataset) => dataset.id !== datasetId))
    setProjects((prev) =>
      prev.map((project) => {
        if (!project.datasetIds.includes(datasetId)) {
          return project
        }

        return {
          ...project,
          datasetIds: project.datasetIds.filter((id) => id !== datasetId),
          updated: `Today ${toTimeLabel()}`,
        }
      }),
    )
  }

  function createRun(input: CreateRunInput): void {
    const project = input.project.trim()
    const requestedName = input.name.trim()
    const runNumber = runs.filter((run) => run.project === project).length + 1
    const defaultName = `${compactIsoDate(new Date())}_Run${String(runNumber).padStart(2, '0')}`
    const name = requestedName || defaultName
    const selectedFile = input.selectedFile.trim()
    if (
      !name ||
      !project ||
      !input.datasetId ||
      !selectedFile ||
      input.epochs <= 0 ||
      input.batchSize <= 0 ||
      input.learningRate <= 0 ||
      (input.earlyStopping && input.earlyStoppingPatience <= 0)
    ) {
      return
    }

    const layerNames = buildLayerNames(input.model)
    const totalEpochs = Math.floor(input.epochs)

    const newRun: RunRecord = {
      id: nextId('run'),
      name,
      project,
      model: input.model,
      status: 'Running',
      progress: 0,
      updated: `Today ${toTimeLabel()}`,
      datasetId: input.datasetId,
      trainingConfig: {
        selectedFile,
        epochs: totalEpochs,
        batchSize: Math.floor(input.batchSize),
        learningRate: Number(input.learningRate),
        earlyStopping: input.earlyStopping,
        earlyStoppingPatience: Math.floor(input.earlyStoppingPatience),
      },
      monitor: {
        currentEpoch: 0,
        totalEpochs,
        bestValLoss: Number.POSITIVE_INFINITY,
        staleEpochs: 0,
        earlyStopTriggered: false,
        layerNames,
        history: [],
        lastLearningRate: Number(input.learningRate),
        lastTrainPrecision: 0,
        lastValPrecision: 0,
        confusionMatrix: input.model === 'ANN Multiclass' ? [[0, 0, 0], [0, 0, 0], [0, 0, 0]] : [[0, 0], [0, 0]],
      },
    }

    setRuns((prev) => [newRun, ...prev])
  }

  function advanceRunStatus(runId: string): void {
    setRuns((prev) =>
      prev.map((run) => {
        if (run.id !== runId) {
          return run
        }

        const nextStatus = getNextRunStatus(run.status)
        const nextProgress = nextStatus === 'Queued' ? 0 : nextStatus === 'Running' ? 62 : 100

        return {
          ...run,
          status: nextStatus,
          progress: nextProgress,
          updated: `Today ${toTimeLabel()}`,
        }
      }),
    )
  }

  function registerModelFromRun(runId: string): void {
    const run = runs.find((candidate) => candidate.id === runId)
    if (!run) {
      return
    }

    const canRegister = run.status === 'Completed' || run.status === 'Review'
    if (!canRegister) {
      return
    }

    const alreadyRegistered = models.find((model) => model.sourceRunId === run.id)
    if (alreadyRegistered) {
      return
    }

    const newModel: ModelVersion = {
      id: nextId('mdl'),
      name: run.name,
      family: run.model,
      version: `v${models.length + 1}`,
      sourceRunId: run.id,
      qualityScore: Number(Math.min(0.99, 0.87 + models.length * 0.02).toFixed(2)),
      registered: `Today ${toTimeLabel()}`,
    }

    setModels((prev) => [newModel, ...prev])
  }

  async function createDesignedModel(input: ModelDesignDraft): Promise<GeneratedModelArtifact | null> {
    const name = input.name.trim()
    const optimizer = input.training.optimizer.trim()
    const scheduler = input.training.scheduler.trim()

    const projectIds = normalizeIds(input.projectIds)
    const datasetIds = normalizeIds(input.datasetIds)

    const isValidArchitecture =
      input.architecture.kind === 'ANN'
        ? input.architecture.inputSize > 0 &&
          input.architecture.outputSize > 0 &&
          input.architecture.outputActivation.trim().length > 0 &&
          input.architecture.hiddenLayers.length > 0 &&
          input.architecture.hiddenLayers.every(
            (layer) =>
              layer.units > 0 &&
              layer.dropout >= 0 &&
              layer.dropout < 1 &&
              layer.activation.trim().length > 0,
          )
        : input.architecture.inputWidth > 0 &&
          input.architecture.inputHeight > 0 &&
          input.architecture.inputChannels > 0 &&
          input.architecture.denseUnits > 0 &&
          input.architecture.outputSize > 0 &&
          input.architecture.blocks.length > 0 &&
          input.architecture.blocks.every(
            (block) =>
              block.filters > 0 &&
              block.kernelSize > 0 &&
              block.stride > 0 &&
              block.poolSize > 0 &&
              block.dropout >= 0 &&
              block.dropout < 1 &&
              block.activation.trim().length > 0,
          )

    if (!name || projectIds.length === 0 || !optimizer || !scheduler || !isValidArchitecture) {
      return null
    }

    const modelId = nextId('mdl')
    const versionNumber = models.length + 1
    const timestamp = `Today ${toTimeLabel()}`
    const artifact = artifactGenerator.generatePtArtifact({
      modelId,
      draft: {
        ...input,
        name,
        projectIds,
        datasetIds,
        training: {
          ...input.training,
          optimizer,
          scheduler,
        },
      },
    })
    const artifactUri = buildModelArtifactUri(modelId, artifact.fileName)
    await storeModelArtifact({
      artifactUri,
      fileName: artifact.fileName,
      payload: artifact.payload,
      generatedAtIso: artifact.generatedAtIso,
    })

    const newModel: ModelVersion = {
      id: modelId,
      name,
      family: input.family,
      version: `v${versionNumber}`,
      sourceRunId: 'design-studio',
      qualityScore: 0,
      registered: timestamp,
      projectIds,
      datasetIds,
      ptFileName: artifact.fileName,
      ptArtifactUri: artifactUri,
      ptGeneratedAt: timestamp,
      ptPayload: artifact.payload,
    }

    setModels((prev) => [newModel, ...prev])
    setProjects((prev) =>
      prev.map((project) => {
        if (!projectIds.includes(project.id)) {
          return project
        }

        if (project.modelIds.includes(modelId)) {
          return {
            ...project,
            ptStatus: 'Created',
            updated: timestamp,
          }
        }

        return {
          ...project,
          modelIds: [...project.modelIds, modelId],
          ptStatus: 'Created',
          updated: timestamp,
        }
      }),
    )

    return {
      ...artifact,
      artifactUri,
    }
  }

  async function updateDesignedModel(input: ModelDesignDraft & { id: string }): Promise<GeneratedModelArtifact | null> {
    const currentModel = models.find((model) => model.id === input.id && model.sourceRunId === 'design-studio')
    if (!currentModel) {
      return null
    }

    const name = input.name.trim()
    const optimizer = input.training.optimizer.trim()
    const scheduler = input.training.scheduler.trim()
    const projectIds = normalizeIds(input.projectIds)
    const datasetIds = normalizeIds(input.datasetIds)

    const isValidArchitecture =
      input.architecture.kind === 'ANN'
        ? input.architecture.inputSize > 0 &&
          input.architecture.outputSize > 0 &&
          input.architecture.outputActivation.trim().length > 0 &&
          input.architecture.hiddenLayers.length > 0 &&
          input.architecture.hiddenLayers.every(
            (layer) =>
              layer.units > 0 &&
              layer.dropout >= 0 &&
              layer.dropout < 1 &&
              layer.activation.trim().length > 0,
          )
        : input.architecture.inputWidth > 0 &&
          input.architecture.inputHeight > 0 &&
          input.architecture.inputChannels > 0 &&
          input.architecture.denseUnits > 0 &&
          input.architecture.outputSize > 0 &&
          input.architecture.blocks.length > 0 &&
          input.architecture.blocks.every(
            (block) =>
              block.filters > 0 &&
              block.kernelSize > 0 &&
              block.stride > 0 &&
              block.poolSize > 0 &&
              block.dropout >= 0 &&
              block.dropout < 1 &&
              block.activation.trim().length > 0,
          )

    if (!name || projectIds.length === 0 || !optimizer || !scheduler || !isValidArchitecture) {
      return null
    }

    const timestamp = `Today ${toTimeLabel()}`
    const artifact = artifactGenerator.generatePtArtifact({
      modelId: input.id,
      draft: {
        ...input,
        name,
        projectIds,
        datasetIds,
        training: {
          ...input.training,
          optimizer,
          scheduler,
        },
      },
    })
    const artifactUri = buildModelArtifactUri(input.id, artifact.fileName)
    await storeModelArtifact({
      artifactUri,
      fileName: artifact.fileName,
      payload: artifact.payload,
      generatedAtIso: artifact.generatedAtIso,
    })

    setModels((prev) =>
      prev.map((model) => {
        if (model.id !== input.id) {
          return model
        }

        return {
          ...model,
          name,
          family: input.family,
          projectIds,
          datasetIds,
          registered: timestamp,
          ptFileName: artifact.fileName,
          ptArtifactUri: artifactUri,
          ptGeneratedAt: timestamp,
          ptPayload: artifact.payload,
        }
      }),
    )

    const previousProjectIds = normalizeIds(currentModel.projectIds ?? [])

    setProjects((prev) =>
      prev.map((project) => {
        const wasLinked = previousProjectIds.includes(project.id)
        const shouldLink = projectIds.includes(project.id)

        if (!wasLinked && !shouldLink) {
          return project
        }

        if (!wasLinked && shouldLink) {
          return {
            ...project,
            modelIds: project.modelIds.includes(input.id) ? project.modelIds : [...project.modelIds, input.id],
            ptStatus: 'Created',
            updated: timestamp,
          }
        }

        if (wasLinked && !shouldLink) {
          return {
            ...project,
            modelIds: project.modelIds.filter((modelId) => modelId !== input.id),
            ptStatus: project.modelIds.filter((modelId) => modelId !== input.id).length > 0 ? 'Created' : 'Not Created',
            updated: timestamp,
          }
        }

        return {
          ...project,
          modelIds: project.modelIds.includes(input.id) ? project.modelIds : [...project.modelIds, input.id],
          ptStatus: 'Created',
          updated: timestamp,
        }
      }),
    )

    return {
      ...artifact,
      artifactUri,
    }
  }

  async function deleteDesignedModel(modelId: string): Promise<void> {
    const target = models.find((model) => model.id === modelId && model.sourceRunId === 'design-studio')
    if (!target) {
      return
    }

    if (target.ptArtifactUri) {
      await removeModelArtifact(target.ptArtifactUri)
    }

    const timestamp = `Today ${toTimeLabel()}`
    setModels((prev) => prev.filter((model) => model.id !== modelId))

    setProjects((prev) =>
      prev.map((project) => {
        if (!project.modelIds.includes(modelId)) {
          return project
        }

        const nextModelIds = project.modelIds.filter((id) => id !== modelId)

        return {
          ...project,
          modelIds: nextModelIds,
          ptStatus: nextModelIds.length > 0 ? 'Created' : 'Not Created',
          updated: timestamp,
        }
      }),
    )
  }

  function createProject(input: CreateProjectInput): void {
    const name = input.name.trim()
    const createdOn = input.createdOn.trim()

    if (!name || !createdOn) {
      return
    }

    const datasetIds = Array.from(new Set(input.datasetIds.filter((datasetId) => datasetId.trim().length > 0)))
    const modelIds = Array.from(new Set(input.modelIds.filter((modelId) => modelId.trim().length > 0)))
    const modelCombinations = Array.from(
      new Set(input.modelCombinations.map((item) => item.trim()).filter((item) => item.length > 0)),
    )

    const newProject: ProjectRecord = {
      id: nextId('prj'),
      name,
      createdOn,
      status: input.status,
      networkType: input.networkType,
      ptStatus: 'Not Created',
      datasetIds,
      modelIds,
      modelCombinations,
      updated: `Today ${toTimeLabel()}`,
    }

    setProjects((prev) => [newProject, ...prev])
  }

  function updateProject(input: UpdateProjectInput): void {
    const name = input.name.trim()
    const createdOn = input.createdOn.trim()

    if (!name || !createdOn) {
      return
    }

    const datasetIds = Array.from(new Set(input.datasetIds.filter((datasetId) => datasetId.trim().length > 0)))
    const modelIds = Array.from(new Set(input.modelIds.filter((modelId) => modelId.trim().length > 0)))
    const modelCombinations = Array.from(
      new Set(input.modelCombinations.map((item) => item.trim()).filter((item) => item.length > 0)),
    )

    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== input.id) {
          return project
        }

        return {
          ...project,
          name,
          createdOn,
          networkType: input.networkType,
          datasetIds,
          modelIds,
          modelCombinations,
          updated: `Today ${toTimeLabel()}`,
        }
      }),
    )
  }

  function updateProjectStatus(projectId: string, status: ProjectStatus): void {
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) {
          return project
        }

        return {
          ...project,
          status,
          updated: `Today ${toTimeLabel()}`,
        }
      }),
    )
  }

  function deleteProject(projectId: string): void {
    setProjects((prev) => prev.filter((project) => project.id !== projectId))
  }

  return {
    activeView,
    setActiveView,
    datasets,
    runs,
    models,
    projects,
    recentRuns,
    registrableRuns,
    alerts,
    kpiCards,
    queueLength,
    pendingDatasets,
    createDataset,
    updateDataset,
    deleteDataset,
    createProject,
    updateProject,
    updateProjectStatus,
    deleteProject,
    createRun,
    advanceRunStatus,
    registerModelFromRun,
    createDesignedModel,
    updateDesignedModel,
    deleteDesignedModel,
  }
}
