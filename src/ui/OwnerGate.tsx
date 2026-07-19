import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { View } from "react-native";
import { goBackOrReplace } from "../navigation/goBackOrReplace";
import { getCurrentAccount } from "../sync/authService";
import { AppButton, AppText } from "./Controls";
import { Screen } from "./Screen";

type AccessState = "checking" | "granted" | "denied";

/**
 * 管理页权限门：只有 owner（建空间的人）能进入。
 * 服务端写接口用 requireOwner 兜底，这里只负责不让非 owner 看到管理界面。
 */
export function OwnerGate({
  children,
  fallbackHref = "/profile"
}: {
  children: ReactNode;
  fallbackHref?: Parameters<typeof router.replace>[0];
}) {
  const access = useOwnerAccess();

  if (access === "checking") {
    return (
      <Screen>
        <AppText variant="body" tone="muted">
          正在确认小岛权限…
        </AppText>
      </Screen>
    );
  }

  if (access === "denied") {
    return <OwnerDenied fallbackHref={fallbackHref} />;
  }

  return <>{children}</>;
}

function useOwnerAccess(): AccessState {
  const [access, setAccess] = useState<AccessState>("checking");
  useFocusEffect(useCallback(() => {
    let active = true;
    getCurrentAccount()
      .then((account) => {
        if (active) setAccess(account?.role === "owner" ? "granted" : "denied");
      })
      .catch(() => {
        if (active) setAccess("denied");
      });
    return () => {
      active = false;
    };
  }, []));
  return access;
}

function OwnerDenied({ fallbackHref }: { fallbackHref: Parameters<typeof router.replace>[0] }) {
  return (
    <Screen>
      <View style={{ gap: 12 }}>
        <AppText variant="display">小岛管理权限</AppText>
        <AppText variant="body" tone="muted">
          只有创建空间的人（Owner）可以管理奖励与章节。
        </AppText>
        <AppButton
          title="返回"
          variant="secondary"
          icon="chevron-back"
          onPress={() => goBackOrReplace(router, fallbackHref)}
        />
      </View>
    </Screen>
  );
}
