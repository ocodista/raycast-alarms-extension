import { ChildProcess } from 'child_process';

// Interface for our shared data
export interface RaycastAlarmsNamespace {
  activeSoundProcesses: Map<string, ChildProcess>;
}

// Global shared state
export const globalRaycastAlarms: RaycastAlarmsNamespace = {
  activeSoundProcesses: new Map<string, ChildProcess>()
};

// Function to stop a specific alarm
export const stopAlarm = (alarmId: string): boolean => {
  const process = globalRaycastAlarms.activeSoundProcesses.get(alarmId);
  if (process && !process.killed) {
    process.kill();
    globalRaycastAlarms.activeSoundProcesses.delete(alarmId);
    return true;
  }
  return false;
};

// Function to stop all alarms
export const stopAllAlarms = (): number => {
  let stoppedCount = 0;
  for (const [alarmId, process] of globalRaycastAlarms.activeSoundProcesses.entries()) {
    if (process && !process.killed) {
      process.kill();
      stoppedCount++;
    }
    globalRaycastAlarms.activeSoundProcesses.delete(alarmId);
  }
  return stoppedCount;
}; 