import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  cancelAdventureClaim,
  fulfillAdventureClaim,
  loadAdminAdventureClaims
} from "../../src/adventure/adventureService";
import type { AdventureClaim } from "../../src/adventure/types";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { OwnerGate } from "../../src/ui/OwnerGate";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";

function statusTone(status: AdventureClaim["fulfillmentStatus"]): "primary" | "success" | "danger" | "muted" {
  if (status === "pending") return "primary";
  if (status === "fulfilled") return "success";
  if (status === "cancelled") return "danger";
  return "muted";
}

function statusLabel(status: AdventureClaim["fulfillmentStatus"]): string {
  if (status === "pending") return "待兑现";
  if (status === "fulfilled") return "已兑现";
  if (status === "cancelled") return "已取消";
  return "无需兑现";
}

export default function AdminAdventureClaimsScreen() {
  return (
    <OwnerGate>
      <AdminAdventureClaimsContent />
    </OwnerGate>
  );
}

function AdminAdventureClaimsContent() {
  const [claims, setClaims] = useState<AdventureClaim[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setClaims(await loadAdminAdventureClaims());
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);

  async function fulfill(id: string) {
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      await fulfillAdventureClaim(id);
      setMessage("已确认兑现");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认失败");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: string) {
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      await cancelAdventureClaim(id);
      setMessage("已取消兑现");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "取消失败");
    } finally {
      setBusyId(null);
    }
  }

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  const pending = claims.filter((claim) => claim.fulfillmentStatus === "pending");
  const others = claims.filter((claim) => claim.fulfillmentStatus !== "pending");

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <AppText variant="display">章节兑现</AppText>
        <AppText variant="body" tone="muted">
          处理徽章现实惊喜的兑现状态
        </AppText>
      </View>
      <HelperText>现实惊喜领取后在此确认兑现。取消不会回退章节解锁，仅标记状态。</HelperText>
      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {error ? <HelperText tone="danger">{error}</HelperText> : null}

      <AppText variant="section">待兑现（{pending.length}）</AppText>
      {pending.length === 0 ? (
        <EmptyState title="暂无待兑现" body="章节设为「现实惊喜」并被领取后，会出现在这里。" />
      ) : (
        pending.map((claim) => (
          <Card key={claim.id} elevated={false} style={{ gap: 10, padding: 13 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="bodyStrong">{claim.chapterTitle}</AppText>
                <AppText variant="caption" tone="muted">
                  {claim.badgeName} · {new Date(claim.claimedAt).toLocaleString()}
                </AppText>
              </View>
              <Badge label={statusLabel(claim.fulfillmentStatus)} tone={statusTone(claim.fulfillmentStatus)} />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <AppButton
                title={busyId === claim.id ? "处理中…" : "确认兑现"}
                onPress={() => void fulfill(claim.id)}
                disabled={busyId === claim.id}
                style={{ flex: 1 }}
              />
              <AppButton
                title="取消"
                variant="danger"
                onPress={() => void cancel(claim.id)}
                disabled={busyId === claim.id}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))
      )}

      {others.length > 0 ? (
        <>
          <AppText variant="section">历史记录</AppText>
          {others.map((claim) => (
            <Card key={claim.id} elevated={false} style={{ gap: 10, padding: 13 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="bodyStrong">{claim.chapterTitle}</AppText>
                <Badge label={statusLabel(claim.fulfillmentStatus)} tone={statusTone(claim.fulfillmentStatus)} />
              </View>
              <AppText variant="caption" tone="muted">
                {claim.badgeName} · {new Date(claim.claimedAt).toLocaleString()}
              </AppText>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
