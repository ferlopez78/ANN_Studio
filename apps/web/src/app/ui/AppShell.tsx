import { menuItems } from '../../shared/config/navigation'
import { PlaceholderView } from '../../shared/ui/PlaceholderView'
import { DashboardView } from '../../features/dashboard/ui/DashboardView'
import { DatasetsView } from '../../features/datasets/ui/DatasetsView'
import { ModelDesignView } from '../../features/model-design/ui/ModelDesignView'
import { RegistryView } from '../../features/model-registry/ui/RegistryView'
import { ProjectsView } from '../../features/projects/ui/ProjectsView'
import { RunsView } from '../../features/runs/ui/RunsView'
import { useMvpStore } from '../hooks/useMvpStore'
import heroLogo from '../../assets/Logo.png'

function renderPlaceholderFor(view: string) {
  if (view === 'Live Metrics') {
    return {
      title: 'Live Metrics',
      description: 'Streaming curves and diagnostics panels are defined in OpenSpec and planned in the next increment.',
    }
  }

  return {
    title: 'Settings',
    description: 'Workspace policy and user settings are intentionally deferred for MVP hardening.',
  }
}

export function AppShell() {
  const {
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
  } = useMvpStore()

  const title = activeView === 'Dashboard' ? 'Executive Dashboard' : activeView

  function renderMainView() {
    if (activeView === 'Dashboard') {
      return (
        <DashboardView
          kpiCards={kpiCards}
          recentRuns={recentRuns}
          alerts={alerts}
          queueLength={queueLength}
          modelsCount={models.length}
          pendingDatasets={pendingDatasets}
          onOpenRuns={() => setActiveView('Runs')}
          onOpenDatasets={() => setActiveView('Datasets')}
          onOpenRegistry={() => setActiveView('Model Registry')}
        />
      )
    }

    if (activeView === 'Datasets') {
      return (
        <DatasetsView
          datasets={datasets}
          projects={projects}
          onCreateDataset={createDataset}
          onUpdateDataset={updateDataset}
          onDeleteDataset={deleteDataset}
        />
      )
    }

    if (activeView === 'Projects') {
      return (
        <ProjectsView
          projects={projects}
          datasets={datasets}
          models={models}
          onCreateProject={createProject}
          onUpdateProject={updateProject}
          onUpdateProjectStatus={updateProjectStatus}
          onDeleteProject={deleteProject}
        />
      )
    }

    if (activeView === 'Runs') {
      return (
        <RunsView
          datasets={datasets}
          models={models}
          projects={projects}
          runs={runs}
          onCreateRun={createRun}
          onAdvanceRunStatus={advanceRunStatus}
        />
      )
    }

    if (activeView === 'Model Registry') {
      return (
        <RegistryView
          models={models}
          registrableRuns={registrableRuns}
          onRegister={registerModelFromRun}
        />
      )
    }

    if (activeView === 'Model Design') {
      return (
        <ModelDesignView
          projects={projects}
          datasets={datasets}
          models={models}
          onCreateDesignedModel={createDesignedModel}
          onUpdateDesignedModel={updateDesignedModel}
          onDeleteDesignedModel={deleteDesignedModel}
        />
      )
    }

    const placeholder = renderPlaceholderFor(activeView)
    return <PlaceholderView title={placeholder.title} description={placeholder.description} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <img src={heroLogo} alt="ANN Studio logo" className="brand-mark-image" />
          </div>
          <div>
            <div className="brand-title">by Braize</div>
          </div>
        </div>

        <div className="env-card">
          <span className="eyebrow">Environment</span>
          <strong>Local Docker Cluster</strong>
          <span className="muted">Synced 34 seconds ago</span>
        </div>

        <nav className="nav">
          {menuItems.map((item) => (
            <button
              key={item}
              className={`nav-item ${activeView === item ? 'active' : ''}`}
              onClick={() => setActiveView(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">Control Plane</span>
            <h1>{title}</h1>
            <p className="subtitle">
              Operational view across datasets, runs, diagnostics, and model-governance readiness.
            </p>
          </div>

          <div className="topbar-actions">
            <button className="btn btn-secondary" onClick={() => setActiveView('Dashboard')}>
              Dashboard View
            </button>
            <button className="btn btn-primary" onClick={() => setActiveView('Runs')}>
              Start New Run
            </button>
          </div>
        </header>

        {renderMainView()}
      </main>
    </div>
  )
}
