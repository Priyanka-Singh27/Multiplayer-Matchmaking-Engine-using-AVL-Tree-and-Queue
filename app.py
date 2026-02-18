from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
import random
import time
import threading
from datetime import datetime
from collections import deque

app = Flask(__name__)
app.config['SECRET_KEY'] = 'hardpoint-matchmaking-secret'
socketio = SocketIO(app, cors_allowed_origins="*")

# ═══════════════════════════════════════════════════
#               AVL TREE IMPLEMENTATION
# ═══════════════════════════════════════════════════

class AVLNode:
    def __init__(self, elo, player_data):
        self.elo = elo
        self.player = player_data
        self.left = None
        self.right = None
        self.height = 1
        self.balance_factor = 0

class AVLTree:
    def __init__(self):
        self.root = None
        self.rotation_log = []
    
    def _height(self, node):
        return node.height if node else 0
    
    def _update_height(self, node):
        if node:
            node.height = 1 + max(self._height(node.left), self._height(node.right))
            node.balance_factor = self._height(node.left) - self._height(node.right)
    
    def _rotate_right(self, y):
        self.rotation_log.append({
            'type': 'right',
            'node': y.elo,
            'affected': [y.elo, y.left.elo if y.left else None]
        })
        x = y.left
        T2 = x.right
        x.right = y
        y.left = T2
        self._update_height(y)
        self._update_height(x)
        return x
    
    def _rotate_left(self, x):
        self.rotation_log.append({
            'type': 'left',
            'node': x.elo,
            'affected': [x.elo, x.right.elo if x.right else None]
        })
        y = x.right
        T2 = y.left
        y.left = x
        x.right = T2
        self._update_height(x)
        self._update_height(y)
        return y
    
    def insert(self, elo, player_data):
        self.rotation_log = []
        self.root = self._insert(self.root, elo, player_data)
        return self.rotation_log
    
    def _insert(self, node, elo, player_data):
        if not node:
            return AVLNode(elo, player_data)
        
        if elo < node.elo:
            node.left = self._insert(node.left, elo, player_data)
        else:
            node.right = self._insert(node.right, elo, player_data)
        
        self._update_height(node)
        
        # Balancing
        balance = node.balance_factor
        
        # Left-Left
        if balance > 1 and elo < node.left.elo:
            return self._rotate_right(node)
        
        # Right-Right
        if balance < -1 and elo > node.right.elo:
            return self._rotate_left(node)
        
        # Left-Right
        if balance > 1 and elo > node.left.elo:
            node.left = self._rotate_left(node.left)
            return self._rotate_right(node)
        
        # Right-Left
        if balance < -1 and elo < node.right.elo:
            node.right = self._rotate_right(node.right)
            return self._rotate_left(node)
        
        return node
    
    def delete(self, elo):
        self.rotation_log = []
        self.root = self._delete(self.root, elo)
        return self.rotation_log
    
    def _delete(self, node, elo):
        if not node:
            return node
        
        if elo < node.elo:
            node.left = self._delete(node.left, elo)
        elif elo > node.elo:
            node.right = self._delete(node.right, elo)
        else:
            if not node.left:
                return node.right
            elif not node.right:
                return node.left
            
            temp = self._min_value_node(node.right)
            node.elo = temp.elo
            node.player = temp.player
            node.right = self._delete(node.right, temp.elo)
        
        self._update_height(node)
        
        balance = node.balance_factor
        
        if balance > 1 and self._height(node.left.left) >= self._height(node.left.right):
            return self._rotate_right(node)
        
        if balance > 1 and self._height(node.left.left) < self._height(node.left.right):
            node.left = self._rotate_left(node.left)
            return self._rotate_right(node)
        
        if balance < -1 and self._height(node.right.right) >= self._height(node.right.left):
            return self._rotate_left(node)
        
        if balance < -1 and self._height(node.right.right) < self._height(node.right.left):
            node.right = self._rotate_right(node.right)
            return self._rotate_left(node)
        
        return node
    
    def _min_value_node(self, node):
        current = node
        while current.left:
            current = current.left
        return current
    
    def range_query(self, min_elo, max_elo):
        result = []
        self._range_query(self.root, min_elo, max_elo, result)
        return result
    
    def _range_query(self, node, min_elo, max_elo, result):
        if not node:
            return
        
        if min_elo < node.elo:
            self._range_query(node.left, min_elo, max_elo, result)
        
        if min_elo <= node.elo <= max_elo:
            result.append(node.player)
        
        if max_elo > node.elo:
            self._range_query(node.right, min_elo, max_elo, result)
    
    def to_dict(self, node=None, is_root=True):
        if is_root:
            node = self.root
        if not node:
            return None
        
        return {
            'elo': node.elo,
            'player': node.player,
            'balance_factor': node.balance_factor,
            'height': node.height,
            'left': self.to_dict(node.left, False),
            'right': self.to_dict(node.right, False)
        }

# ═══════════════════════════════════════════════════
#            PRIORITY QUEUE (MIN-HEAP)
# ═══════════════════════════════════════════════════

class PriorityQueue:
    def __init__(self):
        self.heap = []
    
    def insert(self, priority, player_id):
        self.heap.append((priority, player_id))
        self._heapify_up(len(self.heap) - 1)
    
    def extract_min(self):
        if not self.heap:
            return None
        
        if len(self.heap) == 1:
            return self.heap.pop()
        
        min_item = self.heap[0]
        self.heap[0] = self.heap.pop()
        self._heapify_down(0)
        return min_item
    
    def _heapify_up(self, index):
        parent = (index - 1) // 2
        if index > 0 and self.heap[index][0] < self.heap[parent][0]:
            self.heap[index], self.heap[parent] = self.heap[parent], self.heap[index]
            self._heapify_up(parent)
    
    def _heapify_down(self, index):
        smallest = index
        left = 2 * index + 1
        right = 2 * index + 2
        
        if left < len(self.heap) and self.heap[left][0] < self.heap[smallest][0]:
            smallest = left
        
        if right < len(self.heap) and self.heap[right][0] < self.heap[smallest][0]:
            smallest = right
        
        if smallest != index:
            self.heap[index], self.heap[smallest] = self.heap[smallest], self.heap[index]
            self._heapify_down(smallest)
    
    def size(self):
        return len(self.heap)

# ═══════════════════════════════════════════════════
#              GLOBAL STATE
# ═══════════════════════════════════════════════════

avl_tree = AVLTree()
priority_queue = PriorityQueue()
players = {}  # player_id -> player_data
match_history = deque(maxlen=10)
stats = {
    'total_matches': 0,
    'total_balance_score': 0,
    'total_wait_time': 0
}
simulation_running = False
simulation_speed = 1.0

# ═══════════════════════════════════════════════════
#              HELPER FUNCTIONS
# ═══════════════════════════════════════════════════

FIRST_NAMES = ['Shadow', 'Blaze', 'Viper', 'Razor', 'Storm', 'Ghost', 'Nova', 'Frost', 'Titan', 'Echo']
LAST_NAMES = ['Reaper', 'Hunter', 'Striker', 'Phantom', 'Destroyer', 'Sniper', 'Warrior', 'Slayer', 'Knight', 'Demon']

def generate_player():
    player_id = f"P{random.randint(1000, 9999)}"
    elo = int(random.gauss(1500, 150))
    elo = max(1000, min(2000, elo))
    
    return {
        'id': player_id,
        'name': f"{random.choice(FIRST_NAMES)}{random.choice(LAST_NAMES)}{random.randint(10, 99)}",
        'elo': elo,
        'ping': random.randint(15, 80),
        'join_time': time.time(),
        'in_queue': True
    }

def balance_teams(player_list):
    """Find optimal 5v5 split with minimum ELO difference"""
    from itertools import combinations
    
    total_elo = sum(p['elo'] for p in player_list)
    target = total_elo / 2
    
    best_diff = float('inf')
    best_team_a = None
    
    for team_a in combinations(player_list, 5):
        team_a_elo = sum(p['elo'] for p in team_a)
        diff = abs(team_a_elo - target)
        
        if diff < best_diff:
            best_diff = diff
            best_team_a = list(team_a)
    
    team_b = [p for p in player_list if p not in best_team_a]
    
    team_a_total = sum(p['elo'] for p in best_team_a)
    team_b_total = sum(p['elo'] for p in team_b)
    gap = abs(team_a_total - team_b_total)
    
    # Balance score: 100 - (gap / 10)
    balance_score = max(0, 100 - (gap / 10))
    
    return {
        'team_a': best_team_a,
        'team_b': team_b,
        'team_a_total': team_a_total,
        'team_b_total': team_b_total,
        'gap': gap,
        'balance_score': round(balance_score, 1)
    }

# ═══════════════════════════════════════════════════
#              SIMULATION LOOP
# ═══════════════════════════════════════════════════

def simulation_loop():
    global simulation_running
    
    while simulation_running:
        # Add new player
        if len(players) < 100 and random.random() < 0.7:
            player = generate_player()
            players[player['id']] = player
            
            rotations = avl_tree.insert(player['elo'], player)
            priority_queue.insert(player['join_time'], player['id'])
            
            socketio.emit('player_joined', {
                'player': player,
                'tree': avl_tree.to_dict(),
                'rotations': rotations,
                'queue_size': len(players)
            })
        
        # Try to form a match
        if len(players) >= 10:
            # Get median ELO
            elos = sorted([p['elo'] for p in players.values()])
            median_elo = elos[len(elos) // 2]
            
            # Range query: ±100 ELO from median
            eligible = avl_tree.range_query(median_elo - 100, median_elo + 100)
            
            if len(eligible) >= 10:
                # Pick the 10 longest-waiting players
                waiting_players = []
                for _ in range(min(10, priority_queue.size())):
                    _, pid = priority_queue.extract_min()
                    if pid in players and players[pid]['in_queue']:
                        waiting_players.append(players[pid])
                
                if len(waiting_players) == 10:
                    # Balance teams
                    match_data = balance_teams(waiting_players)
                    
                    # Remove from AVL tree and players dict
                    for p in waiting_players:
                        avl_tree.delete(p['elo'])
                        p['in_queue'] = False
                    
                    # Calculate avg wait time
                    current_time = time.time()
                    wait_times = [current_time - p['join_time'] for p in waiting_players]
                    avg_wait = sum(wait_times) / len(wait_times)
                    
                    # Update stats
                    stats['total_matches'] += 1
                    stats['total_balance_score'] += match_data['balance_score']
                    stats['total_wait_time'] += avg_wait
                    
                    match_record = {
                        'match_id': stats['total_matches'],
                        'timestamp': datetime.now().strftime('%H:%M:%S'),
                        'avg_wait': round(avg_wait, 1),
                        **match_data
                    }
                    
                    match_history.appendleft(match_record)
                    
                    socketio.emit('match_formed', {
                        'match': match_record,
                        'tree': avl_tree.to_dict(),
                        'stats': get_stats()
                    })
        
        time.sleep(2 / simulation_speed)

def get_stats():
    return {
        'queue_size': len([p for p in players.values() if p['in_queue']]),
        'total_matches': stats['total_matches'],
        'avg_balance': round(stats['total_balance_score'] / max(1, stats['total_matches']), 1),
        'avg_wait': round(stats['total_wait_time'] / max(1, stats['total_matches']), 1)
    }

# ═══════════════════════════════════════════════════
#              FLASK ROUTES
# ═══════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/stats')
def api_stats():
    return jsonify(get_stats())

@app.route('/api/players')
def api_players():
    return jsonify(list(players.values()))

@app.route('/api/tree')
def api_tree():
    return jsonify(avl_tree.to_dict())

@app.route('/api/player/add', methods=['POST'])
def add_player():
    data = request.json
    player = {
        'id': f"P{random.randint(1000, 9999)}",
        'name': data['name'],
        'elo': int(data['elo']),
        'ping': int(data['ping']),
        'join_time': time.time(),
        'in_queue': True
    }
    
    players[player['id']] = player
    rotations = avl_tree.insert(player['elo'], player)
    priority_queue.insert(player['join_time'], player['id'])
    
    socketio.emit('player_joined', {
        'player': player,
        'tree': avl_tree.to_dict(),
        'rotations': rotations,
        'queue_size': len(players)
    })
    
    return jsonify({'success': True, 'player': player})

@app.route('/api/player/delete/<player_id>', methods=['DELETE'])
def delete_player(player_id):
    if player_id in players:
        player = players[player_id]
        rotations = avl_tree.delete(player['elo'])
        del players[player_id]
        
        socketio.emit('player_deleted', {
            'player_id': player_id,
            'tree': avl_tree.to_dict(),
            'rotations': rotations
        })
        
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'error': 'Player not found'})

@app.route('/api/simulation/start', methods=['POST'])
def start_simulation():
    global simulation_running
    if not simulation_running:
        simulation_running = True
        thread = threading.Thread(target=simulation_loop, daemon=True)
        thread.start()
    return jsonify({'success': True})

@app.route('/api/simulation/stop', methods=['POST'])
def stop_simulation():
    global simulation_running
    simulation_running = False
    return jsonify({'success': True})

@app.route('/api/simulation/speed', methods=['POST'])
def set_speed():
    global simulation_speed
    simulation_speed = float(request.json['speed'])
    return jsonify({'success': True})

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
