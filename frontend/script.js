class CollaborativeWhiteboard {
    constructor() {
        console.log('[Frontend] Initializing collaborative whiteboard...');
        
        // Canvas setup
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        // UI elements
        this.colorPicker = document.getElementById('colorPicker');
        this.brushSize = document.getElementById('brushSize');
        this.sizeValue = document.getElementById('sizeValue');
        this.clearBtn = document.getElementById('clearBtn');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');

        // Drawing state
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.currentColor = '#000000';
        this.currentSize = 3;

        // WebSocket connection
        this.ws = null;
        this.wsUrl = 'ws://localhost:8080';
        this.reconnectInterval = 2000; // 2 seconds
        this.reconnectTimer = null;
        this.pendingLocalStrokeCounts = new Map();
        this.pendingStrokeTTL = 15000; // 15 seconds
        this.maxPendingStrokes = 5000;
        this.coordinatePrecision = 2;

        // Initialize
        this.setupEventListeners();
        this.connectWebSocket();
        this.updateStatusIndicator();
        
        console.log('[Frontend] Initialization complete');
    }

    setupEventListeners() {
        // Canvas drawing - Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e, false));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e, false));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Canvas drawing - Touch events
        this.canvas.addEventListener('touchstart', (e) => this.startDrawing(e, true), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.draw(e, true), { passive: false });
        this.canvas.addEventListener('touchend', () => this.stopDrawing(), { passive: false });
        this.canvas.addEventListener('touchcancel', () => this.stopDrawing(), { passive: false });

        // UI controls
        this.colorPicker.addEventListener('change', (e) => {
            this.currentColor = e.target.value;
        });

        this.brushSize.addEventListener('input', (e) => {
            this.currentSize = parseInt(e.target.value);
            this.sizeValue.textContent = this.currentSize;
        });

        this.clearBtn.addEventListener('click', () => {
            this.clearCanvas();
        });

        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        // Set white background on first load and resize
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x, y;

        if (e.touches) {
            // Touch event
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            // Mouse event
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }

        return { x, y };
    }

    startDrawing(e, isTouch) {
        e.preventDefault();
        this.isDrawing = true;
        const { x, y } = this.getCanvasCoordinates(e);
        this.lastX = x;
        this.lastY = y;
    }

    draw(e, isTouch) {
        if (!this.isDrawing) return;

        e.preventDefault();
        const { x, y } = this.getCanvasCoordinates(e);

        // Draw locally immediately (for zero lag)
        this.drawStroke(this.lastX, this.lastY, x, y, this.currentColor, this.currentSize);

        // Send to gateway
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const strokeData = {
                type: 'stroke',
                data: {
                    x: x,
                    y: y,
                    prevX: this.lastX,
                    prevY: this.lastY,
                    color: this.currentColor,
                    size: this.currentSize
                }
            };
            this.ws.send(JSON.stringify(strokeData));
            this.rememberLocalStroke(strokeData.data);
            console.log('[Frontend] Stroke sent:', strokeData.data);
        } else {
            console.warn('[Frontend] WebSocket not ready, stroke not sent');
        }

        this.lastX = x;
        this.lastY = y;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    drawStroke(prevX, prevY, x, y, color, size) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = size;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(prevX, prevY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    }

    clearCanvas() {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    connectWebSocket() {
        try {
            console.log(`[Frontend] Attempting to connect to ${this.wsUrl}`);
            this.ws = new WebSocket(this.wsUrl);

            this.ws.addEventListener('open', () => {
                console.log('[Frontend] WebSocket connected successfully');
                this.updateStatusIndicator(true);
                // Clear any pending reconnect timer
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
            });

            this.ws.addEventListener('message', (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('[Frontend] Received message:', message.type);
                    this.handleMessage(message);
                } catch (e) {
                    console.error('[Frontend] Failed to parse message:', e, event.data);
                }
            });

            this.ws.addEventListener('close', () => {
                console.log('[Frontend] WebSocket disconnected');
                this.updateStatusIndicator(false);
                this.scheduleReconnect();
            });

            this.ws.addEventListener('error', (event) => {
                console.error('[Frontend] WebSocket error:', event);
                this.updateStatusIndicator(false);
            });
        } catch (e) {
            console.error('[Frontend] Failed to create WebSocket:', e);
            this.updateStatusIndicator(false);
            this.scheduleReconnect();
        }
    }

    handleMessage(message) {
        if (message.type === 'commit') {
            const { data } = message;
            if (!data) {
                return;
            }
            if (this.consumeLocalStroke(data)) {
                return;
            }
            console.log('[Frontend] Commit received, drawing stroke:', data);
            // Draw the committed stroke (from other users)
            this.drawStroke(
                data.prevX,
                data.prevY,
                data.x,
                data.y,
                data.color,
                data.size
            );
        } else {
            console.warn('[Frontend] Unknown message type:', message.type);
        }
    }

    buildStrokeKey(data) {
        const prevX = this.normalizeCoordinate(data.prevX);
        const prevY = this.normalizeCoordinate(data.prevY);
        const x = this.normalizeCoordinate(data.x);
        const y = this.normalizeCoordinate(data.y);
        if (prevX === null || prevY === null || x === null || y === null) {
            console.warn('[Frontend] Invalid stroke coordinates for dedupe:', {
                prevX: data.prevX,
                prevY: data.prevY,
                x: data.x,
                y: data.y
            });
            return null;
        }
        return `${prevX}|${prevY}|${x}|${y}|${data.color}|${data.size}`;
    }

    normalizeCoordinate(value) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
            return null;
        }
        return numberValue.toFixed(this.coordinatePrecision);
    }

    rememberLocalStroke(data) {
        this.cleanupPendingLocalStrokes();
        const key = this.buildStrokeKey(data);
        if (!key) {
            return;
        }
        const now = Date.now();
        const existingEntry = this.pendingLocalStrokeCounts.get(key);
        if (existingEntry) {
            existingEntry.count += 1;
            existingEntry.lastUpdated = now;
            this.pendingLocalStrokeCounts.set(key, existingEntry);
        } else {
            this.pendingLocalStrokeCounts.set(key, { count: 1, lastUpdated: now });
        }
        while (this.pendingLocalStrokeCounts.size > this.maxPendingStrokes) {
            const oldestKey = this.findOldestPendingStrokeKey();
            if (!oldestKey) break;
            this.pendingLocalStrokeCounts.delete(oldestKey);
        }
    }

    consumeLocalStroke(data) {
        this.cleanupPendingLocalStrokes();
        const key = this.buildStrokeKey(data);
        if (!key) {
            return false;
        }
        const entry = this.pendingLocalStrokeCounts.get(key);
        if (!entry || entry.count <= 0) {
            return false;
        }
        if (entry.count === 1) {
            this.pendingLocalStrokeCounts.delete(key);
        } else {
            entry.count -= 1;
            entry.lastUpdated = Date.now();
            this.pendingLocalStrokeCounts.set(key, entry);
        }
        return true;
    }

    cleanupPendingLocalStrokes() {
        const now = Date.now();
        for (const [key, entry] of this.pendingLocalStrokeCounts.entries()) {
            if ((now - entry.lastUpdated) > this.pendingStrokeTTL) {
                this.pendingLocalStrokeCounts.delete(key);
            }
        }
    }

    findOldestPendingStrokeKey() {
        let oldestKey = null;
        let oldestTimestamp = Infinity;
        for (const [key, entry] of this.pendingLocalStrokeCounts.entries()) {
            if (entry.lastUpdated < oldestTimestamp) {
                oldestTimestamp = entry.lastUpdated;
                oldestKey = key;
            }
        }
        return oldestKey;
    }

    scheduleReconnect() {
        if (this.reconnectTimer) {
            return; // Already scheduled
        }

        console.log(`[Frontend] Reconnect scheduled in ${this.reconnectInterval}ms`);
        this.reconnectTimer = setTimeout(() => {
            console.log('[Frontend] Attempting to reconnect WebSocket...');
            this.reconnectTimer = null;
            this.connectWebSocket();
        }, this.reconnectInterval);
    }

    updateStatusIndicator(connected = null) {
        if (connected === null) {
            connected = this.ws && this.ws.readyState === WebSocket.OPEN;
        }

        if (connected) {
            this.statusDot.className = 'status-dot connected';
            this.statusText.textContent = 'Connected';
        } else {
            this.statusDot.className = 'status-dot disconnected';
            this.statusText.textContent = 'Disconnected';
        }
    }
}

// Initialize whiteboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.whiteboard = new CollaborativeWhiteboard();
});
