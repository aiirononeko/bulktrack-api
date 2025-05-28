# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
pnpm dev                # Start local development server (wrangler dev)
pnpm deploy             # Deploy to Cloudflare Workers with minification

# Database migrations
pnpm generate           # Generate Drizzle migrations from schema changes
pnpm local:migration    # Apply migrations to local D1 database
pnpm remote:migration   # Apply migrations to remote D1 database

# Code quality (use Biome for all linting/formatting)
npx biome check         # Run linter and formatter checks
npx biome check --write # Auto-fix linting and formatting issues
```

## Architecture Overview

This is a **Cloudflare Workers** fitness tracking API built with **Clean Architecture/Hexagonal Architecture**:

```
src/
├── domain/           # Pure business logic (entities, services, repositories)
├── application/      # Use cases, commands, queries, DTOs  
├── infrastructure/   # External adapters (D1, KV, JWT, logging)
└── interface/        # HTTP layer (Hono routes, handlers, middleware)
```

**Core Technologies:**
- **Hono** framework for HTTP routing and middleware
- **Drizzle ORM** with **SQLite (D1 database)** 
- **Valibot** for request/response validation
- **JWT** authentication with device-based onboarding
- **Cloudflare KV** for refresh token storage

## Domain Architecture

### Layer Dependencies (Strict)
1. **Domain** → No external dependencies (pure business logic)
2. **Application** → Domain only (orchestrates domain services via commands/queries)
3. **Infrastructure** → Domain + Application (concrete implementations of ports)
4. **Interface** → All layers (HTTP concerns, DI containers)

### Key Domain Concepts
- **Device-based authentication**: Zero-tap onboarding with anonymous users
- **Exercise library**: Multilingual exercise names with muscle group mappings
- **Effective volume calculation**: `volume * tension_ratio * tension_factor` for muscle-specific training load
- **Workout tracking**: Sets with RPE, volume, and detailed exercise modifiers

## Database Schema (Drizzle)

**Schema location**: `src/infrastructure/db/schema.ts`
**Migrations**: `drizzle/` directory

**Key entities:**
- `users` - Anonymous users created on device activation
- `user_devices` - Device-to-user mapping for authentication
- `exercises` - Exercise library with translations
- `exercise_muscles` - Many-to-many with tension ratios
- `workout_sets` - Core training data with volume calculations
- `muscle_volumes_weekly` - Aggregated training volume per muscle group

## Authentication Flow

1. **Device Activation** (`POST /v1/auth/device`)
   - Send `X-Device-Id` header
   - Creates anonymous user if device is new
   - Returns access + refresh JWT tokens

2. **Token Refresh** (`POST /v1/auth/refresh`)
   - Use refresh token to get new access token
   - Refresh tokens stored in Cloudflare KV

3. **Protected Routes**
   - Use `Authorization: Bearer <access_token>` header
   - 15-minute TTL on access tokens

## API Structure

**Base URL**: `/v1`
**Routes**: Organized by feature in `src/interface/http/modules/`
- `/auth` - Device activation, token refresh
- `/exercises` - Exercise search, recent exercises  
- `/sets` - Workout set CRUD operations
- `/dashboard` - Training statistics and volume data

**Multilingual Support**: Use `Accept-Language` header for exercise names and muscle groups.

## Development Guidelines

### File Creation Rules
- Create new files only in existing directory structure
- Follow Clean Architecture layer boundaries strictly
- Tests go alongside source files as `*.test.ts`
- Use feature-based organization within each layer

### Code Style (Biome)
- 2-space indentation
- Double quotes for strings
- Auto-organize imports
- Run `npx biome check --write` before committing

### Post-Task Requirements
**IMPORTANT**: After completing any coding task, Claude MUST run the following command to ensure code quality:
```bash
npx biome check --write
```
This is mandatory for all tasks involving code changes and should be the final step before marking tasks as complete.

### Testing Commands
No specific test runner configured in package.json. Test files should be placed in:
- `tests/unit/` - Unit tests
- `tests/integration/` - Integration tests  
- `tests/e2e/` - End-to-end tests

### Deployment
- Uses **Cloudflare Workers** with D1 database and KV storage
- Configuration in `wrangler.jsonc`
- Deploy with `pnpm deploy` (includes minification)
- Database migrations must be run separately via `pnpm remote:migration`