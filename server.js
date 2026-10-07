// Minimal signaling server. Its only job: relay SDP descriptions and ICE
// candidates between two peers that share a pairing code. It never sees
// screen content or input events -- those flow over the encrypted
// libdatachannel P2P connection once established.
//
// Run: npm install && node server.js
// Self-host this on your own VPS -- no third party ever touches this traffic.

const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// code -> { host: ws|null, controller: ws|null }
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

        if (msg.type === 'join') {
            const { code, role } = msg;
            if (!code || !role) return;

            if (!rooms.has(code)) {
                rooms.set(code, { host: null, controller: null });
            }
            const room = rooms.get(code);
            room[role] = ws;
            joinedCode = code;
            joinedRole = role;

            const peer = room[otherRole(role)];
            if (peer) {
                send(peer, { type: 'peer-joined' });
                send(ws, { type: 'peer-joined' });
            }
            return;
        }

        if (!joinedCode || !joinedRole) return;
        const room = rooms.get(joinedCode);
        if (!room) return;
        const peer = room[otherRole(joinedRole)];
        if (!peer) return;

        // Relay description / candidate messages verbatim to the other peer.
        if (msg.type === 'description' || msg.type === 'candidate') {
            send(peer, msg);
        }
    });

    ws.on('close', () => {
        if (joinedCode && rooms.has(joinedCode)) {
            const room = rooms.get(joinedCode);
            room[joinedRole] = null;
            if (!room.host && !room.controller) {
                rooms.delete(joinedCode);
            }
        }
    });
});

console.log(`Signaling server listening on ws://localhost:${PORT}`);
