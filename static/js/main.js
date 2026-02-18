// ═══════════════════════════════════════════════════
//    PIXEL MATCHMAKING ENGINE - MAIN JAVASCRIPT
// ═══════════════════════════════════════════════════

// ── GLOBALS ──
const socket = io();
let players = [];
let currentMatch = null;
let selectedPlayer = null;

// ── INITIALIZATION ──
document.addEventListener('DOMContentLoaded', () => {
    initStarfield();
    initEventListeners();
    initSocketListeners();
    loadInitialData();
});

// ══════════════════════════════════════════════════
//              STARFIELD BACKGROUND
// ══════════════════════════════════════════════════

function initStarfield() {
    const canvas = document.getElementById('starfield');
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const stars = [];
    for (let i = 0; i < 200; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }
    
    function animate() {
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-primary');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        stars.forEach(star => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(star.x, star.y, star.size, star.size);
            
            star.y += star.speed;
            if (star.y > canvas.height) {
                star.y = 0;
                star.x = Math.random() * canvas.width;
            }
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// ══════════════════════════════════════════════════
//              EVENT LISTENERS
// ══════════════════════════════════════════════════

function initEventListeners() {
    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    speedSlider.addEventListener('input', (e) => {
        const speed = parseFloat(e.target.value);
        document.getElementById('speed-display').textContent = `${speed.toFixed(1)}x`;
        fetch('/api/simulation/speed', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({speed})
        });
    });
    
    // Simulation Controls
    document.getElementById('start-sim').addEventListener('click', startSimulation);
    document.getElementById('stop-sim').addEventListener('click', stopSimulation);
    
    // Add Player
    document.getElementById('add-player-btn').addEventListener('click', () => {
        openModal('add-modal');
    });
    
    document.getElementById('add-player-form').addEventListener('submit', handleAddPlayer);
    
    // ELO Slider Display
    document.getElementById('new-player-elo').addEventListener('input', (e) => {
        document.getElementById('elo-display').textContent = e.target.value;
    });
    
    // Modal Close Buttons
    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeModal(e.target.dataset.modal);
        });
    });
    
    // Player Search
    document.getElementById('player-search').addEventListener('input', filterPlayers);
    
    // ELO Range Filter
    document.getElementById('elo-min').addEventListener('input', updateEloFilter);
    document.getElementById('elo-max').addEventListener('input', updateEloFilter);
    
    // Tree Controls
    document.getElementById('reset-view').addEventListener('click', resetTreeView);
    document.getElementById('show-balance').addEventListener('change', toggleBalanceFactors);
    document.getElementById('tree-search').addEventListener('input', searchTree);
    
    // Detail Panel Close
    document.querySelector('#player-detail .close-btn').addEventListener('click', () => {
        document.getElementById('player-detail').classList.remove('open');
    });
}

// ══════════════════════════════════════════════════
//              SOCKET LISTENERS
// ══════════════════════════════════════════════════

function initSocketListeners() {
    socket.on('player_joined', (data) => {
        players.push(data.player);
        updateQueue();
        updateStats(data);
        updateTree(data.tree);
        
        if (data.rotations.length > 0) {
            animateRotations(data.rotations);
        }
        
        showToast(`${data.player.name} joined!`, 'info');
    });
    
    socket.on('match_formed', (data) => {
        currentMatch = data.match;
        animateMatchFormation(data.match);
        updateMatchHistory(data.match);
        updateStats(data.stats);
        updateTree(data.tree);
        
        // Remove matched players from queue
        data.match.team_a.concat(data.match.team_b).forEach(p => {
            players = players.filter(player => player.id !== p.id);
        });
        updateQueue();
    });
    
    socket.on('player_deleted', (data) => {
        players = players.filter(p => p.id !== data.player_id);
        updateQueue();
        updateTree(data.tree);
        updatePlayerTable();
    });
}

// ══════════════════════════════════════════════════
//              TAB SWITCHING
// ══════════════════════════════════════════════════

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    // Load tab-specific data
    if (tabName === 'tree') {
        loadTreeView();
    } else if (tabName === 'management') {
        updatePlayerTable();
    }
}

// ══════════════════════════════════════════════════
//              THEME TOGGLE
// ══════════════════════════════════════════════════

function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.toggle('dark-mode');
    body.classList.toggle('light-mode', !isDark);
    
    const icon = document.querySelector('.theme-icon');
    icon.textContent = isDark ? '🌙' : '☀️';
    
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
    toggleTheme();
}

// ══════════════════════════════════════════════════
//              SIMULATION CONTROLS
// ══════════════════════════════════════════════════

function startSimulation() {
    fetch('/api/simulation/start', {method: 'POST'})
        .then(() => {
            document.getElementById('start-sim').style.display = 'none';
            document.getElementById('stop-sim').style.display = 'block';
            showToast('Simulation started!', 'success');
        });
}

function stopSimulation() {
    fetch('/api/simulation/stop', {method: 'POST'})
        .then(() => {
            document.getElementById('start-sim').style.display = 'block';
            document.getElementById('stop-sim').style.display = 'none';
            showToast('Simulation stopped', 'info');
        });
}

// ══════════════════════════════════════════════════
//              LOBBY TAB - QUEUE
// ══════════════════════════════════════════════════

function updateQueue() {
    const queueList = document.getElementById('queue-list');
    const queueCount = document.getElementById('queue-count');
    
    const activeQueue = players.filter(p => p.in_queue);
    queueCount.textContent = activeQueue.length;
    
    queueList.innerHTML = '';
    activeQueue.forEach(player => {
        const card = createPlayerCard(player);
        queueList.appendChild(card);
    });
}

function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.dataset.playerId = player.id;
    
    const waitTime = Math.floor((Date.now() / 1000) - player.join_time);
    const waitPercent = Math.min((waitTime / 30) * 100, 100);
    
    card.innerHTML = `
        <div class="player-avatar">${player.name[0]}</div>
        <div class="player-info">
            <div class="player-name">${player.name}</div>
            <div class="player-stats">
                <span>ELO: ${player.elo}</span>
                <span>${waitTime}s</span>
            </div>
            <div class="wait-bar">
                <div class="wait-fill" style="width: ${waitPercent}%"></div>
            </div>
        </div>
    `;
    
    return card;
}

// Update wait times every second
setInterval(() => {
    document.querySelectorAll('.player-card').forEach(card => {
        const playerId = card.dataset.playerId;
        const player = players.find(p => p.id === playerId);
        if (player) {
            const waitTime = Math.floor((Date.now() / 1000) - player.join_time);
            const waitPercent = Math.min((waitTime / 30) * 100, 100);
            
            const statsDiv = card.querySelector('.player-stats');
            if (statsDiv) {
                const spans = statsDiv.querySelectorAll('span');
                if (spans[1]) spans[1].textContent = `${waitTime}s`;
            }
            
            const waitFill = card.querySelector('.wait-fill');
            if (waitFill) {
                waitFill.style.width = `${waitPercent}%`;
            }
        }
    });
}, 1000);

// ══════════════════════════════════════════════════
//              LOBBY TAB - MATCH FORMATION
// ══════════════════════════════════════════════════

function animateMatchFormation(match) {
    const stage = document.getElementById('formation-stage');
    stage.innerHTML = '';
    
    // Create match display
    const display = document.createElement('div');
    display.className = 'match-display';
    
    // Team A
    const teamA = document.createElement('div');
    teamA.className = 'team-column';
    teamA.innerHTML = `
        <div class="team-header">
            <div class="team-name team-a">TEAM A</div>
            <div class="team-total">Total: ${match.team_a_total}</div>
        </div>
    `;
    match.team_a.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'team-player';
        playerDiv.innerHTML = `
            <span>${player.name}</span>
            <span>${player.elo}</span>
        `;
        teamA.appendChild(playerDiv);
    });
    
    // Balance Display
    const balance = document.createElement('div');
    balance.className = 'balance-display';
    
    let balanceClass = 'excellent';
    if (match.balance_score < 90) balanceClass = 'good';
    if (match.balance_score < 75) balanceClass = 'poor';
    
    balance.innerHTML = `
        <div class="balance-label">BALANCE</div>
        <div class="balance-score ${balanceClass}">${match.balance_score}</div>
        <div class="balance-label">GAP: ${match.gap}</div>
    `;
    
    // Team B
    const teamB = document.createElement('div');
    teamB.className = 'team-column';
    teamB.innerHTML = `
        <div class="team-header">
            <div class="team-name team-b">TEAM B</div>
            <div class="team-total">Total: ${match.team_b_total}</div>
        </div>
    `;
    match.team_b.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'team-player';
        playerDiv.innerHTML = `
            <span>${player.name}</span>
            <span>${player.elo}</span>
        `;
        teamB.appendChild(playerDiv);
    });
    
    display.appendChild(teamA);
    display.appendChild(balance);
    display.appendChild(teamB);
    stage.appendChild(display);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        stage.innerHTML = '';
    }, 5000);
}

// ══════════════════════════════════════════════════
//              LOBBY TAB - MATCH HISTORY
// ══════════════════════════════════════════════════

function updateMatchHistory(match) {
    const historyList = document.getElementById('history-list');
    
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
        <div class="match-id">MATCH #${match.match_id}</div>
        <div class="match-score">${match.team_a_total} vs ${match.team_b_total}</div>
        <div class="match-meta">
            Balance: ${match.balance_score}/100 | 
            Wait: ${match.avg_wait}s | 
            ${match.timestamp}
        </div>
    `;
    
    card.addEventListener('click', () => showMatchDetail(match));
    
    historyList.insertBefore(card, historyList.firstChild);
    
    // Limit to 10 matches
    while (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
}

function showMatchDetail(match) {
    const modal = document.getElementById('match-modal');
    const title = document.getElementById('match-title');
    const content = document.getElementById('match-detail-content');
    
    title.textContent = `MATCH #${match.match_id}`;
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
            <div>
                <h4 style="color: var(--accent-secondary); margin-bottom: 15px;">TEAM A (${match.team_a_total})</h4>
                ${match.team_a.map(p => `
                    <div style="padding: 10px; background: var(--bg-secondary); margin-bottom: 8px;">
                        ${p.name} - ${p.elo}
                    </div>
                `).join('')}
            </div>
            <div>
                <h4 style="color: var(--accent-danger); margin-bottom: 15px;">TEAM B (${match.team_b_total})</h4>
                ${match.team_b.map(p => `
                    <div style="padding: 10px; background: var(--bg-secondary); margin-bottom: 8px;">
                        ${p.name} - ${p.elo}
                    </div>
                `).join('')}
            </div>
        </div>
        <div style="margin-top: 20px; padding: 15px; background: var(--bg-secondary); text-align: center;">
            <div>Balance Score: ${match.balance_score}/100</div>
            <div>ELO Gap: ${match.gap}</div>
            <div>Average Wait: ${match.avg_wait}s</div>
        </div>
    `;
    
    openModal('match-modal');
}

// ══════════════════════════════════════════════════
//              LOBBY TAB - STATS
// ══════════════════════════════════════════════════

function updateStats(stats) {
    document.getElementById('stat-queue').textContent = stats.queue_size || 0;
    document.getElementById('stat-matches').textContent = stats.total_matches || 0;
    document.getElementById('stat-balance').textContent = stats.avg_balance || '--';
    document.getElementById('stat-wait').textContent = stats.avg_wait ? `${stats.avg_wait}s` : '--';
}

// ══════════════════════════════════════════════════
//              AVL TREE TAB
// ══════════════════════════════════════════════════

let treeData = null;
let treeScale = 1;
let treeOffsetX = 0;
let treeOffsetY = 0;

function loadTreeView() {
    fetch('/api/tree')
        .then(r => r.json())
        .then(data => {
            treeData = data;
            renderTree();
        });
}

function renderTree() {
    if (!treeData) return;
    
    const svg = document.getElementById('tree-canvas');
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    
    svg.innerHTML = '';
    
    const nodePositions = calculateNodePositions(treeData, width / 2, 50, width / 4);
    
    // Draw edges first
    drawEdges(svg, treeData, nodePositions);
    
    // Draw nodes
    drawNodes(svg, treeData, nodePositions);
}

function calculateNodePositions(node, x, y, offset, positions = new Map()) {
    if (!node) return positions;
    
    positions.set(node.elo, {x, y, node});
    
    if (node.left) {
        calculateNodePositions(node.left, x - offset, y + 80, offset / 2, positions);
    }
    
    if (node.right) {
        calculateNodePositions(node.right, x + offset, y + 80, offset / 2, positions);
    }
    
    return positions;
}

function drawEdges(svg, node, positions) {
    if (!node) return;
    
    const pos = positions.get(node.elo);
    
    if (node.left) {
        const leftPos = positions.get(node.left.elo);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('class', 'tree-edge');
        line.setAttribute('d', `M ${pos.x} ${pos.y} Q ${(pos.x + leftPos.x)/2} ${(pos.y + leftPos.y)/2 - 20} ${leftPos.x} ${leftPos.y}`);
        svg.appendChild(line);
        drawEdges(svg, node.left, positions);
    }
    
    if (node.right) {
        const rightPos = positions.get(node.right.elo);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('class', 'tree-edge');
        line.setAttribute('d', `M ${pos.x} ${pos.y} Q ${(pos.x + rightPos.x)/2} ${(pos.y + rightPos.y)/2 - 20} ${rightPos.x} ${rightPos.y}`);
        svg.appendChild(line);
        drawEdges(svg, node.right, positions);
    }
}

function drawNodes(svg, node, positions) {
    if (!node) return;
    
    const pos = positions.get(node.elo);
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'tree-node');
    
    const balanceClass = Math.abs(node.balance_factor) === 0 ? 'balanced' : 
                        Math.abs(node.balance_factor) <= 1 ? 'balanced' : 'unbalanced';
    group.classList.add(balanceClass);
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', 25);
    group.appendChild(circle);
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', pos.x);
    text.setAttribute('y', pos.y + 5);
    text.textContent = node.elo;
    group.appendChild(text);
    
    if (document.getElementById('show-balance').checked) {
        const bfText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        bfText.setAttribute('class', 'balance-factor-label');
        bfText.setAttribute('x', pos.x + 30);
        bfText.setAttribute('y', pos.y);
        bfText.textContent = node.balance_factor > 0 ? `+${node.balance_factor}` : node.balance_factor;
        group.appendChild(bfText);
    }
    
    group.addEventListener('click', () => showPlayerDetail(node.player));
    
    svg.appendChild(group);
    
    if (node.left) drawNodes(svg, node.left, positions);
    if (node.right) drawNodes(svg, node.right, positions);
}

function updateTree(data) {
    treeData = data;
    if (document.getElementById('tree-tab').classList.contains('active')) {
        renderTree();
    }
}

function resetTreeView() {
    treeScale = 1;
    treeOffsetX = 0;
    treeOffsetY = 0;
    renderTree();
}

function toggleBalanceFactors() {
    renderTree();
}

function searchTree() {
    const query = document.getElementById('tree-search').value;
    if (!query) return;
    
    // Find and highlight node
    const elo = parseInt(query);
    document.querySelectorAll('.tree-node').forEach(node => {
        const text = node.querySelector('text').textContent;
        if (text === query) {
            node.style.filter = 'drop-shadow(0 0 20px var(--accent-warning))';
        } else {
            node.style.filter = '';
        }
    });
}

function animateRotations(rotations) {
    // Show toast for each rotation
    rotations.forEach((rot, i) => {
        setTimeout(() => {
            showToast(`${rot.type} rotation at ${rot.node}`, 'info');
        }, i * 500);
    });
}

function showPlayerDetail(player) {
    const panel = document.getElementById('player-detail');
    const content = panel.querySelector('.detail-content');
    
    const waitTime = player.join_time ? 
        Math.floor((Date.now() / 1000) - player.join_time) : '--';
    
    content.innerHTML = `
        <div class="detail-avatar-large">${player.name[0]}</div>
        <div class="detail-name">${player.name}</div>
        <div class="detail-stats">
            <div class="detail-stat">
                <div class="detail-stat-label">ELO RATING</div>
                <div class="detail-stat-value">${player.elo}</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-label">IN QUEUE</div>
                <div class="detail-stat-value">${player.in_queue ? `Yes (${waitTime}s)` : 'No'}</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-label">PING</div>
                <div class="detail-stat-value">${player.ping}ms</div>
            </div>
        </div>
    `;
    
    panel.classList.add('open');
}

// ══════════════════════════════════════════════════
//              PLAYER MANAGEMENT TAB
// ══════════════════════════════════════════════════

function updatePlayerTable() {
    fetch('/api/players')
        .then(r => r.json())
        .then(data => {
            players = data;
            renderPlayerTable(players);
        });
}

function renderPlayerTable(playerList) {
    const tbody = document.getElementById('player-table-body');
    tbody.innerHTML = '';
    
    document.getElementById('results-count').textContent = `${playerList.length} PLAYERS`;
    
    playerList.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div class="table-avatar">${player.name[0]}</div></td>
            <td>${player.name}</td>
            <td>${player.elo}</td>
            <td>${player.ping}ms</td>
            <td><span class="status-badge ${player.in_queue ? 'in-queue' : 'idle'}">${player.in_queue ? 'IN QUEUE' : 'IDLE'}</span></td>
            <td class="action-btns">
                <button class="action-btn delete" onclick="confirmDelete('${player.id}', '${player.name}')">DELETE</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterPlayers() {
    const query = document.getElementById('player-search').value.toLowerCase();
    const minElo = parseInt(document.getElementById('elo-min').value);
    const maxElo = parseInt(document.getElementById('elo-max').value);
    
    const filtered = players.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(query);
        const eloMatch = p.elo >= minElo && p.elo <= maxElo;
        return nameMatch && eloMatch;
    });
    
    renderPlayerTable(filtered);
}

function updateEloFilter() {
    const min = document.getElementById('elo-min').value;
    const max = document.getElementById('elo-max').value;
    document.getElementById('elo-range-display').textContent = `${min}-${max}`;
    filterPlayers();
}

function handleAddPlayer(e) {
    e.preventDefault();
    
    const data = {
        name: document.getElementById('new-player-name').value,
        elo: document.getElementById('new-player-elo').value,
        ping: document.getElementById('new-player-ping').value
    };
    
    fetch('/api/player/add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(r => r.json())
    .then(result => {
        if (result.success) {
            closeModal('add-modal');
            document.getElementById('add-player-form').reset();
            showToast('Player added!', 'success');
            updatePlayerTable();
        }
    });
}

function confirmDelete(playerId, playerName) {
    document.getElementById('delete-player-name').textContent = playerName;
    document.getElementById('confirm-delete').onclick = () => deletePlayer(playerId);
    openModal('delete-modal');
}

function deletePlayer(playerId) {
    fetch(`/api/player/delete/${playerId}`, {method: 'DELETE'})
        .then(r => r.json())
        .then(result => {
            if (result.success) {
                closeModal('delete-modal');
                showToast('Player deleted', 'info');
                updatePlayerTable();
            }
        });
}

// ══════════════════════════════════════════════════
//              MODALS
// ══════════════════════════════════════════════════

function openModal(modalId) {
    document.getElementById(modalId).classList.add('open');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('open');
}

// ══════════════════════════════════════════════════
//              TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
        setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
}

// ══════════════════════════════════════════════════
//              INITIAL DATA LOAD
// ══════════════════════════════════════════════════

function loadInitialData() {
    fetch('/api/stats')
        .then(r => r.json())
        .then(stats => updateStats(stats));
    
    fetch('/api/players')
        .then(r => r.json())
        .then(data => {
            players = data;
            updateQueue();
        });
}
