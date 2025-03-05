// This file is a compatibility layer for the "remove-alarm" command in package.json

import { List, ActionPanel, Action } from "@raycast/api"

export default function RemoveAlarm() {
  return (
    <List>
      <List.Item
        title="This command has been replaced by 'Stop Alarm'"
        actions={
          <ActionPanel>
            <Action title="Open Stop Alarm" onAction={() => { }} shortcut={{ modifiers: ["cmd"], key: "space" }} />
          </ActionPanel>
        }
      />
    </List>
  )
} 