# OLT Management System - Design Guidelines

## Design Approach

**Design System**: Material Design adapted for enterprise telecom management  
**Inspiration**: Linear (clean data density) + Grafana (monitoring dashboards) + AWS Console (enterprise architecture)

**Rationale**: This is a utility-focused, information-dense enterprise application where efficiency, scanability, and real-time data visualization are paramount. Material Design provides the structure needed for complex data hierarchies while maintaining clarity.

---

## Core Design Principles

1. **Density Over Decoration**: Maximize information density while maintaining readability
2. **Status-First**: Network health status should be immediately visible
3. **Hierarchical Clarity**: OLT → ONU → Port → Service navigation must be intuitive
4. **Responsive Data**: Real-time updates without disruptive animations

---

## Typography

**Primary Font**: Inter (Google Fonts)  
**Monospace Font**: JetBrains Mono (for IPs, MACs, technical data)

**Hierarchy**:
- Page Titles: text-2xl font-semibold
- Section Headers: text-lg font-semibold
- Card Titles: text-base font-medium
- Body Text: text-sm font-normal
- Labels/Captions: text-xs font-medium uppercase tracking-wide
- Data Values: text-sm font-mono (for IPs, signal levels)
- Large Metrics: text-3xl font-bold (dashboard KPIs)

---

## Layout System

**Spacing Primitives**: Tailwind units of **2, 4, 6, 8, 12, 16**
- Tight spacing: p-2, gap-2 (within cards, table cells)
- Standard spacing: p-4, gap-4 (card padding, form fields)
- Section spacing: p-6, p-8 (between major sections)
- Page margins: p-12, p-16 (outer containers)

**Grid Structure**:
- Dashboard: 12-column grid for flexible widget placement
- Table views: Full-width responsive tables with fixed headers
- Detail panels: 2/3 main content + 1/3 sidebar for ONU details
- Sidebar navigation: Fixed 64px (collapsed) or 240px (expanded)

---

## Component Library

### Navigation
**Primary Sidebar** (Fixed, collapsible):
- Logo/branding at top
- Icon-based navigation with labels
- Grouped sections: Dashboard, OLTs, ONUs, Services, Alerts, Settings
- Active state indicator (left border accent)
- Tenant switcher at bottom (for multi-tenant)

**Top Bar**:
- Breadcrumb navigation
- Global search (ONU MAC/IP search)
- Alert counter badge
- User profile dropdown with role badge

### Dashboard Components

**Status Cards**:
- Compact metric cards (w-full md:w-1/2 lg:w-1/4)
- Large metric number (text-3xl font-bold)
- Label below (text-xs uppercase)
- Trend indicator (↑↓ with percentage)
- Status dot (green/yellow/red)

**OLT Grid View**:
- Card-based layout (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Each card shows: OLT name, vendor logo, IP, total/active ONUs, signal status
- Quick action buttons (configure, view details)
- Visual status indicator (left border or header background)

**ONU Table**:
- Dense table with fixed header
- Columns: MAC, IP, Model, Signal (dBm), Status, Uptime, Actions
- Row hover state
- Inline actions (restart, configure, view details)
- Filterable columns
- Status badges (online/offline/degraded)

**Real-Time Monitoring Widgets**:
- Line charts for signal levels over time (minimal grid, clean axes)
- Gauge charts for optical power levels
- Small sparklines for quick trends
- Live update indicator (pulsing dot)

### Forms & Configuration

**ONU Configuration Modal**:
- Large centered modal (max-w-4xl)
- Tabbed interface (Network, VLAN, Services, Advanced)
- Form groups with clear labels
- Validation feedback inline
- Action bar at bottom (Cancel, Save)

**Service Profile Builder**:
- Drag-and-drop service assignment
- VLAN tag inputs with validation
- Bandwidth sliders with numeric input
- Service type icons (Internet, IPTV, VoIP)

### Alerts & Notifications

**Alert Center**:
- Slide-out panel from right
- Grouped by severity (Critical, Warning, Info)
- Timestamp and affected ONU/OLT
- Quick actions (acknowledge, view details, dismiss)
- Real-time updates via WebSocket

**Toast Notifications**:
- Bottom-right corner
- Auto-dismiss after 5s (info), persistent (critical)
- Action button for details

### Data Visualization

**Signal Strength Charts**:
- Color-coded thresholds (green: -15 to -25 dBm, yellow: -25 to -28, red: < -28)
- Horizontal bar charts for quick comparison
- Tooltip on hover with exact values

**Network Topology View** (if included):
- Tree structure: OLT → Splitter → ONU
- Status indicators on each node
- Zoom/pan capabilities
- Click to drill down

---

## Multi-Tenant & Role Considerations

**Tenant Switcher**:
- Dropdown in sidebar footer
- Search for tenant
- Current tenant badge in top bar

**Role-Based UI**:
- Super Admin: Full access to all features
- Tenant Admin: Tenant-scoped views, configuration access
- Operator: Read-only monitoring, limited actions

Different roles see different navigation items and action buttons.

---

## Responsive Behavior

**Desktop (lg:)**: Full sidebar + multi-column dashboards + side panels
**Tablet (md:)**: Collapsible sidebar + 2-column grids + stacked panels  
**Mobile**: Hidden sidebar (hamburger menu) + single column + bottom sheet modals

Tables convert to card-based views on mobile with key metrics prominently displayed.

---

## Images

**Hero Image**: Not applicable - this is a dashboard application, not a marketing site.

**Supporting Graphics**:
- Vendor logos (Huawei, ZTE) displayed in OLT cards and configuration screens
- Network topology diagrams (can be generated SVG representations)
- Empty state illustrations (when no ONUs configured, no alerts, etc.)
- Icon set: Heroicons for UI elements, custom network icons for OLT/ONU devices

---

## State Management & Feedback

**Loading States**: Skeleton screens for tables and cards (pulsing gray backgrounds)  
**Empty States**: Centered illustration + message + action button  
**Error States**: Inline error messages with retry button  
**Success Feedback**: Checkmark animation + toast notification

---

## Performance Considerations

- Virtualized tables for 1000+ ONU rows
- Lazy-load monitoring charts
- Debounced search inputs
- Optimistic UI updates for configuration changes
- WebSocket connection status indicator