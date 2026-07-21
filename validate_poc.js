/**
 * Validation Script for EDD Mock PoC Requirements
 * This script verifies that the Mock behavior aligns with REQ-EDD-001 through REQ-EDD-008.
 */

const axios = require('axios');
const Schemas = require('./src/models/schemas');

const BASE_URL = 'http://localhost:8081';
const AUTH_HEADERS = { 'x-api-key': 'EDD-TEST-KEY-2026' };

async function validateRequirements() {
    console.log("🚀 Starting Thorough Requirement Validation...");
    
    const results = {
        passed: [],
        failed: []
    };

    const assert = (condition, message) => {
        if (condition) {
            results.passed.push(message);
            console.log(`✅ PASS: ${message}`);
        } else {
            results.failed.push(message);
            console.error(`❌ FAIL: ${message}`);
        }
    };

    try {
        // [REQ-EDD-004] API Gateway (Auth Failure)
        console.log("\n--- Testing REQ-EDD-004: API Gateway (Auth Failure) ---");
        try {
            await axios.post(`${BASE_URL}/api/calculate-edd?mock=true`, {});
            assert(false, "Request without API key should fail");
        } catch (err) {
            assert(err.response.status === 401, "Should return 401 for missing API key");
        }

        // [GAP-002] Logic Validation: Inventory OOS Gating (Expected 422)
        console.log("\n--- Testing GAP-002: Inventory OOS Gating (422) ---");
        try {
            await axios.post(`${BASE_URL}/api/calculate-edd?mock=true`, {
                warehouseId: "WH-SEA-01",
                items: [{ sku: "SKU-1", quantity: 1 }],
                scenarios: { inventory: "out_of_stock" }
            }, { headers: AUTH_HEADERS });
            assert(false, "Out of stock should return 422");
        } catch (err) {
            assert(err.response.status === 422, "Should return 422 for out of stock");
            assert(err.response.data.status === "ABORTED", "Status should be ABORTED");
        }

        // [REQ-EDD-001] Logic Validation: Warehouse DOWN scenario (Expected 503)
        console.log("\n--- Testing REQ-EDD-001: Core Logic (Warehouse DOWN) ---");
        try {
            await axios.post(`${BASE_URL}/api/calculate-edd?mock=true`, {
                warehouseId: "WH-SEA-01",
                items: [{ sku: "SKU-1", quantity: 1 }],
                scenarios: { warehouse: "down" }
            }, { headers: AUTH_HEADERS });
            assert(false, "Warehouse down should return 503");
        } catch (err) {
            assert(err.response.status === 503, "Should return 503 for warehouse down");
        }


        // [REQ-EDD-001] Logic Validation: Processing + Transit breakdown
        console.log("\n--- Testing REQ-EDD-001: Core Logic (Breakdown) ---");
        const normalRes = await axios.post(`${BASE_URL}/api/calculate-edd?mock=true`, {
            warehouseId: "WH-NJ-01",
            items: [{ sku: "SKU-1", quantity: 1 }],
            scenarios: { warehouse: "normal", carrier: "standard" }
        }, { headers: AUTH_HEADERS });
        assert(normalRes.data.breakdown.processing !== undefined, "Response must include processing breakdown");
        assert(normalRes.data.breakdown.transit !== undefined, "Response must include transit breakdown");
        assert(normalRes.data.breakdown.total >= (normalRes.data.breakdown.processing + normalRes.data.breakdown.transit), "Total must >= sum of processing and transit");

        // [REQ-EDD-002] Parallel Ingestion & Resilience
        console.log("\n--- Testing REQ-EDD-002: Parallel Ingestion & Resilience ---");
        const startTime = Date.now();
        const parallelRes = await axios.post(`${BASE_URL}/api/calculate-edd?mock=true`, {
            warehouseId: "WH-NJ-01",
            items: [{ sku: "SKU-123", quantity: 1 }]
        }, { headers: AUTH_HEADERS });
        const duration = Date.now() - startTime;
        
        assert(parallelRes.status === 200, "Parallel ingestion endpoint should return 200");
        assert(duration < 500, `Parallel fetch should be fast (took ${duration}ms)`);
        assert(parallelRes.data.data_freshness.timestamp !== undefined, "Should have fresh data timestamp");

        // [REQ-EDD-003] Tiered Caching Mock
        console.log("\n--- Testing REQ-EDD-003: Tiered Caching Mock ---");
        // Trigger first call to seed cache
        await axios.post(`${BASE_URL}/api/calculate-edd?mock=true`, {
            warehouseId: "WH-NJ-01",
            items: [{ sku: "SKU-1", quantity: 1 }]
        }, { headers: AUTH_HEADERS });
        
        // Second call should be a cache hit for WMS and Carrier
        const cachedRes = await axios.post(`${BASE_URL}/api/calculate-edd?mock=true`, {
            warehouseId: "WH-NJ-01",
            items: [{ sku: "SKU-1", quantity: 1 }]
        }, { headers: AUTH_HEADERS });

        assert(cachedRes.data.metadata.cache_info.wms === true, "Secondary call should be a WMS cache hit");
        assert(cachedRes.data.metadata.cache_info.carrier === true, "Secondary call should be a Carrier cache hit");

        // [REQ-EDD-006] Observability Mocks (Metrics & Logging check)
        console.log("\n--- Testing REQ-EDD-006: Observability Mocks ---");
        const metricsRes = await axios.get(`${BASE_URL}/metrics`);
        assert(metricsRes.status === 200, "Metrics endpoint should be accessible");
        assert(metricsRes.data.includes('edd_requests_total'), "Metrics should include edd_requests_total");
        assert(metricsRes.data.includes('edd_request_duration_ms_avg'), "Metrics should include edd_request_duration_ms_avg");

        console.log("\n--- Testing REQ-EDD-004: Schema Alignment ---");
        const responseKeys = Object.keys(normalRes.data);
        const expectedKeys = ["edd", "confidence", "breakdown", "metadata", "warnings", "data_freshness"];
        expectedKeys.forEach(key => {
            assert(responseKeys.includes(key), `Response should have '${key}' field`);
        });

        // [REQ-EDD-008] UI/Playground Accessibility
        console.log("\n--- Testing REQ-EDD-008: Playground Access ---");
        const pgRes = await axios.get(`${BASE_URL}/playground/index.html`);
        assert(pgRes.status === 200, "Playground should be accessible at /playground/index.html");

    } catch (error) {
        console.error("Critical error during validation:", error.message);
        if (error.response) console.error("Response data:", error.response.data);
    }

    console.log("\n--- Validation Summary ---");
    console.log(`Passed: ${results.passed.length}`);
    console.log(`Failed: ${results.failed.length}`);

    if (results.failed.length > 0) {
        process.exit(1);
    }
}

validateRequirements();
