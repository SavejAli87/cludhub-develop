// Minimal WebRTC Signaling Server with clean room re-entry and reconnect handling.
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Active rooms mapped by pairing code:
// code -> { host: WebSocket | null, controller: WebSocket | null }
const rooms = new Map();

function send(ws, obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
    }
}

function otherRole(role) {
    return role === 'host' ? 'controller' : 'host';
}
// signaling-server/server.js
wss.on('connection', (ws) => {
    let joinedCode = null;
    let joinedRole = null;

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }

        // Handle both 'join' and 'connect'
       // signaling-server/server.js
if (msg.type === 'join' || msg.type === 'register-host') {
    const { code, role } = msg;
    if (!code || !role) return;

    if (!rooms.has(code)) {
        rooms.set(code, { host: null, controller: null });
    }
    const room = rooms.get(code);

    // Overwrite socket for this role
    room[role] = ws;
    joinedCode = code;
    joinedRole = role;

    console.log(`[Signaling] ${role} joined room: ${code}`);

    const other = role === 'host' ? 'controller' : 'host';
    const peer = room[other];

    // If both peers are active, ALWAYS trigger negotiation
    if (peer && peer.readyState === WebSocket.OPEN) {
        console.log(`[Signaling] Triggering WebRTC negotiation for room: ${code}`);
        // Notify both sides so host creates a fresh WebRTC offer
        send(room.host, { type: 'peer-joined' });
        send(room.controller, { type: 'peer-joined' });
    }
    return;
}

        // Controller connection request
        if (msg.type === 'connect') {
            const code = msg.code;
            const room = rooms.get(code);
            if (!room || !room.host || room.host.readyState !== WebSocket.OPEN) {
                send(ws, { type: 'error', message: 'Host not found' });
                return;
            }
            room.controller = ws;
            joinedCode = code;
            joinedRole = 'controller';
            send(room.host, { type: 'peer-joined' });
            send(ws, { type: 'peer-joined' });
            return;
        }

        // Relay SDP / Candidates
        if (!joinedCode || !joinedRole) return;
        const room = rooms.get(joinedCode);
        if (!room) return;
        const peer = room[otherRole(joinedRole)];
        if (peer && peer.readyState === WebSocket.OPEN) {
            send(peer, msg);
        }
    });

    ws.on('close', () => {
        if (joinedCode && rooms.has(joinedCode)) {
            const room = rooms.get(joinedCode);
            if (room[joinedRole] === ws) {
                room[joinedRole] = null;
            }
            if (!room.host && !room.controller) {
                rooms.delete(joinedCode);
            }
        }
    });
});

console.log(`Signaling server listening on port ${PORT}`);