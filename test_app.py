import subprocess
import time
import json
import urllib.request
import os
import shutil

# Launch Edge with remote debugging
temp_dir = os.environ.get('TEMP', '.')
user_data = os.path.join(temp_dir, 'edge_test_profile')
shot_path = os.path.join(temp_dir, 'commit_deck_active.png')

# Clean old user data
shutil.rmtree(user_data, ignore_errors=True)

proc = subprocess.Popen([
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    '--headless=new',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    f'--user-data-dir={user_data}',
    '--window-size=1400,1050',
    'file:///c:/Users/SHIVAM/OneDrive/Desktop/commit-deck/index.html'
])

try:
    # Wait for browser to start
    time.sleep(2)

    # Get page target
    req = urllib.request.urlopen('http://localhost:9222/json')
    targets = json.loads(req.read().decode())
    ws_url = targets[0]['webSocketDebuggerUrl']
    print("Connected to Edge DevTools target:", targets[0]['title'])

    # Python WebSocket without external libs
    import socket, hashlib, base64

    # Connect to WebSocket
    host, port = 'localhost', 9222
    path = ws_url.split(f'{host}:{port}')[1]
    
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, port))

    sec_key = base64.b64encode(os.urandom(16)).decode()
    handshake = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {sec_key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    )
    s.sendall(handshake.encode())
    resp = s.recv(4096)
    assert b"101 Switching Protocols" in resp, "Handshake failed"

    def send_cdp(cmd_id, method, params=None):
        msg = json.dumps({"id": cmd_id, "method": method, "params": params or {}})
        payload = msg.encode()
        frame = bytearray([0x81]) # text frame, FIN
        length = len(payload)
        mask_key = os.urandom(4)
        if length <= 125:
            frame.append(0x80 | length)
        elif length <= 65535:
            frame.append(0x80 | 126)
            frame.extend(length.to_bytes(2, 'big'))
        else:
            frame.append(0x80 | 127)
            frame.extend(length.to_bytes(8, 'big'))
        frame.extend(mask_key)
        masked_payload = bytearray([b ^ mask_key[i % 4] for i, b in enumerate(payload)])
        frame.extend(masked_payload)
        s.sendall(frame)

    def recv_cdp():
        buf = s.recv(65536)
        if not buf: return None
        # Minimal frame parser
        idx = 2
        length = buf[1] & 0x7F
        if length == 126:
            idx = 4
        elif length == 127:
            idx = 10
        data = buf[idx:]
        try:
            return json.loads(data.decode('utf-8', errors='ignore'))
        except Exception:
            return None

    # Enable console
    send_cdp(1, "Console.enable")
    send_cdp(2, "Runtime.enable")

    # Evaluate test interactions
    test_script = """
    (() => {
        // 1. Enter task #1 text and check it
        const task1Input = document.querySelector('.task-slot[data-index="0"] .task-input');
        task1Input.value = "Ship the Unified Focus & Habit Deck";
        task1Input.dispatchEvent(new Event('blur'));

        const task1Check = document.querySelector('.task-slot[data-index="0"] .task-checkbox');
        task1Check.click();

        // 2. Toggle Workout habit (+2) and Reading (+1)
        const workoutPill = document.querySelector('.habit-pill[data-habit-id="workout"]');
        workoutPill.click();

        const readPill = document.querySelector('.habit-pill[data-habit-id="read"]');
        readPill.click();

        // 3. Seed demo data to preview full heatmap
        const seedBtn = document.getElementById('seed-demo-btn');
        // directly invoke seed
        const stateRaw = localStorage.getItem('commit_deck_state_v1');
        const state = JSON.parse(stateRaw);
        return {
            todayScore: document.getElementById('stat-today-points').textContent,
            headerScore: document.getElementById('header-today-score').textContent,
            currentStreak: document.getElementById('stat-current-streak').textContent,
            task1Completed: document.querySelector('.task-slot[data-index="0"]').classList.contains('completed'),
            workoutActive: workoutPill.classList.contains('active'),
            readActive: readPill.classList.contains('active')
        };
    })()
    """
    send_cdp(3, "Runtime.evaluate", {"expression": test_script, "returnByValue": True})
    time.sleep(1)

    # Now seed realistic 365 days of demo data to see the heatmap alive!
    seed_script = """
    (() => {
        // Trigger seed demo data directly
        const today = new Date();
        const raw = localStorage.getItem('commit_deck_state_v1');
        const state = JSON.parse(raw);
        
        for (let i = 364; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const key = `${y}-${m}-${day}`;
            
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            if (Math.random() < (isWeekend ? 0.5 : 0.88)) {
                const weights = [1, 2, 2, 3, 3, 4, 5, 6, 7];
                state.heatmapHistory[key] = weights[Math.floor(Math.random() * weights.length)];
            } else {
                state.heatmapHistory[key] = 0;
            }
        }
        // Today has 4 points (task 1 + workout 2 + read 1)
        const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        state.heatmapHistory[todayKey] = 4;
        localStorage.setItem('commit_deck_state_v1', JSON.stringify(state));
        location.reload();
    })()
    """
    send_cdp(4, "Runtime.evaluate", {"expression": seed_script})
    time.sleep(2)

    # Take screenshot of active, populated state
    send_cdp(5, "Page.captureScreenshot")
    time.sleep(1)

    s.close()

finally:
    proc.terminate()
    proc.wait()

# Now capture screenshot with standard edge command
shot_res = subprocess.run([
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    '--headless=new',
    '--disable-gpu',
    f'--user-data-dir={user_data}',
    f'--screenshot={shot_path}',
    '--window-size=1400,1050',
    'file:///c:/Users/SHIVAM/OneDrive/Desktop/commit-deck/index.html'
], capture_output=True, text=True)

if os.path.exists(shot_path):
    dest = r'c:\Users\SHIVAM\OneDrive\Desktop\commit-deck\screenshot_active.png'
    shutil.copyfile(shot_path, dest)
    print("Captured populated state screenshot to", dest)
