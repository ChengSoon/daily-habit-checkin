import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useReducedMotion } from "../ui/useReducedMotion";
import {
  animationFrameSequence,
  PET_ANIMATIONS,
  PET_ATLAS,
  PET_DANCE_ATLAS,
  animationForMood
} from "./petAnimation";
import type { PetAnimationState, PetMood } from "./types";

const PET_SPRITESHEET = require("../../assets/images/pet/kaka/spritesheet.webp");
const PET_DANCING_SPRITESHEET = require("../../assets/images/pet/kaka/dancing.webp");

type PetSpriteProps = {
  mood: PetMood;
  size?: number;
  stateOverride?: PetAnimationState | null;
  reversed?: boolean;
};

/** 固定窗口裁切动作 WebP atlas，并按每一帧的真实时长播放。 */
export function PetSprite({ mood, size = 88, stateOverride, reversed = false }: PetSpriteProps) {
  const reducedMotion = useReducedMotion();
  const state = stateOverride ?? animationForMood(mood);
  const animation = PET_ANIMATIONS[state];
  const dancing = animation.sheet === "dancing";
  const atlas = dancing ? PET_DANCE_ATLAS : PET_ATLAS;
  const spritesheet = dancing ? PET_DANCING_SPRITESHEET : PET_SPRITESHEET;
  const sequence = useMemo(() => animationFrameSequence(state, reversed), [reversed, state]);
  const [playback, setPlayback] = useState({ state, reversed, frame: sequence[0] });
  const frame =
    playback.state === state && playback.reversed === reversed
      ? playback.frame
      : sequence[0];

  useEffect(() => {
    let sequenceIndex = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    function scheduleNextFrame() {
      const frame = sequence[sequenceIndex];
      timer = setTimeout(() => {
        if (!active) return;
        if (animation.playback === "once-hold" && sequenceIndex === sequence.length - 1) return;
        sequenceIndex = (sequenceIndex + 1) % sequence.length;
        setPlayback({ state, reversed, frame: sequence[sequenceIndex] });
        scheduleNextFrame();
      }, animation.frameDurations[frame]);
    }

    if (!reducedMotion) scheduleNextFrame();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [animation, reducedMotion, reversed, sequence, state]);

  const dimensions = useMemo(() => {
    const scale = size / atlas.cellWidth;
    return {
      frameHeight: atlas.cellHeight * scale,
      atlasWidth: atlas.width * scale,
      atlasHeight: atlas.height * scale
    };
  }, [atlas, size]);

  return (
    <View
      style={{
        width: size,
        height: dimensions.frameHeight,
        overflow: "hidden"
      }}
    >
      <Image
        source={spritesheet}
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
