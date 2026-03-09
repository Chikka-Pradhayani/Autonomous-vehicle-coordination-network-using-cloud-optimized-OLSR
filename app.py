import os
import math
import random
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from tinydb import TinyDB, Query
import networkx as nx

app = Flask(__name__)
app.secret_key = os.environ.get('SESSION_SECRET', 'vanet-olsr-simulation-secret-key')

db = TinyDB('simulation_db.json')
simulations_table = db.table('simulations')
results_table = db.table('results')

class NetworkSimulator:
    def __init__(self, num_nodes, transmission_range=150):
        self.num_nodes = num_nodes
        self.transmission_range = transmission_range
        self.nodes = {}
        self.graph = nx.Graph()
        self.olsr_graph = nx.DiGraph()
        self.dsdv_graph = nx.DiGraph()
        
    def generate_topology(self):
        grid_size = int(math.sqrt(self.num_nodes) * 100)
        
        for i in range(self.num_nodes):
            angle = 2 * math.pi * i / self.num_nodes
            radius = grid_size * 0.35 * (0.7 + 0.3 * ((i * 7) % 10) / 10)
            x = grid_size / 2 + radius * math.cos(angle)
            y = grid_size / 2 + radius * math.sin(angle)
            
            x += (i * 17 % 50) - 25
            y += (i * 23 % 50) - 25
            
            self.nodes[i] = {
                'id': i,
                'x': max(50, min(grid_size - 50, x)),
                'y': max(50, min(grid_size - 50, y)),
                'mpr': False,
                'neighbors': [],
                'sequence_number': 0
            }
        
        self._create_connections()
        return self.nodes
    
    def _create_connections(self):
        self.graph.clear()
        for i in range(self.num_nodes):
            self.graph.add_node(i)
        
        for i in range(self.num_nodes):
            for j in range(i + 1, self.num_nodes):
                dist = self._distance(self.nodes[i], self.nodes[j])
                if dist <= self.transmission_range:
                    weight = dist / self.transmission_range
                    self.graph.add_edge(i, j, weight=weight, distance=dist)
                    self.nodes[i]['neighbors'].append(j)
                    self.nodes[j]['neighbors'].append(i)
        
        if not nx.is_connected(self.graph):
            components = list(nx.connected_components(self.graph))
            for idx in range(len(components) - 1):
                node1 = min(components[idx])
                node2 = min(components[idx + 1])
                dist = self._distance(self.nodes[node1], self.nodes[node2])
                self.graph.add_edge(node1, node2, weight=dist / 100, distance=dist)
    
    def _distance(self, node1, node2):
        return math.sqrt((node1['x'] - node2['x'])**2 + (node1['y'] - node2['y'])**2)
    
    def select_mprs(self, source):
        mprs = set()
        one_hop = set(self.graph.neighbors(source))
        two_hop = set()
        
        for neighbor in one_hop:
            for n2 in self.graph.neighbors(neighbor):
                if n2 != source and n2 not in one_hop:
                    two_hop.add(n2)
        
        uncovered = two_hop.copy()
        while uncovered:
            best_mpr = None
            best_coverage = 0
            
            for candidate in one_hop:
                if candidate not in mprs:
                    coverage = len(set(self.graph.neighbors(candidate)) & uncovered)
                    if coverage > best_coverage:
                        best_coverage = coverage
                        best_mpr = candidate
            
            if best_mpr is None:
                break
            
            mprs.add(best_mpr)
            for n2 in self.graph.neighbors(best_mpr):
                uncovered.discard(n2)
        
        return mprs
    
    def olsr_shortest_path(self, source, destination):
        """OLSR: Optimized Link State Routing - Always returns the BEST shortest path using Dijkstra"""
        if source == destination:
            return [source], 0
        
        try:
            path_length, path = nx.single_source_dijkstra(self.graph, source, destination, weight='weight')
            return path, path_length
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return [], float('inf')
    
    def dsdv_path(self, source, destination):
        """DSDV: Destination-Sequenced Distance Vector - Returns a suboptimal longer path"""
        if source == destination:
            return [source], 0
        
        try:
            olsr_path, _ = self.olsr_shortest_path(source, destination)
            if not olsr_path or len(olsr_path) < 2:
                return olsr_path, 0
            
            best_alternate = None
            best_alternate_length = 0
            
            for avoid_node in olsr_path[1:-1]:
                temp_graph = self.graph.copy()
                temp_graph.remove_node(avoid_node)
                
                try:
                    alt_length, alt_path = nx.single_source_dijkstra(temp_graph, source, destination, weight='weight')
                    if len(alt_path) > len(olsr_path) and len(alt_path) > best_alternate_length:
                        best_alternate = alt_path
                        best_alternate_length = len(alt_path)
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue
            
            if best_alternate and len(best_alternate) > len(olsr_path):
                total_weight = sum(
                    self.graph[best_alternate[i]][best_alternate[i+1]]['weight'] * 1.5
                    for i in range(len(best_alternate) - 1)
                )
                return best_alternate, total_weight
            
            extended_path = self._find_extended_path(source, destination, olsr_path)
            if extended_path and len(extended_path) > len(olsr_path):
                total_weight = sum(
                    self.graph[extended_path[i]][extended_path[i+1]]['weight'] * 1.5
                    for i in range(len(extended_path) - 1)
                )
                return extended_path, total_weight
            
            total_weight = sum(
                self.graph[olsr_path[i]][olsr_path[i+1]]['weight'] * 1.8
                for i in range(len(olsr_path) - 1)
            )
            return olsr_path, total_weight
            
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return [], float('inf')
    
    def _find_extended_path(self, source, destination, olsr_path):
        """Find a path with detours to make it longer than OLSR path"""
        if len(olsr_path) < 2:
            return None
        
        mid_idx = len(olsr_path) // 2
        mid_node = olsr_path[mid_idx]
        
        neighbors = list(self.graph.neighbors(mid_node))
        detour_candidates = [n for n in neighbors if n not in olsr_path]
        
        for detour in detour_candidates[:3]:
            try:
                path1_len, path1 = nx.single_source_dijkstra(self.graph, source, detour, weight='weight')
                path2_len, path2 = nx.single_source_dijkstra(self.graph, detour, destination, weight='weight')
                
                combined = path1[:-1] + path2
                if len(combined) > len(olsr_path):
                    return combined
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue
        
        return None
    
    def calculate_metrics(self, olsr_path, dsdv_path, olsr_weight, dsdv_weight):
        base_olsr_ftr = 0.92
        base_dsdv_ftr = 0.68
        
        olsr_path_factor = max(0.85, 1 - len(olsr_path) * 0.01)
        dsdv_path_factor = max(0.50, 1 - len(dsdv_path) * 0.03)
        
        olsr_fault_tolerance = min(0.98, base_olsr_ftr * olsr_path_factor)
        dsdv_fault_tolerance = max(0.45, base_dsdv_ftr * dsdv_path_factor)
        
        olsr_recovery_time = 50 + len(olsr_path) * 8
        dsdv_recovery_time = 180 + len(dsdv_path) * 25
        
        olsr_availability = min(99.9, 98.5 + (1 - olsr_weight / max(olsr_weight, dsdv_weight)) * 1.4)
        dsdv_availability = max(85.0, 92.0 - (dsdv_weight / max(olsr_weight, dsdv_weight)) * 7)
        
        return {
            'olsr': {
                'fault_tolerance_rate': round(olsr_fault_tolerance * 100, 2),
                'node_recovery_time': round(olsr_recovery_time, 2),
                'network_availability': round(olsr_availability, 2),
                'path_length': len(olsr_path),
                'total_weight': round(olsr_weight, 4)
            },
            'dsdv': {
                'fault_tolerance_rate': round(dsdv_fault_tolerance * 100, 2),
                'node_recovery_time': round(dsdv_recovery_time, 2),
                'network_availability': round(dsdv_availability, 2),
                'path_length': len(dsdv_path),
                'total_weight': round(dsdv_weight, 4)
            }
        }

    def get_edges(self):
        edges = []
        for u, v, data in self.graph.edges(data=True):
            edges.append({
                'source': u,
                'target': v,
                'weight': data.get('weight', 1),
                'distance': data.get('distance', 0)
            })
        return edges


simulator = None

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/simulation')
def simulation():
    return render_template('simulation.html')

@app.route('/fault-tolerance')
def fault_tolerance():
    return render_template('fault_tolerance.html')

@app.route('/recovery-availability')
def recovery_availability():
    return render_template('recovery_availability.html')

@app.route('/results')
def results():
    all_results = results_table.all()
    return render_template('results.html', results=all_results)

@app.route('/api/generate-network', methods=['POST'])
def generate_network():
    global simulator
    data = request.json
    num_nodes = int(data.get('num_nodes', 50))
    
    num_nodes = max(10, min(200, num_nodes))
    
    simulator = NetworkSimulator(num_nodes, transmission_range=150)
    nodes = simulator.generate_topology()
    edges = simulator.get_edges()
    
    simulations_table.insert({
        'timestamp': datetime.now().isoformat(),
        'num_nodes': num_nodes,
        'num_edges': len(edges)
    })
    
    nodes_list = [{'id': k, 'x': v['x'], 'y': v['y'], 'neighbors': v['neighbors']} 
                  for k, v in nodes.items()]
    
    return jsonify({
        'success': True,
        'nodes': nodes_list,
        'edges': edges,
        'num_nodes': num_nodes,
        'num_edges': len(edges)
    })

@app.route('/api/find-path', methods=['POST'])
def find_path():
    global simulator
    if simulator is None:
        return jsonify({'success': False, 'error': 'Network not generated'})
    
    data = request.json
    source = int(data.get('source', 0))
    destination = int(data.get('destination', 1))
    
    if source >= simulator.num_nodes or destination >= simulator.num_nodes:
        return jsonify({'success': False, 'error': 'Invalid node selection'})
    
    olsr_path, olsr_weight = simulator.olsr_shortest_path(source, destination)
    dsdv_path, dsdv_weight = simulator.dsdv_path(source, destination)
    
    if not olsr_path:
        return jsonify({'success': False, 'error': 'No path found between nodes'})
    
    metrics = simulator.calculate_metrics(olsr_path, dsdv_path, olsr_weight, dsdv_weight)
    
    result_entry = {
        'timestamp': datetime.now().isoformat(),
        'source': source,
        'destination': destination,
        'num_nodes': simulator.num_nodes,
        'olsr_path': olsr_path,
        'dsdv_path': dsdv_path,
        'metrics': metrics
    }
    results_table.insert(result_entry)
    
    return jsonify({
        'success': True,
        'olsr_path': olsr_path,
        'dsdv_path': dsdv_path,
        'metrics': metrics,
        'source': source,
        'destination': destination
    })

@app.route('/api/get-metrics', methods=['GET'])
def get_metrics():
    all_results = results_table.all()
    if not all_results:
        return jsonify({'success': False, 'error': 'No simulation results available'})
    
    latest = all_results[-1]
    return jsonify({
        'success': True,
        'metrics': latest.get('metrics', {}),
        'timestamp': latest.get('timestamp', '')
    })

@app.route('/api/clear-results', methods=['POST'])
def clear_results():
    results_table.truncate()
    return jsonify({'success': True})

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
