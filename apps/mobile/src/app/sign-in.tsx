import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Button, Field, Notice, Screen } from "@/components/ui";
import { errorMessage } from "@/lib/format";
import { useSession } from "@/lib/session";

export default function SignInScreen() {
  const { ready, session, lastServerUrl, signInPassword, signInApiKey } =
    useSession();
  const [serverUrl, setServerUrl] = useState(lastServerUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [useApiKey, setUseApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (lastServerUrl) {
      setServerUrl((current) => current || lastServerUrl);
    }
  }, [lastServerUrl]);

  if (ready && session) return <Redirect href="/workspaces" />;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (useApiKey) {
        await signInApiKey(serverUrl, apiKey);
      } else {
        await signInPassword(serverUrl, email, password);
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Kaneo">
      <ScrollView keyboardShouldPersistTaps="handled">
        <Notice>
          Nhập địa chỉ máy chủ tự host, ví dụ http://192.168.1.10:1337.
        </Notice>
        <Field
          autoCapitalize="none"
          label="Máy chủ"
          onChangeText={setServerUrl}
          placeholder="http://localhost:1337"
          value={serverUrl}
        />
        {useApiKey ? (
          <Field
            autoCapitalize="none"
            label="Khóa API"
            onChangeText={setApiKey}
            secure
            value={apiKey}
          />
        ) : (
          <>
            <Field
              autoCapitalize="none"
              label="Email"
              onChangeText={setEmail}
              value={email}
            />
            <Field
              autoCapitalize="none"
              label="Mật khẩu"
              onChangeText={setPassword}
              secure
              value={password}
            />
          </>
        )}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button
          disabled={busy}
          label={busy ? "Đang đăng nhập…" : "Đăng nhập"}
          onPress={() => {
            void submit();
          }}
        />
        <Button
          label={useApiKey ? "Dùng email và mật khẩu" : "Dùng khóa API"}
          onPress={() => setUseApiKey((value) => !value)}
        />
      </ScrollView>
    </Screen>
  );
}
