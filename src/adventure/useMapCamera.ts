/* eslint-disable react-hooks/refs -- 手势/相机全走 ref 直驱（设计要求：不经 setState），
   回调均为事件处理器或 useFrame 消费，非渲染期访问 */
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Gesture, type ComposedGesture } from "react-native-gesture-handler";
import {
  clampCameraDistance,
  clampCameraTarget,
  panToWorldDelta
} from "./cameraMath";
import type { MapCameraApi } from "./VoxelWorldCanvas";
import type { CameraBounds } from "./voxelWorldLayout";

export type MapCameraState = {
  targetX: number;
  targetZ: number;
  distance: number;
  flyingTo: { x: number; z: number; startedAt: number; durationMs: number } | null;
  velocityX: number;
  velocityZ: number;
  bounds: CameraBounds;
};

const INITIAL_DISTANCE = 24;
const VELOCITY_SCALE = 1 / 1000; // px/s → 每帧世界位移的换算基数

export function useMapCamera(input: {
  bounds: CameraBounds;
  initialTarget: [number, number, number];
  viewportHeightPx: number;
}): {
  gesture: ComposedGesture;
  stateRef: MutableRefObject<MapCameraState>;
  api: MapCameraApi;
} {
  const { bounds, initialTarget, viewportHeightPx } = input;
  const stateRef = useRef<MapCameraState>({
    targetX: initialTarget[0],
    targetZ: initialTarget[2],
    distance: INITIAL_DISTANCE,
    flyingTo: null,
    velocityX: 0,
    velocityZ: 0,
    bounds
  });
  // bounds 随 layout 变化（如解锁新岛）时同步进 ref
  useEffect(() => {
    stateRef.current.bounds = bounds;
  }, [bounds]);

  const viewportRef = useRef(viewportHeightPx);
  useEffect(() => {
    viewportRef.current = viewportHeightPx;
  }, [viewportHeightPx]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .onBegin(() => {
        const s = stateRef.current;
        s.flyingTo = null;
        s.velocityX = 0;
        s.velocityZ = 0;
      })
      .onChange((e) => {
        const s = stateRef.current;
        const [dx, dz] = panToWorldDelta(
          -e.changeX,
          -e.changeY,
          s.distance,
          viewportRef.current
        );
        [s.targetX, s.targetZ] = clampCameraTarget(s.targetX + dx, s.targetZ + dz, s.bounds);
      })
      .onEnd((e) => {
        const s = stateRef.current;
        const [vx, vz] = panToWorldDelta(
          -e.velocityX * VELOCITY_SCALE,
          -e.velocityY * VELOCITY_SCALE,
          s.distance,
          viewportRef.current
        );
        s.velocityX = vx * viewportRef.current;
        s.velocityZ = vz * viewportRef.current;
      });

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onChange((e) => {
        const s = stateRef.current;
        s.distance = clampCameraDistance(s.distance / e.scaleChange);
      });

    return Gesture.Simultaneous(pan, pinch);
  }, []);

  const api = useMemo<MapCameraApi>(
    () => ({
      flyTo: (target, ms) => {
        const s = stateRef.current;
        const [x, z] = clampCameraTarget(target[0], target[2], s.bounds);
        s.velocityX = 0;
        s.velocityZ = 0;
        s.flyingTo = { x, z, startedAt: Date.now(), durationMs: ms };
      },
      getTarget: () => {
        const s = stateRef.current;
        return [s.targetX, 0, s.targetZ];
      }
    }),
    []
  );

  return { gesture, stateRef, api };
}
