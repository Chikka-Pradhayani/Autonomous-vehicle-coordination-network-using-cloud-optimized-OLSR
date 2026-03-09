let recoveryTimeChart = null;
let availabilityChart = null;
let combinedChart = null;

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
    const olsrRecovery = metrics.olsr.node_recovery_time;
    const dsdvRecovery = metrics.dsdv.node_recovery_time;
    const olsrAvailability = metrics.olsr.network_availability;
    const dsdvAvailability = metrics.dsdv.network_availability;
    
    const ctx1 = document.getElementById('recoveryTimeChart').getContext('2d');
    
    if (recoveryTimeChart) {
        recoveryTimeChart.destroy();
    }
    
    recoveryTimeChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['OLSR (Proposed)', 'DSDV (Existing)'],
            datasets: [{
                label: 'Recovery Time (ms)',
                data: [olsrRecovery, dsdvRecovery],
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
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Lower is Better',
                    font: { size: 12 },
                    color: '#666'
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Recovery Time (ms)',
                        font: { size: 14 }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    const ctx2 = document.getElementById('availabilityChart').getContext('2d');
    
    if (availabilityChart) {
        availabilityChart.destroy();
    }
    
    availabilityChart = new Chart(ctx2, {
        type: 'polarArea',
        data: {
            labels: ['OLSR Availability', 'DSDV Availability'],
            datasets: [{
                data: [olsrAvailability, dsdvAvailability],
                backgroundColor: [
                    'rgba(76, 175, 80, 0.7)',
                    'rgba(255, 152, 0, 0.7)'
                ],
                borderColor: [
                    '#2e7d32',
                    '#e65100'
                ],
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
                        padding: 15
                    }
                },
                title: {
                    display: true,
                    text: 'Higher is Better',
                    font: { size: 12 },
                    color: '#666'
                }
            },
            scales: {
                r: {
                    min: 80,
                    max: 100,
                    ticks: {
                        stepSize: 5
                    }
                }
            }
        }
    });
    
    const ctx3 = document.getElementById('combinedChart').getContext('2d');
    
    if (combinedChart) {
        combinedChart.destroy();
    }
    
    const olsrFTR = metrics.olsr.fault_tolerance_rate;
    const dsdvFTR = metrics.dsdv.fault_tolerance_rate;
    
    combinedChart = new Chart(ctx3, {
        type: 'radar',
        data: {
            labels: ['Fault Tolerance', 'Availability', 'Recovery Speed', 'Path Efficiency'],
            datasets: [
                {
                    label: 'OLSR (Proposed)',
                    data: [
                        olsrFTR,
                        olsrAvailability,
                        100 - (olsrRecovery / 10),
                        95
                    ],
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    borderColor: '#4caf50',
                    borderWidth: 3,
                    pointBackgroundColor: '#4caf50',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                },
                {
                    label: 'DSDV (Existing)',
                    data: [
                        dsdvFTR,
                        dsdvAvailability,
                        100 - (dsdvRecovery / 10),
                        65
                    ],
                    backgroundColor: 'rgba(255, 152, 0, 0.2)',
                    borderColor: '#ff9800',
                    borderWidth: 3,
                    pointBackgroundColor: '#ff9800',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }
            ]
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
                }
            },
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        font: { size: 12 }
                    },
                    pointLabels: {
                        font: { size: 13, weight: 'bold' }
                    }
                }
            }
        }
    });
}

function updateSummary(metrics) {
    document.getElementById('olsrRecoveryTime').textContent = metrics.olsr.node_recovery_time;
    document.getElementById('dsdvRecoveryTime').textContent = metrics.dsdv.node_recovery_time;
    document.getElementById('olsrAvailability').textContent = metrics.olsr.network_availability;
    document.getElementById('dsdvAvailability').textContent = metrics.dsdv.network_availability;
    
    const recoveryImprovement = ((metrics.dsdv.node_recovery_time - metrics.olsr.node_recovery_time) / metrics.dsdv.node_recovery_time * 100).toFixed(1);
    const availabilityImprovement = (metrics.olsr.network_availability - metrics.dsdv.network_availability).toFixed(2);
    
    document.getElementById('recoveryImprovement').textContent = recoveryImprovement + '%';
    document.getElementById('availabilityImprovement').textContent = '+' + availabilityImprovement + '%';
}
