# Messaging, calls, and screen share

OPUS uses **Socket.io** for realtime chat and **LiveKit Cloud** for voice, video, and screen share (same SFU approach many production apps use).

## Environment (server)

Add to `server/.env`:

```
CLIENT_URL=http://localhost:5173
# Production example:
# CLIENT_URL=https://your-frontend.example.com

LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxx
LIVEKIT_API_SECRET=secretxxxxxxxx
```

1. Create a free project at [https://cloud.livekit.io](https://cloud.livekit.io)
2. Copy the WebSocket URL, API key, and API secret
3. Restart the OPUS server

Without LiveKit keys, **text messaging still works**. Calls return a clear “not configured” error until keys are set.

## How conversations are created

When an employer **accepts a bid**, the server:

1. Creates / ensures a `WorkSession`
2. Creates a `Conversation` between that employer and freelancer
3. Seeds a system message: **Start a conversation**
4. Notifies both users and emits `conversation:created` over Socket.io

Existing accepted bids are backfilled the first time either party loads the conversation list.

## Client surfaces

| Role | Full inbox | Floating dock | Calls |
|------|------------|---------------|-------|
| Employer | `/employer/messages` | Bottom-right dock + FAB | Audio / video / screen |
| Freelancer | `/messages` | Bottom-right dock + FAB + nav icon | Audio / video / screen |

## Reliability notes

- Messages are saved to MongoDB before broadcast
- `clientMsgId` makes sends idempotent (no duplicate bubbles on retry)
- Socket events are membership-checked server-side (wrong-person delivery blocked)
- LiveKit room names are minted only on the server: `opus-conv-{conversationId}`
- Call tokens expire in ~1 hour

## Production checklist

- [ ] Set `CLIENT_URL` to the real HTTPS frontend origin (Socket.io CORS)
- [ ] Set LiveKit env vars on the server host
- [ ] Serve the client over HTTPS (browser mic/camera/screen require secure context except localhost)
- [ ] Optional later: Socket.io Redis adapter if you run multiple Node instances
