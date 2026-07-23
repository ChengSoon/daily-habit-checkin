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

function ClaimCard({ claim, busyId, onFulfill, onCancel }: {
  claim: AdventureClaim;
  busyId: string | null;
  onFulfill: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const busy = busyId === claim.id;
  return <Card elevated={false} style={{ gap: 10, padding: 13 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="bodyStrong">{claim.chapterTitle}</AppText>
        <AppText variant="caption" tone="muted">{claim.badgeName} · {new Date(claim.claimedAt).toLocaleString()}</AppText>
      </View>
      <Badge label={statusLabel(claim.fulfillmentStatus)} tone={statusTone(claim.fulfillmentStatus)} />
    </View>
    <View style={{ flexDirection: "row", gap: 8 }}>
      <AppButton title={busy ? "处理中…" : "确认兑现"} onPress={() => onFulfill(claim.id)}
        disabled={busy} style={{ flex: 1 }} />
      <AppButton title="取消" variant="danger" onPress={() => onCancel(claim.id)}
        disabled={busy} style={{ flex: 1 }} />
    </View>
  </Card>;
}

function ClaimHistory({ claims }: { claims: AdventureClaim[] }) {
  if (claims.length === 0) return null;
  return <>
    <AppText variant="section">历史记录</AppText>
    {claims.map((claim) => <Card key={claim.id} elevated={false} style={{ gap: 10, padding: 13 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="bodyStrong">{claim.chapterTitle}</AppText>
        <Badge label={statusLabel(claim.fulfillmentStatus)} tone={statusTone(claim.fulfillmentStatus)} />
      </View>
      <AppText variant="caption" tone="muted">{claim.badgeName} · {new Date(claim.claimedAt).toLocaleString()}</AppText>
    </Card>)}
  </>;
}

function ClaimsView({ pending, others, busyId, fulfill, cancel, message, error }: {
  pending: AdventureClaim[];
  others: AdventureClaim[];
  busyId: string | null;
  fulfill: (id: string) => void;
  cancel: (id: string) => void;
  message: string | null;
  error: string | null;
}) {
  return <Screen>
    <View style={{ gap: 4 }}>
      <AppText variant="display">章节兑现</AppText>
      <AppText variant="body" tone="muted">处理徽章现实惊喜的兑现状态</AppText>
    </View>
    <HelperText>现实惊喜领取后在此确认兑现。取消不会回退章节解锁，仅标记状态。</HelperText>
    {message ? <HelperText tone="success">{message}</HelperText> : null}
    {error ? <HelperText tone="danger">{error}</HelperText> : null}
    <AppText variant="section">待兑现（{pending.length}）</AppText>
    {pending.length === 0 ? <EmptyState title="暂无待兑现" body="章节设为「现实惊喜」并被领取后，会出现在这里。" />
      : pending.map((claim) => <ClaimCard key={claim.id} claim={claim} busyId={busyId}
        onFulfill={fulfill} onCancel={cancel} />)}
    <ClaimHistory claims={others} />
  </Screen>;
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

  async function mutate(id: string, action: () => Promise<unknown>, success: string) {
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      await action();
      setMessage(success);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  }

  const fulfill = (id: string) => void mutate(id, () => fulfillAdventureClaim(id), "已确认兑现");
  const cancel = (id: string) => void mutate(id, () => cancelAdventureClaim(id), "已取消兑现");

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  const pending = claims.filter((claim) => claim.fulfillmentStatus === "pending");
  const others = claims.filter((claim) => claim.fulfillmentStatus !== "pending");

  return <ClaimsView pending={pending} others={others} busyId={busyId}
    fulfill={fulfill} cancel={cancel} message={message} error={error} />;
}
