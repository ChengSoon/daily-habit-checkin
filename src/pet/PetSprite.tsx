import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useReducedMotion } from "../ui/useReducedMotion";
import { PET_ANIMATIONS, PET_ATLAS, animationForMood } from "./petAnimation";
import type { PetAnimationState, PetMood } from "./types";

const PET_SPRITESHEET = require("../../assets/images/pet/kaka/spritesheet.webp");

type PetSpriteProps = {
  mood: PetMood;
  size?: number;
  stateOverride?: PetAnimationState | null;
};

/** 固定窗口裁切九行 WebP atlas，并按每一帧的真实时长播放。 */
export function PetSprite({ mood, size = 88, stateOverride }: PetSpriteProps) {
  const reducedMotion = useReducedMotion();
  const state = stateOverride ?? animationForMood(mood);
  const animation = PET_ANIMATIONS[state];
  const [playback, setPlayback] = useState({ state, frame: 0 });
  const frame = playback.state === state ? playback.frame : 0;

  useEffect(() => {
    let currentFrame = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    function scheduleNextFrame() {
      timer = setTimeout(() => {
        if (!active) return;
        currentFrame = (currentFrame + 1) % animation.frameDurations.length;
        setPlayback({ state, frame: currentFrame });
        scheduleNextFrame();
      }, animation.frameDurations[currentFrame]);
    }

    if (!reducedMotion) scheduleNextFrame();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [animation, reducedMotion, state]);

  const dimensions = useMemo(() => {
    const scale = size / PET_ATLAS.cellWidth;
    return {
      frameHeight: PET_ATLAS.cellHeight * scale,
      atlasWidth: PET_ATLAS.width * scale,
      atlasHeight: PET_ATLAS.height * scale
    };
  }, [size]);

  return (
    <View
      style={{
        width: size,
        height: dimensions.frameHeight,
        overflow: "hidden"
      }}
    >
      <Image
        source={PET_SPRITESHEET}
        contentFit="fill"
        cachePolicy="memory-disk"
        accessible={false}
        style={{
          position: "absolute",
          width: dimensions.atlasWidth,
          height: dimensions.atlasHeight,
          left: -frame * size,
          top: -animation.row * dimensions.frameHeight
        }}
      />
    </View>
  );
}
