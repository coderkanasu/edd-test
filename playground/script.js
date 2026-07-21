const PRESETS = [
    { name: "Happy Path", warehouse: "normal", inventory: "in_stock", carrier: "standard", historical: "reliable" },
    { name: "Busy Warehouse", warehouse: "busy", inventory: "in_stock", carrier: "standard", historical: "average" },
    { name: "Low Stock", warehouse: "normal", inventory: "low_stock", carrier: "standard", historical: "reliable" },
    { name: "Out of Stock", warehouse: "normal", inventory: "out_of_stock", carrier: "standard", historical: "average" },
    { name: "Slow Transit", warehouse: "normal", inventory: "in_stock", carrier: "slow", historical: "unreliable" },
    { name: "Warehouse Down", warehouse: "down", inventory: "in_stock", carrier: "standard", historical: "average" }
];

document.addEventListener('DOMContentLoaded', () => {
    initPresets();
    initHistory();
    // Auto-populate first preset
    applyPreset(PRESETS[0]);
    document.getElementById('edd-form').addEventListener('submit', calculateEDD);
});

function initPresets() {
    const container = document.getElementById('preset-buttons');
    PRESETS.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        btn.innerText = p.name;
        btn.onclick = (e) => {
            e.preventDefault();
            applyPreset(p);
        };
        container.appendChild(btn);
    });
}

function applyPreset(p) {
    // Remove active class from all preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    
    // Add active class to the clicked button (finding by name)
    const buttons = document.querySelectorAll('.preset-btn');
    buttons.forEach(btn => {
        if (btn.innerText === p.name) btn.classList.add('active');
    });

    document.getElementById('scenario-warehouse').value = p.warehouse;
    document.getElementById('scenario-inventory').value = p.inventory;
    document.getElementById('scenario-carrier').value = p.carrier;
    document.getElementById('scenario-historical').value = p.historical;
}

function addItemRow() {
    const container = document.getElementById('items-container');
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
        <input type="text" placeholder="SKU" class="item-sku">
        <input type="number" placeholder="Qty" class="item-qty" value="1">
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(div);
}

async function calculateEDD(e) {
    e.preventDefault();
    
    const startTime = performance.now();
    const loading = document.getElementById('loading');
    const results = document.getElementById('results-content');
    const errorBox = document.getElementById('error');
    
    loading.classList.remove('hidden');
    results.classList.add('hidden');
    errorBox.classList.add('hidden');
    
    const baseUrl = document.getElementById('api-base-url').value;
    const isMock = document.querySelector('input[name="mode"]:checked').value === 'mock';
    
    // Gather Items
    const itemRows = document.querySelectorAll('.item-row');
    const items = Array.from(itemRows).map(row => ({
        sku: row.querySelector('.item-sku').value,
        quantity: parseInt(row.querySelector('.item-qty').value)
    })).filter(i => i.sku);

    const payload = {
        warehouseId: document.getElementById('warehouse-id').value,
        serviceLevel: document.getElementById('service-level').value,
        customerSegment: document.getElementById('customer-segment').value,
        shippingAddress: {
            city: document.getElementById('ship-city').value,
            state: document.getElementById('ship-state').value,
            zip: document.getElementById('ship-zip').value
        },
        items: items,
        scenarios: {
            warehouse: document.getElementById('scenario-warehouse').value,
            inventory: document.getElementById('scenario-inventory').value,
            carrier: document.getElementById('scenario-carrier').value,
            historical: document.getElementById('scenario-historical').value
        }
    };

    try {
        const response = await fetch(`${baseUrl}/api/calculate-edd?mock=${isMock}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': 'EDD-TEST-KEY-2026'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const duration = Math.round(performance.now() - startTime);
        
        if (response.ok) {
            renderResults(data, duration);
            addToHistory(payload, data, duration);
        } else {
            // Render partial results for errors if metadata exists (e.g. status code 422 with warnings)
            renderResults(data, duration, true);
            throw new Error(data.message || data.error || 'Request failed');
        }
    } catch (err) {
        errorBox.innerText = `Error: ${err.message}`;
        errorBox.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}

function renderResults(data, duration, isError = false) {
    const results = document.getElementById('results-content');
    results.classList.remove('hidden');
    
    document.getElementById('edd-date').innerText = data.edd || (isError ? 'ABORTED' : 'N/A');
    document.getElementById('timer').innerText = `Response time: ${duration}ms`;
    
    const confBar = document.getElementById('confidence-bar');
    const score = data.confidence || 0;
    confBar.style.width = `${score}%`;
    document.getElementById('confidence-value').innerText = `${score}%`;
    confBar.style.backgroundColor = score > 90 ? '#10b981' : (score > 70 ? '#f59e0b' : '#ef4444');

    const breakdownBody = document.getElementById('breakdown-body');
    breakdownBody.innerHTML = '';
    if (data.breakdown) {
        Object.entries(data.breakdown).forEach(([key, val]) => {
            const row = `<tr><td>${key.replace('_', ' ')}</td><td>${val}</td></tr>`;
            breakdownBody.innerHTML += row;
        });
    }

    // Warnings
    const warnContainer = document.getElementById('warnings-container');
    warnContainer.innerHTML = '';
    if (data.warnings && data.warnings.length > 0) {
        warnContainer.classList.remove('hidden');
        data.warnings.forEach(w => {
            warnContainer.innerHTML += `<div class="warning-item">⚠️ ${w}</div>`;
        });
    } else {
        warnContainer.classList.add('hidden');
    }

    // Freshness Badge
    const badge = document.getElementById('freshness-badge');
    const freshness = data.data_freshness || {};
    badge.innerText = `Source: ${freshness.source || 'mock'} | ${freshness.timestamp ? new Date(freshness.timestamp).toLocaleTimeString() : '--'}`;
    badge.className = `badge ${data.metadata?.cache_info?.wms ? 'badge-cached' : 'badge-fresh'}`;

    document.getElementById('raw-json').innerText = JSON.stringify(data, null, 2);
}

function addToHistory(payload, data, duration) {
    const history = JSON.parse(localStorage.getItem('edd_history') || '[]');
    const item = {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        wh: payload.warehouseId,
        edd: data.edd || 'ERROR',
        conf: data.confidence || 0,
        lat: duration,
        payload: payload // Store for re-run
    };
    
    history.unshift(item);
    localStorage.setItem('edd_history', JSON.stringify(history.slice(0, 10)));
    renderHistory();
}

function initHistory() { renderHistory(); }

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('edd_history') || '[]');
    const tbody = document.querySelector('#history-table tbody');
    tbody.innerHTML = '';
    history.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.time}</td>
            <td>${item.wh}</td>
            <td>${item.edd}</td>
            <td>${item.conf}%</td>
            <td>${item.lat}ms</td>
            <td><button class="btn-small" onclick="rerunHistory(${item.id})">Re-run</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.rerunHistory = function(id) {
    const history = JSON.parse(localStorage.getItem('edd_history') || '[]');
    const item = history.find(i => i.id === id);
    if (!item) return;

    // Apply payload to form
    const p = item.payload;
    document.getElementById('warehouse-id').value = p.warehouseId;
    document.getElementById('service-level').value = p.serviceLevel;
    document.getElementById('customer-segment').value = p.customerSegment || 'standard';
    document.getElementById('ship-city').value = p.shippingAddress.city;
    document.getElementById('ship-state').value = p.shippingAddress.state;
    document.getElementById('ship-zip').value = p.shippingAddress.zip;
    
    if (p.scenarios) {
        document.getElementById('scenario-warehouse').value = p.scenarios.warehouse;
        document.getElementById('scenario-inventory').value = p.scenarios.inventory;
        document.getElementById('scenario-carrier').value = p.scenarios.carrier;
        document.getElementById('scenario-historical').value = p.scenarios.historical;
    }

    // Rebuild items
    const container = document.getElementById('items-container');
    container.innerHTML = '';
    p.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.innerHTML = `
            <input type="text" placeholder="SKU" class="item-sku" value="${item.sku}">
            <input type="number" placeholder="Qty" class="item-qty" value="${item.quantity}">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(div);
    });

    // Trigger submit
    document.getElementById('edd-form').dispatchEvent(new Event('submit'));
};
