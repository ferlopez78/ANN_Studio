import { useEffect, useMemo, useState } from 'react'

import { LocalModelArtifactGenerator } from '../../features/model-design/services/artifactGenerator'
import { fetchDatasets } from '../../features/datasets/services/datasetManagementApi'
import {
  fetchClients,
  fetchProjects,
} from '../../features/projects/services/projectManagementApi'
import {
  createControlPlaneActions,
} from './entities/controlPlaneActions'
import { createRunActions } from './entities/runActions'
import {
  buildModelArtifactUri,
  removeModelArtifact,
  storeModelArtifact,
} from '../../features/model-design/services/artifactStorage'
import type { GeneratedModelArtifact, ModelDesignDraft } from '../../features/model-design/types'
import { menuItems } from '../../shared/config/navigation'
import type {
  DatasetRecord,
  ClientRecord,
  ClientStatus,
  KpiCard,
  ModelVersion,
  ProjectRecord,
  RunRecord,
  RunStatus,
} from '../../shared/types/mvp'

export type MenuItem = (typeof menuItems)[number]
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

function toClientRecord(input: {
  id: string
  code: string
  name: string
  status: ClientStatus
  notes?: string | null
  updatedAtUtc?: string
}): ClientRecord {
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    status: input.status,
    notes: input.notes ?? undefined,
    updated: input.updatedAtUtc ? new Date(input.updatedAtUtc).toLocaleString() : `Today ${toTimeLabel()}`,
  }
}

export function useMvpStore() {
  const [activeView, setActiveView] = useState<MenuItem>('Dashboard')
  const [datasets, setDatasets] = useState<DatasetRecord[]>([])
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [models, setModels] = useState<ModelVersion[]>([])
  const [projects, setProjects] = useState<ProjectRecord[]>([])

  useEffect(() => {
    let cancelled = false

    async function syncProjectManagementFromBackend(): Promise<void> {
      try {
        const [backendClients, backendProjects, backendDatasets] = await Promise.all([
          fetchClients(),
          fetchProjects(),
          fetchDatasets(),
        ])
        if (cancelled) {
          return
        }

        const datasetIdsByProjectId = new Map<string, Set<string>>()
        backendDatasets.forEach((dataset) => {
          dataset.projectIds.forEach((projectId) => {
            const current = datasetIdsByProjectId.get(projectId) ?? new Set<string>()
            current.add(dataset.id)
            datasetIdsByProjectId.set(projectId, current)
          })
        })

        setClients(
          backendClients.map((item) =>
            toClientRecord({
              id: item.id,
              code: item.code,
              name: item.name,
              status: item.status,
              notes: item.notes,
              updatedAtUtc: item.updatedAtUtc,
            }),
          ),
        )

        setProjects(
          backendProjects.map((item) => ({
            id: item.id,
            code: item.code,
            clientId: item.clientId,
            clientName: item.clientName ?? undefined,
            name: item.name,
            createdOn: item.createdAtUtc.slice(0, 10),
            status: item.status,
            networkType: item.networkType,
            ptStatus: 'Not Created',
            datasetIds: normalizeIds([...(item.datasetIds ?? []), ...Array.from(datasetIdsByProjectId.get(item.id) ?? [])]),
            modelIds: item.modelIds,
            modelCombinations: item.modelCombinations,
            updated: new Date(item.updatedAtUtc).toLocaleString(),
          })),
        )

        setDatasets(
          backendDatasets.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            versions: item.versions,
            status: item.status,
            updated: new Date(item.updatedAtUtc).toLocaleString(),
          })),
        )
      } catch {
        // Keep local state when backend is unavailable.
      }
    }

    void syncProjectManagementFromBackend()

    return () => {
      cancelled = true
    }
  }, [])

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

  const {
    createDataset,
    updateDataset,
    deleteDataset,
    createProject,
    updateProject,
    updateProjectStatus,
    deleteProject,
    createClient,
    updateClient,
    deleteClient,
  } = createControlPlaneActions({
    clients,
    datasets,
    projects,
    setClients,
    setDatasets,
    setProjects,
    toTimeLabel,
  })

  const { createRun, syncRunWithBackend } = createRunActions({
    datasets,
    runs,
    setRuns,
    nextId,
    toTimeLabel,
    compactIsoDate,
  })

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


  return {
    activeView,
    setActiveView,
    datasets,
    clients,
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
    createClient,
    updateClient,
    deleteClient,
    createRun,
    syncRunWithBackend,
    advanceRunStatus,
    registerModelFromRun,
    createDesignedModel,
    updateDesignedModel,
    deleteDesignedModel,
  }
}
