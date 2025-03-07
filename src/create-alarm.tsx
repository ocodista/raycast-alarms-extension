import React, { useEffect, useState } from "react";
import { Action, ActionPanel, Form, showToast, Toast, popToRoot } from "@raycast/api";
import fs from "fs";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import os from "os";
import { Icon } from "@raycast/api";
import { initializeExtension } from "./utils/initialize";

// Sound options and paths
const DEFAULT_RINGTONE = "Radial.m4r";
const RINGTONES_PATH = "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones";
const SCRIPT_PATH = `${os.homedir()}/.raycast-alarms/scripts/manage-crontab.sh`;
const LOG_PATH = `${os.homedir()}/.raycast-alarms/logs/extension.log`;

// Helper function to log messages to a file
const logToFile = async (message: string) => {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    // Create the directory if it doesn't exist
    await fs.promises.mkdir(path.dirname(LOG_PATH), { recursive: true });

    // Append to the log file
    await fs.promises.appendFile(LOG_PATH, logMessage);
  } catch (error) {
    console.error("Failed to write to log file:", error);
  }
};

export interface AlarmInfo {
  id: string;
  title: string;
  time: string;
  sound: string;
  cronExpression: string;
  seconds?: number;
}

// Format time function with seconds
const formatTime = (date: Date): string => {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
};

// Get full path to ringtone
const getRingtonePath = (ringtoneName: string): string => {
  // Special case for Radial which has a different filename
  if (ringtoneName === "Radial.m4r") {
    return path.join(RINGTONES_PATH, "Radial-EncoreInfinitum.m4r");
  }
  return path.join(RINGTONES_PATH, ringtoneName);
};

// Available ringtones
const ringtones = [
  { name: "Apex", value: "Apex.m4r" },
  { name: "Beacon", value: "Beacon.m4r" },
  { name: "Bulletin", value: "Bulletin.m4r" },
  { name: "By The Seaside", value: "By_The_Seaside.m4r" },
  { name: "Chimes", value: "Chimes.m4r" },
  { name: "Circuit", value: "Circuit.m4r" },
  { name: "Constellation", value: "Constellation.m4r" },
  { name: "Cosmic", value: "Cosmic.m4r" },
  { name: "Crystals", value: "Crystals.m4r" },
  { name: "Hillside", value: "Hillside.m4r" },
  { name: "Illuminate", value: "Illuminate.m4r" },
  { name: "Night Owl", value: "Night_Owl.m4r" },
  { name: "Opening", value: "Opening.m4r" },
  { name: "Playtime", value: "Playtime.m4r" },
  { name: "Presto", value: "Presto.m4r" },
  { name: "Radar", value: "Radar.m4r" },
  { name: "Radial", value: "Radial.m4r" },
  { name: "Ripples", value: "Ripples.m4r" },
  { name: "Sencha", value: "Sencha.m4r" },
  { name: "Signal", value: "Signal.m4r" },
  { name: "Silk", value: "Silk.m4r" },
  { name: "Slow Rise", value: "Slow_Rise.m4r" },
  { name: "Stargaze", value: "Stargaze.m4r" },
  { name: "Summit", value: "Summit.m4r" },
  { name: "Twinkle", value: "Twinkle.m4r" },
  { name: "Uplift", value: "Uplift.m4r" },
  { name: "Waves", value: "Waves.m4r" },
];

// Track preview sound
let previewSoundProcess: ChildProcess | null = null;

const execCommand = async (
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> => {
  return new Promise((resolve) => {
    // Only log critical commands (add, remove, stop)
    const shouldLog = command.includes("add") || command.includes("remove") || command.includes("stop");

    if (shouldLog) {
      console.log(`Executing: ${command} ${args.join(" ")}`);
    }

    // Execute the command directly without shell -c wrapper
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`Command failed with code ${code}`);
        console.error(`stderr: ${stderr}`);
      }
      resolve({ stdout, stderr, code: code || 0 });
    });
  });
};

// Function to stop a specific alarm
export const stopAlarm = async (alarmId: string): Promise<boolean> => {
  try {
    await execCommand(`"${SCRIPT_PATH}"`, ["stop", alarmId]);
    return true;
  } catch (error) {
    console.error(`Error stopping alarm: ${error}`);
    return false;
  }
};

// Function to stop all active alarms
export const stopAllAlarms = async (): Promise<number> => {
  try {
    const result = await execCommand(`"${SCRIPT_PATH}"`, ["stop-all"]);
    const match = result.stdout.match(/^Stopped (\d+) alarm\(s\)$/);
    return match ? parseInt(match[1], 10) : 0;
  } catch (error) {
    console.error(`Error stopping all alarms: ${error}`);
    return 0;
  }
};

// Function to get the list of scheduled alarms
export const getScheduledAlarms = async (): Promise<AlarmInfo[]> => {
  try {
    const result = await execCommand(`"${SCRIPT_PATH}"`, ["list"]);

    // Handle empty or whitespace-only results
    if (!result || result.stdout.trim() === "") {
      console.log("Empty result from list command, returning empty array");
      return [];
    }

    try {
      return JSON.parse(result.stdout);
    } catch (jsonError) {
      console.error(`JSON parse error: ${jsonError}`);
      console.error(`Raw result: "${result.stdout}"`);
      return [];
    }
  } catch (error) {
    console.error(`Error getting scheduled alarms: ${error}`);
    return [];
  }
};

export default function CreateAlarm() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedRingtone, setSelectedRingtone] = useState<string>(DEFAULT_RINGTONE);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(new Date());
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [alarmTitle, setAlarmTitle] = useState<string>("");

  useEffect(() => {
    initializeExtension().catch(error => {
      console.error("Initialization error:", error);
    });
  }, []);

  // Set minDate to now instead of 1 minute from now
  const minDate = new Date();
  minDate.setSeconds(0);
  minDate.setMilliseconds(0);

  const handleCreateAlarm = async () => {
    stopPreview();

    await logToFile("handleCreateAlarm called");

    if (!scheduledTime) {
      showToast({
        style: Toast.Style.Failure,
        title: "Missing Time",
        message: "Please select a time for your alarm",
      });
      return;
    }

    // Validate that the scheduled time is in the future
    const now = new Date();
    if (scheduledTime <= now) {
      showToast({
        style: Toast.Style.Failure,
        title: "Invalid Time",
        message: "Alarm time must be in the future",
      });
      await logToFile(`Alarm submission rejected: time (${scheduledTime.toISOString()}) is not in the future`);
      return;
    }

    setIsLoading(true);

    try {
      const scriptPath = `${os.homedir()}/.raycast-alarms/scripts/manage-crontab.sh`;
      await logToFile(`Using script path: ${scriptPath}`);

      // Check if script exists
      try {
        await fs.promises.access(scriptPath, fs.constants.X_OK);
        await logToFile("Script exists and is executable");
      } catch (error) {
        await logToFile(`Script not found or not executable: ${scriptPath}`);
        throw new Error(`Script not found or not executable: ${scriptPath}`);
      }

      const alarmId = `raycast_alarm_${Date.now()}`;
      const soundPath = getRingtonePath(selectedRingtone);
      await logToFile(`Selected sound path: ${soundPath}`);

      // Create the crontab entry
      const hours = scheduledTime.getHours();
      const minutes = scheduledTime.getMinutes();
      // Always set seconds to 0
      const seconds = 0;

      await logToFile(`Setting alarm for ${hours}:${minutes}:${seconds}`);

      // Creating the command to add the alarm
      const command = "add";
      const args = [
        alarmId,
        alarmTitle || "Raycast Alarm",
        hours.toString(),
        minutes.toString(),
        seconds.toString(),
        soundPath,
      ];

      await logToFile(`Executing command: ${command} with args: ${JSON.stringify(args)}`);

      const result = await execCommand(scriptPath, [command, ...args]);
      await logToFile(`Command result - stdout: ${result.stdout}, stderr: ${result.stderr}, code: ${result.code}`);

      if (result.code !== 0) {
        throw new Error(`Failed to create alarm: ${result.stderr || result.stdout}`);
      }

      // Display success message
      showToast({
        style: Toast.Style.Success,
        title: "Alarm Created",
        message: `${alarmTitle || "Alarm"} set for ${formatTime(scheduledTime)}`,
      });

      // Close and return to root
      popToRoot();
    } catch (error) {
      await logToFile(`Error creating alarm: ${error}`);

      showToast({
        style: Toast.Style.Failure,
        title: "Failed to Create Alarm",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  function previewSound(sound: string) {
    // First stop any currently playing preview
    stopPreview();

    // Then start the new preview
    const soundPath = getRingtonePath(sound);
    previewSoundProcess = spawn("afplay", [soundPath]);
    setIsPreviewPlaying(true);
  }

  function stopPreview() {
    if (previewSoundProcess) {
      previewSoundProcess.kill();
      previewSoundProcess = null;
      setIsPreviewPlaying(false);
    }
  }

  function toggleSoundPreview() {
    if (isPreviewPlaying) {
      stopPreview();
    } else {
      previewSound(selectedRingtone);
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Alarm" onSubmit={handleCreateAlarm} icon={Icon.Clock} />
          <Action
            title={isPreviewPlaying ? "Stop Preview" : "Preview Sound"}
            onAction={toggleSoundPreview}
            icon={isPreviewPlaying ? Icon.Stop : Icon.Play}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
          />
        </ActionPanel>
      }
      isLoading={isLoading}
    >
      <Form.DatePicker
        id="time"
        title="When should it ring?"
        type={Form.DatePicker.Type.DateTime}
        value={scheduledTime}
        onChange={(newValue) => {
          if (newValue) {
            // Force seconds to 0 when user picks a time
            newValue.setSeconds(0);
            newValue.setMilliseconds(0);
            setScheduledTime(newValue);
          }
        }}
        min={minDate}
      />

      <Form.TextField
        id="title"
        title="Title"
        placeholder="What's this alarm for? (optional)"
        value={alarmTitle}
        onChange={setAlarmTitle}
      />

      <Form.Separator />

      <Form.Dropdown
        id="sound"
        title="Alarm Sound"
        value={selectedRingtone}
        onChange={(newValue) => {
          setSelectedRingtone(newValue);
        }}
      >
        <Form.Dropdown.Section title="System Sounds">
          {ringtones.map((ringtone) => (
            <Form.Dropdown.Item key={ringtone.value} value={ringtone.value} title={ringtone.name} />
          ))}
        </Form.Dropdown.Section>
      </Form.Dropdown>
      <Form.Description text="Preview sounds with (⌘ + S)" />
    </Form>
  );
}
