import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  type InstanceWebhook,
  listInstanceWebhookDeliveries,
  listInstanceWebhooks,
  removeInstanceWebhook,
  rotateInstanceWebhook,
  saveInstanceWebhook,
  testInstanceWebhook,
} from "@/fetchers/admin/instance-management";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/webhooks",
)({ component: WebhooksPage });
const empty = { name: "", url: "", enabled: true, categories: [] as string[] };
function WebhooksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["admin", "webhooks"],
    queryFn: listInstanceWebhooks,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [input, setInput] = useState(empty);
  const [secret, setSecret] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ["admin", "webhooks", historyId, "deliveries"],
    queryFn: () => listInstanceWebhookDeliveries(historyId as string),
    enabled: !!historyId,
    refetchInterval: historyId ? 5_000 : false,
  });
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const reset = () => {
    setEditing(null);
    setInput(empty);
  };
  const edit = (webhook: InstanceWebhook) => {
    setEditing(webhook.id);
    setInput({
      name: webhook.name,
      url: webhook.url,
      enabled: webhook.enabled,
      categories: webhook.categories,
    });
  };
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">
        {t("settings:adminPanel.webhooks.title")}
      </h1>
      <p className="text-muted-foreground text-sm">
        {t("settings:adminPanel.webhooks.hint")}
      </p>
      {error && <p role="alert">{error.message}</p>}
      {secret && (
        <div className="rounded-lg border p-4 space-y-3">
          <Label htmlFor="instance-webhook-secret">
            {t("settings:adminPanel.webhooks.secretOnce")}
          </Label>
          <Input
            id="instance-webhook-secret"
            type="text"
            readOnly
            value={secret}
            onFocus={(event) => event.target.select()}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setSecret(null)}
          >
            {t("common:actions.close")}
          </Button>
        </div>
      )}
      <form
        className="rounded-lg border p-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSecret(null);
          mutation.mutate(async () => {
            const result = await saveInstanceWebhook(editing, input);
            if (result.secret) setSecret(result.secret);
            reset();
          });
        }}
      >
        <Label htmlFor="instance-webhook-name">
          {t("settings:adminPanel.webhooks.name")}
        </Label>
        <Input
          id="instance-webhook-name"
          type="text"
          required
          maxLength={100}
          value={input.name}
          onChange={(event) => setInput({ ...input, name: event.target.value })}
        />
        <Label htmlFor="instance-webhook-url">
          {t("settings:adminPanel.webhooks.url")}
        </Label>
        <Input
          id="instance-webhook-url"
          type="url"
          required
          maxLength={2048}
          value={input.url}
          onChange={(event) => setInput({ ...input, url: event.target.value })}
        />
        <Label className="flex items-center gap-2">
          <Switch
            checked={input.enabled}
            onCheckedChange={(enabled) => setInput({ ...input, enabled })}
          />
          {t("settings:adminPanel.webhooks.enabled")}
        </Label>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-3 text-sm">
            {t("settings:adminPanel.webhooks.categories")}
          </legend>
          {data?.categories.map((category) => (
            <Label key={category} className="flex items-center gap-2">
              <Checkbox
                checked={input.categories.includes(category)}
                onCheckedChange={(checked) =>
                  setInput((current) => ({
                    ...current,
                    categories: checked
                      ? [...current.categories, category]
                      : current.categories.filter(
                          (value) => value !== category,
                        ),
                  }))
                }
              />
              {t(`settings:adminPanel.webhookCategories.${category}`)}
            </Label>
          ))}
        </fieldset>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={mutation.isPending || !input.categories.length}
          >
            {t("settings:adminPanel.webhooks.save")}
          </Button>
          {editing && (
            <Button type="button" variant="outline" onClick={reset}>
              {t("common:actions.cancel")}
            </Button>
          )}
        </div>
      </form>
      {data?.webhooks.map((webhook) => (
        <div key={webhook.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex justify-between gap-2">
            <span className="font-medium">{webhook.name}</span>
            <span>
              {t(
                webhook.enabled
                  ? "settings:adminPanel.webhooks.enabled"
                  : "settings:adminPanel.webhooks.disabled",
              )}
            </span>
          </div>
          <p className="text-sm text-muted-foreground break-all">
            {webhook.url}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => edit(webhook)}
            >
              {t("settings:adminPanel.customRoles.edit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending || !webhook.enabled}
              onClick={() =>
                mutation.mutate(() => testInstanceWebhook(webhook.id))
              }
            >
              {t("settings:adminPanel.webhooks.test")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setSecret(null);
                mutation.mutate(async () => {
                  const result = await rotateInstanceWebhook(webhook.id);
                  setSecret(result.secret);
                });
              }}
            >
              {t("settings:adminPanel.webhooks.rotate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setHistoryId(webhook.id)}
            >
              {t("settings:adminPanel.webhooks.history")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate(() => removeInstanceWebhook(webhook.id))
              }
            >
              {t("common:actions.delete")}
            </Button>
          </div>
        </div>
      ))}
      {historyId && (
        <section className="rounded-lg border p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">
              {t("settings:adminPanel.webhooks.history")}
            </h2>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setHistoryId(null)}
            >
              {t("common:actions.close")}
            </Button>
          </div>
          {history.error && <p role="alert">{history.error.message}</p>}
          {history.data?.length === 0 && (
            <p>{t("settings:adminPanel.webhooks.emptyHistory")}</p>
          )}
          {history.data?.map((entry) => (
            <div
              key={entry.id}
              className="text-sm flex flex-wrap gap-3 border-t py-2"
            >
              <time>{new Date(entry.createdAt).toLocaleString()}</time>
              <span>
                {t(`settings:adminPanel.webhookStates.${entry.state}`)}
              </span>
              <span>
                {t("settings:adminPanel.webhooks.attempts", {
                  count: entry.attempts,
                })}
              </span>
              {entry.statusCode && <span>HTTP {entry.statusCode}</span>}
              {entry.errorCode && (
                <span>{t("settings:adminPanel.webhooks.deliveryError")}</span>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
