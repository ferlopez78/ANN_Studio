import type { FormState } from './modelDesignFormUtils'
import { isCnnFamily } from './modelDesignFormUtils'

type ArchitecturePreviewProps = {
  formState: FormState
}

export function ArchitecturePreview({ formState }: ArchitecturePreviewProps) {
  if (isCnnFamily(formState.family)) {
    return (
      <div className="architecture-preview">
        <div className="architecture-preview-row">
          <span className="chip chip-readonly">
            Input {formState.cnnInputWidth}x{formState.cnnInputHeight}x{formState.cnnInputChannels}
          </span>
          <span className="chip chip-readonly">Blocks {formState.cnnBlocks.length}</span>
          <span className="chip chip-readonly">Dense {formState.cnnDenseUnits}</span>
          <span className="chip chip-readonly">Output {formState.cnnOutputSize}</span>
        </div>
        <div className="architecture-meta-grid">
          {formState.cnnBlocks.map((block, index) => (
            <div key={`preview-cnn-${index}`} className="architecture-meta-card">
              <strong>Conv Block {index + 1}</strong>
              <span>Filters: {block.filters}</span>
              <span>Kernel: {block.kernelSize}</span>
              <span>Stride: {block.stride}</span>
              <span>Pool: {block.poolSize}</span>
              <span>Activation: {block.activation}</span>
              <span>Dropout: {block.dropout}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const layerSizes = [formState.annInputSize, ...formState.annHiddenLayers.map((layer) => layer.units), formState.annOutputSize].map(
    (value) => {
      const numeric = Number(value)
      return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
    },
  )

  const width = 620
  const height = 240
  const marginX = 50
  const marginY = 24
  const columnGap = (width - marginX * 2) / (layerSizes.length - 1)

  return (
    <div className="architecture-preview">
      <svg viewBox={`0 0 ${width} ${height}`} className="architecture-svg" role="img" aria-label="ANN architecture preview">
        {layerSizes.map((size, columnIndex) => {
          const x = marginX + columnIndex * columnGap
          const visibleNodes = Math.min(7, size)
          const verticalGap = visibleNodes > 1 ? (height - marginY * 2) / (visibleNodes - 1) : 0

          return Array.from({ length: visibleNodes }).map((_, nodeIndex) => {
            const y = marginY + nodeIndex * verticalGap

            if (columnIndex < layerSizes.length - 1) {
              const nextVisible = Math.min(7, layerSizes[columnIndex + 1])
              const nextX = marginX + (columnIndex + 1) * columnGap
              const nextGap = nextVisible > 1 ? (height - marginY * 2) / (nextVisible - 1) : 0

              return (
                <g key={`${columnIndex}-${nodeIndex}`}>
                  {Array.from({ length: nextVisible }).map((__, nextIndex) => {
                    const nextY = marginY + nextIndex * nextGap
                    return (
                      <line
                        key={`${columnIndex}-${nodeIndex}-${nextIndex}`}
                        x1={x}
                        y1={y}
                        x2={nextX}
                        y2={nextY}
                        className="architecture-line"
                      />
                    )
                  })}
                  <circle cx={x} cy={y} r="4.5" className="architecture-node" />
                </g>
              )
            }

            return <circle key={`${columnIndex}-${nodeIndex}`} cx={x} cy={y} r="4.5" className="architecture-node" />
          })
        })}
      </svg>
      <div className="architecture-labels">
        <span>Input {formState.annInputSize}</span>
        <span>Hidden {formState.annHiddenLayers.length}</span>
        <span>Output {formState.annOutputSize}</span>
      </div>
      <div className="architecture-meta-grid">
        <div className="architecture-meta-card">
          <strong>Input Layer</strong>
          <span>Units: {formState.annInputSize}</span>
        </div>
        {formState.annHiddenLayers.map((layer, index) => (
          <div key={`preview-ann-${index}`} className="architecture-meta-card">
            <strong>Hidden Layer {index + 1}</strong>
            <span>Units: {layer.units}</span>
            <span>Activation: {layer.activation}</span>
            <span>Dropout: {layer.dropout}</span>
          </div>
        ))}
        <div className="architecture-meta-card">
          <strong>Output Layer</strong>
          <span>Units: {formState.annOutputSize}</span>
          <span>Activation: {formState.annOutputActivation}</span>
        </div>
      </div>
    </div>
  )
}
