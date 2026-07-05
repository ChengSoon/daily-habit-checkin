import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet } from "react-native";

export function Screen({ children }: PropsWithChildren) {
  return <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 16,
    padding: 16,
    backgroundColor: "#F7F7F2"
  }
});
