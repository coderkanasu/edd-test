const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use('/playground', express.static(path.join(__dirname, '../playground')));

// Load mock fixtures
const mockData = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/mock-data.json'), 'utf8'));

/**
 * EDD Calculation Endpoint (Mock-first for MVP)
 */
app.post('/api/calculate-edd', (req, res) => {
    const isMockMode = process.env.MOCK_MODE === 'true' || req.headers['x-mock-mode'] === 'true' || req.query.mock === 'true';
    
    if (!isMockMode) {
        return res.status(501).json({ error: "Live mode not implemented. Use mock=true" });
    }

    const { warehouseId, serviceLevel, items, scenarios = {} } = req.body;
    
    // Default scenarios if not provided
    const warehouseScenario = scenarios.warehouse || 'normal';
    const inventoryScenario = scenarios.inventory || 'in_stock';
    const carrierScenario = scenarios.carrier || 'standard';
    const historicalScenario = scenarios.historical || 'reliable';

    // Mock logic: derive a date based on scenarios
    const warehouse = mockData.warehouses.find(w => w.id === warehouseId) || mockData.warehouses[0];
    const whStatus = warehouse.scenarios[warehouseScenario];
    
    if (whStatus.status === 'DOWN') {
        return res.json({
            edd: null,
            confidence: 0,
            status: "ERROR",
            warnings: [`Warehouse ${warehouseId} is currently DOWN. Cannot fulfill.`],
            data_freshness: { source: "mock", timestamp: new Date().toISOString() }
        });
    }

    // Base processing time based on warehouse queue
    let processingDays = Math.ceil(whStatus.queue_depth / 100) + 1;
    
    // Transit days based on carrier scenario
    const transit = mockData.carrier_scenarios[carrierScenario];
    let transitDays = transit.transit_days_p95;
    
    // Inventory delay
    let inventoryDelay = 0;
    if (inventoryScenario === 'backorder') inventoryDelay = 7;
    else if (inventoryScenario === 'low_stock') inventoryDelay = 1;
    else if (inventoryScenario === 'out_of_stock') inventoryDelay = 14;

    const totalDays = processingDays + transitDays + inventoryDelay;
    const eddDate = new Date();
    eddDate.setDate(eddDate.getDate() + totalDays);

    // Confidence calculation
    let confidence = 0.95;
    if (historicalScenario === 'unreliable') confidence -= 0.3;
    if (warehouseScenario === 'degraded') confidence -= 0.15;
    if (inventoryScenario === 'low_stock') confidence -= 0.1;

    res.json({
        edd: eddDate.toISOString().split('T')[0],
        confidence: Math.round(confidence * 100),
        breakdown: {
            processing: processingDays,
            transit: transitDays,
            inventory_delay: inventoryDelay,
            buffer: 1,
            total: totalDays + 1
        },
        metadata: {
            warehouse_name: warehouse.name,
            carrier_level: serviceLevel,
            mode: "mock"
        },
        warnings: inventoryScenario === 'backorder' ? ["Items are on backorder. Expect delays."] : [],
        data_freshness: {
            source: "mock_data",
            timestamp: new Date().toISOString()
        }
    });
});

app.listen(PORT, () => {
    console.log(`EDD Mock Server running at http://localhost:${PORT}`);
    console.log(`Playground available at http://localhost:${PORT}/playground/index.html`);
});
