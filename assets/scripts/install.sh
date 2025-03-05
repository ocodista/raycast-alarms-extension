#!/bin/sh

# Find script directory
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
echo "Script directory: $SCRIPT_DIR"

# Setup the config directory
CONFIG_DIR="$HOME/.raycast-alarms"
echo "Setting up Raycast Alarms extension at $CONFIG_DIR"

# Create required directories
mkdir -p "$CONFIG_DIR/scripts"
mkdir -p "$CONFIG_DIR/logs"
mkdir -p "$CONFIG_DIR/active"
echo "Created config directories"

# Verify source files exist
TRIGGER_SCRIPT="$SCRIPT_DIR/trigger-alarm.sh"
CRONTAB_SCRIPT="$SCRIPT_DIR/manage-crontab.sh"
APPLESCRIPT="$SCRIPT_DIR/show-alarm-popup.applescript"

echo "Verifying source scripts: $TRIGGER_SCRIPT, $CRONTAB_SCRIPT, $APPLESCRIPT"

if [ ! -f "$TRIGGER_SCRIPT" ] || [ ! -f "$CRONTAB_SCRIPT" ] || [ ! -f "$APPLESCRIPT" ]; then
  echo "ERROR: Required scripts not found"
  exit 1
fi

# Copy scripts to config directory and make them executable
cp "$TRIGGER_SCRIPT" "$CONFIG_DIR/scripts/"
cp "$CRONTAB_SCRIPT" "$CONFIG_DIR/scripts/"
cp "$APPLESCRIPT" "$CONFIG_DIR/scripts/"
echo "Scripts copied to $CONFIG_DIR/scripts/"

chmod +x "$CONFIG_DIR/scripts/trigger-alarm.sh"
chmod +x "$CONFIG_DIR/scripts/manage-crontab.sh"
echo "Made scripts executable"

# Create alarms data file if it doesn't exist
if [ ! -f "$CONFIG_DIR/alarms.json" ]; then
  echo "Creating alarms data file"
  echo "[]" > "$CONFIG_DIR/alarms.json"
else
  echo "Alarms data file already exists at $CONFIG_DIR/alarms.json"
fi

# Check for jq (used for JSON operations)
if command -v jq >/dev/null 2>&1; then
  echo "jq is installed"
else
  echo "WARNING: jq is not installed. Some functionality may be limited."
  echo "Install jq with 'brew install jq' for full functionality."
fi

# Ensure crontab marker exists
if crontab -l 2>/dev/null | grep "RAYCAST ALARMS" >/dev/null; then
  echo "Crontab marker already exists"
  echo "Current crontab content:"
  crontab -l
else
  echo "Adding crontab marker"
  (crontab -l 2>/dev/null; echo "#--- RAYCAST ALARMS ---#"; echo "#--- DO NOT EDIT THIS SECTION MANUALLY ---#") | crontab -
fi

# Compile AppleScript if needed
COMPILED_SCRIPT="$CONFIG_DIR/scripts/show-alarm-popup.scpt"
if [ ! -f "$COMPILED_SCRIPT" ]; then
  echo "Compiling AppleScript dialog"
  osacompile -o "$COMPILED_SCRIPT" "$CONFIG_DIR/scripts/show-alarm-popup.applescript"
else
  echo "AppleScript popup dialog already compiled at $COMPILED_SCRIPT"
fi

echo "Installation completed successfully."
echo "Config directory structure:"
ls -la "$CONFIG_DIR"
echo "Scripts directory:"
ls -la "$CONFIG_DIR/scripts"

exit 0 