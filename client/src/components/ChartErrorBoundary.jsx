import { Component } from 'react';

export default class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="dan-chart-fallback" role="status">
          <p>Chart unavailable</p>
        </div>
      );
    }
    return this.props.children;
  }
}
