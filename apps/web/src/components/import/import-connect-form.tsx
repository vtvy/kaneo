import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  IMPORT_SOURCES,
  type ImportConnectValues,
  type ImportSourceId,
  type PlankaSignIn,
} from "./build-connection";

const SOURCE_NAMES: Record<ImportSourceId, string> = {
  planka: "PLANKA",
  jira: "Jira",
};

type ImportConnectFormProps = {
  source: ImportSourceId;
  values: ImportConnectValues;
  canConnect: boolean;
  isConnecting: boolean;
  onSourceChange: (source: ImportSourceId) => void;
  onChange: (values: ImportConnectValues) => void;
  onConnect: () => void;
};

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ImportConnectForm({
  source,
  values,
  canConnect,
  isConnecting,
  onSourceChange,
  onChange,
  onConnect,
}: ImportConnectFormProps) {
  const { t } = useTranslation();
  const set = (patch: Partial<ImportConnectValues>) =>
    onChange({ ...values, ...patch });

  return (
    <form
      className="space-y-4 border border-border rounded-md p-4 bg-sidebar"
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        if (canConnect) onConnect();
      }}
    >
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          {t("settings:workspaceImport.source.label")}
        </Label>
        <ToggleGroup
          variant="outline"
          size="sm"
          aria-label={t("settings:workspaceImport.source.label")}
          value={[source]}
          onValueChange={(selected) => {
            const next = selected[0] as ImportSourceId | undefined;
            if (next) onSourceChange(next);
          }}
        >
          {IMPORT_SOURCES.map((id) => (
            <ToggleGroupItem key={id} value={id} className="px-4">
              {SOURCE_NAMES[id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Field
        id="import-url"
        label={t("settings:workspaceImport.fields.url")}
        hint={t(`settings:workspaceImport.hints.${source}Url`)}
      >
        <Input
          id="import-url"
          type="url"
          placeholder={
            source === "jira"
              ? "https://your-site.atlassian.net"
              : "https://planka.example.com"
          }
          value={values.url}
          onChange={(event) => set({ url: event.target.value })}
        />
      </Field>

      {source === "jira" ? (
        <>
          <Field
            id="import-email"
            label={t("settings:workspaceImport.fields.email")}
            hint={t("settings:workspaceImport.hints.jiraEmail")}
          >
            <Input
              id="import-email"
              type="email"
              value={values.email}
              onChange={(event) => set({ email: event.target.value })}
            />
          </Field>
          <Field
            id="import-token"
            label={t("settings:workspaceImport.fields.apiToken")}
            hint={t("settings:workspaceImport.hints.jiraToken")}
          >
            <Input
              id="import-token"
              type="password"
              autoComplete="new-password"
              value={values.token}
              onChange={(event) => set({ token: event.target.value })}
            />
          </Field>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              {t("settings:workspaceImport.fields.signIn")}
            </Label>
            <ToggleGroup
              variant="outline"
              size="sm"
              aria-label={t("settings:workspaceImport.fields.signIn")}
              value={[values.plankaSignIn]}
              onValueChange={(selected) => {
                const next = selected[0] as PlankaSignIn | undefined;
                if (next) set({ plankaSignIn: next });
              }}
            >
              <ToggleGroupItem value="apiKey" className="px-3">
                {t("settings:workspaceImport.fields.apiKey")}
              </ToggleGroupItem>
              <ToggleGroupItem value="password" className="px-3">
                {t("settings:workspaceImport.fields.password")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {values.plankaSignIn === "apiKey" ? (
            <Field
              id="import-api-key"
              label={t("settings:workspaceImport.fields.apiKey")}
              hint={t("settings:workspaceImport.hints.plankaApiKey")}
            >
              <Input
                id="import-api-key"
                type="password"
                autoComplete="new-password"
                value={values.apiKey}
                onChange={(event) => set({ apiKey: event.target.value })}
              />
            </Field>
          ) : (
            <>
              <Field
                id="import-username"
                label={t("settings:workspaceImport.fields.username")}
              >
                <Input
                  id="import-username"
                  value={values.username}
                  onChange={(event) => set({ username: event.target.value })}
                />
              </Field>
              <Field
                id="import-password"
                label={t("settings:workspaceImport.fields.password")}
              >
                <Input
                  id="import-password"
                  type="password"
                  autoComplete="new-password"
                  value={values.password}
                  onChange={(event) => set({ password: event.target.value })}
                />
              </Field>
            </>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {t("settings:workspaceImport.credentialsNotice")}
      </p>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!canConnect || isConnecting}>
          {isConnecting
            ? t("settings:workspaceImport.actions.connecting")
            : t("settings:workspaceImport.actions.connect")}
        </Button>
      </div>
    </form>
  );
}
