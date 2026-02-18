# 🎮 HARDPOINT MATCHMAKER - Multiplayer Matchmaking Engine

A pixel-art, game-inspired matchmaking system built for Call of Duty Hardpoint 5v5 matches. Features intelligent team balancing using AVL Trees and Priority Queues with a stunning retro UI.

## ✨ Features

### 🎯 Core Functionality
- **AVL Tree** - Keeps players sorted by ELO rating with O(log n) operations
- **Priority Queue** - Ensures fairest wait times for all players
- **Smart Team Balancing** - Optimizes 5v5 team splits for minimum ELO gap
- **Real-time Updates** - WebSocket-powered live matchmaking

### 🎨 Three Interactive Tabs

#### 1. **LOBBY** - Watch Matches Form Live
- Real-time player queue with animated cards
- Live match formation with smooth team split animations
- Balance scores with color-coded ratings (green/orange/red)
- Match history with detailed breakdowns
- Stats dashboard tracking queue size, matches, balance, and wait times

#### 2. **AVL TREE** - Visualize the Data Structure
- Interactive SVG tree rendering
- Smooth rotation animations when nodes are added/removed
- Clickable nodes show player details in a slide-in panel
- Toggle balance factors display
- Search functionality to highlight specific nodes

#### 3. **PLAYER MANAGEMENT** - Admin Control Panel
- Full player CRUD operations
- Search by name with instant filtering
- ELO range slider filters
- Clean table view with status badges
- Floating action button for quick adds

### 🌓 Light & Dark Themes
- Fully designed dual themes (not just color swaps)
- Smooth transitions between modes
- Persistent theme preference

### 🎨 Pixel-Art Game Aesthetic
- Retro pixel font (Press Start 2P)
- Animated starfield background
- Chunky borders and shadows
- Vibrant neon accents (pink/cyan)
- Smooth CSS animations throughout

## 🚀 Quick Start

### Installation

```bash
# Clone or navigate to the project directory
cd matchmaking_engine

# Install Python dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

### Access the Application

Open your browser and navigate to:
```
http://localhost:5000
```

## 🎮 How to Use

### Starting a Simulation

1. Click **START SIMULATION** in the Lobby tab
2. Players will automatically join the queue
3. Every 10 players get matched and split into balanced teams
4. Watch the team formation animation!

### Manually Adding Players

1. Switch to the **PLAYERS** tab
2. Click the **+** floating button (bottom right)
3. Enter player name, ELO (500-2500), and ping
4. Click **ADD PLAYER**

### Viewing the AVL Tree

1. Switch to the **AVL TREE** tab
2. Click any node to see player details
3. Toggle **SHOW BALANCE** to see balance factors
4. Use the search box to find specific ELO ratings

### Adjusting Simulation Speed

- Use the **SPEED** slider in the top-right (0.5x to 3x)
- Useful for demos and presentations

## 📊 What Makes This Project Special

### Data Structures
- **AVL Tree** with full balancing (left/right/left-right/right-left rotations)
- **Priority Queue** implemented as a min-heap
- **Subset-Sum Optimizer** for team balancing

### Team Balancing Algorithm
Instead of randomly splitting 10 players:
1. Calculate total ELO of all 10 players
2. Find all possible 5-player combinations
3. Pick the combination closest to half the total ELO
4. Result: minimized ELO gap between teams

### Real-Time Features
- WebSocket communication (Flask-SocketIO)
- Live queue updates
- Instant tree visualization updates
- Match formation broadcasts

## 🎨 Design Philosophy

Inspired by retro pixel-art space games:
- **Typography**: Press Start 2P for that authentic arcade feel
- **Colors**: Deep purples/blues with neon pink and cyan accents
- **Animations**: Smooth, purposeful, game-like transitions
- **Layout**: Clean, organized, functional

## 📁 Project Structure

```
matchmaking_engine/
├── app.py                 # Flask backend + AVL Tree + Priority Queue
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── css/
│   │   └── style.css     # Complete styling with themes
│   └── js/
│       └── main.js       # Frontend logic + WebSocket handling
```

## 🛠️ Tech Stack

- **Backend**: Flask, Flask-SocketIO
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Styling**: Pure CSS with CSS Variables
- **Real-time**: WebSockets
- **Data Structures**: Custom AVL Tree and Priority Queue implementations

## 🎯 Performance

- **AVL Tree**: O(log n) insert/delete/search
- **Priority Queue**: O(log n) insert/extract-min
- **Team Balancing**: O(n choose k) with optimizations
- **Supports**: 100+ concurrent players in queue

## 📝 Future Enhancements

- **Party System**: Queue as a group (2-3 players)
- **Ping-Aware Matching**: Factor in latency
- **Dynamic Skill Windows**: Auto-widen ELO range if needed
- **Match History Persistence**: Save to database
- **ELO Updates**: Winners gain, losers lose ELO after matches

## 👨‍💻 Development Notes

### Adding More Players Manually
The simulation generates realistic player data, but you can add custom players via the UI or API:

```bash
curl -X POST http://localhost:5000/api/player/add \
  -H "Content-Type: application/json" \
  -d '{"name":"CustomPlayer","elo":1600,"ping":25}'
```

### Viewing API Endpoints
- `GET /api/stats` - Current stats
- `GET /api/players` - All players
- `GET /api/tree` - AVL Tree structure
- `POST /api/player/add` - Add player
- `DELETE /api/player/delete/<id>` - Delete player
- `POST /api/simulation/start` - Start simulation
- `POST /api/simulation/stop` - Stop simulation
- `POST /api/simulation/speed` - Set speed

## 🎓 Educational Value

Perfect for demonstrating:
- Advanced Data Structures (AVL Trees, Priority Queues)
- Algorithm Design (Team Balancing)
- Real-time Web Applications
- Full-Stack Development
- UI/UX Design

## 📄 License

Educational project - feel free to use and modify!

---

**Built with 💜 for Advanced Data Structures Course Project**
