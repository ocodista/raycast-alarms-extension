import { Form, ActionPanel, Action, showToast, Toast, LocalStorage, Icon, popToRoot } from "@raycast/api"
import { useState, useEffect } from "react"
import { spawn, ChildProcess } from 'child_process'
import { CronJob, CronTime } from 'cron';
import { globalRaycastAlarms } from './shared-state';

// Sound options and paths
const DEFAULT_SOUND = 'Radial';
const SOUNDS = {
  'Alarm': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Alarm.m4r",
  'Apex': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Apex.m4r",
  'Ascending': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Ascending.m4r",
  'Bell Tower': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Bell Tower.m4r",
  'Chimes': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Chimes.m4r",
  'Circuit': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Circuit.m4r",
  'Constellation': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Constellation.m4r",
  'Cosmic': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Cosmic.m4r",
  'Crystals': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Crystals.m4r",
  'Digital': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Digital.m4r",
  'Radar': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Radar.m4r",
  'Radial': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Radial-EncoreInfinitum.m4r",
  'Radiate': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Radiate.m4r",
  'Signal': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Signal.m4r",
  'Silk': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Silk.m4r",
  'Slow Rise': "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones/Slow Rise.m4r",
};

// Convert hashtable to dropdown options
const SOUND_OPTIONS = Object.entries(SOUNDS).map(([name, path]) => ({ name, path }));

interface FormValues {
  scheduledTime: Date
  title?: string
  sound: string
}

interface AlarmInfo {
  id: string
  name: string
  time: string
  jobId: CronTime
  cronExpression: string
  soundPath: string
}

// Store active jobs in memory
const activeJobs = new Map<string, CronJob>()
// Store active sound processes
const activeSoundProcesses = new Map<string, ChildProcess>()
// Store preview sound process
let previewSoundProcess: ChildProcess | null = null

// Function to stop a specific alarm
export const stopAlarm = (alarmId: string) => {
  const process = activeSoundProcesses.get(alarmId);
  if (process && !process.killed) {
    process.kill();
    activeSoundProcesses.delete(alarmId);
    globalRaycastAlarms.activeSoundProcesses.delete(alarmId);
    return true;
  }
  return false;
};

// Function to stop all alarms
export const stopAllAlarms = () => {
  let stoppedCount = 0;
  for (const [alarmId, process] of activeSoundProcesses.entries()) {
    if (process && !process.killed) {
      process.kill();
      stoppedCount++;
    }
    activeSoundProcesses.delete(alarmId);
    globalRaycastAlarms.activeSoundProcesses.delete(alarmId);
  }
  return stoppedCount;
};

export default function CreateAlarm() {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [selectedSound, setSelectedSound] = useState<string>(SOUNDS[DEFAULT_SOUND])
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  // Function to toggle sound preview
  const togglePreview = () => {
    if (isPlaying) {
      stopPreview();
    } else {
      startPreview();
    }
  }

  // Function to start sound preview
  const startPreview = () => {
    try {
      previewSoundProcess = spawn('afplay', [selectedSound], { detached: false })
      setIsPlaying(true)

      previewSoundProcess.on('exit', () => {
        setIsPlaying(false)
        previewSoundProcess = null
      })
    } catch (error) {
      console.error(`Error previewing sound: ${error}`)
      setIsPlaying(false)
    }
  }

  // Function to stop sound preview
  const stopPreview = () => {
    if (previewSoundProcess && !previewSoundProcess.killed) {
      previewSoundProcess.kill()
      previewSoundProcess = null
    }
    setIsPlaying(false)
  }

  async function handleSubmit(values: FormValues) {
    setIsLoading(true)

    try {
      // Stop any preview that's playing
      stopPreview();

      // Format the date for crontab
      const time = values.scheduledTime

      // Ensure we have seconds (since DatePicker UI doesn't show seconds)
      // This will set the time to include the current seconds if they're not explicitly selected
      const now = new Date()
      if (time.getSeconds() === 0 && now.getMinutes() === time.getMinutes() && now.getHours() === time.getHours()) {
        time.setSeconds(now.getSeconds())
      }

      const minutes = time.getMinutes()
      const hours = time.getHours()
      const seconds = time.getSeconds()
      const soundFile = values.sound
      const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      const alarmMessage = (values.title || `Wake up`) + ` at ${formattedTime}`

      // Create a unique identifier for this alarm
      const alarmId = `raycast_alarm_${Date.now()}`

      // Create cron job using node-crontab
      const cronExpression = `${seconds} ${minutes} ${hours} * * *`

      // TODO: Migrate this to crontab as it needs to work even if Raycast is closed
      const job = CronJob.from({
        cronTime: cronExpression,
        onTick: async function () {
          try {
            // Play the sound directly using spawn to get a reference to the process
            const soundProcess = spawn('afplay', [soundFile], { detached: false })

            // Store the sound process for later termination
            activeSoundProcesses.set(alarmId, soundProcess)
            globalRaycastAlarms.activeSoundProcesses.set(alarmId, soundProcess)

            console.log(`Playing sound ${soundFile} with process ID: ${soundProcess.pid}`)

            // Show alarm notification using Raycast Toast
            await showToast({
              style: Toast.Style.Success,
              title: "Time's up! ⏰",
              message: alarmMessage,

              primaryAction: {
                title: "Stop",
                onAction: () => {
                  const process = activeSoundProcesses.get(alarmId)
                  if (process && !process.killed) {
                    process.kill()
                    console.log(`Stopped sound process with PID: ${process.pid}`)
                    activeSoundProcesses.delete(alarmId)
                    globalRaycastAlarms.activeSoundProcesses.delete(alarmId)

                    showToast({
                      style: Toast.Style.Success,
                      title: "Silenced",
                      message: alarmMessage
                    })
                  }
                },
              },
            })

            // Set up a timeout to automatically stop the sound after 60 seconds if not stopped manually
            setTimeout(() => {
              const process = activeSoundProcesses.get(alarmId)
              if (process && !process.killed) {
                process.kill()
                console.log(`Auto-stopped sound process with PID: ${process.pid} after 60 seconds`)
                activeSoundProcesses.delete(alarmId)
                globalRaycastAlarms.activeSoundProcesses.delete(alarmId)
              }
            }, 60000)
          } catch (error) {
            console.error(`Error executing alarm: ${error}`)
            await showToast({
              style: Toast.Style.Failure,
              title: "Failed to play sound",
              message: String(error)
            })
          }
        },
        start: true,
      });

      // Store job in memory for later access
      activeJobs.set(alarmId, job)

      // Store alarm information in local storage
      const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      const alarmInfo: AlarmInfo = {
        id: alarmId,
        name: alarmMessage,
        time: timeString,
        jobId: job.cronTime,
        cronExpression,
        soundPath: soundFile
      }

      // Get existing alarms or initialize empty array
      const existingAlarmsJson = await LocalStorage.getItem('raycast-alarms')
      const existingAlarms: AlarmInfo[] = existingAlarmsJson ? JSON.parse(existingAlarmsJson as string) : []

      // Add new alarm and save back to storage
      existingAlarms.push(alarmInfo)
      await LocalStorage.setItem('raycast-alarms', JSON.stringify(existingAlarms))

      await showToast({
        style: Toast.Style.Success,
        title: 'Scheduled!',
        message: alarmMessage,
      })
      popToRoot({ clearSearchBar: true })
    } catch (error) {
      console.error(error)
      await showToast({
        style: Toast.Style.Failure,
        title: 'Something went wrong',
        message: String(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setIsLoading(false);

    // Stop preview on unmount
    return () => {
      console.log("unmounting")
      stopPreview();
    }
  }, []);

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Schedule" icon={Icon.Alarm} onSubmit={handleSubmit} />
          <Action
            title={isPlaying ? "Stop Preview" : "Preview Sound"}
            icon={isPlaying ? Icon.Stop : Icon.Play}
            onAction={togglePreview}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
          />
        </ActionPanel>
      }
    >
      <Form.DatePicker
        id="scheduledTime"
        title="When to ring"
        type={Form.DatePicker.Type.DateTime}
        defaultValue={new Date()}
        min={new Date()}
        autoFocus
      />
      <Form.TextField
        id="title"
        title="Title"
        placeholder="Set a title for your reminder"
      />
      <Form.Dropdown
        id="sound"
        title="Sound"
        defaultValue={SOUNDS[DEFAULT_SOUND]}
        onChange={setSelectedSound}
        info="Choose a sound for your reminder"
      >
        {SOUND_OPTIONS.map((sound) => (
          <Form.Dropdown.Item
            key={sound.path}
            value={sound.path}
            title={sound.name}
          />
        ))}
      </Form.Dropdown>
      <Form.Description
        title="Shortcut"
        text={`Press (⌘ + S) to ${isPlaying ? 'stop' : 'start'} the preview sound`}
      />
    </Form>
  )
} 