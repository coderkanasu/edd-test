/**
 * Tiered Caching Service
 * Mocks multi-layered caching with distinct TTLs for different data types.
 * (REQ-EDD-003)
 */

class CacheService {
    constructor() {
        this.store = new Map();
        
        // TTL Configuration (in milliseconds)
        this.ttls = {
            warehouse: 30 * 1000,     // 30 seconds
            carrier: 24 * 60 * 60 * 1000, // 24 hours
            inventory: 5 * 1000       // 5 seconds
        };
    }

    set(type, id, value) {
        const key = `${type}:${id}`;
        const ttl = this.ttls[type] || 60000;
        const expiresAt = Date.now() + ttl;
        
        this.store.set(key, { value, expiresAt });
        console.log(`[Cache] SET ${key} (TTL: ${ttl/1000}s)`);
    }

    get(type, id) {
        const key = `${type}:${id}`;
        const entry = this.store.get(key);

        if (!entry) {
            console.log(`[Cache] MISS ${key}`);
            return null;
        }

        if (Date.now() > entry.expiresAt) {
            console.log(`[Cache] EXPIRED ${key}`);
            this.store.delete(key);
            return null;
        }

        console.log(`[Cache] HIT ${key}`);
        return entry.value;
    }

    clear() {
        this.store.clear();
    }
}

module.exports = new CacheService();
