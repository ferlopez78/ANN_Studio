import type { ModelDesignDraft, GeneratedModelArtifact } from '../types'

export type GenerateArtifactInput = {
  modelId: string
  draft: ModelDesignDraft
}

export interface ModelArtifactGenerator {
  generatePtArtifact(input: GenerateArtifactInput): GeneratedModelArtifact
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export class LocalModelArtifactGenerator implements ModelArtifactGenerator {
  generatePtArtifact(input: GenerateArtifactInput): GeneratedModelArtifact {
    const generatedAtIso = new Date().toISOString()
    const fileName = `${toSlug(input.draft.name)}-${input.modelId}.pt`

    const payload = JSON.stringify(
      {
        modelId: input.modelId,
        modelName: input.draft.name,
        family: input.draft.family,
        projectIds: input.draft.projectIds,
        datasetIds: input.draft.datasetIds,
        architecture: input.draft.architecture,
        training: input.draft.training,
        generatedAt: generatedAtIso,
      },
      null,
      2,
    )

    return {
      fileName,
      payload,
      generatedAtIso,
    }
  }
}
