import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({
  title,
  children,
  back,
  right,
}: {
  title: string;
  children: ReactNode;
  back?: boolean;
  right?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          {back ? (
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={styles.back}>Quay lại</Text>
            </Pressable>
          ) : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        {right}
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secure?: boolean;
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize ?? "sentences"}
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secure}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled ? styles.buttonDisabled : null]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Notice({
  children,
  tone,
}: {
  children: string;
  tone?: "error" | "muted";
}) {
  return (
    <Text style={tone === "error" ? styles.error : styles.muted}>
      {children}
    </Text>
  );
}

export function Row({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f6f5f2",
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  back: {
    color: "#1d4e89",
    fontSize: 15,
  },
  title: {
    color: "#1a1a1a",
    fontSize: 24,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  field: {
    gap: 6,
    marginBottom: 12,
  },
  label: {
    color: "#3d3d3d",
    fontSize: 14,
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#d7d4cc",
    borderRadius: 10,
    borderWidth: 1,
    color: "#1a1a1a",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#1d4e89",
    borderRadius: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#9b2c2c",
    marginBottom: 8,
  },
  muted: {
    color: "#5c5c5c",
    marginBottom: 8,
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  row: {
    backgroundColor: "#ffffff",
    borderColor: "#e4e1d8",
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowTitle: {
    color: "#1a1a1a",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
});
