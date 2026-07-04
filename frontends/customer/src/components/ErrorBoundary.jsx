import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[DashZW] UI crash:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white text-slate-900">
          <p className="text-lg font-bold mb-2">Something went wrong</p>
          <p className="text-sm text-slate-600 mb-4 text-center max-w-md">
            {this.state.error.message || String(this.state.error)}
          </p>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-semibold"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
