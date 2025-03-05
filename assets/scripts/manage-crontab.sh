#!/bin/sh

# manage-crontab.sh - Script to manage crontab entries for Raycast Alarms

# Add common paths for Homebrew binaries
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"

# Script directory (for finding resources)
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
BASE_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Configuration directory
CONFIG_DIR="$HOME/.raycast-alarms"
ALARMS_FILE="$CONFIG_DIR/alarms.json"
CRONTAB_MARKER="#--- RAYCAST ALARMS ---#"

# Ensure config directory exists
mkdir -p "$CONFIG_DIR/active"
mkdir -p "$CONFIG_DIR/logs"

# Log function
log() {
  LOG_FILE="$CONFIG_DIR/logs/crontab-$(date +%Y%m%d).log"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Initialize alarms file if it doesn't exist
if [ ! -f "$ALARMS_FILE" ]; then
  echo "[]" > "$ALARMS_FILE"
fi

# Function to add an alarm to crontab
add_alarm() {
  alarm_id="$1"
  title="$2"
  hours="$3"
  minutes="$4"
  seconds="$5"
  sound_path="$6"
  
  log "Adding alarm: ID=$alarm_id, Title=$title, Time=$hours:$minutes:$seconds, Sound=$sound_path"
  
  # Validate parameters
  if [ -z "$alarm_id" ] || [ -z "$title" ] || [ -z "$hours" ] || [ -z "$minutes" ] || [ -z "$seconds" ] || [ -z "$sound_path" ]; then
    log "Error: Missing required parameters"
    echo "Usage: $0 add alarm_id title hours minutes seconds sound_path"
    exit 1
  fi
  
  # Validate time format
  if ! [[ "$hours" =~ ^[0-9]+$ ]] || [ "$hours" -lt 0 ] || [ "$hours" -gt 23 ]; then
    log "Error: Hours must be between 0-23"
    echo "Error: Hours must be between 0-23"
    exit 1
  fi
  
  if ! [[ "$minutes" =~ ^[0-9]+$ ]] || [ "$minutes" -lt 0 ] || [ "$minutes" -gt 59 ]; then
    log "Error: Minutes must be between 0-59"
    echo "Error: Minutes must be between 0-59"
    exit 1
  fi
  
  if ! [[ "$seconds" =~ ^[0-9]+$ ]] || [ "$seconds" -lt 0 ] || [ "$seconds" -gt 59 ]; then
    log "Error: Seconds must be between 0-59"
    echo "Error: Seconds must be between 0-59"
    exit 1
  fi
  
  # Check that trigger script exists
  TRIGGER_SCRIPT="$HOME/.raycast-alarms/scripts/trigger-alarm.sh"
  if [ ! -f "$TRIGGER_SCRIPT" ]; then
    log "ERROR: Trigger script not found at: $TRIGGER_SCRIPT"
    echo "ERROR: Trigger script not found at: $TRIGGER_SCRIPT"
    # Try to find it elsewhere
    log "Searching for trigger script in current directory..."
    CURRENT_DIR="$(pwd)"
    log "Current directory: $CURRENT_DIR"
    FOUND_SCRIPT=$(find "$CURRENT_DIR" -name "trigger-alarm.sh" 2>/dev/null | head -n 1)
    log "Found script (if any): $FOUND_SCRIPT"
  else
    log "Trigger script found at: $TRIGGER_SCRIPT"
  fi
  
  # Create the crontab entry
  # Format: minute hour day month weekday command
  # Escape spaces in paths with backslashes
  escaped_sound_path=$(echo "$sound_path" | sed 's/ /\\ /g')
  escaped_script_path=$(echo "$HOME/.raycast-alarms/scripts/trigger-alarm.sh" | sed 's/ /\\ /g')
  
  # Create a crontab entry with proper parameter order, pass seconds as a parameter
  cron_entry="$minutes $hours * * * $escaped_script_path $alarm_id \"$title\" $escaped_sound_path $seconds"
  
  log "Generated crontab entry: $cron_entry"
  
  # Get current crontab
  crontab -l > "$CONFIG_DIR/temp_crontab" 2>/dev/null || echo "" > "$CONFIG_DIR/temp_crontab"
  log "Retrieved current crontab content"
  
  # Check if marker exists
  if ! grep -q "$CRONTAB_MARKER" "$CONFIG_DIR/temp_crontab"; then
    # Add marker section if it doesn't exist
    echo "" >> "$CONFIG_DIR/temp_crontab"
    echo "$CRONTAB_MARKER" >> "$CONFIG_DIR/temp_crontab"
    echo "#--- DO NOT EDIT THIS SECTION MANUALLY ---#" >> "$CONFIG_DIR/temp_crontab"
    echo "" >> "$CONFIG_DIR/temp_crontab"
    log "Added marker section to crontab"
  else
    log "Marker already exists in crontab"
  fi

  # For debugging, show the marker section in the crontab
  log "Current crontab marker section:"
  grep -A 5 -B 5 "$CRONTAB_MARKER" "$CONFIG_DIR/temp_crontab" | while read line; do log "CRONTAB: $line"; done
  
  # Add new entry
  sed -i '' "/$CRONTAB_MARKER/a\\
$cron_entry
" "$CONFIG_DIR/temp_crontab"
  log "Added entry to temp crontab file"
  
  # For debugging, check if the entry was added correctly
  log "Checking if entry was added correctly:"
  grep "$alarm_id" "$CONFIG_DIR/temp_crontab" | while read line; do log "ENTRY: $line"; done
  
  # Install updated crontab
  crontab "$CONFIG_DIR/temp_crontab"
  CRONTAB_RESULT=$?
  log "Installed updated crontab, exit code: $CRONTAB_RESULT"
  
  # Debug: Check crontab content after installation
  log "Checking crontab content after installation:"
  crontab -l | grep -A 5 -B 5 "$CRONTAB_MARKER" | while read line; do log "INSTALLED: $line"; done
  
  rm -f "$CONFIG_DIR/temp_crontab"
  
  log "Added alarm: $alarm_id at $hours:$minutes:$seconds - '$title'"
  
  # Also add to our tracking JSON file
  # Use temporary file to avoid issues with redirection
  if command -v jq &> /dev/null; then
    jq --arg id "$alarm_id" \
       --arg name "$title" \
       --arg time "$hours:$minutes:$seconds" \
       --arg sound "$sound_path" \
       '. += [{"id": $id, "name": $name, "time": $time, "sound": $sound}]' \
       "$ALARMS_FILE" > "$CONFIG_DIR/temp_alarms.json"
    JQ_RESULT=$?
    log "Added alarm to JSON file, jq exit code: $JQ_RESULT"
    
    if [ $JQ_RESULT -ne 0 ]; then
      log "ERROR: Failed to add alarm to JSON file"
      echo "ERROR: Failed to add alarm to JSON file"
    fi
  else
    # Fallback method if jq is not available
    log "WARNING: jq not found, using fallback method to update JSON"
    
    # Check if the file is empty or just contains []
    if [ ! -s "$ALARMS_FILE" ] || [ "$(cat "$ALARMS_FILE")" = "[]" ]; then
      # Create a new JSON array with one entry
      echo "[{\"id\": \"$alarm_id\", \"name\": \"$title\", \"time\": \"$hours:$minutes:$seconds\", \"sound\": \"$sound_path\"}]" > "$CONFIG_DIR/temp_alarms.json"
    else
      # Remove the closing bracket, add a comma and the new entry, then close the array
      sed 's/]$/,{"id": "'"$alarm_id"'", "name": "'"$title"'", "time": "'"$hours:$minutes:$seconds"'", "sound": "'"$sound_path"'"}]/' "$ALARMS_FILE" > "$CONFIG_DIR/temp_alarms.json"
    fi
    
    FALLBACK_RESULT=$?
    log "Added alarm to JSON file using fallback method, exit code: $FALLBACK_RESULT"
    
    if [ $FALLBACK_RESULT -ne 0 ]; then
      log "ERROR: Failed to add alarm to JSON file with fallback method"
      echo "ERROR: Failed to add alarm to JSON file (jq not installed)"
      echo "Please install jq using: brew install jq"
    fi
  fi
  
  mv "$CONFIG_DIR/temp_alarms.json" "$ALARMS_FILE"
  MV_RESULT=$?
  log "Moved temp JSON file to actual JSON file, exit code: $MV_RESULT"
  
  # Debug: Check JSON file content
  log "JSON file content after update:"
  cat "$ALARMS_FILE" | while read line; do log "JSON: $line"; done
  
  echo "Alarm added successfully: $title at $hours:$minutes:$seconds"
}

# Function to remove an alarm from crontab
remove_alarm() {
  alarm_id="$1"
  
  # Get current crontab
  crontab -l > "$CONFIG_DIR/temp_crontab" 2>/dev/null || echo "" > "$CONFIG_DIR/temp_crontab"
  
  # Remove the specific alarm entry
  sed -i '' "/\"$alarm_id\"/d" "$CONFIG_DIR/temp_crontab"
  
  # Install updated crontab
  crontab "$CONFIG_DIR/temp_crontab"
  rm -f "$CONFIG_DIR/temp_crontab"
  
  log "Removed alarm: $alarm_id"
  
  # Also remove from our tracking JSON file
  if command -v jq &> /dev/null; then
    jq --arg id "$alarm_id" 'map(select(.id != $id))' "$ALARMS_FILE" > "$CONFIG_DIR/temp_alarms.json"
    JQ_RESULT=$?
    log "Removed alarm from JSON file, jq exit code: $JQ_RESULT"
    
    if [ $JQ_RESULT -ne 0 ]; then
      log "ERROR: Failed to remove alarm from JSON file"
      echo "ERROR: Failed to remove alarm from JSON file"
    fi
  else
    # Fallback method if jq is not available
    log "WARNING: jq not found, using fallback method to update JSON"
    
    # This is a simplistic approach - a proper JSON parser would be better
    # But for emergency fallback, we'll use grep to filter out the line with the alarm ID
    grep -v "\"id\": \"$alarm_id\"" "$ALARMS_FILE" > "$CONFIG_DIR/temp_alarms.json"
    
    FALLBACK_RESULT=$?
    log "Removed alarm from JSON file using fallback method, exit code: $FALLBACK_RESULT"
    
    if [ $FALLBACK_RESULT -ne 0 ]; then
      log "ERROR: Failed to remove alarm from JSON file with fallback method"
      echo "ERROR: Failed to remove alarm from JSON file (jq not installed)"
      echo "Please install jq using: brew install jq"
    fi
  fi

  mv "$CONFIG_DIR/temp_alarms.json" "$ALARMS_FILE"
  
  # Clean up any active processes
  if [ -f "$CONFIG_DIR/active/$alarm_id.pid" ]; then
    pid=$(cat "$CONFIG_DIR/active/$alarm_id.pid")
    if ps -p $pid > /dev/null 2>&1; then
      kill $pid
      log "Stopped alarm process with PID: $pid"
    fi
    rm -f "$CONFIG_DIR/active/$alarm_id.pid"
  fi
  
  echo "Alarm removed successfully: $alarm_id"
}

# Function to list all alarms
list_alarms() {
  log "Listing alarms from $ALARMS_FILE"
  
  if [ ! -f "$ALARMS_FILE" ]; then
    log "Alarms file not found, returning empty array"
    echo "[]"
    return
  fi
  
  # Check if file contains valid JSON
  if command -v jq &> /dev/null; then
    # Use jq to validate and pretty print
    if jq -e . "$ALARMS_FILE" > /dev/null 2>&1; then
      log "File contains valid JSON, returning contents"
      cat "$ALARMS_FILE"
    else
      log "ERROR: Invalid JSON in $ALARMS_FILE, returning empty array"
      echo "[]"
    fi
  else
    # Without jq, we can't validate, but we can check if it's empty
    if [ ! -s "$ALARMS_FILE" ]; then
      log "Empty file, returning empty array"
      echo "[]"
    else
      # Basic check if it starts with [ and ends with ]
      if grep -q "^\[.*\]$" "$ALARMS_FILE" 2>/dev/null; then
        log "File appears to contain JSON array, returning contents"
        cat "$ALARMS_FILE"
      else
        log "ERROR: File doesn't appear to contain a JSON array, returning empty array"
        echo "[]"
      fi
    fi
  fi
}

# Function to remove all alarms
remove_all_alarms() {
  # Get current crontab
  crontab -l > "$CONFIG_DIR/temp_crontab" 2>/dev/null || echo "" > "$CONFIG_DIR/temp_crontab"
  
  # Get section between markers
  sed -i '' "/$CRONTAB_MARKER/,/#--- DO NOT EDIT THIS SECTION MANUALLY ---#/c\\
$CRONTAB_MARKER\\
#--- DO NOT EDIT THIS SECTION MANUALLY ---#
" "$CONFIG_DIR/temp_crontab"
  
  # Install updated crontab
  crontab "$CONFIG_DIR/temp_crontab"
  rm -f "$CONFIG_DIR/temp_crontab"
  
  log "Removed all alarms"
  
  # Clear JSON file
  echo "[]" > "$ALARMS_FILE"
  
  # Kill all active alarm processes
  for pid_file in "$CONFIG_DIR/active/"*.pid; do
    if [ -f "$pid_file" ]; then
      pid=$(cat "$pid_file")
      if ps -p $pid > /dev/null 2>&1; then
        kill $pid
        log "Stopped alarm process with PID: $pid"
      fi
      rm -f "$pid_file"
    fi
  done
  
  echo "All alarms removed successfully"
}

# Function to stop a ringing alarm
stop_alarm() {
  alarm_id="$1"
  log "Stopping alarm: $alarm_id"
  
  # Check if the alarm is active
  pid_file="$HOME/.raycast-alarms/active/$alarm_id"
  
  if [ -f "$pid_file" ]; then
    # Read the PID from the file
    pid=$(cat "$pid_file")
    log "Found PID file with PID: $pid"
    
    # Kill the process
    if ps -p $pid > /dev/null; then
      kill $pid
      log "Killed process with PID: $pid"
      rm -f "$pid_file"
      echo "Alarm stopped successfully"
      return 0
    else
      log "Process with PID $pid is not running"
      rm -f "$pid_file"
      echo "Alarm was not running, removed PID file"
      return 0
    fi
  else
    log "No active alarm found with ID: $alarm_id"
    echo "No active alarm found with ID: $alarm_id"
    return 1
  fi
}

# Function to stop all ringing alarms
stop_all_alarms() {
  log "Stopping all active alarms"
  
  # Find all PID files in the active directory
  active_dir="$HOME/.raycast-alarms/active"
  count=0
  
  # Check if the directory exists
  if [ ! -d "$active_dir" ]; then
    log "Active directory does not exist"
    echo "Stopped 0 alarm(s)"
    return 0
  fi
  
  # Loop through all files in the active directory
  for pid_file in "$active_dir"/*; do
    if [ -f "$pid_file" ]; then
      alarm_id=$(basename "$pid_file")
      log "Found active alarm: $alarm_id"
      
      # Read the PID from the file
      pid=$(cat "$pid_file")
      
      # Kill the process
      if ps -p $pid > /dev/null; then
        kill $pid
        log "Killed process with PID: $pid"
        count=$((count + 1))
      else
        log "Process with PID $pid is not running"
      fi
      
      # Remove the PID file
      rm -f "$pid_file"
    fi
  done
  
  log "Stopped $count alarm(s)"
  echo "Stopped $count alarm(s)"
  return 0
}

# Command line interface
case "$1" in
  add)
    if [ $# -lt 6 ]; then
      echo "Usage: $0 add <alarm_id> <title> <hours> <minutes> <seconds> <sound_path>"
      exit 1
    fi
    add_alarm "$2" "$3" "$4" "$5" "$6" "$7"
    ;;
  remove)
    if [ $# -lt 2 ]; then
      echo "Usage: $0 remove <alarm_id>"
      exit 1
    fi
    remove_alarm "$2"
    ;;
  list)
    list_alarms
    ;;
  remove-all)
    remove_all_alarms
    ;;
  stop)
    if [ $# -lt 2 ]; then
      echo "Usage: $0 stop <alarm_id>"
      exit 1
    fi
    stop_alarm "$2"
    ;;
  stop-all)
    stop_all_alarms
    ;;
  *)
    echo "Usage: $0 {add|remove|list|remove-all|stop|stop-all}"
    exit 1
    ;;
esac

exit 0 