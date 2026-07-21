/**
 * API Gateway Middleware
 * Mocks authentication, request validation, and rate limiting.
 * (REQ-EDD-004)
 */

class ApiGateway {
    constructor() {
        this.validApiKeys = ['EDD-TEST-KEY-2026', 'POC-DEMO-AUTH'];
        this.rateLimits = new Map(); // Store simplistic rate limit info
    }

    /**
     * Authentication Middleware
     */
    authenticate(req, res, next) {
        // Skip auth for playground, metrics, or if explicitly disabled for testing
        if (req.path.startsWith('/playground') || req.path === '/metrics' || req.headers['x-skip-auth'] === 'true') {
            return next();
        }

        const apiKey = req.headers['x-api-key'];
        if (!apiKey || !this.validApiKeys.includes(apiKey)) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "A valid X-API-KEY header is required.",
                docs: "/playground/api-guide.html"
            });
        }
        next();
    }

    /**
     * Rate Limiting Middleware (Mock)
     */
    rateLimiter(req, res, next) {
        const apiKey = req.headers['x-api-key'] || req.ip;
        const now = Date.now();
        const limit = 50; // 50 requests per minute
        const window = 60 * 1000;

        let userQuota = this.rateLimits.get(apiKey) || { count: 0, reset: now + window };

        if (now > userQuota.reset) {
            userQuota = { count: 1, reset: now + window };
        } else {
            userQuota.count++;
        }

        this.rateLimits.set(apiKey, userQuota);

        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - userQuota.count));
        res.setHeader('X-RateLimit-Reset', userQuota.reset);

        if (userQuota.count > limit) {
            return res.status(429).json({
                error: "Too Many Requests",
                message: `Rate limit exceeded. Try again in ${Math.ceil((userQuota.reset - now)/1000)}s`
            });
        }
        next();
    }

    /**
     * Payload Validation Middleware
     */
    validateRequest(req, res, next) {
        const { warehouseId, items } = req.body;
        
        if (!warehouseId || !warehouseId.match(/^WH-[A-Z0-9-]+$/)) {
            return res.status(400).json({
                error: "Bad Request",
                message: "Invalid warehouseId format. Expected WH-[REGION]-[ID]"
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: "Bad Request",
                message: "Items array is required and cannot be empty."
            });
        }

        next();
    }
}

module.exports = new ApiGateway();
