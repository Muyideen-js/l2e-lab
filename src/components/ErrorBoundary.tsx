import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcw, AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      this.setState({ errorInfo })
    }
    console.error('[L2E LAB] Render error:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="error-boundary" role="alert" aria-live="assertive">
          <div className="error-boundary__content">
            <span className="error-boundary__icon"><AlertTriangle size={32} /></span>
            <h1>Something went wrong.</h1>
            <p className="error-boundary__message">
              This part of L2E LAB did not render correctly. Reloading the page will reset your workspace.
            </p>
            <div className="error-boundary__actions">
              <button
                className="pl-button pl-button--primary"
                onClick={() => {
                  window.location.reload()
                }}
              >
                <RotateCcw size={16} /> Reload and reset
              </button>
              <button
	      	type="button"
                className="pl-button pl-button--secondary"
                onClick={this.resetError}
              >
                Try again
              </button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <details className="error-boundary__details">
                <summary>Technical details</summary>
                <pre>{this.state.error.message}</pre>
                <pre>{this.state.errorInfo?.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
