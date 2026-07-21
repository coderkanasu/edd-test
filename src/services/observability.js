/**
 * Observability Service
 * Mocks structured logging and Prometheus-style metrics.
 * (REQ-EDD-006)
 */

class ObservabilityService {
    constructor() {
        this.metrics = {
            requests_total: 0,
            cache_hits: 0,
            cache_misses: 0,
            errors_total: 0,
            latencies: []
        };
    }

    /**
     * Structured JSON Logger
     */
    log(level, message, context = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...context,
            service: 'edd-engine-poc'
        };
        console.log(JSON.stringify(logEntry));
    }

    /**
     * Metrics Tracker
     */
    recordRequest(method, path, status, duration, cached = false) {
        this.metrics.requests_total++;
        if (cached) this.metrics.cache_hits++;
        else this.metrics.cache_misses++;
        
        if (status >= 400) this.metrics.errors_total++;
        
        this.metrics.latencies.push(duration);
        if (this.metrics.latencies.length > 100) this.metrics.latencies.shift();
    }

    getPrometheusMetrics() {
        const avgLatency = this.metrics.latencies.length > 0 
            ? this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length 
            : 0;

        return `# HELP edd_requests_total Total number of requests
# TYPE edd_requests_total counter
edd_requests_total ${this.metrics.requests_total}

# HELP edd_cache_hits_total Total number of cache hits
# TYPE edd_cache_hits_total counter
edd_cache_hits_total ${this.metrics.cache_hits}

# HELP edd_request_duration_ms_avg Average request duration
# TYPE edd_request_duration_ms_avg gauge
edd_request_duration_ms_avg ${avgLatency.toFixed(2)}

# HELP edd_errors_total Total number of error responses
# TYPE edd_errors_total counter
edd_errors_total ${this.metrics.errors_total}
`;
    }
}

module.exports = new ObservabilityService();
