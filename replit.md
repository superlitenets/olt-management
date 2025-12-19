# OLT Management System

## Overview
The OLT Management System is a comprehensive solution for managing multi-vendor GPON/EPON networks. It supports Huawei and ZTE OLTs, provides ONU discovery and provisioning primarily via TR-069/ACS, offers real-time monitoring, and operates within a multi-tenant architecture. The system aims to streamline OLT and ONU operations, enhance network visibility, and provide robust management capabilities for internet service providers.

## User Preferences
My ideal workflow involves iterative development. I prefer detailed explanations for complex features and architectural decisions. Please ask before making major changes or refactoring large portions of the codebase. I prefer clear, concise communication and well-documented code.

## System Architecture

### UI/UX Decisions
The frontend is built with React and TypeScript, using Tailwind CSS and shadcn/ui components for a Material Design-inspired interface. The design emphasizes a clean, information-dense UI with dark mode support and consistent spacing, drawing inspiration from platforms like Linear, Grafana, and AWS Console.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, and TanStack Query for server state management.
- **Backend**: Express.js with TypeScript, using PostgreSQL as the database with Drizzle ORM.
- **Authentication**: Replit Auth (OpenID Connect) for Replit deployments and local username/password authentication for self-hosted environments.
- **Session Management**: Express-session with `connect-pg-simple`.
- **Hybrid Management**: Utilizes OMCI for Layer 2 provisioning (VLAN, GEM ports) and TR-069/ACS for Layer 3 services (WiFi, VoIP, diagnostics).
- **Multi-vendor Support**: Designed to integrate with Huawei and ZTE OLTs.

### Feature Specifications
- **OLT Management**: Multi-vendor OLT support, connection status monitoring, PON port configuration, and VLAN management via CLI. Includes detailed OLT information retrieval via SNMP (boards, uplinks, VLANs, PON ports) and configuration saving.
- **ONU Management**: Primarily TR-069 based for provisioning. Comprehensive ONU detail pages, TR-069 task-based operations (WiFi, VoIP, WAN/VLAN configuration), remote reboot/factory reset, status monitoring, and service profile assignment.
- **TR-069/ACS Server**: Implements CWMP protocol for CPE management, supporting device auto-discovery, parameter get/set, firmware upgrades, remote actions, and configuration presets.
- **Service Profiles**: Centralized management for bandwidth, VLAN, and QoS configurations.
- **Multi-tenant Architecture**: Ensures tenant isolation and includes Role-Based Access Control (Super Admin, Tenant Admin, Operator).
- **VPN Tunnels**: OpenVPN integration for secure OLT connections. Features include managing `.ovpn` configurations, auto-generating MikroTik onboarding scripts, downloading RouterOS scripts, associating VPN profiles with OLTs, and environment-aware connection management.

### System Design Choices
The system uses a shared module (`shared/`) for Drizzle database schemas and Zod validation schemas, ensuring consistency between frontend and backend. The API is structured logically around resources like OLTs, ONUs, TR-069, and VPNs.

## External Dependencies
- **PostgreSQL**: Primary database for all system data.
- **Replit Auth**: OpenID Connect provider for user authentication in Replit environments.
- **SNMP**: Used for real-time polling and detailed information retrieval from OLTs.
- **TR-069/ACS**: Integrated server for managing CPE devices.
- **OpenVPN**: Used for establishing secure VPN tunnels to OLT devices.
- **MikroTik RouterOS**: Integration for generating onboarding scripts to configure MikroTik devices as VPN clients.