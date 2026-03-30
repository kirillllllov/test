# Support Bot IST

A TypeScript/Node.js backend API for a support bot system. Uses Express for HTTP handling, XState for state machine management, DynamoDB for persistence, and MinIO/S3 for file storage.

## Architecture

- **Runtime**: Node.js 20, TypeScript (via `tsx` for dev, `tsc` for production builds)
- **Package Manager**: Yarn 1.22.22
- **Framework**: Express.js
- **State Management**: XState v5 (finite state machines for bot conversation flow)
- **Database**: AWS DynamoDB (local endpoint for dev at localhost:8000)
- **File Storage**: MinIO (S3-compatible)
- **Connector Pattern**: External messenger connectors (VK, Telegram) run on separate hosts, identified by `X-Connector-Name` header

## Connector Layer

Connectors are registered at startup from environment variables matching `*_CONNECTOR_URL`:
- `VK_CONNECTOR_URL=http://localhost:5001` → registers connector named `"vk"`
- `TELEGRAM_CONNECTOR_URL=http://localhost:5002` → registers connector named `"telegram"`

**Incoming** (connector → module): All 5 webhook routes require `X-Connector-Name` header.

**Outgoing** (module → connector): `HttpConnector` calls:
- `POST {baseUrl}/message` — send text
- `POST {baseUrl}/keyboard/create` — create keyboard, returns `message_id`
- `POST {baseUrl}/keyboard/update` — update existing keyboard

## Project Structure

```
src/
  index.ts                     # Entry point — calls initConnectors(), starts Express
  routes.ts                    # All API routes + appeal-agent proxy
  connectors/
    http-connector.ts          # HttpConnector (implements Connector interface)
    connector-registry.ts      # initConnectors() reads env, creates HttpConnectors
  middleware/
    connector-name.ts          # extractConnectorName — validates X-Connector-Name header
    auth.ts                    # JWT auth middleware
  controllers/
    main-bot-controller.ts     # Main webhook handler; routes user vs staff; no stubs
  services/
    appeal-service.ts          # Appeal listing business logic
    state-service.ts           # XState snapshot persistence (L1 NodeCache + L2 DynamoDB)
    dynamo-service.ts          # Simple appeal creation
    s3-service.ts              # MinIO/S3 — uploadTempFile, uploadBase64File, uploadBase64Images
    messaging-service.ts       # Unified outgoing messaging (sendText, sendKeyboard, updateKeyboard)
  machines/
    main-states.ts             # appealRootMachine — root user machine (context: userId, connectorName, chatId)
    master-create-appeal.ts    # appealCreateMachine — invoked child for appeal creation
    master-join-appeal.ts      # appealJoinMachine — invoked child for joining appeals
    support-appeal-machine.ts  # supportAppealMachine — staff side, keyed by appealId
  modules/
    messenger-aggregator/
      messenger-aggregator.ts  # Aggregates parse calls across connectors
      interfaces/connector.ts  # Connector interface (parse?, sendMessage, createKeyboard, updateKeyboard)
      types.ts                 # Incoming message types (Actions, Commands, InputKeyboard, etc.)
  db/
    dynamodb.ts                # DynamoDB client
    tables/                    # Table-specific CRUD (appeal, support-staff, user-state, etc.)
    types.ts                   # All DB entity types and TABLE_NAMES constants
  config/
    dynamo-db.ts               # DynamoDB client configuration
```

## API Endpoints

All incoming webhook routes require `X-Connector-Name` header.

| Route | Method | Description |
|---|---|---|
| `/health-check` | GET | Health check |
| `/command` | POST | Bot command (e.g. /start) |
| `/user_message` | POST | Free-text user message |
| `/keyboard/input` | POST | Keyboard button press |
| `/image` | POST | Image upload (base64 → S3) |
| `/message/action` | POST | Action on message (staff: `TAKE_WORK:APPEAL#id`) |
| `/appeal-agent` | POST | Proxy to AGENT_URL |
| `/appeal-agent` | GET | Poll appeal agent status (?executionId=) |

## State Machine Routing

- **Regular users** → `appealRootMachine` (keyed by `userId` in DynamoDB)
  - Spawns `appealCreateMachine` and `appealJoinMachine` as invoked children
- **Support staff** (checked via DynamoDB `isSupportStaff`) → `supportAppealMachine` (keyed by `appeal:${appealId}`)
  - Staff actions: `TAKE_WORK`, `SOLVE`, `RELEASE`, `SUBMIT_SOLUTION`, `REASSIGN`, `AUTO_REMIND`
  - Action string format: `"TAKE_WORK:APPEAL#abc123"`

## Machine Context

All machines carry `connectorName` and `chatId` in their context (serialized to DynamoDB snapshot). Actions use fire-and-forget async calls to `messagingService`.

## Image Handling

`POST /image` accepts `attachments_base64: string[]`, uploads each to MinIO via `uploadBase64Images()`, returns `{ attachment_urls: string[] }`, and forwards URLs to the user's machine as `ATTACH_FILE` events.

## Development

```bash
yarn dev    # Start development server with hot reload (tsx watch)
yarn build  # Compile TypeScript to dist/
yarn lint   # Run ESLint
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| PORT | Server port | 5000 |
| NODE_ENV | Environment mode | development |
| BOT_BASE_URL | Server bind host | 0.0.0.0 |
| `<NAME>_CONNECTOR_URL` | Connector endpoint (e.g. VK_CONNECTOR_URL) | — |
| AGENT_URL | Appeal agent service URL | — |
| DYNAMODB_ENDPOINT | DynamoDB endpoint | http://localhost:8000 |
| DYNAMODB_REGION | AWS region | us-east-1 |
| MINIO_ENDPOINT | MinIO endpoint | localhost |
| MINIO_PORT | MinIO port | 9000 |
| MINIO_ACCESS_KEY | MinIO access key | minioadmin |
| MINIO_SECRET_KEY | MinIO secret key | minioadmin |
| MINIO_BUCKET / S3_BUCKET | Storage bucket | support-bot-files |
| JWT_SECRET | JWT signing secret | — |

## Workflow

- **Start application**: `yarn dev` — runs the dev server on port 5000 with hot reload

## Deployment

Configured as a VM deployment (always-running) since the bot needs persistent state in memory.
