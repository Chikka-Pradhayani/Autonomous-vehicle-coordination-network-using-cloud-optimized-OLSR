let nodes = [];
let edges = [];
let canvas, ctx;
let olsrPath = [];
let dsdvPath = [];
let sourceNode = null;
let destNode = null;
let flashInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('simulationCanvas');
    ctx = canvas.getContext('2d');
    
    drawEmptyCanvas();
    
    document.getElementById('generateNetworkBtn').addEventListener('click', generateNetwork);
    document.getElementById('findPathBtn').addEventListener('click', findPaths);
});

function drawEmptyCanvas() {
    ctx.fillStyle = '#fffde7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#9e9e9e';
    ctx.font = '18px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('Generate a network first, then select source and destination nodes', canvas.width / 2, canvas.height / 2);
}

async function generateNetwork() {
    const numNodes = document.getElementById('numNodesSimulation').value;
    const btn = document.getElementById('generateNetworkBtn');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Generating...';
    
    try {
        const response = await fetch('/api/generate-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ num_nodes: parseInt(numNodes) })
        });
        
        const data = await response.json();
        
        if (data.success) {
            nodes = data.nodes;
            edges = data.edges;
            olsrPath = [];
            dsdvPath = [];
            sourceNode = null;
            destNode = null;
            
            if (flashInterval) {
                clearInterval(flashInterval);
                flashInterval = null;
            }
            
            document.getElementById('pathControls').style.display = 'flex';
            document.getElementById('sourceNode').max = data.num_nodes - 1;
            document.getElementById('destNode').max = data.num_nodes - 1;
            document.getElementById('resultsPanel').style.display = 'none';
            
            drawNetwork();
        }
    } catch (error) {
        console.error('Error generating network:', error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">⚡</span> Generate Network';
    }
}

async function findPaths() {
    sourceNode = parseInt(document.getElementById('sourceNode').value);
    destNode = parseInt(document.getElementById('destNode').value);
    const btn = document.getElementById('findPathBtn');
    
    if (sourceNode === destNode) {
        alert('Please select different source and destination nodes');
        return;
    }
    
    if (sourceNode >= nodes.length || destNode >= nodes.length) {
        alert('Invalid node selection. Please select valid node IDs.');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Finding Paths...';
    
    try {
        const response = await fetch('/api/find-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: sourceNode, destination: destNode })
        });
        
        const data = await response.json();
        
        if (data.success) {
            olsrPath = data.olsr_path;
            dsdvPath = data.dsdv_path;
            
            document.getElementById('olsrPathLength').textContent = data.metrics.olsr.path_length + ' hops';
            document.getElementById('olsrWeight').textContent = data.metrics.olsr.total_weight;
            document.getElementById('olsrPath').textContent = olsrPath.join(' → ');
            
            document.getElementById('dsdvPathLength').textContent = data.metrics.dsdv.path_length + ' hops';
            document.getElementById('dsdvWeight').textContent = data.metrics.dsdv.total_weight;
            document.getElementById('dsdvPath').textContent = dsdvPath.join(' → ');
            
            const pathImprovement = dsdvPath.length - olsrPath.length;
            const weightImprovement = ((data.metrics.dsdv.total_weight - data.metrics.olsr.total_weight) / data.metrics.dsdv.total_weight * 100).toFixed(1);
            
            document.getElementById('pathImprovement').textContent = pathImprovement + ' hops';
            document.getElementById('weightImprovement').textContent = weightImprovement + '%';
            
            document.getElementById('resultsPanel').style.display = 'block';
            
            startFlashingPath();
        } else {
            alert(data.error || 'Error finding paths');
        }
    } catch (error) {
        console.error('Error finding paths:', error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">🔍</span> Find Paths';
    }
}

function getTransform() {
    const padding = 50;
    const width = canvas.width - 2 * padding;
    const height = canvas.height - 2 * padding;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    });
    
    const scaleX = width / (maxX - minX || 1);
    const scaleY = height / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);
    
    const offsetX = padding + (width - (maxX - minX) * scale) / 2;
    const offsetY = padding + (height - (maxY - minY) * scale) / 2;
    
    return { minX, minY, scale, offsetX, offsetY };
}

function transform(node, t) {
    return {
        x: (node.x - t.minX) * t.scale + t.offsetX,
        y: (node.y - t.minY) * t.scale + t.offsetY
    };
}

function drawNetwork(flashState = true) {
    const t = getTransform();
    
    ctx.fillStyle = '#fffde7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawGridPattern();
    
    ctx.strokeStyle = 'rgba(158, 158, 158, 0.25)';
    ctx.lineWidth = 1;
    edges.forEach(edge => {
        const source = transform(nodes.find(n => n.id === edge.source), t);
        const target = transform(nodes.find(n => n.id === edge.target), t);
        
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
    });
    
    if (dsdvPath.length > 1) {
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 4]);
        drawPath(dsdvPath, t);
        ctx.setLineDash([]);
    }
    
    if (olsrPath.length > 1) {
        ctx.strokeStyle = flashState ? '#4caf50' : '#81c784';
        ctx.lineWidth = flashState ? 6 : 4;
        ctx.shadowColor = flashState ? 'rgba(76, 175, 80, 0.8)' : 'transparent';
        ctx.shadowBlur = flashState ? 15 : 0;
        drawPath(olsrPath, t);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }
    
    nodes.forEach(node => {
        const pos = transform(node, t);
        let color = '#3f51b5';
        let size = 8;
        
        if (node.id === sourceNode) {
            color = '#4caf50';
            size = 12;
        } else if (node.id === destNode) {
            color = '#f44336';
            size = 12;
        } else if (olsrPath.includes(node.id)) {
            color = '#81c784';
            size = 10;
        } else if (dsdvPath.includes(node.id)) {
            color = '#ffb74d';
            size = 9;
        }
        
        drawNode(pos.x, pos.y, node.id, color, size);
    });
}

function drawPath(path, t) {
    if (path.length < 2) return;
    
    ctx.beginPath();
    const start = transform(nodes.find(n => n.id === path[0]), t);
    ctx.moveTo(start.x, start.y);
    
    for (let i = 1; i < path.length; i++) {
        const point = transform(nodes.find(n => n.id === path[i]), t);
        ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
}

function drawGridPattern() {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawNode(x, y, id, color, size = 8) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    if (nodes.length <= 50 || id === sourceNode || id === destNode) {
        ctx.fillStyle = '#333';
        ctx.font = 'bold 10px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(id, x, y - size - 4);
    }
}

function startFlashingPath() {
    if (flashInterval) {
        clearInterval(flashInterval);
    }
    
    let flashState = true;
    flashInterval = setInterval(() => {
        flashState = !flashState;
        drawNetwork(flashState);
    }, 400);
}
