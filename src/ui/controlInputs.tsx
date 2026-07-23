import { KeyboardTypeOptions, Switch, TextInput, View } from "react-native";
import { AppText } from "./controlText";
import { Label } from "./controlDisplay";
import { useTheme } from "./ThemeContext";

type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  disabled?: boolean;
};

export function TextField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  keyboardType,
  multiline = false,
  autoFocus = false,
  secureTextEntry = false,
  disabled = false
}: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        multiline={multiline}
        autoFocus={autoFocus}
        secureTextEntry={secureTextEntry}
        editable={!disabled}
        style={[
          {
            minHeight: multiline ? 88 : 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.inputBackground,
            color: colors.ink,
            fontSize: 15,
            fontFamily: "Nunito_500Medium",
            paddingHorizontal: 14,
            paddingVertical: 12,
            textAlignVertical: multiline ? "top" : "center"
          },
          disabled ? { opacity: 0.55 } : null
        ]}
      />
    </View>
  );
}

export function SwitchRow({ label, description, value, onValueChange, disabled = false }: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" style={{ fontSize: 15 }}>{label}</AppText>
        {description ? <AppText variant="small" tone="muted">{description}</AppText> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.lineStrong, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}
