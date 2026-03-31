import { loadFromDatabase, saveToDatabase } from '../../../shared/lib/browserDb'

type StoredArtifact = {
  artifactUri: string
  fileName: string
  payload: string
  generatedAtIso: string
}

type ArtifactIndex = Record<string, StoredArtifact>

type StoreArtifactInput = {
  artifactUri: string
  fileName: string
  payload: string
  generatedAtIso: string
}

const ARTIFACTS_KEY = 'annstudio_model_artifacts'

function triggerArtifactDownload(fileName: string, payload: string): void {
  const blob = new Blob([payload], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

async function readArtifactIndex(): Promise<ArtifactIndex> {
  return loadFromDatabase<ArtifactIndex>(ARTIFACTS_KEY, {})
}

async function writeArtifactIndex(index: ArtifactIndex): Promise<void> {
  await saveToDatabase(ARTIFACTS_KEY, index)
}

export function buildModelArtifactUri(modelId: string, fileName: string): string {
  return `object://ann-studio/models/${modelId}/${fileName}`
}

export async function storeModelArtifact(input: StoreArtifactInput): Promise<void> {
  const index = await readArtifactIndex()

  index[input.artifactUri] = {
    artifactUri: input.artifactUri,
    fileName: input.fileName,
    payload: input.payload,
    generatedAtIso: input.generatedAtIso,
  }

  await writeArtifactIndex(index)
}

export async function removeModelArtifact(artifactUri: string): Promise<void> {
  const index = await readArtifactIndex()

  if (!index[artifactUri]) {
    return
  }

  delete index[artifactUri]
  await writeArtifactIndex(index)
}

export async function downloadModelArtifact(input: {
  artifactUri?: string
  fallbackFileName?: string
  fallbackPayload?: string
}): Promise<boolean> {
  if (input.artifactUri) {
    const index = await readArtifactIndex()
    const stored = index[input.artifactUri]

    if (stored) {
      triggerArtifactDownload(stored.fileName, stored.payload)
      return true
    }
  }

  if (input.fallbackFileName && input.fallbackPayload) {
    triggerArtifactDownload(input.fallbackFileName, input.fallbackPayload)
    return true
  }

  return false
}
