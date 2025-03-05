import React, { useEffect, useState } from 'react'
import { Action, ActionPanel, Form, showToast, Toast } from '@raycast/api'
import fs from 'fs'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'
import os from 'os'
import { closeMainWindow, showHUD } from "@raycast/api"
import { Icon } from "@raycast/api"

// Sound options and paths
const DEFAULT_RINGTONE = "Radial.m4r"
const RINGTONES_PATH = "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones"
const SCRIPT_PATH = `${os.homedir()}/.raycast-alarms/scripts/manage-crontab.sh`

export interface AlarmInfo {
  id: string
  title: string
  time: string
  sound: string
  cronExpression: string
  seconds?: number
}

// Format time function with seconds
const formatTime = (date: Date): string => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// Get full path to ringtone
const getRingtonePath = (ringtoneName: string): string => {
  // Special case for Radial which has a different filename
  if (ringtoneName === "Radial.m4r") {
    return path.join(RINGTONES_PATH, "Radial-EncoreInfinitum.m4r")
  }
  return path.join(RINGTONES_PATH, ringtoneName)
}

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
]

// Track preview sound
let previewSoundProcess: ChildProcess | null = null

const execCommand = async (command: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> => {
  return new Promise((resolve) => {
    // Only log critical commands (add, remove, stop)
    const shouldLog = command.includes('add') || command.includes('remove') || command.includes('stop');

    if (shouldLog) {
      console.log(`Executing: ${command} ${args.join(' ')}`);
    }

    // Execute the command directly without shell -c wrapper
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
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
    await execCommand(`"${SCRIPT_PATH}"`, ['stop', alarmId])
    return true
  } catch (error) {
    console.error(`Error stopping alarm: ${error}`)
    return false
  }
}

// Function to stop all active alarms
export const stopAllAlarms = async (): Promise<number> => {
  try {
    const result = await execCommand(`"${SCRIPT_PATH}"`, ['stop-all'])
    const match = result.stdout.match(/^Stopped (\d+) alarm\(s\)$/)
    return match ? parseInt(match[1], 10) : 0
  } catch (error) {
    console.error(`Error stopping all alarms: ${error}`)
    return 0
  }
}

// Function to get the list of scheduled alarms
export const getScheduledAlarms = async (): Promise<AlarmInfo[]> => {
  try {
    const result = await execCommand(`"${SCRIPT_PATH}"`, ['list'])

    // Handle empty or whitespace-only results
    if (!result || result.stdout.trim() === '') {
      console.log('Empty result from list command, returning empty array')
      return []
    }

    try {
      return JSON.parse(result.stdout)
    } catch (jsonError) {
      console.error(`JSON parse error: ${jsonError}`)
      console.error(`Raw result: "${result.stdout}"`)
      return []
    }
  } catch (error) {
    console.error(`Error getting scheduled alarms: ${error}`)
    return []
  }
}

export default function CreateAlarm() {
  const [isLoading, setIsLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [scheduledTime, setScheduledTime] = useState<Date>(new Date())
  const [selectedRingtone, setSelectedRingtone] = useState(DEFAULT_RINGTONE)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const defaultRingtone = DEFAULT_RINGTONE
  const [minDate, setMinDate] = useState<Date>(() => {
    // Set minimum date to 1 minute from now
    const now = new Date()
    now.setMinutes(now.getMinutes() + 1)
    now.setSeconds(0)
    now.setMilliseconds(0)
    return now
  })

  // Update minDate every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      now.setMinutes(now.getMinutes() + 1)
      now.setSeconds(0)
      now.setMilliseconds(0)
      setMinDate(now)

      // If the current selected time is now in the past, update it
      if (scheduledTime < now) {
        setScheduledTime(now)
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [scheduledTime])

  const handleCreateAlarm = async () => {
    stopPreview()

    if (!scheduledTime) {
      showToast({
        style: Toast.Style.Failure,
        title: "Missing Time",
        message: "Please select a time for your alarm",
      })
      return
    }

    setIsLoading(true);

    try {
      const scriptPath = `${os.homedir()}/.raycast-alarms/scripts/manage-crontab.sh`;

      // Check if script exists
      try {
        await fs.promises.access(scriptPath, fs.constants.X_OK);
      } catch (error) {
        throw new Error(`Script not found or not executable: ${scriptPath}`);
      }

      const alarmId = `raycast_alarm_${Date.now()}`
      const soundPath = getRingtonePath(selectedRingtone)
      const hours = scheduledTime.getHours()
      const minutes = scheduledTime.getMinutes()
      const seconds = scheduledTime.getSeconds()

      // Use a default title if none is provided
      const alarmTitle = title.trim() || "Raycast Alarm"

      // Important: Pass arguments separately to ensure proper escaping
      const { code, stderr } = await execCommand(
        scriptPath,
        ['add', alarmId, alarmTitle, hours.toString(), minutes.toString(), seconds.toString(), soundPath]
      )

      if (code !== 0) {
        throw new Error(`Failed to create alarm: ${stderr}`);
      }

      showToast({
        style: Toast.Style.Success,
        title: "Alarm Set Successfully",
        message: `Your alarm will ring at ${formatTime(scheduledTime)}`,
      });

      // Reset form
      setTitle("");
      setScheduledTime(new Date());
      setSelectedRingtone(defaultRingtone);

      // Navigate to list
      await closeMainWindow();
      await showHUD("Alarm set for " + formatTime(scheduledTime), {});
    } catch (error) {
      console.error("Error creating alarm:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Could Not Create Alarm",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only ensure the script directory exists, don't do anything that could trigger an alarm
    const initializeDirectory = async () => {
      try {
        // Just check if directory exists, create if needed
        await fs.promises.mkdir(path.dirname(SCRIPT_PATH), { recursive: true });
      } catch (error) {
        console.error(`Error initializing directory: ${error}`);
      }
    };

    initializeDirectory();

    // Cleanup on unmount
    return () => {
      if (previewSoundProcess) {
        previewSoundProcess.kill();
        previewSoundProcess = null;
      }
    };
  }, []);

  function previewSound(sound: string) {
    // First stop any currently playing preview
    stopPreview()

    // Then start the new preview
    const soundPath = getRingtonePath(sound)
    previewSoundProcess = spawn('afplay', [soundPath])
    setIsPreviewPlaying(true)
  }

  function stopPreview() {
    if (previewSoundProcess) {
      previewSoundProcess.kill()
      previewSoundProcess = null
      setIsPreviewPlaying(false)
    }
  }

  function toggleSoundPreview() {
    if (isPreviewPlaying) {
      stopPreview()
    } else {
      previewSound(selectedRingtone)
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create Alarm"
            onSubmit={handleCreateAlarm}
            icon={Icon.Clock}
          />
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
        onChange={(newValue) => newValue && setScheduledTime(newValue)}
        min={minDate}
      />

      <Form.TextField
        id="title"
        title="Title"
        placeholder="What's this alarm for? (optional)"
        value={title}
        onChange={setTitle}
      />

      <Form.Separator />

      <Form.Dropdown
        id="sound"
        title="Alarm Sound"
        value={selectedRingtone}
        onChange={(newValue) => {
          // Only preview if actually changing the sound
          if (newValue !== selectedRingtone) {
            previewSound(newValue)
          }
          setSelectedRingtone(newValue)
        }}
      >
        <Form.Dropdown.Section title="System Sounds">
          {ringtones.map((ringtone) => (
            <Form.Dropdown.Item
              key={ringtone.value}
              value={ringtone.value}
              title={ringtone.name}
            />
          ))}
        </Form.Dropdown.Section>
      </Form.Dropdown>
      <Form.Description
        text="Preview sounds with (⌘ + S)"
      />
    </Form>
  );
} 