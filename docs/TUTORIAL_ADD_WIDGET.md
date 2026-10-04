# Tutorial: Adding Custom Widgets

This guide explains how to add new Custom Widgets to the Dashboard. Custom widgets allow you to monitor arbitrary commands, metrics, or scripts across your servers and local environment.

## 1. Widget Architecture

Widgets in this dashboard are composed of:
1. **Frontend Component**: Renders the data in `CustomWidgets.tsx`.
2. **Backend API**: Executes the shell command or fetches the data (`widgetsRouter.js`).
3. **Database**: Stores the widget configuration (name, command, type, color, etc.).

## 2. Supported Widget Types

The dashboard currently supports five types of data visualization for widgets:
- **`number`**: Displays a single large numeric value (e.g., CPU usage, active users).
- **`text`**: Displays raw text/monospace output (e.g., container list, server status string).
- **`bar-chart`**: Displays a progress bar (0-100%).
- **`network-chart`**: Windows Task Manager-style Ethernet/Network performance view. Spans 2 grid columns, rendering:
  - Header with card title ("Ethernet" or custom name), "Przepływność", and adapter name.
  - Timeseries SVG graph (60s history) with Task Manager grid (10 vertical, 4 horizontal divisions).
  - Dynamic top-right scale limit (e.g. `11 Mb/s`), horizontal reference line for peak throughput (`7,7 Mb/s`).
  - Dotted line for **Wysyłanie** (Upload) and solid line with gradient fill for **Odbieranie** (Download).
  - Bottom metrics (Wysyłanie & Odbieranie speeds in Polish decimal format e.g. `7,3 Mb/s`, `216 Kb/s`).
  - Connection properties table (Nazwa karty, Typ połączenia, Adres IPv4, Adres IPv6).

## 3. Creating a Widget via the UI

The easiest way to add a widget is through the Dashboard UI:

1. Navigate to the **Server Stats** or main dashboard view.
2. Locate the **"Custom Widgets"** panel.
3. Click the **"+" (Add)** button.
4. Fill in the configuration:
   - **Name**: The display name of the widget (e.g., "Ethernet" or "Active Docker Containers").
   - **Command**: The shell command to execute.
     - For `network-chart`: Provide a command returning throughput rates (e.g. `Download: 216 Kb/s | Upload: 7.3 Mb/s`) or interface details and counters (e.g. `Interface: eth0 | IPv4: 10.10.10.30 | rx: ... | tx: ...`). The widget calculates real-time rate over time automatically.
   - **Type**: Select `number`, `text`, `bar-chart`, or `network-chart`.
   - **Color**: Pick an accent color (e.g., Crimson `#d13438` for Task Manager Ethernet style).
   - **Server**: Select a remote server or leave blank for "Local".
5. Click **"Save"**. 

The dashboard will automatically begin executing the command at regular intervals (every 3 seconds for network widgets, 15 seconds for others) and plotting the data.

## 4. Best Practices for Widget Commands

- **Keep it fast**: The command runs periodically. Avoid commands that take longer than 1-2 seconds.
- **Output format**: 
  - For `number` widgets, ensure the command outputs a valid number.
  - For `network-chart` widgets, output formatted rates or interface metrics like `Interface: eth0 | IPv4: x.x.x.x | rx: <bytes> | tx: <bytes>`.
- **Security**: Be extremely careful with the commands you configure, especially on remote servers. The commands execute with the permissions of the Node.js process or the SSH user.

## 5. Adding Pre-configured Widgets via Database Seed (Advanced)

If you want to ship a standard set of widgets for all developers, you can add them to the database migrations/seed in `src/backend/db.js`:

```javascript
// In src/backend/db.js:
INSERT INTO custom_widgets (name, command, type, color) 
VALUES ('Load Avg', 'cat /proc/loadavg | awk "{print \$1}"', 'chart', '#f87171') 
ON CONFLICT DO NOTHING;
```

## 6. Extending Widget Capabilities

If you want to add a new *type* of widget (e.g., a "Pie Chart" or "Gauge"):
1. Update the database schema (optional, if you just use the `type` column).
2. Edit `CustomWidgets.tsx` to include a new rendering block in the `switch (widget.type)` statement.
3. Use `recharts` (already in the project) to render the new visualization type.
