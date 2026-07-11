import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject
} from "react";
import {
  buildCeremonyTimeline,
  phaseAt,
  type CeremonyPhase
} from "./ceremonyTimeline";
import type { ActiveCeremony, MapCameraApi } from "./VoxelWorldCanvas";
import type { AdventureStation } from "./types";
import type { VoxelWorldLayout } from "./voxelWorldLayout";

export function useUnlockCeremony(input: {
  layout: VoxelWorldLayout;
  stations: AdventureStation[];
  pendingUnlockStationIds: string[];
  cameraApi: MutableRefObject<MapCameraApi | null>;
  reducedMotion: boolean;
  onComplete: () => void;
}): {
  ceremony: ActiveCeremony | null;
  showRewardFor: AdventureStation | null;
  skip: () => void;
} {
  const { layout, stations, pendingUnlockStationIds, cameraApi, reducedMotion, onComplete } = input;

  const [ceremony, setCeremony] = useState<ActiveCeremony | null>(null);
  const [showRewardFor, setShowRewardFor] = useState<AdventureStation | null>(null);

  const queueRef = useRef<string[]>([]);
  const playedKeyRef = useRef<string>("");
  const rafRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const finishAll = useCallback(() => {
    stopRaf();
    queueRef.current = [];
    setCeremony(null);
    setShowRewardFor(null);
    onCompleteRef.current();
  }, [stopRaf]);

  const playNextRef = useRef<() => void>(() => {});
  const playNext = useCallback(() => {
    stopRaf();
    const nextId = queueRef.current.shift();
    if (!nextId) {
      finishAll();
      return;
    }
    const toStationIndex = stations.findIndex((s) => s.id === nextId);
    if (toStationIndex < 0 || !layout.nodes[toStationIndex]) {
      playNextRef.current();
      return;
    }
    const fromStationIndex = Math.max(0, toStationIndex - 1);
    const phases = buildCeremonyTimeline({
      layout,
      fromStationIndex,
      toStationIndex,
      reducedMotion
    });
    const startedAt = Date.now();
    const active: ActiveCeremony = {
      phases,
      startedAt,
      onDone: () => {}
    };
    setCeremony(active);
    setShowRewardFor(null);

    // flyTo 由 hook 发起一次（Canvas 内 CameraRig 消费 flyingTo 状态）
    const fly = phases.find((p): p is Extract<CeremonyPhase, { kind: "flyTo" }> => p.kind === "flyTo");
    if (fly) cameraApi.current?.flyTo(fly.target, fly.durationMs);

    const station = stations[toStationIndex];
    const tick = () => {
      const located = phaseAt(phases, Date.now() - startedAt);
      if (located === null) {
        setShowRewardFor(null);
        playNextRef.current();
        return;
      }
      if (located.phase.kind === "celebrate") {
        setShowRewardFor((prev) => (prev === station ? prev : station));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [cameraApi, finishAll, layout, reducedMotion, stations, stopRaf]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  useEffect(() => {
    const key = pendingUnlockStationIds.join("|");
    if (key === playedKeyRef.current) return;
    playedKeyRef.current = key;
    if (pendingUnlockStationIds.length === 0) return;
    queueRef.current = [...pendingUnlockStationIds];
    playNext();
  }, [pendingUnlockStationIds, playNext]);

  useEffect(() => stopRaf, [stopRaf]);

  const skip = useCallback(() => {
    if (queueRef.current.length === 0 && ceremony === null) return;
    finishAll();
  }, [ceremony, finishAll]);

  return { ceremony, showRewardFor, skip };
}
