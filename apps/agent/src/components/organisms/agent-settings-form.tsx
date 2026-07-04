import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  SettingsField,
  Textarea,
} from "@mini-analytics/shared-ui";

interface AgentSettingsFormProps {
  apiUrl: string;
  apiToken: string;
  excludedApps: string;
  onApiUrlChange: (value: string) => void;
  onApiTokenChange: (value: string) => void;
  onExcludedAppsChange: (value: string) => void;
  onSave: () => void;
}

export function AgentSettingsForm({
  apiUrl,
  apiToken,
  excludedApps,
  onApiUrlChange,
  onApiTokenChange,
  onExcludedAppsChange,
  onSave,
}: AgentSettingsFormProps) {
  return (
    <Card className="grid gap-5">
      <div>
        <CardTitle>Privacy & Routing</CardTitle>
        <CardDescription className="mt-2">
          Configure the backend target and hide specific applications from window-title collection.
        </CardDescription>
      </div>
      <SettingsField label="Backend API URL">
        <Input value={apiUrl} onChange={(event) => onApiUrlChange(event.target.value)} />
      </SettingsField>
      <SettingsField label="API token">
        <Input
          type="password"
          value={apiToken}
          onChange={(event) => onApiTokenChange(event.target.value)}
          placeholder="Optional bearer token"
        />
      </SettingsField>
      <SettingsField label="Excluded apps">
        <Textarea
          value={excludedApps}
          onChange={(event) => onExcludedAppsChange(event.target.value)}
          placeholder={"One app per line\nSlack\n1Password"}
        />
      </SettingsField>
      <Button variant="outline" onClick={onSave}>
        Save settings
      </Button>
    </Card>
  );
}
