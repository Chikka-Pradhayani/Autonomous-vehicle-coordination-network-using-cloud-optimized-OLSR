let faultToleranceChart = null;
let faultToleranceBarChart = null;

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('refreshMetrics').addEventListener('click', loadMetrics);
    loadMetrics();
});

async function loadMetrics() {
    const btn = document.getElementById('refreshMetrics');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Loading...';
    
    try {
        const response = await fetch('/api/get-metrics');
        const data = await response.json();
        
        if (data.success) {
            updateCharts(data.metrics);
            updateSummary(data.metrics);
            document.getElementById('metricsSummary').style.display = 'block';
        } else {
            console.log('No metrics available yet');
        }
    } catch (error) {
        console.error('Error loading metrics:', error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">🔄</span> Load Latest Results';
    }
}

function updateCharts(metrics) {
    const olsrFTR = metrics.olsr.fault_tolerance_rate;
    const dsdvFTR = metrics.dsdv.fault_tolerance_rate;
    
    const ctx1 = document.getElementById('faultToleranceChart').getContext('2d');
    
    if (faultToleranceChart) {
        faultToleranceChart.destroy();
    }
    
    faultToleranceChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['OLSR (Proposed)', 'DSDV (Existing)'],
            datasets: [{
                data: [olsrFTR, dsdvFTR],
                backgroundColor: ['#4caf50', '#ff9800'],
                borderColor: ['#2e7d32', '#e65100'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 14 },
                        padding: 20
                    }
                },
                title: {
                    display: true,
                    text: 'Fault Tolerance Rate Comparison',
                    font: { size: 16 }
                }
            }
        }
    });
    
    const ctx2 = document.getElementById('faultToleranceBarChart').getContext('2d');
    
    if (faultToleranceBarChart) {
        faultToleranceBarChart.destroy();
    }
    
    faultToleranceBarChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['OLSR (Proposed)', 'DSDV (Existing)'],
            datasets: [{
                label: 'Fault Tolerance Rate (%)',
                data: [olsrFTR, dsdvFTR],
                backgroundColor: [
                    'rgba(76, 175, 80, 0.8)',
                    'rgba(255, 152, 0, 0.8)'
                ],
                borderColor: [
                    '#2e7d32',
                    '#e65100'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Fault Tolerance Rate (%)',
                        font: { size: 14 }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function updateSummary(metrics) {
    document.getElementById('olsrFaultTolerance').textContent = metrics.olsr.fault_tolerance_rate;
    document.getElementById('dsdvFaultTolerance').textContent = metrics.dsdv.fault_tolerance_rate;
    
    const improvement = (metrics.olsr.fault_tolerance_rate - metrics.dsdv.fault_tolerance_rate).toFixed(2);
    document.getElementById('faultToleranceImprovement').textContent = '+' + improvement;
}
