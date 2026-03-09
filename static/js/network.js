let nodes = [];
let edges = [];
let canvas, ctx;

document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('networkCanvas');
    ctx = canvas.getContext('2d');
    
    drawEmptyCanvas();
    
    document.getElementById('generateBtn').addEventListener('click', generateNetwork);
});

function drawEmptyCanvas() {
    ctx.fillStyle = '#fffde7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#9e9e9e';
    ctx.font = '18px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('Enter number of nodes and click "Generate Network" to visualize', canvas.width / 2, canvas.height / 2);
    
    drawVehicleIcon(canvas.width / 2 - 100, canvas.height / 2 + 40, '#bdbdbd');
    drawVehicleIcon(canvas.width / 2, canvas.height / 2 + 40, '#bdbdbd');
    drawVehicleIcon(canvas.width / 2 + 100, canvas.height / 2 + 40, '#bdbdbd');
}

function drawVehicleIcon(x, y, color) {
    ctx.save();
    ctx.translate(x, y);
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-15, -8, 30, 16, 4);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(-10, -6, 8, 6, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(2, -6, 8, 6, 2);
    ctx.fill();
    
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-10, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

async function generateNetwork() {
    const numNodes = document.getElementById('numNodes').value;
    const btn = document.getElementById('generateBtn');
    
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
            
            document.getElementById('networkInfo').style.display = 'flex';
            document.getElementById('totalNodes').textContent = data.num_nodes;
            document.getElementById('totalEdges').textContent = data.num_edges;
            
            drawNetwork();
        }
    } catch (error) {
        console.error('Error generating network:', error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">⚡</span> Generate Network';
    }
}

function drawNetwork() {
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
    
    function transform(node) {
        return {
            x: (node.x - minX) * scale + offsetX,
            y: (node.y - minY) * scale + offsetY
        };
    }
    
    ctx.fillStyle = '#fffde7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawGridPattern();
    
    ctx.strokeStyle = 'rgba(158, 158, 158, 0.3)';
    ctx.lineWidth = 1;
    edges.forEach(edge => {
        const source = transform(nodes.find(n => n.id === edge.source));
        const target = transform(nodes.find(n => n.id === edge.target));
        
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
    });
    
    nodes.forEach(node => {
        const pos = transform(node);
        drawNode(pos.x, pos.y, node.id, '#3f51b5');
    });
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

function drawNode(x, y, id, color) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    if (nodes.length <= 50) {
        ctx.fillStyle = '#333';
        ctx.font = 'bold 9px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(id, x, y - 12);
    }
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        return this;
    };
}
