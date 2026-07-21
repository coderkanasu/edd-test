/**
 * Core Data Contracts for EDD Engine
 * Based on REQ-EDD-001 and REQ-EDD-002
 */

const Schemas = {
    // Input Request Schema (REQ-EDD-004)
    OrderRequest: {
        warehouse_id: "string (matches ^WH-[A-Z]{1,3}-\\d{2}$)",
        items: "array of {sku: string, quantity: number}",
        shipping_address: "{street: string, city: string, state: string, zip: string, country: string}",
        customer_segment: "enum: standard, premium, enterprise",
        preferred_service_level: "enum: ground, express, overnight",
        order_placed_at: "ISO8601 string"
    },

    // Upstream Data Contracts (REQ-EDD-002)
    WmsMetrics: {
        warehouse_id: "string",
        queue_depth: "number",
        avg_wait_minutes: "number",
        status: "enum: OPERATIONAL, DEGRADED, DOWN"
    },

    InventoryStatus: {
        sku: "string",
        available: "number",
        reserved: "number",
        status: "enum: IN_STOCK, LOW_STOCK, OUT_OF_STOCK, BACKORDER"
    },

    CarrierTransit: {
        origin_zip: "string",
        dest_zip: "string",
        service_level: "string",
        transit_days_p95: "number",
        holiday_delays: "array of ISO dates"
    },

    // Engine Output Schema (REQ-EDD-001)
    EddResponse: {
        edd_date: "ISO8601 date string",
        confidence_level: "number (0.0-1.0)",
        breakdown: {
            processing_days: "number",
            transit_days: "number",
            buffer_days: "number",
            holiday_adjustment_days: "number"
        },
        data_freshness: {
            warehouse_metrics_age_seconds: "number",
            inventory_check_timestamp: "ISO8601",
            carrier_data_cached: "boolean"
        },
        warnings: "array of strings",
        calculation_version: "string (semver)",
        request_id: "uuid-v4"
    }
};

module.exports = Schemas;
