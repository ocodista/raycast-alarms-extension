# Raycast Alarms Extension

Create and manage system-wide alarms that work even when Raycast is closed.

## Features

- Schedule alarms that play sounds and display popup notifications
- Alarms work system-wide (even when Raycast is closed)
- Beautiful custom popup interface with a stop button
- Manage all your scheduled alarms in one place
- Stop active alarms individually or all at once

## How It Works

Unlike traditional Raycast extensions that only run within Raycast, this extension uses macOS's crontab system to schedule alarms that will trigger regardless of whether Raycast is running. When an alarm triggers:

1. A sound of your choice plays
2. A custom popup dialog appears showing the alarm title
3. A system notification is also triggered

## Installation

1. Install the extension from the Raycast store
2. The extension will automatically set up the necessary directories and scripts

## Usage

### Creating an Alarm

1. Open Raycast and type "Create Alarm"
2. Set the date and time for the alarm
3. (Optional) Add a title for your alarm
4. Choose a sound for your alarm
5. Click "Schedule" to create the alarm

### Managing Alarms

1. Open Raycast and type "Stop Alarm"
2. You'll see two sections:
   - Active Alarms: Alarms that are currently ringing
   - Scheduled Alarms: Alarms that will ring in the future

### Stopping Alarms

- For active alarms, click "Stop Alarm" to silence them
- You can also click "Stop All Alarms" to silence all active alarms at once
- For scheduled alarms, click "Remove Alarm" to cancel them

## Technical Details

The extension uses:

- macOS crontab for scheduling alarms
- Bash scripts for triggering and managing alarms
- AppleScript for creating custom UI dialogs
- The afplay command for playing sounds

## Requirements

- macOS 10.15 or higher
- Raycast 1.40.0 or higher

## Troubleshooting

If alarms don't trigger:

1. Make sure your Mac is not in sleep mode at the scheduled time
2. Check if your system allows notifications from script applications
3. Ensure that the extension has the necessary permissions

## Privacy

This extension:
- Only schedules alarms on your local machine
- Does not send any data to external servers
- Manages alarm data in the `~/.raycast-alarms` directory

## Credits

- Created by: ocodista
- Icons: Raycast default icons