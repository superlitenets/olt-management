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
- `GET /api/olts/:id/details` - Get detailed OLT info (boards, uplinks, VLANs, PON ports via SNMP)
- `PATCH /api/olts/:id` - Update OLT
- `DELETE /api/olts/:id` - Delete OLT
- `POST /api/olts/:id/poll` - Poll OLT via SNMP (CPU, memory, temperature, ONU count)
- `POST /api/olts/:id/vlans` - Create VLAN on OLT via CLI
- `DELETE /api/olts/:id/vlans/:vlanId` - Delete VLAN from OLT via CLI
- `POST /api/olts/:id/vlan-trunk` - Configure VLAN trunk on uplink port
- `POST /api/olts/:id/save-config` - Save OLT configuration
- `PATCH /api/olts/:id/acs-settings` - Update TR-069/ACS settings

### ONU Management
- `GET /api/onus` - List all ONUs
- `POST /api/onus` - Create ONU
- `GET /api/onus/:id` - Get ONU details
- `PATCH /api/onus/:id` - Update ONU
- `DELETE /api/onus/:id` - Delete ONU
- `POST /api/onus/:id/poll` - Poll ONU optical power via SNMP (Rx/Tx power, distance)
- `GET /api/onus/:id/tr069` - Get linked TR-069 device
- `POST /api/onus/:id/tr069/link` - Link ONU to TR-069 device
- `GET /api/onus/:id/tr069/tasks` - Get TR-069 tasks for ONU
- `POST /api/onus/:id/tr069/tasks` - Create TR-069 task for ONU
- `POST /api/onus/:id/provision` - Provision ONU with service profile (VLAN, bandwidth)
- `POST /api/onus/:id/provision-tr069` - Provision ONU with TR-069/ACS settings from parent OLT
- `POST /api/onus/:id/deprovision` - Remove ONU configuration from OLT
- `POST /api/onus/:id/reboot` - Reboot ONU via OLT CLI
- `POST /api/onus/:id/preview-commands` - Preview CLI commands that would be sent to OLT

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

### Development (Replit)
```bash
npm run dev
```
Starts Express server with Vite HMR on port 5000.

### Docker
```bash
# Start with Docker Compose (includes PostgreSQL)
docker-compose up -d

# Or build and run manually
docker build -t olt-management .
docker run -p 5000:5000 -p 7547:7547 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e SESSION_SECRET=your-secret \
  olt-management
```

Ports:
- `5000` - Web application
- `7547` - TR-069/ACS server

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

## Authentication
The system supports two authentication methods:

### Replit Auth (Default in Replit)
- Uses OpenID Connect with Replit as identity provider
- Automatic user creation on first login

### Local Auth (For Docker/Self-hosted)
- Username/password authentication with bcrypt hashing
- Registration at `/auth` page
- API endpoints:
  - `POST /api/auth/register` - Create new account
  - `POST /api/auth/login` - Authenticate with username/password
  - `POST /api/auth/logout` - End session

## Design Choices

### Hybrid Management Approach
- **OMCI**: Layer 2 provisioning (VLAN, GEM ports)
- **TR-069/ACS**: Layer 3 services (WiFi, VoIP, diagnostics)

### Material Design
- Clean, information-dense UI
- Dark mode support
- Consistent spacing and typography

## TR-069 Task Types
The following task types are supported by the ACS server (use snake_case):
- `get_parameter_values` - Get device parameters (requires `parameterNames` array)
- `set_parameter_values` - Set device parameters (requires `parameterValues` array with name/value pairs)
- `download` - Download firmware or config file
- `reboot` - Reboot device
- `factory_reset` - Factory reset device

### Common TR-069 Parameter Paths
WiFi Configuration:
- `Device.WiFi.SSID.1.SSID` - WiFi network name
- `Device.WiFi.SSID.1.Enable` - Enable/disable WiFi ("1" or "0")
- `Device.WiFi.AccessPoint.1.Security.ModeEnabled` - Security mode (WPA2-Personal, WPA3-Personal, etc.)
- `Device.WiFi.AccessPoint.1.Security.KeyPassphrase` - WiFi password
- `Device.WiFi.Radio.1.Channel` - WiFi channel

VoIP/SIP Configuration:
- `Device.Services.VoiceService.1.VoiceProfile.1.Enable` - Enable voice profile
- `Device.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServer` - SIP proxy server
- `Device.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServerPort` - SIP port
- `Device.Services.VoiceService.1.VoiceProfile.1.Line.{n}.SIP.AuthUserName` - SIP username
- `Device.Services.VoiceService.1.VoiceProfile.1.Line.{n}.SIP.AuthPassword` - SIP password

## Recent Changes
- December 2025: Added TR-069 WiFi configuration dialog with SSID, password, security mode, channel settings
- December 2025: Added TR-069 VoIP/SIP configuration dialog with server, credentials, line settings
- December 2025: Added TR-069 Factory Reset action with confirmation
- December 2025: Fixed TR-069 task types to use snake_case format (set_parameter_values, get_parameter_values, etc.)
- December 2025: Enhanced OLT Hardware Details - Real-time SNMP discovery of boards, uplinks, VLANs, PON ports with multiple OID fallbacks for different OLT models
- December 2025: Added VLAN management via CLI - Create/delete VLANs and configure VLAN trunks on uplink ports (trunk, access, hybrid modes)
- December 2025: Added TR-069/ACS configuration UI - Edit ACS settings (URL, credentials, periodic inform) directly from OLT detail page
- December 2025: Added TR-069/ACS zero-touch provisioning - OLTs can store ACS settings and push them to ONUs via OMCI
- December 2025: Added ONU-TR069 integration with device linking and quick actions (WiFi, VoIP, reboot)
- December 2025: Added TR-069/ACS server with full CWMP support
- December 2025: Implemented multi-tenant architecture
- December 2025: Added real-time monitoring capabilities
