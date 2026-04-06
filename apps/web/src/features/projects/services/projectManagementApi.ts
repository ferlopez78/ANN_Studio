import type { ProjectNetworkType, ProjectStatus } from '../../../shared/types/mvp'

export type ClientStatus = 'active' | 'inactive'

export type ClientRecordApi = {
  id: string
  tenantId: string
  code: string
  name: string
  status: ClientStatus
  notes?: string | null
  createdByUserId: string
  createdAtUtc: string
  updatedAtUtc: string
}

export type ProjectRecordApi = {
  id: string
  tenantId: string
  clientId: string
  clientName?: string | null
  code: string
  name: string
  status: ProjectStatus
  networkType: ProjectNetworkType
  description?: string | null
  datasetIds: string[]
  modelIds: string[]
  modelCombinations: string[]
  createdByUserId: string
  createdAtUtc: string
  updatedAtUtc: string
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
const TENANT_ID = (import.meta.env.VITE_TENANT_ID as string | undefined)?.trim()
const USER_ID = (import.meta.env.VITE_USER_ID as string | undefined)?.trim()

function assertAuthContext(): { tenantId: string; userId: string } {
  if (!TENANT_ID || !USER_ID) {
    throw new Error('Missing VITE_TENANT_ID or VITE_USER_ID in frontend environment.')
  }

  return {
    tenantId: TENANT_ID,
    userId: USER_ID,
  }
}

function headers(): HeadersInit {
  const auth = assertAuthContext()
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Id': auth.tenantId,
    'X-User-Id': auth.userId,
  }
}

async function safeJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T
  return payload
}

async function throwIfNotOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) {
    return
  }

  try {
    const payload = await safeJson<{ detail?: unknown }>(response)
    if (payload.detail && typeof payload.detail === 'string') {
      throw new Error(payload.detail)
    }
  } catch (error) {
    if (error instanceof Error && error.message !== 'Unexpected end of JSON input') {
      throw error
    }
  }

  throw new Error(fallback)
}

export async function fetchClients(): Promise<ClientRecordApi[]> {
  const response = await fetch(`${API_BASE_URL}/api/clients`, {
    method: 'GET',
    headers: headers(),
  })
  await throwIfNotOk(response, 'Unable to fetch clients')
  return safeJson<ClientRecordApi[]>(response)
}

export async function createClient(payload: {
  code?: string
  name: string
  status: ClientStatus
  notes?: string
}): Promise<ClientRecordApi> {
  const response = await fetch(`${API_BASE_URL}/api/clients`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  await throwIfNotOk(response, 'Unable to create client')
  return safeJson<ClientRecordApi>(response)
}

export async function updateClient(clientId: string, payload: {
  code?: string
  name: string
  status: ClientStatus
  notes?: string
}): Promise<ClientRecordApi> {
  const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  await throwIfNotOk(response, 'Unable to update client')
  return safeJson<ClientRecordApi>(response)
}

export async function deleteClient(clientId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}`, {
    method: 'DELETE',
    headers: headers(),
  })
  await throwIfNotOk(response, 'Unable to archive client')
}

export async function fetchProjects(): Promise<ProjectRecordApi[]> {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: 'GET',
    headers: headers(),
  })
  await throwIfNotOk(response, 'Unable to fetch projects')
  return safeJson<ProjectRecordApi[]>(response)
}

export async function createProject(payload: {
  clientId: string
  code: string
  name: string
  status: ProjectStatus
  networkType: ProjectNetworkType
  description?: string
  datasetIds: string[]
  modelIds: string[]
  modelCombinations: string[]
}): Promise<ProjectRecordApi> {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  await throwIfNotOk(response, 'Unable to create project')
  return safeJson<ProjectRecordApi>(response)
}

export async function updateProject(projectId: string, payload: {
  clientId: string
  code: string
  name: string
  status: ProjectStatus
  networkType: ProjectNetworkType
  description?: string
  datasetIds: string[]
  modelIds: string[]
  modelCombinations: string[]
}): Promise<ProjectRecordApi> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  await throwIfNotOk(response, 'Unable to update project')
  return safeJson<ProjectRecordApi>(response)
}

export async function deleteProject(projectId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: 'DELETE',
    headers: headers(),
  })
  await throwIfNotOk(response, 'Unable to archive project')
}
