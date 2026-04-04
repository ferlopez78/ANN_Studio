type WizardStep = 1 | 2 | 3

type ModelDesignWizardTabsProps = {
  step: WizardStep
  onChangeStep: (step: WizardStep) => void
}

export function ModelDesignWizardTabs({ step, onChangeStep }: ModelDesignWizardTabsProps) {
  return (
    <div className="model-tabs" role="tablist" aria-label="Model creation steps">
      <button className={`model-tab ${step === 1 ? 'active' : ''}`} onClick={() => onChangeStep(1)}>
        1. Type And Links
      </button>
      <button className={`model-tab ${step === 2 ? 'active' : ''}`} onClick={() => onChangeStep(2)}>
        2. Layer Builder
      </button>
      <button className={`model-tab ${step === 3 ? 'active' : ''}`} onClick={() => onChangeStep(3)}>
        3. Optimizer And Scheduler
      </button>
    </div>
  )
}
