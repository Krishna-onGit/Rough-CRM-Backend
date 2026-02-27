# LeadFlow AI — Complete Feature Specification

## Enterprise Real-Estate CRM Engine

**Version:** 1.0.0
**Last Updated:** February 2026
**Document Type:** Feature Specification (Product & Engineering Reference)

---

## Table of Contents

1. [Global Features & Navigation](#1-global-features--navigation)
2. [Module 1: Overview (Dashboard & Management Hub)](#2-module-1-overview)
3. [Module 2: Pre-Sales (Lead Pipeline)](#3-module-2-pre-sales)
4. [Module 3: Live Inventory (Unit Grid & Lifecycle)](#4-module-3-live-inventory)
5. [Module 4: Sales Engine (Team, Agents & Commissions)](#5-module-4-sales-engine)
6. [Module 5: Post-Sales (Payments to Possession)](#6-module-5-post-sales)
7. [Module 6: Customer 360 (Complete Customer View)](#7-module-6-customer-360)
8. [Module 7: Analytics (Dashboards & Reports)](#8-module-7-analytics)
9. [Cross-Module Cascades (Interconnected Behaviors)](#9-cross-module-cascades)
10. [Role-Based Access Matrix](#10-role-based-access-matrix)
11. [Approval Workflows](#11-approval-workflows)
12. [Notifications & Alerts](#12-notifications--alerts)
13. [Business Rules & Constraints Master List](#13-business-rules--constraints)

---

## 1. Global Features & Navigation

### 1.1 Top Navigation Bar

The application presents a persistent top tab bar with 7 module tabs accessible from any screen:

| Tab Position | Label | Module |
|---|---|---|
| 1 | Overview | Dashboard, Projects, Sales Team, Agents management |
| 2 | Pre-Sales | Leads, Site Visits, Follow-ups |
| 3 | Live Inventory | BookMyShow-style unit grid with full lifecycle actions |
| 4 | Sales Engine | Team performance, Agent management, Bookings, Commissions |
| 5 | Post-Sales | Payments, Demand Letters, Possession, Complaints, Cancellations, Transfers, Audit |
| 6 | Customer 360 | Complete customer lifecycle view |
| 7 | Analytics | Sales, Inventory, Financial, Channel, Agent dashboards |

Active tab is visually highlighted. Clicking any tab instantly navigates to that module's default sub-tab.

### 1.2 Multi-Tenancy Context

- Each logged-in user belongs to exactly one tenant (real-estate company).
- All data displayed is automatically scoped to the user's tenant. Users never see other tenants' data.
- Tenant name is displayed in the header area.

### 1.3 Role-Based Visibility

- UI elements (buttons, tabs, actions) are conditionally rendered based on the user's role.
- Five roles exist: **Admin**, **Sales Manager**, **Sales Executive**, **Finance**, **Operations**.
- Unauthorized actions are hidden (not shown as disabled). If a user navigates to a restricted URL directly, they see an "Access Denied" message.

### 1.4 Toast Notifications

- Success actions (booking created, payment recorded, etc.) display a green toast notification at the top-right.
- Error actions (validation failure, permission denied, etc.) display a red toast.
- Toasts auto-dismiss after 4 seconds. Users can manually dismiss by clicking the close icon.

### 1.5 Soft Delete Behavior (Global)

- No entity is ever permanently deleted from the system.
- Projects, Sales Persons, and Agents use an **Active/Inactive toggle**. Inactive entities are hidden from dropdown selectors and list views but remain accessible in historical records, audit logs, and analytics.
- Units use **status-based lifecycle** (never deleted, status changes to "Cancelled" at most).
- Customers, Bookings, Leads, Payments, and all other records are never deleted. Status fields manage their lifecycle.

---

## 2. Module 1: Overview

The Overview module is the central management hub and first screen users see upon login. It contains **4 sub-tabs**: Dashboard, Projects, Sales Team, and Agents/Brokers.

### 2.1 Dashboard Tab

#### 2.1.1 KPI Cards (Top Row — 4 Cards)

**Card 1: Total Units**
- Shows the total count of all units across all projects for this tenant.
- Breakdown line beneath: "X Available | Y Blocked | Z Sold"
- "Sold" includes all units with status: Booked, Agreement Done, Registered, or Possession Handed.
- Clicking this card navigates to the Live Inventory module.

**Card 2: Revenue Booked**
- Primary number: Sum of `agreement_value` for all sold units (in ₹, formatted with commas).
- Secondary line: "₹X Collected" — sum of all cleared payments.
- Clicking this card navigates to Analytics → Financial tab.

**Card 3: Leads Pipeline**
- Primary number: Total count of all leads (all statuses).
- Secondary line: "X Won | Y% Conversion"
- Conversion % = (Won leads / Total leads) × 100, rounded to 1 decimal.
- Clicking this card navigates to Pre-Sales → Leads tab.

**Card 4: Commission Due**
- Primary number: Sum of all pending (unpaid) commission amounts across all agents.
- Secondary line: "X Open Complaints"
- Clicking this card navigates to Sales Engine → Commissions tab.

#### 2.1.2 Project Cards (Below KPIs)

- Displays the **top 6 projects** by sales progress (% sold, descending).
- Each project card contains:
  - Project name (bold, large)
  - Location and city (smaller text)
  - Status badge: color-coded pill — Green for "Active", Yellow for "Pre-Launch", Gray for "Completed"
  - Three stat counters in a row: Available (green number) | Blocked (orange number) | Sold (purple number)
  - A horizontal progress bar showing percentage sold: (Sold units / Total units) × 100
  - Below progress bar: "X Towers | Y Units Total"
- Clicking any project card navigates directly to **Live Inventory** with that project pre-selected in the filter.

#### 2.1.3 Quick Access Grid

- A 2×3 grid of shortcut buttons, one for each module:
  - Pre-Sales, Live Inventory, Sales Engine, Post-Sales, Customer 360, Analytics
- Each button has an icon and label. Clicking navigates to that module.

---

### 2.2 Projects Tab

#### 2.2.1 Search & Actions Bar

- **Search input**: Real-time text filter on project name, city, and location. Debounced (300ms). Filters the card list below.
- **"Add New Project" button** (visible to Admin and Sales Manager roles only): Opens the Add Project Dialog.

#### 2.2.2 Project Cards (Full List)

- All tenant projects displayed in a **2-column card layout**, sorted by creation date (newest first).
- Each card contains:
  - Project ID (code, e.g., PRJ-MUM-001) — top-left
  - Project name — bold, prominent
  - Location, City — below name
  - Status badge — colored pill (Active / Pre-Launch / Completed)
  - **Eye icon button** (top-right): Opens the Project Detail Dialog for this project
  - Stats row: Towers count | Total Units | Available count | Sold count
  - Base rate: "₹X/sqft"
  - Project type: e.g., "Residential", "Commercial"
  - Sold percentage: "X% Sold"
  - **Tower badges**: A row of small pills, each showing a tower name and its configuration (e.g., "Tower A: 20F × 4U")

#### 2.2.3 Project Detail Dialog

Opens when the eye icon on a project card is clicked. Contains:

- **Header**: Project name, project code, status badge
- **Metadata grid** (2 columns):
  - Project Type, City, Location, Base Rate, RERA Number, Completion %, Status, Created Date
- **Tower list** (table format):
  - Each row: Tower Name, Floors, Units per Floor, Total Units
  - Below each tower row: Unit status summary — "X Available | Y Blocked | Z Sold"
- **"View Live Inventory" button** at bottom: Navigates to Live Inventory with this project pre-selected.
- **Close button** (X in top-right corner).

#### 2.2.4 Add Project Dialog

A multi-section form dialog:

**Section 1: Project Details**

| Field | Type | Required | Validation |
|---|---|---|---|
| Project Name | Text input | Yes | Min 2 characters |
| City | Text input | Yes | Min 2 characters |
| Location/Address | Text input | Yes | Min 5 characters |
| Project Type | Dropdown | Yes | Options: Residential, Commercial, Mixed Use, Township, Villa, Plotted Development, Affordable Housing, Luxury, Ultra Luxury, Senior Living |
| Status | Dropdown | Yes | Options: Active, Pre-Launch, Completed. Default: Active |
| Base Rate (per sqft) | Number input | Yes | Must be positive. Displayed as ₹ |
| Completion % | Number input | No | 0-100. Default: 0 |

**Section 2: Tower Configuration**

- Starts with **1 tower row** by default.
- **"Add Tower" button**: Adds a new tower row below the last one.
- Each tower row contains:

| Field | Type | Required | Validation |
|---|---|---|---|
| Tower Name | Text input | Yes | Min 1 character. Must be unique within this project |
| Floors | Number input | Yes | Min 1, Max 100 |
| Units per Floor | Number input | Yes | Min 1, Max 20 |

- Each tower row shows a **live computed label**: "X units" (Floors × Units per Floor).
- Each tower row (except the first) has a **red trash icon** to remove it.
- Below all tower rows, a **summary line**: "X Towers | Y Total Floors | Z Total Units"

**Submit Behavior:**
- All required fields validated. If any fail, red error text appears below the offending field and the form does not submit.
- On successful submit:
  1. A new Project record is created.
  2. Tower records are created for each tower row.
  3. The `generateUnits()` function runs automatically, creating all individual unit records with:
     - Unit numbers based on tower-floor-position pattern (e.g., "A-0101")
     - Configuration assigned by position: corner units get larger configs (3BHK/4BHK), middle units get smaller (1BHK/2BHK), top floor units can be Penthouse
     - Area calculated: 450-2200 sqft carpet based on config
     - Facing assigned by unit position within the floor (N, S, E, W, NE, NW, SE, SW)
     - Full cost sheet calculated per unit: base price + floor rise + PLC + amenity + GST + stamp duty + registration
     - All units start with status "Available"
  4. Success toast: "Project created with X units"
  5. Dialog closes.
  6. Projects list refreshes to show the new project.

---

### 2.3 Sales Team Tab

#### 2.3.1 Search & Actions Bar

- **Search input**: Filters by name, mobile, email, team. Debounced.
- **"Add Sales Member" button** (Admin and Sales Manager only): Opens the Add Sales Member Dialog.

#### 2.3.2 Summary KPI Row (4 Mini Cards)

| KPI | Value |
|---|---|
| Total Members | Count of all sales persons (active + inactive) |
| Active | Count of active sales persons |
| Total Units Sold | Sum of sold units attributed to all sales persons |
| Incentives Earned | Sum of incentives/bonuses (if tracked) |

#### 2.3.3 Sales Team Table

Full-width table with the following columns:

| Column | Description |
|---|---|
| ID | Sales person code (SP-001) |
| Name | Full name |
| Team | Team name (e.g., Team Alpha) |
| Designation | VP Sales / Manager / Senior Executive / Executive / Trainee |
| Contact | Mobile number |
| Units Sold | Lifetime count of sold units |
| Active Blocks | "X/3" — current active blocks out of max 3 |
| MTD Target | Monthly target amount in ₹ |
| MTD Achieved | Percentage achieved this month with colored progress indicator (Red <50%, Yellow 50-80%, Green >80%) |
| Status | Active (green badge) or Inactive (gray badge) |
| Action | **Delete button** (trash icon) — actually sets status to Inactive. Confirmation dialog: "Are you sure? This person will be marked inactive and won't appear in selection lists." |

Table is sortable by clicking column headers. Default sort: Name ascending.

#### 2.3.4 Add Sales Member Dialog

| Field | Type | Required | Validation |
|---|---|---|---|
| Full Name | Text input | Yes | Min 2 characters |
| Mobile | Text input | Yes | Exactly 10 digits |
| Email | Text input | Yes | Valid email format |
| Team | Dropdown | Yes | Options: Team Alpha, Team Beta, Team Gamma, Team Delta, Team Epsilon |
| Designation | Dropdown | Yes | Options: VP Sales, Sales Manager, Senior Sales Executive, Sales Executive, Sales Trainee |
| Reporting Manager | Dropdown | No | List of existing active sales persons |
| Monthly Target | Number input | No | Positive number, in ₹ |

**Submit Behavior:**
- Validation check on all required fields.
- Duplicate check: Mobile number must be unique within tenant.
- On success: New sales person record created, table refreshes, success toast.

---

### 2.4 Agents / Brokers Tab

#### 2.4.1 Search & Actions Bar

- **Search input**: Filters by firm name, contact person, mobile, RERA number.
- **"Add Agent / Broker" button** (Admin and Sales Manager only): Opens the Add Agent Dialog.

#### 2.4.2 Summary KPI Row (4 Mini Cards)

| KPI | Value |
|---|---|
| Total Agents | Count of all agents (active + inactive) |
| Active | Count of active agents |
| Total Units Sold | Sum of sold units across all agents |
| Pending Commission | Sum of unpaid commission amounts across all agents |

#### 2.4.3 Agent Cards (2-Column Layout)

Each agent card shows:

- **Firm name** — bold, large
- **Contact person** — name below firm
- **Status badge** — Active (green) or Inactive (gray)
- **Contact info**: Phone icon + mobile | Email icon + email
- **Details row**: RERA No. | Commission: X% | Units Sold: Y | Rating: Z/5 (star display)
- **Financial row**: Total Commission: ₹X | Pending: ₹Y (highlighted in orange if > 0)
- **Delete button** (trash icon, bottom-right) — marks as Inactive with confirmation dialog.

#### 2.4.4 Add Agent / Broker Dialog

| Field | Type | Required | Validation |
|---|---|---|---|
| Firm Name | Text input | Yes | Min 2 characters |
| Contact Person | Text input | Yes | Min 2 characters |
| Mobile | Text input | Yes | Exactly 10 digits |
| Email | Text input | No | Valid email format if provided |
| RERA Number | Text input | Yes | Min 5 characters. Must be unique within tenant. This is a regulatory requirement in India. |
| PAN | Text input | No | If provided: exactly 10 characters, format XXXXX0000X |
| GST Number | Text input | No | If provided: exactly 15 characters |
| Commission Slab % | Number input | Yes | 0.01 - 10.00 |

**Submit Behavior:**
- Validates all required fields.
- RERA number uniqueness check across tenant.
- On success: New agent created, card list refreshes, success toast.

---

## 3. Module 2: Pre-Sales

The Pre-Sales module manages the top-of-funnel pipeline from lead capture through to conversion. Contains **3 sub-tabs**: Leads, Site Visits, Follow-ups.

### 3.1 Leads Sub-Tab

#### 3.1.1 Lead List Controls

- **Search bar**: Filter by lead name, mobile, email. Debounced.
- **Status filter dropdown**: All | New | Contacted | Site Visit Scheduled | Site Visit Done | Interested | Negotiation | Won | Lost | Junk
- **Source filter dropdown**: All | WhatsApp | Website | Walk-in | Referral | Broker | Digital Ad | Print Ad | Exhibition | Cold Call
- **Assigned to filter**: All | (list of active sales persons)
- **"Add Lead" button** (visible to Admin, Sales Manager, Sales Executive)
- **Sort options**: Newest First (default), Score (High to Low), Name (A-Z)

#### 3.1.2 Lead Cards

Displayed as a vertical card list. Each lead card contains:

- **Lead code** (e.g., LEAD-001) — top-left, small
- **Full name** — bold, prominent
- **Status badge** — color-coded pill:
  - New: Blue
  - Contacted: Cyan
  - Site Visit Scheduled: Teal
  - Site Visit Done: Green
  - Interested: Purple
  - Negotiation: Orange
  - Won: Green (solid background)
  - Lost: Red
  - Junk: Gray
- **Score badge** — circular indicator, 0-100, color gradient (Red <30, Yellow 30-60, Green >60)
- **Contact row**: Phone icon + mobile | Email icon + email
- **Source badge**: Small pill showing lead source (e.g., "WhatsApp", "Website")
- **Interest row**: Interested Project name (if set) | Preferred Config (if set) | Budget range (if set)
- **Assigned to**: Sales person name with avatar, or "Unassigned" in red
- **Created date**: Relative time (e.g., "3 days ago")
- **Click/tap card**: Opens Lead Detail Panel

#### 3.1.3 Lead Status Pipeline Flow

Leads follow a strictly defined status pipeline. Allowed transitions:

```
New → Contacted
Contacted → Site Visit Scheduled
Site Visit Scheduled → Site Visit Done
Site Visit Done → Interested | Lost | Junk
Interested → Negotiation | Lost | Junk
Negotiation → Won | Lost | Junk
```

Backward transitions are NOT allowed (e.g., cannot move from "Interested" back to "New").
The "Won" and "Lost" and "Junk" statuses are terminal — no further transitions from these.

When moved to **Won**: The system does NOT auto-create a booking. The sales person must manually go to Live Inventory to block a unit and initiate the booking process. However, the lead record stores a reference to the eventual booking once created (linked via `converted_booking_id`).

When moved to **Lost**: A `lost_reason` field becomes mandatory. Options include: "Budget Mismatch", "Location Concern", "Competitor Project", "Loan Rejected", "Personal Reasons", "No Response", "Other".

When moved to **Junk**: Lead is effectively archived. It remains in the system but is excluded from pipeline metrics and conversion calculations.

#### 3.1.4 Add Lead Dialog

| Field | Type | Required | Validation |
|---|---|---|---|
| Full Name | Text input | Yes | Min 2 characters |
| Mobile | Text input | Yes | 10 digits |
| Email | Text input | No | Valid email if provided |
| Source | Dropdown | Yes | 10 options as listed above |
| Interested Project | Dropdown | No | List of active projects |
| Preferred Config | Dropdown | No | 1BHK, 2BHK, 3BHK, 4BHK, Penthouse |
| Budget Min | Number input | No | Positive, in ₹ |
| Budget Max | Number input | No | Must be ≥ Budget Min |
| Assign To | Dropdown | No | List of active sales persons. If not set, lead is "Unassigned" |
| Remarks | Text area | No | Free text |

**Submit**: Creates lead with status "New", score 0. Lead appears at top of list. Success toast displayed.

#### 3.1.5 Lead Detail Panel

Opens as a side panel or modal when a lead card is clicked. Contains:

- **Header**: Lead name, code, status badge, score badge
- **Status Update Dropdown**: Shows only valid next statuses based on current status. Selecting a new status triggers an immediate update with confirmation.
- **Score Slider**: 0-100, draggable. Updates on release.
- **Contact Info Section**: Name, mobile, email (editable inline)
- **Interest Section**: Project, config, budget (editable)
- **Assignment Section**: Dropdown to reassign to different sales person. Changing triggers notification to new assignee.
- **Remarks Section**: Editable text area
- **Activity Timeline**: Chronological list of all changes made to this lead (status changes, reassignments, score changes, site visits, follow-ups). Each entry shows: action, actor, timestamp.
- **Quick Actions**:
  - "Schedule Site Visit" button → Opens Site Visit creation with lead pre-filled
  - "Create Follow-up" button → Opens Follow-up creation with lead pre-filled
  - "View Communications" → Shows all logged calls/emails/messages for this lead

---

### 3.2 Site Visits Sub-Tab

#### 3.2.1 Site Visit List Controls

- **Date range filter**: Start date → End date pickers. Default: current month.
- **Project filter**: Dropdown of all active projects.
- **Status filter**: Upcoming | Completed | Cancelled
- **"Schedule Visit" button**: Opens Schedule Visit Dialog.

#### 3.2.2 Site Visit Cards

Each visit card shows:

- **Visit date & time** — prominent, formatted as "Mon, 25 Feb 2026 at 10:30 AM"
- **Lead name** — clickable, navigates to lead detail
- **Project name** — the project being visited
- **Sales person** — assigned salesperson name
- **Visit type badge**: First Visit (blue), Revisit (purple), Family Visit (green), Loan Agent Visit (orange)
- **Visitor count**: "X visitors"
- **Duration**: If check-in and check-out recorded, shows duration (e.g., "45 min")
- **Feedback badge**: If recorded — Interested (green), Thinking (yellow), Not Interested (red), Price Concern (orange), Location Concern (purple)
- **Check-in / Check-out buttons**: Appear based on visit state:
  - Before visit: "Check In" button (records check-in timestamp)
  - After check-in: "Check Out" button (records check-out timestamp)
  - After check-out: Both timestamps displayed as text
- **Add Feedback button**: Appears after check-out. Opens a dropdown to select feedback.

#### 3.2.3 Schedule Site Visit Dialog

| Field | Type | Required | Validation |
|---|---|---|---|
| Lead | Dropdown/Search | Yes | List of active leads (non-terminal status) |
| Project | Dropdown | Yes | List of active projects |
| Sales Person | Dropdown | Yes | List of active sales persons |
| Visit Date & Time | DateTime picker | Yes | Must be in the future |
| Visit Type | Dropdown | Yes | First Visit, Revisit, Family Visit, Loan Agent Visit |
| Expected Visitors | Number input | No | Default: 1. Min: 1 |
| Remarks | Text area | No | Free text |

**Submit Behavior:**
- Creates site visit record.
- Automatically updates the linked lead's status to "Site Visit Scheduled" (if currently "Contacted" or "New").
- Success toast: "Site visit scheduled for [Lead Name] on [Date]"

**After Visit Completion (Check-out done + Feedback recorded):**
- Lead status auto-updates to "Site Visit Done".

---

### 3.3 Follow-ups Sub-Tab

#### 3.3.1 Follow-up List Controls

- **Status filter tabs**: All | Pending | Completed | Missed | Rescheduled. Default: Pending.
- **Priority filter**: All | High | Medium | Low
- **Assigned to filter**: All | (list of sales persons)
- **Date range filter**: Start → End. Default: current week.
- **"Create Follow-up" button**: Opens creation dialog.

#### 3.3.2 Follow-up Task Cards

Each card shows:

- **Task type icon**: Phone (Call), Message (WhatsApp), Email, Users (Meeting), Map Pin (Site Visit)
- **Lead name** — clickable, navigates to lead detail
- **Scheduled date/time** — formatted prominently
- **Priority badge**: High (red), Medium (yellow), Low (green)
- **Status badge**: Pending (blue), Completed (green), Missed (red), Rescheduled (orange)
- **Assigned to**: Sales person name
- **Outcome text** (if completed): Brief text showing result
- **Action buttons** (for Pending tasks):
  - "Mark Complete" → Opens outcome input → Status changes to Completed, records completed_at timestamp
  - "Reschedule" → Opens date picker → Status changes to Rescheduled, new scheduled date set
  - "Mark Missed" → Confirmation → Status changes to Missed

Overdue tasks (scheduled_at < now AND status = pending) are visually highlighted with a red border/background.

#### 3.3.3 Create Follow-up Dialog

| Field | Type | Required | Validation |
|---|---|---|---|
| Lead | Dropdown/Search | Yes | List of active leads |
| Task Type | Dropdown | Yes | Call, WhatsApp, Email, Meeting, Site Visit |
| Priority | Dropdown | Yes | High, Medium, Low. Default: Medium |
| Scheduled Date & Time | DateTime picker | Yes | Must be in the future |
| Assign To | Dropdown | Yes | List of active sales persons |
| Remarks | Text area | No | Free text |

**Submit**: Creates follow-up task with status "Pending". Success toast.

---

## 4. Module 3: Live Inventory

The Live Inventory module is the centerpiece of LeadFlow AI — a real-time, interactive unit management system inspired by BookMyShow's seat selection interface.

### 4.1 Filter Bar (Top of Module)

A horizontal bar with 7 filter controls:

| Filter | Type | Behavior |
|---|---|---|
| **Project** | Dropdown | Lists all projects (active and completed). Selecting a project loads that project's units. Default: first project. |
| **Tower** | Dropdown | Appears when selected project has multiple towers. Shows "All Towers" (default) plus individual tower names. Resets to "All Towers" when project changes. |
| **Unit Search** | Text input | Search by unit number or unit code. Instant filter. |
| **Config** | Multi-select | 1BHK, 2BHK, 3BHK, 4BHK, Penthouse. Default: all selected. |
| **Status** | Multi-select | All 8 statuses. Default: all selected. |
| **Facing** | Multi-select | N, S, E, W, NE, NW, SE, SW. Default: all selected. |
| **View Toggle** | Button group | Grid (default) / List. Switches between the two view modes. |

Filter persistence: Filters remain active while navigating within Live Inventory. They reset when navigating away and returning.

### 4.2 Stats Bar (Below Filter Bar)

A row of **6 stat cards** showing real-time counts for the currently filtered dataset:

| Stat | Display | Color |
|---|---|---|
| Total Units | Count | Dark/neutral |
| Available | Count | Green |
| Blocked | Count | Orange |
| Token Received | Count | Blue |
| Sold | Count (Booked + Agreement + Registered + Possession) | Purple |
| Revenue | Sum of agreement_value for sold units, in ₹ | Indigo |

Stats update instantly when filters change.

### 4.3 Status Legend

A horizontal row of **8 color-coded status indicators**:

| Status | Color | Dot Style |
|---|---|---|
| Available | Green (#22C55E) | Solid |
| Blocked | Orange (#F97316) | **Pulsing animated dot** |
| Token Received | Blue (#3B82F6) | Solid |
| Booked | Purple (#8B5CF6) | Solid |
| Agreement Done | Indigo (#6366F1) | Solid |
| Registered | Cyan (#06B6D4) | Solid |
| Possession Handed | Gray (#6B7280) | Solid |
| Cancelled | Red (#EF4444) | Solid |

### 4.4 Grid View (Default)

#### 4.4.1 Layout Structure

- The grid represents a **floor-by-floor layout** of the selected tower(s).
- **Y-axis** (vertical, left side): Floor numbers, highest floor at top, ground floor at bottom.
- **X-axis** (horizontal): Unit positions on each floor (Unit 1, Unit 2, etc.).
- If "All Towers" is selected for a multi-tower project, each tower's grid is displayed in separate sections with tower name headers.
- **Right column**: A percentage label per floor showing occupancy rate: (Non-available units / Total units on floor) × 100, displayed as "X%".

#### 4.4.2 Unit Cells

Each unit is a **rectangular colored cell** within the grid:

- **Size**: Approximately 60×40px (responsive).
- **Background color**: Matches status color from the legend.
- **Content**: Unit number (e.g., "101") in white/dark text, plus config abbreviation below (e.g., "2BHK") in smaller text.
- **Blocked units**: Have a **pulsing orange dot** in the top-right corner of the cell, animated with CSS.
- **Cancelled units**: Have a diagonal strikethrough or reduced opacity.

#### 4.4.3 Hover Tooltip

Hovering over any unit cell displays a rich tooltip containing:

| Field | Value |
|---|---|
| Unit ID | Full unit code (e.g., "A-1201") |
| Config | 1BHK / 2BHK / 3BHK / 4BHK / Penthouse |
| Facing | N / S / E / W / NE / NW / SE / SW |
| Carpet Area | X sqft |
| Total Price | ₹X (all-inclusive) |
| Status | Current status with color indicator |
| Sales Person | Name (if assigned) or "—" |
| Customer | Name (if assigned) or "—" |
| Block Expiry | Countdown (if blocked): "Expires in Xh Ym" |

Tooltip appears after 200ms hover delay and disappears immediately on mouse leave.

#### 4.4.4 Click Behavior

Clicking any unit cell opens the **Unit Detail Modal** (see Section 4.6).

### 4.5 List View (Alternative)

A traditional table view of units with the following columns:

| Column | Content | Sortable |
|---|---|---|
| Unit | Unit number + tower name | Yes |
| Floor | Floor number | Yes |
| Config | 1BHK/2BHK/etc. | Yes |
| Area | Carpet area in sqft | Yes |
| Facing | Direction | Yes |
| Price | Total all-inclusive price in ₹ | Yes |
| Status | Colored badge | Yes |
| Sales Person | Name or "—" | Yes |
| Customer | Name or "—" | Yes |
| Action | "Block" button (only for Available units) | No |

- **Row limit**: Maximum 50 rows displayed. If more units match the current filters, a notice appears: "Showing 50 of X units. Use filters to narrow results."
- Clicking "Block" in the Action column opens the Block Unit Dialog (see Section 4.7).
- Clicking any row (except the action button) opens the Unit Detail Modal.

### 4.6 Unit Detail Modal

A large modal (70% viewport width) that serves as the command center for any individual unit.

#### 4.6.1 Modal Header

- **Unit number** — large, bold (e.g., "Unit A-1201")
- **Project name** — smaller text below
- **Status badge** — large colored pill with current status
- **Close button** (X) — top-right corner

#### 4.6.2 Block Timer (Visible only when status = Blocked)

- A prominent **countdown timer** displayed in a warning-colored banner.
- Shows: "Blocked by [Sales Person Name] | Expires in XX:XX:XX"
- Timer counts down in real-time (updates every second).
- When timer reaches 0, the unit is auto-released by the server-side cron job. The modal reflects this on next data refresh.

#### 4.6.3 Lifecycle Progress Bar

A horizontal **7-stage progress indicator**:

```
Available → Blocked → Token → Booked → Agreement → Registered → Possession
```

- Each stage is a dot/circle connected by lines.
- Completed stages: Filled dots with green checkmarks.
- Current stage: Larger dot with pulsing animation.
- Future stages: Empty/gray dots.
- If status is "Cancelled", the entire bar is crossed out with a red overlay.

#### 4.6.4 Unit Details Grid

A 2-column grid showing 10 unit attributes:

| Row | Left Column | Right Column |
|---|---|---|
| 1 | Unit ID: A-1201 | Config: 2BHK |
| 2 | Floor: 12 | Facing: North-East |
| 3 | Carpet Area: 850 sqft | Built-up Area: 1020 sqft |
| 4 | Super Built-up: 1190 sqft | View: Garden |
| 5 | Parking: Covered | Base Rate: ₹X/sqft |

#### 4.6.5 Cost Sheet Section

A detailed pricing breakdown displayed in a table format:

| Line Item | Amount (₹) |
|---|---|
| Base Price (Carpet Area × Base Rate) | X |
| Floor Rise Premium | X |
| Preferential Location Charge (PLC) | X |
| **Agreement Value** | **X** (subtotal) |
| GST @ 5% | X |
| Stamp Duty @ 6% | X |
| Registration Charges | X |
| Amenity Charges | X |
| **Total All-Inclusive** | **X** (grand total, highlighted, bold) |

#### 4.6.6 Transaction Details Section (Visible only when unit is sold/booked+)

| Field | Value |
|---|---|
| Sales Person | Name |
| Channel Partner | Agent firm name or "Direct Sale" |
| Customer | Customer name (clickable → navigates to Customer 360) |
| Sale Date | Date formatted |
| Final Sale Value | ₹X |
| Discount Applied | ₹X or "None" |

#### 4.6.7 Action Buttons (Context-Aware)

The bottom of the modal shows action buttons that change based on the unit's current status:

| Current Status | Visible Buttons |
|---|---|
| Available | **Block Unit** (orange), Print Cost Sheet (gray) |
| Blocked | **Release Block** (gray), **Collect Token** (blue), Cancel Unit (red), Print Cost Sheet |
| Token Received | **Create Booking** (purple), Cancel Unit (red), Print Cost Sheet |
| Booked | **Execute Agreement** (indigo), Cancel Unit (red), Print Cost Sheet |
| Agreement Done | **Mark Registered** (cyan), Cancel Unit (red), Print Cost Sheet |
| Registered | **Hand Over Possession** (gray), Cancel Unit (red), Print Cost Sheet |
| Possession Handed | Print Cost Sheet (no further actions) |
| Cancelled | Print Cost Sheet (no actions) |

**Cancel Unit** button is available at EVERY stage except "Possession Handed" and "Cancelled" itself. It always appears in RED and triggers the Cancel Unit Dialog.

**Print Cost Sheet** button is always available regardless of status.

**Button visibility also depends on user role** (see Section 10 for full RBAC matrix).

---

### 4.7 Block Unit Dialog

Opened when clicking "Block Unit" on an Available unit.

#### 4.7.1 Warning Banner

A yellow/amber warning box at the top of the dialog containing the blocking rules:

> **Blocking Rules:**
> • Block expires automatically after **48 hours**
> • Each sales person can block a maximum of **3 units** simultaneously
> • Block will be auto-released if not converted to token within the time limit

#### 4.7.2 Form Fields

| Field | Type | Required | Validation |
|---|---|---|---|
| Sales Person | Dropdown/Search | Yes | List of active sales persons only. Shows current active block count next to each name: "John Doe (2/3 blocks)". Persons with 3/3 blocks are shown as disabled/grayed with "(Max reached)" label. |
| Channel Partner | Dropdown/Search | No | List of active agents. Default: "No Agent / Direct" |

#### 4.7.3 Unit Summary

Below the form, a read-only summary:
- Unit: A-1201 | Config: 2BHK | Floor: 12 | Price: ₹XX

#### 4.7.4 Submit Behavior

- Validates sales person selection.
- Checks max block limit (3) — if exceeded, shows red error: "This sales person already has 3 active blocks."
- On success:
  1. Unit status → "Blocked"
  2. `blocked_by` → selected sales person
  3. `blocked_at` → current timestamp
  4. `block_expires_at` → current time + 48 hours
  5. `block_agent_id` → selected agent (or null)
  6. Sales person's active block count increments
  7. Audit log entry created
  8. Dialog closes
  9. Grid refreshes — unit cell turns orange with pulsing dot
  10. Success toast: "Unit A-1201 blocked for 48 hours"

---

### 4.8 Release Block

Clicking "Release Block" on a Blocked unit:

1. Confirmation dialog: "Release block on Unit A-1201? The unit will become available again."
2. On confirm:
   - Unit status → "Available"
   - Clear: blocked_by, blocked_at, block_expires_at, block_agent_id
   - Sales person's active block count decrements
   - Audit log entry
   - Grid refreshes — unit cell turns green
   - Success toast

---

### 4.9 Token Collection Dialog

Opened when clicking "Collect Token" on a Blocked unit.

#### 4.9.1 Form Fields

| Field | Type | Required | Validation |
|---|---|---|---|
| Token Amount | Number input | Yes | Must be positive. Displayed with ₹ prefix |
| Payment Mode | Dropdown | Yes | Options: Cheque, NEFT, RTGS, UPI, DD, Cash |
| Transaction Reference / UTR | Text input | No | Free text for reference number |
| Remarks | Text area | No | Free text |

#### 4.9.2 Unit Price Summary

Read-only section below the form:
- Unit: A-1201 | Agreement Value: ₹XX | Total All-Inclusive: ₹XX

#### 4.9.3 Submit Behavior

- On success:
  1. Unit status → "Token Received"
  2. Payment record created with token amount (status: cleared)
  3. Audit log entry
  4. Dialog closes
  5. Grid refreshes — unit cell turns blue
  6. Success toast: "Token of ₹X collected for Unit A-1201"

---

### 4.10 Create Booking Dialog (Most Complex Dialog)

Opened when clicking "Create Booking" on a Token Received unit. This is a **multi-tab dialog** with strict validation.

#### 4.10.1 Warning Banner (Top of Dialog, Always Visible)

A red/amber banner:

> ⚠️ **All fields marked * are mandatory.** Booking will NOT proceed until all customer information is provided. Ensure PAN, Aadhaar, and all personal details are accurately entered as per government ID documents.

#### 4.10.2 Tab 1: Personal Details

| Field | Type | Required | Validation |
|---|---|---|---|
| Full Name (as per PAN) * | Text input | **YES** | Min 2 characters |
| Father's / Spouse Name * | Text input | **YES** | Min 2 characters |
| Date of Birth * | Date picker | **YES** | Must be in the past. Applicant must be 18+ |
| PAN Number * | Text input | **YES** | Exactly 10 characters. Format: XXXXX0000X (5 letters, 4 digits, 1 letter). Converted to uppercase automatically. |
| Aadhaar Number * | Text input | **YES** | Exactly 12 digits. No spaces or dashes. |
| Mobile (Primary) * | Text input | **YES** | Exactly 10 digits |
| Alternate Mobile | Text input | No | If provided: 10 digits |
| Email * | Text input | **YES** | Valid email format |
| Current Address * | Text area | **YES** | Min 10 characters |

Each field shows a red asterisk (*) and red border on validation failure. Error messages appear below each field.

A **completeness indicator** at the bottom of this tab shows: "7/8 mandatory fields completed" with a progress bar.

#### 4.10.3 Tab 2: Financial Details

| Field | Type | Required | Validation |
|---|---|---|---|
| Occupation | Text input | No | Free text |
| Company Name | Text input | No | Free text |
| Annual Income | Number input | No | Positive, in ₹ |
| Payment Mode | Radio buttons | No | Self-Funded / Bank Loan / Part Loan |
| Preferred Bank | Dropdown | Conditional | Required if Payment Mode = Bank Loan or Part Loan. Options: SBI, HDFC, ICICI, Axis, Bank of Baroda, PNB, Kotak, LIC Housing, Other |
| Loan Amount | Number input | Conditional | Required if Payment Mode = Bank Loan or Part Loan. Must be positive. |

**KYC Document Checklist** (7 items):

| Document | Status |
|---|---|
| PAN Card Copy | ☐ Not Uploaded / ☑ Uploaded |
| Aadhaar Card Copy | ☐ / ☑ |
| Passport Photo | ☐ / ☑ |
| Address Proof | ☐ / ☑ |
| Income Proof | ☐ / ☑ |
| Bank Statement (6 months) | ☐ / ☑ |
| Cancelled Cheque | ☐ / ☑ |

Clicking each item toggles its status. These are tracking flags — actual document uploads happen in Customer 360 → Document Vault post-booking.

#### 4.10.4 Tab 3: Co-Applicant Details

| Field | Type | Required | Validation |
|---|---|---|---|
| Co-Applicant Name | Text input | No | Min 2 chars if provided |
| Co-Applicant PAN | Text input | No | Same PAN format validation if provided |
| Relationship | Dropdown | No | Spouse, Parent, Sibling, Child, Business Partner, Other |

#### 4.10.5 Booking Summary (Bottom of Dialog, Always Visible)

A fixed summary section at the bottom showing:

| Field | Value |
|---|---|
| Unit | A-1201 (2BHK, Floor 12) |
| Project | Project Name, City |
| Customer | Full name (from Tab 1) |
| Agreement Value | ₹XX |
| Total Cost (All-Inclusive) | ₹XX |

#### 4.10.6 Submit ("Confirm Booking") Button Behavior

**Pre-submit validation (STRICT):**

The following **8 fields must ALL be non-empty and valid** for the booking to proceed:

1. Full Name
2. Father's / Spouse Name
3. Date of Birth
4. PAN Number (valid format)
5. Aadhaar Number (valid format)
6. Mobile Primary (10 digits)
7. Email (valid format)
8. Current Address

If ANY of these 8 fields is missing or invalid:
- The submit button is **disabled** (grayed out, not clickable).
- A red notice below the button: "Please complete all mandatory fields to proceed."
- The incomplete field(s) are highlighted with red borders and error messages.
- The tab containing the first incomplete field is indicated with a red dot on its tab label.

**On successful validation and submit:**

This triggers the **Booking Created Cascade** (the most important cascade in the system):

1. **Customer record**: Created if PAN doesn't exist in system. If PAN matches existing customer, that record is updated/linked.
2. **Booking record**: Created with all financial details, linked to unit, customer, sales person, agent.
3. **Unit status** → "Booked". Unit record updated with customer_id, booking_id, sale_date.
4. **Commission record**: Auto-created if an agent is linked. Calculation:
   - Gross Commission = Agreement Value × Agent Commission %
   - GST = 18% of Gross
   - TDS = 5% of Gross
   - Net Payable = Gross - GST - TDS
   - Status: "Pending" (not payable until sale is fully completed)
5. **Payment Schedule (CLP)**: Auto-generated from project's milestone template. Typical milestones:
   - On Booking: 10%
   - On Agreement: 10%
   - On Plinth: 10%
   - On 1st Slab: 10%
   - On 3rd Slab: 10%
   - On 5th Slab: 10%
   - On Brickwork: 10%
   - On Plaster: 10%
   - On Flooring: 10%
   - On Possession: 10%
6. **Demand Letters**: Initial demand letter auto-generated for the "On Booking" milestone.
7. **Possession record**: Created with status "Pending" and empty checklist.
8. **Audit log**: BOOKING_CREATED entry with full before/after snapshot.
9. **Dialog closes**.
10. **Grid refreshes** — unit cell turns purple.
11. **Success toast**: "Booking confirmed for Unit A-1201 — Customer: [Name]"

---

### 4.11 Execute Agreement Action

Clicking "Execute Agreement" on a Booked unit:

1. Confirmation dialog with date picker for agreement date.
2. On confirm:
   - Unit status → "Agreement Done"
   - Booking record updated with agreement_date
   - Agreement record created
   - Audit log entry
   - Success toast

---

### 4.12 Mark Registered Action

Clicking "Mark Registered" on an Agreement Done unit:

1. Dialog with fields:
   - Registration Date (required)
   - Registration Number (optional)
   - Sub-Registrar Office (optional)
2. On submit:
   - Unit status → "Registered"
   - Booking record updated with registration_date
   - Registration record created
   - **Commission status → "Sale Completed"** (commission is now eligible for payout)
   - Agent's total_commission and pending_commission updated
   - Audit log entry
   - Success toast

---

### 4.13 Hand Over Possession Action

Clicking "Hand Over Possession" on a Registered unit:

1. Opens Possession Checklist dialog (see Post-Sales → Possession for full details)
2. On completion:
   - Unit status → "Possession Handed"
   - Unit is now **fully closed** — no further financial actions possible
   - Audit log entry
   - Success toast

---

### 4.14 Cancel Unit Dialog

Opened when clicking "Cancel Unit" on any non-cancelled, non-possession unit.

#### 4.14.1 Confirmation Content

- Warning banner: "⚠️ This action will initiate a cancellation request that requires manager approval."
- Unit summary: Unit number, project, customer name, agreement value
- **Cancellation reason** (required): Text area, min 10 characters
- **Estimated refund preview** (read-only calculation):
  - Total Received: ₹X
  - Forfeiture (X%): -₹X
  - GST on Forfeiture (18%): -₹X
  - TDS: -₹X
  - Brokerage Recovery: -₹X
  - Admin Fee: -₹X
  - **Net Refund: ₹X**

#### 4.14.2 Submit Behavior

1. Creates an **Approval Request** of type "cancellation"
2. Status: "Pending Approval" — the unit does NOT change status yet
3. Notification sent to Admin and Sales Manager roles
4. Dialog closes
5. Toast: "Cancellation request submitted for approval"

**After Approval** (handled by the approver via Approvals interface):
- Full cancellation cascade executes (see Section 9.1)

---

### 4.15 Print Cost Sheet Dialog

Available for any unit at any status.

- Displays the full cost sheet in a print-optimized layout.
- **Project name and logo** at top
- **Unit details**: Number, tower, floor, config, area, facing
- **Cost breakdown table**: Same as Section 4.6.5
- **Two buttons**:
  - "Copy" — copies cost sheet as formatted text to clipboard
  - "Print" — opens browser print dialog

---

## 5. Module 4: Sales Engine

Manages the commercial and team aspects of sales. Contains **4 sub-tabs**: Team, Agents, Bookings, Commissions.

### 5.1 Team Sub-Tab

#### 5.1.1 Layout

Identical structure to Overview → Sales Team tab but with additional performance metrics:

- **Target vs Achievement charts** per person (bar chart)
- **Booking pipeline** per person (count of units at each stage)
- **Lead conversion rate** per person

#### 5.1.2 Individual Performance View

Clicking a team member's row expands to show:

- **Units in pipeline**: List of units currently blocked or at various stages by this person
- **MTD bookings**: Units booked this month
- **MTD revenue**: Sum of agreement values this month
- **Active leads**: Leads assigned to this person in non-terminal status
- **Commission earned**: Total commission generated through this person's bookings

---

### 5.2 Agents Sub-Tab

Same as Overview → Agents tab with additional details:

- **Booking history**: Table of all bookings facilitated by this agent
- **Commission ledger**: All commission records with payout status
- **Active units**: Units currently in pipeline with this agent

---

### 5.3 Bookings Sub-Tab

#### 5.3.1 Filters

- **Project filter**: Dropdown
- **Status filter**: All | Booked | Agreement Done | Registered | Possession Handed | Cancelled
- **Date range**: Booking date range
- **Sales Person filter**: Dropdown
- **Search**: By booking code, customer name, unit number

#### 5.3.2 Bookings Table

| Column | Content |
|---|---|
| Booking Code | BKG-001 (clickable → opens booking detail) |
| Unit | Unit number + project name |
| Customer | Customer name (clickable → Customer 360) |
| Sales Person | Name |
| Agent | Firm name or "Direct" |
| Booking Date | Formatted date |
| Agreement Value | ₹X |
| Status | Colored badge |

#### 5.3.3 Booking Detail Panel

Clicking a booking code opens a detailed panel showing:

- All booking metadata
- Unit details (mini cost sheet)
- Customer summary
- Payment summary: Total due, Received, Outstanding
- Demand letter status summary
- Commission details
- Timeline of all status changes

---

### 5.4 Commissions Sub-Tab

#### 5.4.1 Filters

- **Agent filter**: Dropdown
- **Status filter**: All | Pending | Sale Completed | Approved | Partially Paid | Paid | Cancelled
- **Date range**: Booking date range

#### 5.4.2 Commission Table

| Column | Content |
|---|---|
| Booking Code | BKG-001 |
| Unit | Unit number |
| Agent | Firm name |
| Agreement Value | ₹X |
| Commission % | X% |
| Gross Commission | ₹X |
| GST (18%) | ₹X |
| TDS (5%) | ₹X |
| Net Payable | ₹X |
| Paid Amount | ₹X |
| Pending | ₹X |
| Status | Colored badge |
| Action | "Record Payout" button (for Approved/Partially Paid) |

#### 5.4.3 Record Payout Dialog

| Field | Type | Required |
|---|---|---|
| Payout Amount | Number | Yes (must be ≤ pending amount) |
| Payment Mode | Dropdown | Yes |
| Transaction Reference | Text | No |
| Milestone | Dropdown | Yes (from commission milestone list) |

**Submit**: Updates commission paid_amount, milestone status. If fully paid, commission status → "Paid".

**Commission Status Rule**: The "Record Payout" button is ONLY available when commission status is "Sale Completed" or later. Commission at "Pending" status cannot receive payouts — the sale must be fully completed first (unit reaches Registered or Possession Handed).

---

## 6. Module 5: Post-Sales

The most operationally complex module. Contains **8 sub-tabs** (Construction section removed): Payments, Demand Letters, Payment Schedule, Possession, Complaints, Cancellations, Transfers, Audit.

### 6.1 Payments Sub-Tab

#### 6.1.1 Filters

- **Booking/Unit filter**: Search by booking code or unit number
- **Status filter**: All | Cleared | Bounced | Under Process | Refund Pending | Refunded
- **Payment mode filter**: All | Cheque | NEFT | RTGS | UPI | DD | Cash
- **Date range**: Payment date range
- **"Record Payment" button** (Finance and Admin roles)

#### 6.1.2 Payments Table

| Column | Content |
|---|---|
| Receipt No. | Auto-generated (RCP-001) |
| Booking Code | BKG-001 |
| Customer | Name |
| Unit | Unit number |
| Amount | ₹X |
| Mode | Payment mode |
| Reference | UTR / Cheque number |
| Date | Payment date |
| Status | Colored badge: Cleared (green), Bounced (red), Under Process (yellow), Refund Pending (orange), Refunded (gray) |
| Recorded By | User name |
| Action | Status update dropdown (for Finance role) |

#### 6.1.3 Record Payment Dialog

| Field | Type | Required | Validation |
|---|---|---|---|
| Booking | Dropdown/Search | Yes | List of active bookings |
| Amount | Number input | Yes | Must be positive |
| Payment Mode | Dropdown | Yes | Cheque, NEFT, RTGS, UPI, DD, Cash |
| Transaction Reference | Text input | Conditional | Required for NEFT, RTGS, UPI |
| Payment Date | Date picker | Yes | Cannot be future date |
| Linked Demand Letter | Dropdown | No | List of pending/partial demand letters for selected booking |
| Remarks | Text area | No | Free text |

**Submit**: Creates payment record with auto-generated receipt number. Status: "Under Process" (for cheque/DD) or "Cleared" (for NEFT/RTGS/UPI/Cash). Audit log created.

#### 6.1.4 Payment Status Changes

**Mark as Cleared**: Available for "Under Process" payments.
- Updates status to "Cleared"
- If linked to demand letter: demand letter paid_amount increases, remaining decreases. Status may change to "Partially Paid" or "Paid".
- Audit log entry.

**Mark as Bounced**: Available for "Under Process" or "Cleared" payments.
- Opens bounce dialog: requires bounce_reason (dropdown: "Insufficient Funds", "Signature Mismatch", "Account Closed", "Stop Payment", "Technical Error", "Other") and bounce_date.
- **Triggers Payment Bounced Cascade**:
  1. Payment status → "Bounced"
  2. Demand letter reversal (if linked): paid_amount decreases, remaining increases, status may revert
  3. Auto-creates complaint with category "Payment", subject "Cheque Bounce", priority "High", SLA 24 hours
  4. Audit log entry
  5. Notification to customer, finance team, and sales person

---

### 6.2 Demand Letters Sub-Tab

#### 6.2.1 Filters

- **Booking filter**: Search by booking code
- **Status filter**: All | Pending | Partially Paid | Paid | Overdue
- **Date range**: Due date range
- **"Generate Demand" button** (Finance role)

#### 6.2.2 Demand Letter Table

| Column | Content |
|---|---|
| Letter Code | DL-BKG001-01 |
| Booking | BKG-001 |
| Customer | Name |
| Milestone | "On Booking", "On Slab", etc. |
| Milestone % | 10%, 15%, etc. |
| Demand Amount | ₹X |
| Due Date | Formatted date |
| Paid Amount | ₹X |
| Remaining | ₹X (highlighted red if overdue) |
| Status | Colored badge |
| Reminders Sent | Count |

#### 6.2.3 Generate Demand Letter Dialog

| Field | Type | Required |
|---|---|---|
| Booking | Dropdown | Yes |
| Milestone | Dropdown | Yes (from payment schedule) |
| Demand Amount | Auto-calculated | Read-only |
| Due Date | Date picker | Yes |

#### 6.2.4 Manual Reconciliation

For demand letters with status "Pending" or "Partially Paid":
- Finance user can manually update `paid_amount` via an "Update Payment" button.
- This is a manual process — partial payments against demand letters are manually reconciled.
- On update: system recalculates remaining amount. If remaining = 0, status → "Paid". If 0 < remaining < demand_amount, status → "Partially Paid".

#### 6.2.5 Overdue Detection

A background job runs every hour:
- Finds all demand letters where `due_date < today` AND status is "Pending" or "Partially Paid".
- Marks them as "Overdue".
- Overdue letters are highlighted with red backgrounds in the table.
- Overdue count is shown in the filter bar as a badge.

---

### 6.3 Payment Schedule Sub-Tab

#### 6.3.1 View

- Select a booking via dropdown search.
- Displays the **Construction Linked Payment (CLP) plan** as a milestone timeline.
- Each milestone shows:
  - Milestone name (e.g., "On 3rd Slab")
  - Percentage of agreement value
  - Calculated amount (₹)
  - Due date (if set)
  - Status: Upcoming | Due | Paid | Overdue
  - Linked demand letter (if generated)

#### 6.3.2 Timeline Visualization

Milestones are displayed vertically as a timeline:
- Completed (Paid) milestones: Green checkmark
- Current (Due) milestone: Blue pulsing indicator
- Upcoming milestones: Gray dots
- Overdue milestones: Red warning indicator

---

### 6.4 Possession Sub-Tab

#### 6.4.1 Possession List

Table of all possession records:

| Column | Content |
|---|---|
| Unit | Unit number |
| Customer | Name |
| Booking Code | BKG-001 |
| Status | Pending / In Progress / Completed |
| Possession Date | Date or "Not Set" |
| Checklist Progress | "X/Y items complete" with progress bar |
| Snag Count | Open: X | Resolved: Y |

#### 6.4.2 Possession Detail (Checklist)

Clicking a possession record opens a detail view:

**Possession Checklist**:

| Item | Status | Toggle |
|---|---|---|
| Possession Letter Issued | ☐ / ☑ | Click to toggle |
| Keys Handed Over | ☐ / ☑ | Click to toggle |
| Electricity Meter Reading Recorded | ☐ / ☑ | Click to toggle |
| Water Meter Reading Recorded | ☐ / ☑ | Click to toggle |
| Gas Connection Transferred | ☐ / ☑ | Click to toggle |
| Parking Spot Allocated | ☐ / ☑ | Click to toggle |
| Welcome Kit Delivered | ☐ / ☑ | Click to toggle |
| Society Membership Form Signed | ☐ / ☑ | Click to toggle |

Each toggle updates the record immediately. Progress bar reflects completion.

**Note**: Possession does NOT require all demand letters to be fully paid. It is manually managed and can proceed regardless of outstanding dues. Once the checklist is fully complete and the handover is confirmed, the unit is marked "Possession Handed" and is permanently closed for further financial actions.

**Snag List Management**:

Below the checklist, a "Snag List" section:

- **"Report Snag" button**: Opens a form:
  - Description (required)
  - Category: Plumbing, Electrical, Civil, Painting, Carpentry, Hardware, Other
  - Priority: High, Medium, Low
  - Photos (optional, upload to S3)
- **Snag items table**:
  - Description, Category, Priority, Status (Open / In Progress / Resolved), Reported Date, Resolved Date
  - Actions: "Start Work" (Open → In Progress), "Mark Resolved" (In Progress → Resolved)

---

### 6.5 Complaints Sub-Tab

#### 6.5.1 Filters

- **Status filter tabs**: All | Open | In Progress | Resolved | Closed | Escalated
- **Priority filter**: All | High | Medium | Low
- **Category filter**: All | Payment | Construction | Documentation | General
- **"Create Complaint" button**

#### 6.5.2 Complaint Cards

Each complaint card shows:

- **Complaint code** (e.g., CMP-001) and **subject** — prominent
- **Customer name** — clickable
- **Category badge** and **Priority badge**
- **Status badge**: Open (blue), In Progress (yellow), Resolved (green), Closed (gray), Escalated (red)
- **SLA indicator**:
  - If within SLA: Green clock icon + "Due in X hours"
  - If SLA breached: Red warning icon + "BREACHED — X hours overdue"
- **Assigned to**: User name or "Unassigned"
- **Created date**: Relative time

#### 6.5.3 Create Complaint Dialog

| Field | Type | Required |
|---|---|---|
| Customer | Dropdown/Search | Yes |
| Unit | Dropdown | No (auto-populated if customer has one unit) |
| Category | Dropdown | Yes |
| Subject | Text input | Yes |
| Description | Text area | Yes (min 20 characters) |
| Priority | Dropdown | Yes (default: Medium) |
| Assign To | Dropdown | No |

**Submit**: Creates complaint with SLA deadline (default 48 hours from creation). Auto-generated complaint code. Notification to assigned user (if set) and admin.

#### 6.5.4 Complaint Detail & Resolution

Clicking a complaint opens its detail view:

- Full complaint information
- **Status update buttons**: Based on current status:
  - Open → "Start Working" (→ In Progress) or "Escalate" (→ Escalated)
  - In Progress → "Mark Resolved" (→ Resolved, requires resolution text)
  - Resolved → "Close" (→ Closed)
  - Escalated → "Start Working" or "Close"
- **Communication thread**: Chronological list of updates, status changes, notes added by team members
- **"Add Note" button**: Add internal note or customer-facing update

#### 6.5.5 SLA Breach Detection

Background job runs every 30 minutes:
- Finds complaints where `sla_deadline < now` AND status NOT IN (Resolved, Closed)
- Sets `sla_breached = true`
- Sends notification to Admin and assigned user
- Breached complaints are highlighted in the list with red border

---

### 6.6 Cancellations Sub-Tab

#### 6.6.1 Cancellation Records Table

Read-only view of all cancellation records (created automatically by the cancellation cascade):

| Column | Content |
|---|---|
| Cancel Code | CAN-001 |
| Booking | BKG-001 |
| Unit | Unit number |
| Customer | Name |
| Cancellation Date | Formatted date |
| Reason | Text (truncated, hover for full) |
| Total Received | ₹X |
| Forfeiture | ₹X |
| GST Deduction | ₹X |
| TDS Deduction | ₹X |
| Brokerage Recovery | ₹X |
| Admin Fee | ₹X |
| **Net Refund** | **₹X** (highlighted) |
| Refund Status | Pending / Approved / Processed / Paid |
| Requested By | User name |
| Approved By | User name |

#### 6.6.2 Refund Processing

For cancellations with refund_status "Approved":
- Finance user can click "Process Refund" → opens form:
  - Refund Amount (pre-filled with net_refund, editable)
  - Payment Mode (NEFT/RTGS/Cheque)
  - Transaction Reference
  - Refund Date
- On submit: refund_status → "Processed" → then "Paid" when confirmed

---

### 6.7 Transfers Sub-Tab

#### 6.7.1 Transfer Records Table

| Column | Content |
|---|---|
| Transfer Code | TRF-001 |
| Unit | Unit number |
| From Customer | Original customer name |
| To Customer | New customer name |
| Transfer Date | Date |
| Transfer Fee | ₹X |
| Status | Pending Approval / Approved / Executed / Rejected |
| Requested By | User name |

#### 6.7.2 Initiate Transfer

**"Initiate Transfer" button** opens a multi-step form:

**Step 1: Select Unit & Existing Customer**
- Unit: Dropdown (only units with status Booked through Registered)
- Auto-shows current customer details

**Step 2: New Customer Details (Transferee)**
- Same mandatory fields as the booking form (Full Name, PAN, Aadhaar, Mobile, Email, Address, DOB, Father/Spouse Name)

**Step 3: Transfer Details**
- Transfer Fee: Number input (₹)
- NOC Document: **Mandatory** file upload (PDF/Image of No Objection Certificate from original buyer)
- Reason: Text area

**Submit**: Creates Transfer Record with status "Pending Approval". Creates Approval Request. Notifications sent to Admin and Sales Manager.

**After Approval & Execution** (Transfer Cascade):
1. New customer record created (or linked if PAN exists)
2. Transfer fee recorded as a payment
3. Unit ownership updated: customer_id → new customer
4. Booking record: customer_id → new customer
5. ALL payment history moved to new customer
6. ALL demand letters updated to new customer
7. Possession record updated
8. Loan records updated
9. Transfer record status → "Executed"
10. Full audit trail created
11. Both customers' 360 views updated

---

### 6.8 Audit Sub-Tab

#### 6.8.1 Audit Log Viewer

A searchable, filterable log of every action in the system.

**Filters**:
- **Entity type**: All | Unit | Booking | Payment | Lead | Customer | Commission | Complaint | Transfer | Possession | Agent | Sales Person | Project | Approval
- **Action**: All | Create | Update | Delete | Status Change | Approve | Reject
- **Actor**: Dropdown of all users (or "SYSTEM" for cron-triggered events)
- **Date range**: Start → End
- **Search**: By entity code or actor name

**Log Entry Display**:

Each entry shows:
- **Timestamp**: Full date and time
- **Actor**: User name + role badge (or "SYSTEM")
- **Action badge**: Create (green), Update (blue), Delete (red), Status Change (purple), Approve (green), Reject (red)
- **Entity**: Type + Code (e.g., "Unit A-1201", "Booking BKG-001")
- **Summary**: Human-readable description (e.g., "Unit A-1201 status changed from Blocked to Token Received")
- **Expand arrow**: Click to see full before/after JSON diff

**Expanded View** shows:
- Before State (JSON, formatted)
- After State (JSON, formatted)
- Changed Fields (highlighted diff)
- Metadata: IP address, user agent

---

## 7. Module 6: Customer 360

A single comprehensive view of everything related to a customer.

### 7.1 Customer Search

- **Search bar**: Search by customer name, PAN, mobile, email, customer code.
- **Results list**: Customer cards showing name, PAN (masked: XXXXX0000X), mobile, unit count, booking status.
- Clicking a customer card opens their **360 view**.

### 7.2 Customer 360 View (8 Sections)

#### Section 1: Profile Header

- Customer name (large), customer code
- PAN Number, Aadhaar (partially masked for display)
- Mobile, Email
- Date of Birth, Occupation
- Current Address
- Co-applicant info (if exists)
- **KYC Status badge**: Verified (green) or Pending (yellow)
- **Edit Profile button** (opens edit form)

#### Section 2: Associated Units & Bookings

Table of all units/bookings linked to this customer:

| Column | Content |
|---|---|
| Unit | Unit number (clickable → Live Inventory detail) |
| Project | Project name |
| Booking Code | BKG-XXX |
| Status | Current unit status badge |
| Agreement Value | ₹X |
| Paid Amount | ₹X |
| Outstanding | ₹X (red if > 0) |

#### Section 3: Document Vault

**9 document categories** displayed as a card grid:

| Category | Description |
|---|---|
| PAN Card | Identity proof |
| Aadhaar Card | Identity proof |
| Passport Photo | Photo ID |
| Address Proof | Utility bill, rental agreement, etc. |
| Income Proof | Salary slip, ITR, etc. |
| Bank Statement | Last 6 months |
| Agreement Copy | Registered agreement |
| Registration Document | Sub-registrar document |
| Other | Miscellaneous |

Each category card shows:
- Category name + icon
- Status: "Uploaded" (green check), "Verified" (blue shield), "Rejected" (red X), "Not Uploaded" (gray)
- Upload date (if uploaded)
- **View button**: Downloads/previews the document
- **Upload button**: Opens file upload dialog (presigned S3 URL flow)
- **Verify/Reject buttons** (visible to Finance/Admin): Mark document as verified or rejected

#### Section 4: Communication Log

Chronological timeline of all communications with this customer:

- Each entry: Channel icon (Phone/Email/WhatsApp/SMS/In-person) + Direction (→ Outbound, ← Inbound) + Content summary + Actor name + Timestamp + Duration (for calls)
- **"Log Communication" button**: Opens form to record a new entry:
  - Channel (required), Direction (required), Subject, Content, Duration (for calls)

#### Section 5: Loan Tracking

Table of loan records linked to this customer:

| Column | Content |
|---|---|
| Bank | Bank name |
| Loan Amount | ₹X |
| Sanctioned Amount | ₹X |
| Interest Rate | X% |
| Tenure | X months |
| Status | Applied / Sanctioned / Disbursing / Fully Disbursed / Rejected |

Expanding a loan record shows the **disbursement schedule**:
- Table: Tranche #, Date, Amount, Reference
- "Add Disbursement" button (Finance role)

#### Section 6: Agreement & Registration

- **Agreement record**: Agreement date, value, stamp duty paid, linked document
- **Registration record**: Registration date, registration number, sub-registrar, fee, linked document
- Both records are read-only summaries with links to the actual documents in the vault.

#### Section 7: Payment History

Full table of all payments by this customer (across all bookings):

| Column | Content |
|---|---|
| Receipt No. | RCP-XXX |
| Booking | BKG-XXX |
| Amount | ₹X |
| Mode | Payment mode |
| Date | Payment date |
| Status | Badge |

Summary row at top: **Total Paid: ₹X | Total Due: ₹X | Outstanding: ₹X**

#### Section 8: Complaint History

Table of all complaints filed by or for this customer:
- Complaint code, subject, category, priority, status, created date, resolved date
- Clicking opens full complaint detail

---

## 8. Module 7: Analytics

Dashboards and visualizations powered by Recharts. Contains **5 sub-tabs**: Sales, Inventory, Financial, Channel, Agent Performance.

### 8.1 Sales Analytics

#### 8.1.1 KPI Row (6 Cards)

| KPI | Metric |
|---|---|
| Total Bookings | Count (MTD + YTD) |
| Revenue Booked | ₹ (MTD + YTD) |
| Avg Ticket Size | ₹ (Agreement Value / Bookings) |
| Conversion Rate | % (Won leads / Total leads) |
| Avg Sales Cycle | Days (Lead created → Booking) |
| Cancellation Rate | % (Cancelled / Total bookings) |

#### 8.1.2 Charts

- **Monthly Revenue Trend** (Line chart): Last 12 months, revenue booked per month
- **Bookings by Project** (Bar chart): Horizontal bars, bookings count per project
- **Bookings by Config** (Pie/Donut chart): Distribution of 1BHK/2BHK/3BHK/4BHK/Penthouse bookings
- **Lead Source Performance** (Stacked bar chart): Leads by source and their conversion outcomes
- **Team Leaderboard** (Table): Sales persons ranked by MTD bookings, revenue, conversion rate

### 8.2 Inventory Analytics

#### 8.2.1 Project-wise Summary Table

| Column | Content |
|---|---|
| Project | Name |
| Total Units | Count |
| Available | Count + % |
| Blocked | Count |
| Sold | Count + % |
| Revenue Potential | ₹ (Available × Avg price) |

#### 8.2.2 Inventory Heatmap

For each project (selectable via dropdown):
- A **per-tower heatmap grid** identical to the Live Inventory grid but color-coded purely by status.
- Used for visual analysis of which floors/positions sell fastest.
- Color intensity indicates status density: darker = more sold, lighter = more available.

#### 8.2.3 Config-wise Demand Analysis

- Chart showing which configurations (1BHK, 2BHK, etc.) have highest demand vs. supply.
- Helps in pricing decisions for remaining inventory.

### 8.3 Financial Analytics

#### 8.3.1 KPI Row

| KPI | Metric |
|---|---|
| Total Billed | Sum of all demand letter amounts |
| Total Collected | Sum of all cleared payments |
| Collection Efficiency | % (Collected / Billed) |
| Outstanding | ₹ (Billed - Collected) |
| Overdue Amount | ₹ (Sum of overdue demand letters) |
| Refunds Processed | ₹ |

#### 8.3.2 Charts

- **Collection Trend** (Line chart): Monthly collection vs. demand
- **Outstanding Aging** (Bar chart): Outstanding grouped by age buckets (0-30 days, 31-60, 61-90, 90+)
- **Payment Mode Distribution** (Donut chart): Percentage by NEFT, Cheque, UPI, etc.
- **Project-wise Collection** (Horizontal bar): Collection efficiency per project

### 8.4 Channel Analytics

#### 8.4.1 Agent Performance Table

| Column | Content |
|---|---|
| Agent | Firm name |
| Units Sold | Count |
| Revenue Generated | ₹ |
| Gross Commission | ₹ |
| Pending Commission | ₹ |
| Avg Ticket Size | ₹ |
| Rating | X/5 |

#### 8.4.2 Charts

- **Top 5 Agents by Revenue** (Bar chart)
- **Agent vs. Direct Sales Split** (Donut chart)
- **Commission Payout Status** (Stacked bar): Paid vs. Pending vs. Cancelled

### 8.5 Agent Performance (Drill-Down)

#### 8.5.1 Tier System

Agents are classified into performance tiers:

| Tier | Criteria | Badge Color |
|---|---|---|
| Platinum | 20+ units sold, Rating ≥ 4.5 | Silver/Platinum |
| Gold | 10-19 units, Rating ≥ 4.0 | Gold |
| Silver | 5-9 units, Rating ≥ 3.5 | Silver |
| Bronze | 1-4 units | Bronze |
| New | 0 units | Gray |

#### 8.5.2 Individual Agent Drill-Down

Selecting an agent shows:
- Profile summary
- Performance metrics (units, revenue, commission)
- Booking history table
- Commission ledger
- Monthly trend chart
- Rating history

---

## 9. Cross-Module Cascades (Interconnected Behaviors)

These are the critical data flows where an action in one module automatically creates, updates, or affects records in other modules.

### 9.1 Booking Created Cascade

**Trigger**: "Confirm Booking" button in Live Inventory → Create Booking Dialog

| Step | Module Affected | Action |
|---|---|---|
| 1 | Live Inventory | Unit status: Token Received → Booked |
| 2 | Customer 360 | Customer record created or linked |
| 3 | Sales Engine → Bookings | Booking record created |
| 4 | Live Inventory | Unit record updated (customer_id, booking_id, sale_date) |
| 5 | Sales Engine → Commissions | Commission record auto-created (if agent linked) |
| 6 | Post-Sales → Payments | Token payment record created (status: cleared) |
| 7 | Post-Sales → Payment Schedule | CLP milestones auto-generated |
| 8 | Post-Sales → Demand Letters | Initial demand letter auto-generated |
| 9 | Post-Sales → Possession | Possession record created (status: pending) |
| 10 | Post-Sales → Audit | Audit log entry: BOOKING_CREATED |

### 9.2 Unit Cancellation Cascade

**Trigger**: Cancellation approval approved (initiated from Live Inventory → Cancel Unit)

| Step | Module Affected | Action |
|---|---|---|
| 1 | Live Inventory | Unit status → Cancelled; clear sales_person, agent, customer, booking links |
| 2 | Sales Engine → Bookings | Booking status → Cancelled |
| 3 | Post-Sales → Cancellations | Cancellation record auto-created with full refund calculation |
| 4 | Post-Sales → Payments | ALL payments for this booking → status: refund_pending |
| 5 | Post-Sales → Demand Letters | ALL pending demand letters → status: cancelled |
| 6 | Sales Engine → Commissions | Commission updated: if pending → cancelled; if sale_completed → cancelled with clawback |
| 7 | Overview → Agents | Agent pending_commission recalculated |
| 8 | Post-Sales → Audit | Audit log entry: UNIT_CANCELLED |

### 9.3 Payment Bounced Cascade

**Trigger**: Payment status changed to "Bounced" in Post-Sales → Payments

| Step | Module Affected | Action |
|---|---|---|
| 1 | Post-Sales → Payments | Payment status → Bounced, bounce reason + date recorded |
| 2 | Post-Sales → Demand Letters | Linked demand letter: paid_amount decreased, remaining increased, status may revert |
| 3 | Post-Sales → Complaints | Auto-create complaint: category=Payment, priority=High, SLA=24h |
| 4 | Post-Sales → Audit | Audit log entry: PAYMENT_BOUNCED |

### 9.4 Transfer Execution Cascade

**Trigger**: Transfer approval approved

| Step | Module Affected | Action |
|---|---|---|
| 1 | Customer 360 | New customer record created for transferee |
| 2 | Post-Sales → Payments | Transfer fee payment recorded |
| 3 | Live Inventory | Unit customer_id → new customer |
| 4 | Sales Engine → Bookings | Booking customer_id → new customer |
| 5 | Post-Sales → Payments | ALL payment records: customer_id → new customer |
| 6 | Post-Sales → Demand Letters | ALL demand letters: customer_id → new customer |
| 7 | Post-Sales → Possession | Possession record: customer_id → new customer |
| 8 | Customer 360 → Loans | Loan records: customer_id → new customer |
| 9 | Post-Sales → Transfers | Transfer record status → Executed |
| 10 | Post-Sales → Audit | Audit log entry: TRANSFER_EXECUTED |

### 9.5 Possession Completed Cascade

**Trigger**: All possession checklist items marked complete + handover confirmed

| Step | Module Affected | Action |
|---|---|---|
| 1 | Post-Sales → Possession | Possession status → Completed, date recorded |
| 2 | Live Inventory | Unit status → Possession Handed (CLOSED) |
| 3 | Sales Engine → Bookings | Booking status → Possession Handed |
| 4 | Sales Engine → Commissions | Commission eligible for final payout (if sale_completed) |
| 5 | Post-Sales → Audit | Audit log entry: POSSESSION_COMPLETED |

### 9.6 Block Expired Cascade (Automated)

**Trigger**: Background cron job (runs every minute)

| Step | Module Affected | Action |
|---|---|---|
| 1 | Live Inventory | Unit status: Blocked → Available |
| 2 | Live Inventory | Clear: blocked_by, blocked_at, block_expires_at, block_agent_id |
| 3 | Overview → Sales Team | Sales person active block count decremented |
| 4 | Post-Sales → Audit | Audit log entry: BLOCK_EXPIRED (actor = SYSTEM) |

### 9.7 Registration Completed Cascade

**Trigger**: "Mark Registered" action on Agreement Done unit

| Step | Module Affected | Action |
|---|---|---|
| 1 | Live Inventory | Unit status: Agreement Done → Registered |
| 2 | Sales Engine → Bookings | Booking registration_date recorded |
| 3 | Customer 360 | Registration record created |
| 4 | Sales Engine → Commissions | Commission status → Sale Completed (commission now eligible for payout) |
| 5 | Overview → Agents | Agent total_commission and pending_commission updated |
| 6 | Post-Sales → Audit | Audit log entry: REGISTRATION_DONE |

---

## 10. Role-Based Access Matrix

### Feature Access by Role

| Feature / Action | Admin | Sales Manager | Sales Executive | Finance | Operations |
|---|---|---|---|---|---|
| **View Dashboard** | ✅ All | ✅ All | ✅ Own metrics | ✅ Financial only | ✅ Operational only |
| **Create Project** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Edit Project** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Deactivate Project** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Add Sales Person** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Deactivate Sales Person** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Add Agent** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Deactivate Agent** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Inventory Grid** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Block Unit** | ✅ | ✅ | ✅ (own only) | ❌ | ❌ |
| **Release Block** | ✅ | ✅ (any) | ✅ (own only) | ❌ | ❌ |
| **Collect Token** | ✅ | ✅ | ✅ (own blocks) | ❌ | ❌ |
| **Create Booking** | ✅ | ✅ | ✅ (own blocks) | ❌ | ❌ |
| **Execute Agreement** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Mark Registered** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Request Cancellation** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Approve Cancellation** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Leads** | ✅ All | ✅ Team | ✅ Own | ❌ | ❌ |
| **Create/Edit Leads** | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| **Schedule Site Visit** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Create Follow-up** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Record Payment** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Mark Payment Bounced** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Generate Demand Letter** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Reconcile Demand Payment** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Process Refund** | ✅ | ❌ | ❌ | ✅ (needs approval) | ❌ |
| **Approve Refund** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Initiate Transfer** | ✅ | ✅ (needs approval) | ❌ | ❌ | ❌ |
| **Approve Transfer** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Manage Possession** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Report/Manage Snags** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Create Complaint** | ✅ | ✅ | ✅ (own customers) | ✅ | ✅ |
| **Resolve Complaint** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Record Commission Payout** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **View Analytics** | ✅ All | ✅ Team | ✅ Own | ✅ Financial | ✅ Operational |
| **View Audit Logs** | ✅ All | ✅ Team | ❌ | ✅ Financial | ✅ Operational |
| **Manage Tenant Settings** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Approve/Reject Requests** | ✅ All | ✅ (per rules) | ❌ | ✅ (refunds) | ❌ |

### Data Scope by Role

| Role | Leads Visible | Bookings Visible | Payments Visible | Analytics Scope |
|---|---|---|---|---|
| Admin | All | All | All | All modules, all data |
| Sales Manager | Team's leads | Team's bookings | Team's related | Team metrics |
| Sales Executive | Own leads only | Own bookings only | Own related | Own metrics only |
| Finance | N/A | All (read) | All | Financial analytics |
| Operations | N/A | All (read) | Read only | Operational metrics |

---

## 11. Approval Workflows

### 11.1 Actions Requiring Approval

| Action | Who Can Request | Who Can Approve | Auto-Approve Condition |
|---|---|---|---|
| **Unit Cancellation** | Admin, Sales Manager | Admin, Sales Manager | Never (always needs approval) |
| **Unit Discount** (>1%) | Admin, Sales Manager | Admin, Sales Manager | Auto-approved if discount ≤ 1% |
| **Refund Processing** | Finance | Admin only | Never |
| **Unit Transfer** | Admin, Sales Manager | Admin, Sales Manager | Never |

### 11.2 Approval Flow

1. **Request Created**: Action button triggers approval request creation. Entity is placed in "Pending Approval" state.
2. **Notification**: Approvers receive in-app notification and email.
3. **Review**: Approver sees request details, justification, and data snapshot in the Approvals interface.
4. **Decision**:
   - **Approve**: Cascade executes immediately. Requester notified. Audit log created.
   - **Reject**: Request marked rejected with remarks. No cascade. Requester notified. Audit log created.
5. **Escalation**: If not reviewed within 48 hours (configurable), escalation notification sent to Admin.

### 11.3 Approvals Interface

Accessible via a bell/notification icon in the header (shows pending count badge).

- **Pending Approvals List**: Cards showing:
  - Request type badge (Cancellation, Discount, Refund, Transfer)
  - Entity details (unit number, booking code, customer)
  - Requested by (name, role, timestamp)
  - Justification text
  - "Approve" (green) and "Reject" (red) buttons
- **Reject** requires a reason text input (mandatory)
- **History tab**: All past approvals/rejections

---

## 12. Notifications & Alerts

### 12.1 In-App Notifications

Toast notifications displayed for:
- Action confirmations (booking created, payment recorded, etc.)
- Errors (validation failure, permission denied)
- Approval requests received
- Approval decisions (approved/rejected)
- Block expiry warnings (at 4h, 1h, 15min remaining)
- SLA breach alerts

### 12.2 Email Notifications

Triggered automatically for:

| Event | Recipients |
|---|---|
| Booking confirmed | Customer, Sales Person, Agent |
| Cancellation request submitted | Admin, Sales Manager |
| Cancellation approved/rejected | Requester, Customer |
| Payment received | Customer |
| Payment bounced | Customer, Finance, Sales Person |
| Demand letter generated | Customer |
| Demand overdue | Customer, Finance |
| Transfer completed | Both customers, Finance |
| Possession completed | Customer, Sales Person, Agent |
| Complaint created | Assigned user, Admin |
| SLA breached | Assigned user, Admin |
| Commission payout processed | Agent |

### 12.3 SMS Notifications

Triggered for high-priority events:
- Booking confirmed
- Cancellation processed
- Payment bounce alert
- Possession date confirmation

---

## 13. Business Rules & Constraints Master List

### 13.1 Unit Lifecycle Rules

| Rule | Description |
|---|---|
| BLK-001 | Maximum 3 active blocks per sales person |
| BLK-002 | Block expires automatically after 48 hours |
| BLK-003 | Block expiry enforced by server-side cron job (runs every minute) |
| BLK-004 | Only "Available" units can be blocked |
| BLK-005 | Only active sales persons can block units |
| BLK-006 | Only active agents can be assigned during blocking |
| STS-001 | Unit status transitions are strictly sequential (no skipping stages) |
| STS-002 | Cancellation is allowed at any stage except Possession Handed and Cancelled |
| STS-003 | Possession Handed is a terminal state — no further actions possible |
| STS-004 | Cancelled is a terminal state — no reversal |

### 13.2 Booking Rules

| Rule | Description |
|---|---|
| BKG-001 | 8 mandatory fields must ALL be valid: Full Name, Father/Spouse, DOB, PAN, Aadhaar, Mobile, Email, Address |
| BKG-002 | PAN format: XXXXX0000X (5 letters, 4 digits, 1 letter) |
| BKG-003 | Aadhaar: exactly 12 digits |
| BKG-004 | Mobile: exactly 10 digits |
| BKG-005 | DOB: applicant must be 18+ years old |
| BKG-006 | If PAN already exists in system, existing customer record is linked (not duplicated) |
| BKG-007 | Booking auto-creates: customer, commission, payment schedule, demand letter, possession record |

### 13.3 Financial Rules

| Rule | Description |
|---|---|
| FIN-001 | All monetary values stored in paise (1/100 INR) to avoid floating point errors |
| FIN-002 | Commission: Gross = Agreement Value × Commission %. GST = 18% of Gross. TDS = 5% of Gross. Net = Gross - GST - TDS. |
| FIN-003 | Commission payouts only allowed after sale is completed (unit reaches Registered status) |
| FIN-004 | Cancellation refund: Net = Received - Forfeiture - GST(18%) - TDS - Brokerage Recovery - Admin Fee |
| FIN-005 | Demand letter reconciliation is manual (Finance user updates paid amounts) |
| FIN-006 | Cost sheet: Agreement Value = Base Price + Floor Rise + PLC + Amenity. Total = Agreement + GST(5%) + Stamp Duty(6%) + Registration |

### 13.4 Entity Management Rules

| Rule | Description |
|---|---|
| ENT-001 | No hard deletes anywhere in the system |
| ENT-002 | Projects: Active/Inactive toggle. Cannot be deleted if units exist. |
| ENT-003 | Sales Persons: Active/Inactive. Inactive persons hidden from dropdowns but visible in historical data. |
| ENT-004 | Agents: Active/Inactive. Cannot be deleted if transactions exist. Inactive hidden from dropdowns. |
| ENT-005 | RERA number is mandatory for all agents (Indian regulatory requirement) |
| ENT-006 | Agent RERA number must be unique within tenant |
| ENT-007 | Sales person mobile must be unique within tenant |

### 13.5 Approval Rules

| Rule | Description |
|---|---|
| APR-001 | Cancellations always require approval (never auto-approved) |
| APR-002 | Discounts >1% of agreement value require approval |
| APR-003 | Discounts ≤1% are auto-approved |
| APR-004 | Refund processing always requires Admin approval |
| APR-005 | Transfers always require approval |
| APR-006 | Transfers require NOC document from original buyer (mandatory) |
| APR-007 | Unapproved requests escalate after 48 hours |

### 13.6 Data Integrity Rules

| Rule | Description |
|---|---|
| DAT-001 | Every action creates an audit log entry |
| DAT-002 | Audit logs are immutable — never edited or deleted |
| DAT-003 | All timestamps stored in UTC |
| DAT-004 | PAN and Aadhaar encrypted at rest (AES-256-GCM) |
| DAT-005 | Document uploads use S3 presigned URLs (never pass through application server) |
| DAT-006 | Multi-tenant data isolation via PostgreSQL Row-Level Security |
| DAT-007 | Tenant data is completely invisible to other tenants, enforced at database level |

### 13.7 Possession Rules

| Rule | Description |
|---|---|
| POS-001 | Possession is manually managed — no dependency on demand letter completion |
| POS-002 | Possession can proceed with outstanding dues |
| POS-003 | Once possession is handed over, unit is permanently closed (no further charges) |
| POS-004 | Snag items follow lifecycle: Open → In Progress → Resolved |

### 13.8 Lead Pipeline Rules

| Rule | Description |
|---|---|
| LED-001 | Lead status transitions are forward-only (no backward movement) |
| LED-002 | Won, Lost, Junk are terminal statuses |
| LED-003 | Lost status requires a lost_reason (mandatory) |
| LED-004 | Won does NOT auto-create booking — manual block in Live Inventory required |
| LED-005 | Junk leads excluded from pipeline metrics and conversion calculations |
| LED-006 | Site visit scheduling auto-updates lead to "Site Visit Scheduled" |
| LED-007 | Site visit completion (check-out + feedback) auto-updates lead to "Site Visit Done" |

---

*End of Feature Specification*
