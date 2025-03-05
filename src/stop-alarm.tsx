import { List, ActionPanel, Action, LocalStorage, showToast, Toast, Icon } from "@raycast/api"
import { useState, useEffect } from "react"
import { CronTime } from 'cron'
import { globalRaycastAlarms, stopAlarm, stopAllAlarms } from './shared-state'

// Shared data structure for alarms
interface AlarmInfo {
  id: string
  name: string
  time: string
  jobId: CronTime
  cronExpression: string
  soundPath: string
}

// Define ringing bell SVG icon
// const RingingBellIcon = `
// <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
//   <path d="M16 3C16.5523 3 17 3.44772 17 4V5.06689C20.4773 5.55399 23 8.47765 23 12V17.5453L25.8321 22.5437C26.0366 22.8242 26.0557 23.1957 25.8817 23.4938C25.7077 23.7919 25.3688 24 25 24H7C6.63124 24 6.29226 23.7919 6.11832 23.4938C5.94438 23.1957 5.96338 22.8242 6.16795 22.5437L9 17.5453V12C9 8.47765 11.5227 5.55399 15 5.06689V4C15 3.44772 15.4477 3 16 3Z" fill="#FFF" fill-opacity="0.6"/>
//   <path d="M16 3C16.5523 3 17 3.44772 17 4V5.06689C20.4773 5.55399 23 8.47765 23 12V17.5453L25.8321 22.5437C26.0366 22.8242 26.0557 23.1957 25.8817 23.4938C25.7077 23.7919 25.3688 24 25 24H7C6.63124 24 6.29226 23.7919 6.11832 23.4938C5.94438 23.1957 5.96338 22.8242 6.16795 22.5437L9 17.5453V12C9 8.47765 11.5227 5.55399 15 5.06689V4C15 3.44772 15.4477 3 16 3Z" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
//   <path d="M13 24C13 25.6569 14.3431 27 16 27C17.6569 27 19 25.6569 19 24" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
//   <path d="M5 10 C7 6, 11 6, 13 8" stroke="#FFF" stroke-opacity="0.6" stroke-width="1.5" stroke-linecap="round"/>
//   <path d="M27 10 C25 6, 21 6, 19 8" stroke="#FFF" stroke-opacity="0.6" stroke-width="1.5" stroke-linecap="round"/>
// </svg>
// `

// Dictionary to track active alarms and their sound processes locally
// Removed the unused activeAlarmProcesses variable

export default function StopAlarm() {
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [alarms, setAlarms] = useState<AlarmInfo[]>([])
  const [activeAlarmIds, setActiveAlarmIds] = useState<string[]>([])

  const loadAlarms = async () => {
    try {
      const alarmsJson = await LocalStorage.getItem('raycast-alarms')
      if (alarmsJson) {
        const parsedAlarms: AlarmInfo[] = JSON.parse(alarmsJson as string)
        setAlarms(parsedAlarms)
      }

      setIsLoading(false)
    } catch (error) {
      console.error('Error loading alarms:', error)
      setIsLoading(false)
    }
  }

  const handleStopAlarm = async (alarmId: string) => {
    try {
      if (stopAlarm(alarmId)) {
        // Update active alarm IDs
        setActiveAlarmIds(prevIds => prevIds.filter(id => id !== alarmId))

        await showToast({
          style: Toast.Style.Success,
          title: "Alarm Stopped",
          message: `Alarm has been stopped`
        })
      } else {
        await showToast({
          style: Toast.Style.Failure,
          title: "No Active Alarm",
          message: "This alarm is not currently active"
        })
      }
    } catch (error) {
      console.error(`Error stopping alarm: ${error}`)
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to stop alarm",
        message: String(error)
      })
    }
  }

  const handleStopAllAlarms = async () => {
    try {
      const stoppedCount = stopAllAlarms()

      // Clear the active alarm IDs
      setActiveAlarmIds([])

      await showToast({
        style: Toast.Style.Success,
        title: "All Alarms Stopped",
        message: `Stopped ${stoppedCount} active alarm${stoppedCount !== 1 ? 's' : ''}`
      })
    } catch (error) {
      console.error(`Error stopping all alarms: ${error}`)
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to stop alarms",
        message: String(error)
      })
    }
  }

  useEffect(() => {
    loadAlarms()

    // We'll use a polling approach to check for active alarms every 1 second
    const interval = setInterval(() => {
      // Check for new active processes from global store
      const alarmIds = Array.from(globalRaycastAlarms.activeSoundProcesses.keys())

      if (JSON.stringify(alarmIds) !== JSON.stringify(activeAlarmIds)) {
        setActiveAlarmIds(alarmIds)
      }
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [activeAlarmIds])

  // If viewing as a regular command and there are no active alarms
  if (activeAlarmIds.length === 0) {
    return (
      <List isLoading={isLoading} searchBarPlaceholder="Search alarms...">
        <List.EmptyView
          title="No Active Alarms"
          description="No alarms are currently ringing. Create one from the 'Create Alarm' command."
          icon={Icon.BellDisabled}
        />
      </List>
    )
  }

  // If there are active alarms
  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search alarms...">
      <List.Section title="Active Alarms">
        {activeAlarmIds.map(id => {
          const alarm = alarms.find(a => a.id === id)
          return (
            <List.Item
              key={id}
              title={alarm ? alarm.name : `Alarm ${id}`}
              subtitle={alarm ? alarm.time : ''}
              icon={Icon.Bell}
              accessories={[{ icon: Icon.CircleFilled, tooltip: 'Active' }]}
              actions={
                <ActionPanel>
                  <Action
                    title="Stop Alarm"
                    icon={Icon.Stop}
                    onAction={() => handleStopAlarm(id)}
                  />
                </ActionPanel>
              }
            />
          )
        })}
      </List.Section>

      {activeAlarmIds.length > 1 && (
        <List.Item
          title="Stop All Alarms"
          icon={Icon.Stop}
          actions={
            <ActionPanel>
              <Action title="Stop All" onAction={handleStopAllAlarms} />
            </ActionPanel>
          }
        />
      )}

      <List.Section title="Scheduled Alarms">
        {alarms.filter(alarm => !activeAlarmIds.includes(alarm.id)).length > 0 ? (
          alarms
            .filter(alarm => !activeAlarmIds.includes(alarm.id))
            .map(alarm => (
              <List.Item
                key={alarm.id}
                title={alarm.name}
                subtitle={alarm.time}
                icon={Icon.Clock}
                accessories={[{ text: 'Scheduled' }]}
              />
            ))
        ) : (
          <List.Item title="No scheduled alarms" icon={Icon.Clock} />
        )}
      </List.Section>
    </List>
  )
} 