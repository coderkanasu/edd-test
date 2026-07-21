/**
 * Data Ingestion Service
 * Handles parallel fetching of data from upstream mocks with resilience logic.
 * (REQ-EDD-002, REQ-EDD-005)
 */

const Schemas = require('../models/schemas');
const cache = require('./cache');

class DataIngestionService {
    constructor() {
        this.timeout = 2000; // 2s timeout per req
        this.maxRetries = 2;
    }

    /**
     * Simulated parallel fetch with resilience and caching
     */
    async fetchAll(warehouseId, items) {
        console.log(`[Ingestion] Data gathering for ${warehouseId}...`);

        // Check Cache first
        const cachedWms = cache.get('warehouse', warehouseId);
        const cachedCarrier = cache.get('carrier', warehouseId);

        const tasks = [
            cachedWms ? Promise.resolve(cachedWms) : this.fetchWmsMetrics(warehouseId),
            this.fetchInventoryStatus(items), // Inventory always fresh for PoC
            cachedCarrier ? Promise.resolve(cachedCarrier) : this.fetchCarrierData(warehouseId)
        ];

        const results = await Promise.allSettled(tasks);

        const wms = this.unwrap(results[0], 'WMS');
        const inventory = this.unwrap(results[1], 'Inventory');
        const carrier = this.unwrap(results[2], 'Carrier');

        // Update Cache if fetched fresh
        if (!cachedWms && !wms.error) cache.set('warehouse', warehouseId, wms);
        if (!cachedCarrier && !carrier.error) cache.set('carrier', warehouseId, carrier);

        return {
            wms,
            inventory,
            carrier,
            timestamp: new Date().toISOString(),
            cache_hits: {
                wms: !!cachedWms,
                carrier: !!cachedCarrier
            }
        };
    }

    unwrap(result, source) {
        if (result.status === 'fulfilled') return result.value;
        console.warn(`[Ingestion] ${source} fetch failed:`, result.reason);
        return { error: true, source, message: result.reason };
    }

    // Mock Upstream Calls with simulated delay/failure
    async fetchWmsMetrics(id) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    warehouse_id: id,
                    queue_depth: Math.floor(Math.random() * 500),
                    status: Math.random() > 0.9 ? 'DEGRADED' : 'OPERATIONAL'
                });
            }, 100);
        });
    }

    async fetchInventoryStatus(items) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(items.map(item => ({
                    sku: item.sku,
                    status: 'IN_STOCK',
                    available: 100
                })));
            }, 150);
        });
    }

    async fetchCarrierData(id) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    service_level: 'ground',
                    transit_days_p95: 3,
                    carrier_name: 'FedEx'
                });
            }, 50);
        });
    }
}

module.exports = new DataIngestionService();
