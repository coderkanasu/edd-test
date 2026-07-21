const express = require('express');
const path = require('path');
const fs = require('fs');
const ingestionService = require('./services/ingestion');
const gateway = require('./services/gateway');
const obs = require('./services/observability');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// REQ-EDD-006: Observability Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        obs.recordRequest(req.method, req.path, res.statusCode, duration);
        obs.log('INFO', `Request processed: ${req.method} ${req.path}`, {
            status: res.statusCode,
            duration_ms: duration,
            ip: req.ip
        });
    });
    next();
});

// REQ-EDD-004: Global Gateway Mocks
app.use((req, res, next) => gateway.authenticate(req, res, next));
app.use((req, res, next) => gateway.rateLimiter(req, res, next));

app.use('/playground', express.static(path.join(__dirname, '../playground')));

// REQ-EDD-006: Metrics Endpoint
app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(obs.getPrometheusMetrics());
});

// Load mock fixtures
const mockData = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/mock-data.json'), 'utf8'));

/**
 * EDD Calculation Endpoint (Mock-first for MVP)
 */
app.post('/api/calculate-edd', gateway.validateRequest, async (req, res) => {
    const isMockMode = process.env.MOCK_MODE === 'true' || req.headers['x-mock-mode'] === 'true' || req.query.mock === 'true';
    
    if (!isMockMode) {
        return res.status(501).json({ error: "Live mode not implemented. Use mock=true" });
    }

    const { 
        warehouseId, 
        serviceLevel, 
        items = [], 
        shippingAddress = {}, 
        customerSegment = 'standard',
        scenarios = {} 
    } = req.body;
    
    // REQ-EDD-002: Parallel Data Ingestion
    const upstreamData = await ingestionService.fetchAll(warehouseId, items);

    // [GAP-002] Inventory Gating: REQ states inventory affects viability
    const inventoryScenario = scenarios.inventory || (upstreamData.inventory.some(i => i.status === 'OUT_OF_STOCK') ? 'out_of_stock' : 'in_stock');
    
    if (inventoryScenario === 'out_of_stock') {
        return res.status(422).json({
            error: "Inventory Unfulfillable",
            message: "One or more items are out of stock. Calculation aborted.",
            status: "ABORTED",
            warnings: ["OUT_OF_STOCK_GATE_TRIGGERED"]
        });
    }

    // Default scenarios if not provided
    const warehouseScenario = scenarios.warehouse || (upstreamData.wms.status === 'DEGRADED' ? 'degraded' : 'normal');
    const carrierScenario = scenarios.carrier || 'standard';
    const historicalScenario = scenarios.historical || 'reliable';

    const warehouse = mockData.warehouses.find(w => w.id === warehouseId) || mockData.warehouses[0];
    const whStatus = warehouse.scenarios[warehouseScenario];
    
    if (whStatus.status === 'DOWN') {
        return res.status(503).json({
            error: "Service Unavailable",
            message: `Warehouse ${warehouseId} is currently DOWN.`,
            status: "ERROR",
            warnings: [`Warehouse ${warehouseId} is currently DOWN.`]
        });
    }

    // Base processing time with segment multiplier
    let segmentMultiplier = 1.0;
    if (customerSegment === 'premium') segmentMultiplier = 0.8;
    if (customerSegment === 'enterprise') segmentMultiplier = 0.5;

    let processingDays = Math.ceil((whStatus.queue_depth / 100) * segmentMultiplier) + 1;
    
    // Transit days based on carrier scenario AND destination zip parity (simple mock)
    const transit = mockData.carrier_scenarios[carrierScenario];
    let transitDays = transit.transit_days_p95;
    
    // Simple mock logic: if zip starts with same digit as WH, it's local (shorten transit)
    if (shippingAddress.zip && shippingAddress.zip[0] === warehouseId.split('-')[1][0]) {
        transitDays = Math.max(1, transitDays - 1);
    }

    const bufferDays = (customerSegment === 'standard') ? 1 : 0;
    const totalDays = processingDays + transitDays + bufferDays;
    
    const eddDate = new Date();
    eddDate.setDate(eddDate.getDate() + totalDays);

    // Confidence calculation (Dynamic)
    let confidence = 0.95;
    if (historicalScenario === 'unreliable') confidence -= 0.3;
    if (upstreamData.cache_hits.wms) confidence += 0.02; // Small boost for cached (stable) data
    if (warehouseScenario === 'degraded') confidence -= 0.15;
    if (inventoryScenario === 'low_stock') confidence -= 0.1;
    
    confidence = Math.max(0.1, Math.min(1.0, confidence));

    res.json({
        edd: eddDate.toISOString().split('T')[0],
        confidence: Math.round(confidence * 100),
        breakdown: {
            processing: processingDays,
            transit: transitDays,
            buffer: bufferDays,
            total: totalDays
        },
        metadata: {
            warehouse_name: warehouse.name,
            carrier_level: serviceLevel,
            customer_segment: customerSegment,
            mode: "mock",
            cache_info: upstreamData.cache_hits
        },
        warnings: inventoryScenario === 'backorder' ? ["Items are on backorder. Expect delays."] : [],
        data_freshness: {
            source: "mock_data",
            timestamp: upstreamData.timestamp
        }
    });
});

app.listen(PORT, () => {
    console.log(`EDD Mock Server running at http://localhost:${PORT}`);
    console.log(`Playground available at http://localhost:${PORT}/playground/index.html`);
});
