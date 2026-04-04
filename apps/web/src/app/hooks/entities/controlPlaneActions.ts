import {
  createDataset as createDatasetApi,
  deleteDataset as deleteDatasetApi,
  updateDataset as updateDatasetApi,
} from '../../../features/datasets/services/datasetManagementApi'
import type { Dispatch, SetStateAction } from 'react'
import {
  createClient as createClientApi,
  createProject as createProjectApi,
  deleteClient as deleteClientApi,
  deleteProject as deleteProjectApi,
  updateClient as updateClientApi,
  updateProject as updateProjectApi,
} from '../../../features/projects/services/projectManagementApi'
import type {
  ClientRecord,
  ClientStatus,
  DatasetRecord,
  DatasetType,
  ProjectNetworkType,
  ProjectRecord,
  ProjectStatus,
} from '../../../shared/types/mvp'

export type CreateDatasetInput = {
  name: string
  type: DatasetType
  projectIds: string[]
}

export type UpdateDatasetInput = {
  id: string
  name: string
  type: DatasetType
  projectIds: string[]
}

export type CreateProjectInput = {
  clientId: string
  name: string
  createdOn: string
  status: ProjectStatus
  networkType: ProjectNetworkType
  datasetIds: string[]
  modelIds: string[]
  modelCombinations: string[]
}

export type UpdateProjectInput = {
  id: string
  clientId: string
  name: string
  createdOn: string
  status: ProjectStatus
  networkType: ProjectNetworkType
  datasetIds: string[]
  modelIds: string[]
  modelCombinations: string[]
}

export type CreateClientInput = {
  name: string
  status: ClientStatus
  notes?: string
}

export type UpdateClientInput = {
  id: string
  name: string
  status: ClientStatus
  notes?: string
}

type Context = {
  clients: ClientRecord[]
  datasets: DatasetRecord[]
  projects: ProjectRecord[]
  setClients: Dispatch<SetStateAction<ClientRecord[]>>
  setDatasets: Dispatch<SetStateAction<DatasetRecord[]>>
  setProjects: Dispatch<SetStateAction<ProjectRecord[]>>
  toTimeLabel: () => string
}

function firstFiveToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase()
}

function buildProjectCode(baseName: string, projects: ProjectRecord[]): string {
  const base = firstFiveToken(baseName) || 'PRJ'
  const usedCodes = new Set(
    projects
      .map((project) => project.code?.toUpperCase())
      .filter((code): code is string => Boolean(code && code.trim().length > 0)),
  )

  if (!usedCodes.has(base)) {
    return base
  }

  let suffix = 2
  while (usedCodes.has(`${base}${suffix}`)) {
    suffix += 1
  }
  return `${base}${suffix}`
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
    updated: input.updatedAtUtc ? new Date(input.updatedAtUtc).toLocaleString() : `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
  }
}

export function createControlPlaneActions(context: Context) {
  async function createDataset(input: CreateDatasetInput): Promise<void> {
    const name = input.name.trim()
    const projectIds = Array.from(new Set(input.projectIds.filter((projectId) => projectId.trim().length > 0)))

    if (!name || projectIds.length === 0) {
      return
    }

    const payload = await createDatasetApi({
      name,
      type: input.type,
      status: 'Ready',
      projectIds,
    })

    const newDataset: DatasetRecord = {
      id: payload.id,
      name: payload.name,
      type: payload.type,
      versions: payload.versions,
      status: payload.status,
      updated: new Date(payload.updatedAtUtc).toLocaleString(),
    }

    context.setDatasets((prev) => [newDataset, ...prev.filter((dataset) => dataset.id !== newDataset.id)])
    context.setProjects((prev) =>
      prev.map((project) => {
        if (!payload.projectIds.includes(project.id)) {
          return project
        }

        if (project.datasetIds.includes(newDataset.id)) {
          return project
        }

        return {
          ...project,
          datasetIds: [...project.datasetIds, newDataset.id],
          updated: new Date(payload.updatedAtUtc).toLocaleString(),
        }
      }),
    )
  }

  async function updateDataset(input: UpdateDatasetInput): Promise<void> {
    const name = input.name.trim()
    const projectIds = Array.from(new Set(input.projectIds.filter((projectId) => projectId.trim().length > 0)))

    if (!name || projectIds.length === 0) {
      return
    }

    const payload = await updateDatasetApi(input.id, {
      name,
      type: input.type,
      status: 'Ready',
      projectIds,
    })

    context.setDatasets((prev) =>
      prev.map((dataset) => {
        if (dataset.id !== payload.id) {
          return dataset
        }

        return {
          ...dataset,
          name: payload.name,
          type: payload.type,
          versions: payload.versions,
          status: payload.status,
          updated: new Date(payload.updatedAtUtc).toLocaleString(),
        }
      }),
    )

    context.setProjects((prev) =>
      prev.map((project) => {
        const shouldInclude = payload.projectIds.includes(project.id)
        const alreadyIncluded = project.datasetIds.includes(payload.id)

        if (shouldInclude && !alreadyIncluded) {
          return {
            ...project,
            datasetIds: [...project.datasetIds, payload.id],
            updated: new Date(payload.updatedAtUtc).toLocaleString(),
          }
        }

        if (!shouldInclude && alreadyIncluded) {
          return {
            ...project,
            datasetIds: project.datasetIds.filter((datasetId) => datasetId !== payload.id),
            updated: new Date(payload.updatedAtUtc).toLocaleString(),
          }
        }

        return project
      }),
    )
  }

  async function deleteDataset(datasetId: string): Promise<void> {
    await deleteDatasetApi(datasetId)
    context.setDatasets((prev) => prev.filter((dataset) => dataset.id !== datasetId))
    context.setProjects((prev) =>
      prev.map((project) => {
        if (!project.datasetIds.includes(datasetId)) {
          return project
        }

        return {
          ...project,
          datasetIds: project.datasetIds.filter((id) => id !== datasetId),
          updated: `Today ${context.toTimeLabel()}`,
        }
      }),
    )
  }

  async function createProject(input: CreateProjectInput): Promise<void> {
    const name = input.name.trim()
    const createdOn = input.createdOn.trim()
    const clientId = input.clientId.trim()

    if (!name || !createdOn || !clientId) {
      return
    }

    const datasetIds = Array.from(new Set(input.datasetIds.filter((datasetId) => datasetId.trim().length > 0)))
    const modelIds = Array.from(new Set(input.modelIds.filter((modelId) => modelId.trim().length > 0)))
    const modelCombinations = Array.from(
      new Set(input.modelCombinations.map((item) => item.trim()).filter((item) => item.length > 0)),
    )

    const selectedClient = context.clients.find((client) => client.id === clientId)
    if (!selectedClient) {
      return
    }

    const payload = await createProjectApi({
      clientId,
      code: buildProjectCode(name, context.projects),
      name,
      status: input.status,
      networkType: input.networkType,
      description: '',
      datasetIds,
      modelIds,
      modelCombinations,
    })

    const newProject: ProjectRecord = {
      id: payload.id,
      code: payload.code,
      clientId: payload.clientId,
      clientName: payload.clientName ?? selectedClient.name,
      name: payload.name,
      createdOn,
      status: payload.status,
      networkType: payload.networkType,
      ptStatus: 'Not Created',
      datasetIds: payload.datasetIds,
      modelIds: payload.modelIds,
      modelCombinations: payload.modelCombinations,
      updated: new Date(payload.updatedAtUtc).toLocaleString(),
    }

    context.setProjects((prev) => [newProject, ...prev])
  }

  async function updateProject(input: UpdateProjectInput): Promise<void> {
    const name = input.name.trim()
    const createdOn = input.createdOn.trim()
    const clientId = input.clientId.trim()

    if (!name || !createdOn || !clientId) {
      return
    }

    const datasetIds = Array.from(new Set(input.datasetIds.filter((datasetId) => datasetId.trim().length > 0)))
    const modelIds = Array.from(new Set(input.modelIds.filter((modelId) => modelId.trim().length > 0)))
    const modelCombinations = Array.from(
      new Set(input.modelCombinations.map((item) => item.trim()).filter((item) => item.length > 0)),
    )

    const payload = await updateProjectApi(input.id, {
      clientId,
      code: context.projects.find((project) => project.id === input.id)?.code ?? firstFiveToken(name),
      name,
      status: input.status,
      networkType: input.networkType,
      description: '',
      datasetIds,
      modelIds,
      modelCombinations,
    })

    context.setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== input.id) {
          return project
        }

        return {
          ...project,
          code: payload.code,
          clientId: payload.clientId,
          clientName: payload.clientName ?? project.clientName,
          name: payload.name,
          createdOn,
          status: payload.status,
          networkType: payload.networkType,
          datasetIds: payload.datasetIds,
          modelIds: payload.modelIds,
          modelCombinations: payload.modelCombinations,
          updated: new Date(payload.updatedAtUtc).toLocaleString(),
        }
      }),
    )
  }

  async function updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
    const current = context.projects.find((project) => project.id === projectId)
    if (!current || !current.clientId) {
      return
    }

    await updateProjectApi(projectId, {
      clientId: current.clientId,
      code: current.code ?? firstFiveToken(current.name),
      name: current.name,
      status,
      networkType: current.networkType,
      description: '',
      datasetIds: current.datasetIds,
      modelIds: current.modelIds,
      modelCombinations: current.modelCombinations,
    })

    context.setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) {
          return project
        }

        return {
          ...project,
          status,
          updated: `Today ${context.toTimeLabel()}`,
        }
      }),
    )
  }

  async function deleteProject(projectId: string): Promise<void> {
    await deleteProjectApi(projectId)
    context.setProjects((prev) => prev.filter((project) => project.id !== projectId))
  }

  async function createClient(input: CreateClientInput): Promise<void> {
    const name = input.name.trim()
    if (!name) {
      return
    }

    const payload = await createClientApi({
      name,
      status: input.status,
      notes: input.notes,
    })

    context.setClients((prev) => [toClientRecord(payload), ...prev])
  }

  async function updateClient(input: UpdateClientInput): Promise<void> {
    const name = input.name.trim()
    if (!name) {
      return
    }

    const current = context.clients.find((client) => client.id === input.id)
    if (!current) {
      return
    }

    const payload = await updateClientApi(input.id, {
      code: current.code,
      name,
      status: input.status,
      notes: input.notes,
    })

    context.setClients((prev) => prev.map((client) => (client.id === input.id ? toClientRecord(payload) : client)))
  }

  async function deleteClient(clientId: string): Promise<void> {
    await deleteClientApi(clientId)
    context.setClients((prev) => prev.filter((client) => client.id !== clientId))
    context.setProjects((prev) => prev.filter((project) => project.clientId !== clientId))
  }

  return {
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
    normalizeIds,
    toClientRecord,
  }
}
