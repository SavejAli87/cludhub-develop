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

        // Handle peer joining room
        if (msg.type === 'join') {
            const { code, role } = msg;
            if (!code || !role) return;

            // If this socket was already in another room, clean it up first
            if (joinedCode && rooms.has(joinedCode)) {
                const oldRoom = rooms.get(joinedCode);
                if (oldRoom[joinedRole] === ws) {
                    oldRoom[joinedRole] = null;
                }
            }

            if (!rooms.has(code)) {
                rooms.set(code, { host: null, controller: null });
            }
            const room = rooms.get(code);

            // If the role slot already has a stale dead socket, overwrite it cleanly
            room[role] = ws;
            joinedCode = code;
            joinedRole = role;

            console.log(`[Signaling] '${role}' joined room [${code}]`);

            const peer = room[otherRole(role)];
            // When both Host and Controller are present and open, notify both
            if (peer && peer.readyState === WebSocket.OPEN) {
                console.log(`[Signaling] Both peers ready in room [${code}]. Emitting peer-joined.`);
                send(peer, { type: 'peer-joined' });
                send(ws, { type: 'peer-joined' });
            }
            return;
        }

        // Leave room message for explicit teardown
        if (msg.type === 'leave') {
            if (joinedCode && rooms.has(joinedCode)) {
                const room = rooms.get(joinedCode);
                room[joinedRole] = null;
                const peer = room[otherRole(joinedRole)];
                if (peer && peer.readyState === WebSocket.OPEN) {
                    send(peer, { type: 'peer-left' });
                }
                if (!room.host && !room.controller) {
                    rooms.delete(joinedCode);
                }
            }
            joinedCode = null;
            joinedRole = null;
            return;
        }

        // Relay SDP description and ICE candidates
        if (!joinedCode || !joinedRole) return;
        const room = rooms.get(joinedCode);
        if (!room) return;
        const peer = room[otherRole(joinedRole)];

        if (peer && peer.readyState === WebSocket.OPEN) {
            if (msg.type === 'description' || msg.type === 'candidate') {
                send(peer, msg);
            }
        }
    });

    ws.on('close', () => {
        if (joinedCode && rooms.has(joinedCode)) {
            const room = rooms.get(joinedCode);
            if (room[joinedRole] === ws) {
                room[joinedRole] = null;
                console.log(`[Signaling] '${joinedRole}' disconnected from room [${code = joinedCode}]`);
                const peer = room[otherRole(joinedRole)];
                if (peer && peer.readyState === WebSocket.OPEN) {
                    send(peer, { type: 'peer-left' });
                }
            }
            if (!room.host && !room.controller) {
                rooms.delete(joinedCode);
                console.log(`[Signaling] Cleaned up empty room [${joinedCode}]`);
            }
        }
    });
});

console.log(`Signaling server listening on port ${PORT}`);
