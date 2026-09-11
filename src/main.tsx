import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GhostNav Uncaught Error:', error, errorInfo);
  }

  handleReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex w-screen h-screen items-center justify-center bg-slate-950 text-slate-100 p-6">
          <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl shadow-rose-500/20">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 font-bold text-xl">
              ⚠️
            </div>
            <h2 className="font-orbitron font-black text-xl text-white tracking-wider uppercase">
              NAVIGATION RECOVERY CONSOLE
            </h2>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              A temporary initialization error occurred. Tapping below will reset local telemetry cache and reboot the tactical navigation grid.
            </p>
            {this.state.error && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-rose-300 text-left overflow-x-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-orbitron font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
            >
              🔄 Reboot Navigation System
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
