const PRESETS = [
    { name: "Happy Path", warehouse: "normal", inventory: "in_stock", carrier: "standard", historical: "reliable" },
    { name: "Busy Warehouse", warehouse: "busy", inventory: "in_stock", carrier: "standard", historical: "average" },
    { name: "Low Stock", warehouse: "normal", inventory: "low_stock", carrier: "fast", historical: "reliable" },
    { name: "Out of Stock", warehouse: "normal", inventory: "out_of_stock", carrier: "standard", historical: "average" },
    { name: "Slow Transit", warehouse: "normal", inventory: "in_stock", carrier: "slow", historical: "unreliable" },
    { name: "Warehouse Down", warehouse: "down", inventory: "in_stock", carrier: "standard", historical: "average" }
];

document.addEventListener('DOMContentLoaded', () => {
    initPresets();
    initHistory();
    
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
    document.getElementById('scenario-warehouse').value = p.warehouse;
    document.getElementById('scenario-inventory').value = p.inventory;
    document.getElementById('scenario-carrier').value = p.carrier;
    document.getElementById('scenario-historical').value = p.historical;
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
    
    const payload = {
        warehouseId: document.getElementById('warehouse-id').value,
        serviceLevel: document.getElementById('service-level').value,
        items: [{ sku: "SKU-TEST-01", qty: 1 }],
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const duration = Math.round(performance.now() - startTime);
        
        if (response.ok) {
            renderResults(data, duration);
            addToHistory(data, duration);
        } else {
            throw new Error(data.error || 'Request failed');
        }
    } catch (err) {
        errorBox.innerText = `Error: ${err.message}`;
        errorBox.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}

function renderResults(data, duration) {
    const results = document.getElementById('results-content');
    results.classList.remove('hidden');
    
    document.getElementById('edd-date').innerText = data.edd || 'N/A';
    document.getElementById('timer').innerText = `Response time: ${duration}ms`;
    
    const confBar = document.getElementById('confidence-bar');
    confBar.style.width = `${data.confidence}%`;
    document.getElementById('confidence-value').innerText = `${data.confidence}%`;
    
    confBar.style.backgroundColor = data.confidence > 90 ? '#10b981' : (data.confidence > 70 ? '#f59e0b' : '#ef4444');

    const breakdownBody = document.getElementById('breakdown-body');
    breakdownBody.innerHTML = '';
    if (data.breakdown) {
        Object.entries(data.breakdown).forEach(([key, val]) => {
            const row = `<tr><td>${key.replace('_', ' ')}</td><td>${val}</td></tr>`;
            breakdownBody.innerHTML += row;
        });
    }

    const warnings = document.getElementById('warnings');
    warnings.innerHTML = '';
    if (data.warnings) {
        data.warnings.forEach(w => {
            warnings.innerHTML += `<div class="warning-item">${w}</div>`;
        });
    }

    document.getElementById('raw-json').innerText = JSON.stringify(data, null, 2);
}

function addToHistory(data, duration) {
    const history = JSON.parse(localStorage.getItem('edd_history') || '[]');
    const item = {
        time: new Date().toLocaleTimeString(),
        wh: data.metadata?.warehouse_name || '?',
        edd: data.edd || 'ERROR',
        conf: data.confidence,
        lat: duration
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
        tbody.innerHTML += `
            <tr>
                <td>${item.time}</td>
                <td>${item.wh}</td>
                <td>${item.edd}</td>
                <td>${item.conf}%</td>
                <td>${item.lat}ms</td>
                <td><button onclick="alert('Re-run not implemented')">Re-run</button></td>
            </tr>
        `;
    });
}
