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
<<<<<<< HEAD
// signaling-server/server.js
=======

>>>>>>> e190c887985dac0158d5688bd6517149e708c2db
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

<<<<<<< HEAD
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
=======
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
>>>>>>> e190c887985dac0158d5688bd6517149e708c2db
        if (!joinedCode || !joinedRole) return;
        const room = rooms.get(joinedCode);
        if (!room) return;
        const peer = room[otherRole(joinedRole)];
<<<<<<< HEAD
        if (peer && peer.readyState === WebSocket.OPEN) {
            send(peer, msg);
=======

        if (peer && peer.readyState === WebSocket.OPEN) {
            if (msg.type === 'description' || msg.type === 'candidate') {
                send(peer, msg);
            }
>>>>>>> e190c887985dac0158d5688bd6517149e708c2db
        }
    });

    ws.on('close', () => {
        if (joinedCode && rooms.has(joinedCode)) {
            const room = rooms.get(joinedCode);
            if (room[joinedRole] === ws) {
                room[joinedRole] = null;
<<<<<<< HEAD
            }
            if (!room.host && !room.controller) {
                rooms.delete(joinedCode);
=======
                console.log(`[Signaling] '${joinedRole}' disconnected from room [${code = joinedCode}]`);
                const peer = room[otherRole(joinedRole)];
                if (peer && peer.readyState === WebSocket.OPEN) {
                    send(peer, { type: 'peer-left' });
                }
            }
            if (!room.host && !room.controller) {
                rooms.delete(joinedCode);
                console.log(`[Signaling] Cleaned up empty room [${joinedCode}]`);
>>>>>>> e190c887985dac0158d5688bd6517149e708c2db
            }
        }
    });
});

<<<<<<< HEAD
console.log(`Signaling server listening on port ${PORT}`);
=======
console.log(`Signaling server listening on port ${PORT}`);
>>>>>>> e190c887985dac0158d5688bd6517149e708c2db
