# OLT Management System

## Overview
A comprehensive OLT (Optical Line Terminal) Management System for multi-vendor GPON/EPON networks. Built with React, Node.js/Express, and PostgreSQL. Supports Huawei and ZTE OLT vendors, ONU discovery and provisioning, TR-069/ACS for advanced configuration, real-time monitoring, and multi-tenant architecture.

## Project Architecture

### Frontend (client/)
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Routing**: Wouter
- **State Management**: TanStack Query for server state
- **Design System**: Material Design inspired (Linear, Grafana, AWS Console)

### Backend (server/)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **Session Management**: Express-session with connect-pg-simple

### Shared (shared/)
- **schema.ts**: Drizzle database schema and Zod validation schemas

## Key Features

### 1. OLT Management
- Multi-vendor support (Huawei, ZTE)
- Connection status monitoring
- PON port configuration

### 2. ONU Management
- Discovery and provisioning via OMCI
- Service profile assignment
- Status monitoring (power levels, distance)

### 3. TR-069/ACS Server
- CWMP protocol support for CPE management
- Location: `server/acs/index.ts`
- Default port: 7547
- Features:
  - Device auto-discovery and registration
  - Parameter get/set operations
  - Firmware upgrade support
  - Remote reboot and factory reset
  - Configuration presets

### 4. Service Profiles
- Bandwidth configuration
- VLAN management
- QoS settings

### 5. Multi-tenant Architecture
- Tenant isolation
- Role-based access control (Super Admin, Tenant Admin, Operator)

## Database Schema

### Core Tables
- `users` - User accounts with role-based access
- `tenants` - Multi-tenant organization support
- `olts` - OLT devices (Huawei, ZTE)
- `onus` - ONU/ONT devices
- `service_profiles` - Bandwidth and service configurations
- `alerts` - System alerts and notifications
- `event_logs` - Audit trail

### TR-069 Tables
- `tr069_devices` - CPE devices managed via TR-069
- `tr069_parameters` - Device parameter cache
- `tr069_tasks` - Pending/completed device tasks
- `tr069_presets` - Auto-configuration presets
- `tr069_firmware` - Firmware images for upgrades

## API Routes

### Authentication
- `GET /api/auth/user` - Current user info
- `GET /api/login` - Initiate login
- `GET /api/logout` - Logout

### OLT Management
- `GET /api/olts` - List all OLTs
- `POST /api/olts` - Create OLT
- `GET /api/olts/:id` - Get OLT details
- `PATCH /api/olts/:id` - Update OLT
- `DELETE /api/olts/:id` - Delete OLT

### ONU Management
- `GET /api/onus` - List all ONUs
- `POST /api/onus` - Create ONU
- `GET /api/onus/:id` - Get ONU details
- `PATCH /api/onus/:id` - Update ONU
- `DELETE /api/onus/:id` - Delete ONU

### TR-069/ACS
- `GET /api/tr069/devices` - List managed devices
- `GET /api/tr069/devices/:id` - Device details
- `DELETE /api/tr069/devices/:id` - Remove device
- `GET /api/tr069/tasks` - List tasks
- `POST /api/tr069/tasks` - Create task
- `GET /api/tr069/presets` - List presets
- `POST /api/tr069/presets` - Create preset
- `GET /api/tr069/firmware` - List firmware images

### Other Endpoints
- `GET/POST /api/service-profiles`
- `GET/POST /api/alerts`
- `GET /api/tenants`
- `GET /api/event-logs`

## Running the Application

### Development
```bash
npm run dev
```
Starts Express server with Vite HMR on port 5000.

### Database
```bash
npm run db:push    # Push schema changes
npm run db:studio  # Open Drizzle Studio
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-provided)
- `SESSION_SECRET` - Session encryption key
- `REPLIT_DEPLOYMENT_ID` - Deployment context
- `ISSUER_URL` - OpenID Connect issuer

## Design Choices

### Hybrid Management Approach
- **OMCI**: Layer 2 provisioning (VLAN, GEM ports)
- **TR-069/ACS**: Layer 3 services (WiFi, VoIP, diagnostics)

### Material Design
- Clean, information-dense UI
- Dark mode support
- Consistent spacing and typography

## Recent Changes
- December 2025: Added TR-069/ACS server with full CWMP support
- December 2025: Implemented multi-tenant architecture
- December 2025: Added real-time monitoring capabilities
