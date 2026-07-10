import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { CoupleAvatars, CouplePerson } from "../ui/Avatar";
import { AppText } from "../ui/Controls";
import { radius } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import { createRoutePoints, travelerPoint } from "./adventureMapGeometry";
import { AdventureCampaign, AdventureProgress } from "./types";

const STATION_ICONS = ["flag", "flash", "diamond", "star", "flower", "moon", "heart", "planet"] as const;

export function AdventureMap({
  campaign,
  people,
  progress
}: {
  campaign: AdventureCampaign;
  people: CouplePerson[];
  progress: AdventureProgress;
}) {
  const { colors, scheme } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const stationPoints = createRoutePoints(campaign.stations.length + 1);
  const traveler = travelerPoint(stationPoints, progress.stationIndex, progress.segmentPoints, progress.segmentCost);
  const dots = createRoutePoints(25);
  const sky = scheme === "dark" ? colors.surfaceMuted : "#EDE8FA";

  return (
    <View
      accessibilityLabel={`冒险地图，当前第 ${progress.stationIndex + 1} 站`}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={[styles.map, { backgroundColor: sky, borderColor: colors.line }]}
    >
      <View style={[styles.moon, { backgroundColor: colors.surface }]} />
      <View style={[styles.farHill, { backgroundColor: colors.surface }]} />
      <View style={[styles.nearHill, { backgroundColor: colors.successSurface }]} />

      {size.width > 0
        ? dots.map((point, index) => {
            const routeRatio = index / (dots.length - 1);
            const reachedRatio = (progress.stationIndex + (progress.segmentCost ? progress.segmentPoints / progress.segmentCost : 0)) /
              (progress.stationCount - 1);
            return (
              <View
                key={`${point.x}-${point.y}`}
                style={[
                  styles.routeDot,
                  {
                    backgroundColor: routeRatio <= reachedRatio ? colors.primary : colors.partner,
                    left: point.x * size.width - 5,
                    top: point.y * size.height - 5
                  }
                ]}
              />
            );
          })
        : null}

      {size.width > 0
        ? stationPoints.map((point, index) => {
            const reached = index <= progress.stationIndex;
            const active = index === progress.stationIndex;
            return (
              <View
                key={index}
                style={[
                  styles.station,
                  {
                    backgroundColor: reached ? (index === 0 ? colors.primary : colors.celebration) : colors.surface,
                    borderColor: active ? colors.primaryInk : reached ? colors.celebration : colors.partner,
                    left: point.x * size.width - 21,
                    top: point.y * size.height - 21
                  }
                ]}
              >
                <Ionicons
                  name={STATION_ICONS[index % STATION_ICONS.length]}
                  size={17}
                  color={reached ? (index === 0 ? colors.onPrimary : colors.ink) : colors.partnerInk}
                />
              </View>
            );
          })
        : null}

      {size.width > 0 ? (
        <View
          style={[
            styles.traveler,
            {
              left: traveler.x * size.width - 34,
              top: traveler.y * size.height + 24
            }
          ]}
        >
          {people.length > 0 ? (
            <CoupleAvatars people={people} size={28} showRibbon={false} />
          ) : (
            <View style={[styles.placeholderTraveler, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <Ionicons name="heart" size={16} color={colors.primary} />
            </View>
          )}
        </View>
      ) : null}

      <View style={[styles.mapLabel, { backgroundColor: colors.surface }]}>
        <AppText variant="caption" tone="muted">共享旅程</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    aspectRatio: 1.08,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative"
  },
  moon: {
    borderRadius: radius.pill,
    height: 68,
    opacity: 0.76,
    position: "absolute",
    right: 22,
    top: 24,
    width: 68
  },
  farHill: {
    borderRadius: radius.pill,
    bottom: -112,
    height: 220,
    left: -45,
    opacity: 0.72,
    position: "absolute",
    transform: [{ rotate: "8deg" }],
    width: "125%"
  },
  nearHill: {
    borderRadius: radius.pill,
    bottom: -135,
    height: 220,
    left: -15,
    position: "absolute",
    transform: [{ rotate: "-7deg" }],
    width: "125%"
  },
  routeDot: {
    borderRadius: radius.pill,
    height: 10,
    opacity: 0.92,
    position: "absolute",
    width: 10
  },
  station: {
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 4,
    height: 42,
    justifyContent: "center",
    position: "absolute",
    width: 42
  },
  traveler: {
    alignItems: "center",
    position: "absolute",
    width: 68
  },
  placeholderTraveler: {
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  mapLabel: {
    borderRadius: radius.sm,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "absolute",
    top: 14
  }
});
