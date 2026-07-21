import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  useWindowDimensions,
  View,
  type PanResponderGestureState,
  type PanResponderInstance
} from "react-native";
import { AppText } from "../ui/Controls";
import { useTheme } from "../ui/ThemeContext";
import { clampPetOffset, motionStateForDelta, PET_ATLAS } from "./petAnimation";
import { PET_NAME } from "./petIdentity";
import { PetSprite } from "./PetSprite";
import { PetQuickActions } from "./PetQuickActions";
import type { PetQuickAction } from "./petInteractionState";
import type { PetAnimationState, PetMood, PetTravelState } from "./types";

const PET_SIZE = 92;
const PET_HEIGHT = (PET_SIZE * PET_ATLAS.cellHeight) / PET_ATLAS.cellWidth;
const HORIZONTAL_MARGIN = 14;
const BUBBLE_RESERVED_HEIGHT = 176;
const DRAG_THRESHOLD = 4;

type PetOffset = { x: number; y: number };
type PetBounds = Parameters<typeof clampPetOffset>[1];

type FloatingPetProps = {
  mood: PetMood;
  bubble: string | null;
  bottomInset: number;
  topInset: number;
  onClearBubble: () => void;
  onPress: () => void;
  onLongPress: () => void;
  quickActionsOpen: boolean;
  actionAnimation: PetAnimationState | null;
  onQuickAction: (action: PetQuickAction) => void;
  onDragStart: () => void;
};

type PetBubbleProps = {
  text: string;
  onLeft: boolean;
  maxWidth: number;
  onClose: () => void;
};

function offsetForGesture(
  resting: PetOffset,
  gesture: PanResponderGestureState,
  bounds: PetBounds
): PetOffset {
  return clampPetOffset(
    { x: resting.x + gesture.dx, y: resting.y + gesture.dy },
    bounds
  );
}

function bubbleIsOnLeft(offset: PetOffset, bounds: PetBounds): boolean {
  const leftEdge = clampPetOffset({ x: Number.NEGATIVE_INFINITY, y: 0 }, bounds).x;
  return offset.x < leftEdge / 2;
}

function createPetPanResponder(args: {
  position: Animated.ValueXY;
  resting: PetOffset;
  bounds: PetBounds;
  setResting: (value: PetOffset) => void;
  setTravel: (value: PetTravelState | null) => void;
  setBubbleOnLeft: (value: boolean) => void;
  onDragStart: () => void;
}): PanResponderInstance {
  function settle(gesture: PanResponderGestureState) {
    const next = offsetForGesture(args.resting, gesture, args.bounds);
    args.position.setValue(next);
    args.setResting(next);
    args.setTravel(null);
  }

  return PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD,
    onPanResponderGrant: args.onDragStart,
    onPanResponderMove: (_, gesture) => {
      const next = offsetForGesture(args.resting, gesture, args.bounds);
      const direction =
        motionStateForDelta(gesture.vx, 0.01) ?? motionStateForDelta(gesture.dx, 1);
      if (direction) args.setTravel(direction);
      args.position.setValue(next);
      args.setBubbleOnLeft(bubbleIsOnLeft(next, args.bounds));
    },
    onPanResponderRelease: (_, gesture) => settle(gesture),
    onPanResponderTerminate: (_, gesture) => settle(gesture),
    onPanResponderTerminationRequest: () => false
  });
}

function usePetDrag(bounds: PetBounds, onDragStart: () => void) {
  const [position] = useState(() => new Animated.ValueXY());
  const [resting, setResting] = useState<PetOffset>({ x: 0, y: 0 });
  const [travel, setTravel] = useState<PetTravelState | null>(null);
  const [bubbleOnLeft, setBubbleOnLeft] = useState(false);

  useEffect(() => {
    const next = clampPetOffset(resting, bounds);
    if (next.x === resting.x && next.y === resting.y) return;
    const frame = requestAnimationFrame(() => {
      position.setValue(next);
      setResting(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [bounds, position, resting]);

  const responder = useMemo(
    () =>
      createPetPanResponder({
        position,
        resting,
        bounds,
        setResting,
        setTravel,
        setBubbleOnLeft,
        onDragStart
      }),
    [bounds, onDragStart, position, resting]
  );
  return { panHandlers: responder.panHandlers, position, travel, bubbleOnLeft };
}

function PetBubble({ text, onLeft, maxWidth, onClose }: PetBubbleProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="关闭卡卡的消息"
      style={{
        position: "absolute",
        bottom: PET_HEIGHT + 8,
        ...(onLeft ? { left: 0 } : { right: 0 }),
        width: 220,
        maxWidth,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.line,
        paddingHorizontal: 12,
        paddingVertical: 9,
        shadowColor: colors.ink,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4
      }}
    >
      <AppText variant="small" style={{ color: colors.ink, fontWeight: "700", lineHeight: 18 }}>
        {text}
      </AppText>
    </Pressable>
  );
}

export function FloatingPet(props: FloatingPetProps) {
  const window = useWindowDimensions();
  const bounds = useMemo<PetBounds>(
    () => ({
      screenWidth: window.width,
      screenHeight: window.height,
      petWidth: PET_SIZE,
      petHeight: PET_HEIGHT,
      horizontalMargin: HORIZONTAL_MARGIN,
      bottomInset: props.bottomInset,
      topInset: props.topInset + BUBBLE_RESERVED_HEIGHT
    }),
    [props.bottomInset, props.topInset, window.height, window.width]
  );
  const drag = usePetDrag(bounds, props.onDragStart);

  return (
    <Animated.View
      {...drag.panHandlers}
      style={{
        position: "absolute",
        right: HORIZONTAL_MARGIN,
        bottom: props.bottomInset,
        width: PET_SIZE,
        height: PET_HEIGHT,
        zIndex: 50,
        transform: drag.position.getTranslateTransform()
      }}
    >
      {props.bubble && !props.quickActionsOpen ? (
        <PetBubble
          text={props.bubble}
          onLeft={drag.bubbleOnLeft}
          maxWidth={Math.max(96, Math.min(220, window.width - 28))}
          onClose={props.onClearBubble}
        />
      ) : null}
      <View
        pointerEvents={props.quickActionsOpen ? "auto" : "none"}
        style={{
          position: "absolute",
          bottom: PET_HEIGHT + 8,
          ...(drag.bubbleOnLeft ? { left: 0 } : { right: 0 })
        }}
      >
        <PetQuickActions visible={props.quickActionsOpen} onAction={props.onQuickAction} />
      </View>
      <Pressable
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        delayLongPress={480}
        accessibilityRole="button"
        accessibilityLabel={"打开" + PET_NAME + "对话"}
        accessibilityHint="点按打开互动菜单，长按摸摸卡卡"
        style={({ pressed }) => ({
          width: PET_SIZE,
          height: PET_HEIGHT,
          opacity: pressed ? 0.88 : 1
        })}
      >
        <View pointerEvents="none">
          <PetSprite
            mood={props.mood}
            stateOverride={drag.travel ?? props.actionAnimation ?? (props.quickActionsOpen ? "jumping" : null)}
            size={PET_SIZE}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}
