import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Toast } from '../Toast/Toast'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('render error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-dvh flex flex-col items-center justify-center gap-4 bg-white px-6 text-center text-secondary">
          <button
            className="px-4 py-2 rounded-lg bg-secondary text-white text-sm"
            onClick={() => window.location.reload()}
          >
            再読込
          </button>
          <Toast message="画面の表示中にエラーが発生しました" />
        </div>
      )
    }

    return this.props.children
  }
}
