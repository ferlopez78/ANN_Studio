import type { DatasetRecord, ModelVersion, ProjectRecord, RunRecord } from '../types/mvp'

export const initialDatasets: DatasetRecord[] = [
  {
    id: 'ds-credit-v1',
    name: 'Credit Risk Core',
    type: 'Tabular',
    versions: 3,
    status: 'Ready',
    updated: '12 min ago',
  },
  {
    id: 'ds-retail-v2',
    name: 'Retail Segmentation',
    type: 'Tabular',
    versions: 2,
    status: 'Pending Validation',
    updated: '44 min ago',
  },
  {
    id: 'ds-vision-v1',
    name: 'Vision QA Detection',
    type: 'Computer Vision',
    versions: 1,
    status: 'Ready',
    updated: '1 h ago',
  },
]

export const initialRuns: RunRecord[] = [
  {
    id: 'run-001',
    name: 'credit-risk-ann-v12',
    project: 'Risk Scoring',
    model: 'ANN Binary',
    status: 'Running',
    progress: 73,
    updated: '2 min ago',
    datasetId: 'ds-credit-v1',
  },
  {
    id: 'run-002',
    name: 'retail-segmentation-v08',
    project: 'Customer Analytics',
    model: 'ANN Multiclass',
    status: 'Completed',
    progress: 100,
    updated: '11 min ago',
    datasetId: 'ds-retail-v2',
  },
  {
    id: 'run-003',
    name: 'detector-stage1-v03',
    project: 'Vision QA',
    model: 'Custom Detector',
    status: 'Review',
    progress: 100,
    updated: '27 min ago',
    datasetId: 'ds-vision-v1',
  },
  {
    id: 'run-004',
    name: 'fraud-screening-v04',
    project: 'Payments',
    model: 'ANN Binary',
    status: 'Failed',
    progress: 41,
    updated: '1 h ago',
    datasetId: 'ds-credit-v1',
  },
]

export const initialModels: ModelVersion[] = [
  {
    id: 'mdl-001',
    name: 'credit-risk-ann',
    family: 'ANN Binary',
    version: 'v11',
    sourceRunId: 'run-000',
    qualityScore: 0.91,
    registered: 'Yesterday',
  },
]

export const initialProjects: ProjectRecord[] = [
  {
    id: 'prj-001',
    name: 'Risk Scoring Program',
    createdOn: '2026-01-15',
    status: 'Active',
    networkType: 'ANN Binary',
    ptStatus: 'Not Created',
    datasetIds: ['ds-credit-v1'],
    modelIds: ['mdl-001'],
    modelCombinations: [],
    updated: 'Today 09:20',
  },
]
