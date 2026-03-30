# Support Bot IST

A TypeScript/Node.js backend API for a support bot system. Uses Express for HTTP handling, XState for state machine management, DynamoDB for persistence, and MinIO/S3 for file storage.

## Architecture

- **Runtime**: Node.js 20, TypeScript (via `tsx` for dev, `tsc` for production builds)
- **Package Manager**: Yarn 1.22.22
- **Framework**: Express.js
- **State Management**: XState v5 (finite state machines for bot conversation flow)
- **Database**: AWS DynamoDB (local endpoint for dev)
- **File Storage**: MinIO (S3-compatible)
- **Auth**: JWT tokens

## Project Structure

```
src/
  index.ts                  # Entry point — Express server setup
  routes.ts                 # API routes
  database.ts               # DB stub (placeholder)
  config/
    dynamo-db.ts            # DynamoDB client configuration
  controllers/
    main-bot-controller.ts  # Main webhook handler
  services/
    appeal-service.ts       # Appeal business logic
    state-service.ts        # XState snapshot persistence
    dynamo-service.ts       # DynamoDB operations
    s3-service.ts           # MinIO/S3 file operations
    counter-service.ts      # Counter utilities
  machines/
    main-states.ts          # Root state machine
    support-appeal-machine.ts
    master-create-appeal.ts
    master-join-appeal.ts
    repair-bot-machine.ts
  db/
    dynamodb.ts             # DynamoDB table helpers
    tables/                 # Table-specific queries
    types.ts                # DB type definitions
  middleware/
    auth.ts                 # JWT auth middleware
    require-authentication.ts
    validate.ts             # Request validation
  modules/
    messenger-aggregator/   # Unified message parsing layer
    types/                  # Shared type definitions
```

## API Endpoints

- `GET /health-check` — Health check
- `POST /ai-agent` — AI agent stub
- `POST /image` — Handle image messages
- `POST /command` — Handle bot commands
- `POST /user_message` — Handle user messages
- `POST /message/action` — Handle inline actions
- `POST /keyboard/input` — Handle keyboard input

## Development

```bash
yarn dev    # Start development server with hot reload (tsx watch)
yarn build  # Compile TypeScript to dist/
yarn lint   # Run ESLint
yarn test   # Run Vitest tests
```

## Environment Variables (Development)

| Variable | Description | Default |
|---|---|---|
| PORT | Server port | 5000 |
| NODE_ENV | Environment mode | development |
| BOT_BASE_URL | Server bind host | 0.0.0.0 |
| DYNAMODB_TABLE | DynamoDB table name | support-bot-table |
| DYNAMODB_ENDPOINT | DynamoDB endpoint | http://localhost:8000 |
| DYNAMODB_REGION | AWS region | us-east-1 |
| AWS_ACCESS_KEY_ID | AWS key (fake for local) | fake |
| AWS_SECRET_ACCESS_KEY | AWS secret (fake for local) | fake |
| MINIO_ENDPOINT | MinIO endpoint | localhost:9000 |
| MINIO_BUCKET | MinIO bucket | support-bot-files |
| JWT_SECRET | JWT signing secret | — |

## Workflow

- **Start application**: `yarn dev` — runs the dev server on port 5000 with hot reload

## Deployment

Configured as a VM deployment (always-running) since the bot needs persistent state in memory.
Run command: `yarn dev`
