# Tutorial: Adding Custom Widgets

This guide explains how to add new Custom Widgets to the Dashboard. Custom widgets allow you to monitor arbitrary commands, metrics, or scripts across your servers and local environment.

## 1. Widget Architecture

Widgets in this dashboard are composed of:
1. **Frontend Component**: Renders the data in `CustomWidgets.tsx`.
2. **Backend API**: Executes the shell command or fetches the data (`widgetsRouter.js`).
3. **Database**: Stores the widget configuration (name, command, type, color, etc.).

## 2. Supported Widget Types

The dashboard currently supports three main types of data visualization for widgets:
- **`number`**: Displays a single large numeric value (e.g., CPU usage, active users).
- **`text`**: Displays string output (e.g., latest git commit, server status string).
- **`chart`**: Displays a timeseries chart (expects numeric output that is periodically polled).

## 3. Creating a Widget via the UI

The easiest way to add a widget is through the Dashboard UI:

1. Navigate to the **Server Stats** or main dashboard view.
2. Locate the **"Custom Widgets"** panel.
3. Click the **"+" (Add)** button.
4. Fill in the configuration:
   - **Name**: The display name of the widget (e.g., "Active Docker Containers").
   - **Command**: The shell command to execute. For example: `docker ps -q | wc -l`.
   - **Type**: Select `number`, `text`, or `chart`.
   - **Color**: Pick an accent color (used for the chart line or value text).
   - **Server**: Select a remote server or leave blank for "Local".
5. Click **"Save"**. 

The dashboard will automatically begin executing the command at regular intervals and plotting the data.

## 4. Best Practices for Widget Commands

- **Keep it fast**: The command runs periodically. Avoid commands that take longer than 1-2 seconds.
- **Output format**: 
  - For `number` or `chart` widgets, ensure the command outputs **only** a valid number. Strip out trailing text. 
    *(Good: `awk '{print $1}' /proc/loadavg` | Bad: `echo "Load is 1.5"`)*
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
