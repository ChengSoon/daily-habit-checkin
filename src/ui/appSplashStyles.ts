import { StyleSheet } from "react-native";

export const appSplashStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 100
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24
  },
  eyebrow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  heroBlock: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24
  },
  emblemWrap: {
    alignItems: "center",
    gap: 18
  },
  emblemPlate: {
    width: 108,
    height: 108,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#283048",
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8
  },
  emblemCore: {
    width: 72,
    height: 72,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  },
  emblemChip: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    textAlign: "center",
    letterSpacing: -0.6
  },
  subtitle: {
    textAlign: "center",
    marginTop: 6
  },
  footer: {
    width: "100%"
  },
  statusCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    shadowColor: "#283048",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  statusAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  statusBridge: {
    width: 18,
    height: 2,
    borderRadius: 2,
    marginHorizontal: -2
  },
  track: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden"
  },
  trackFill: {
    height: "100%",
    borderRadius: 999
  },
  orbitLayer: {
    position: "absolute",
    alignSelf: "center",
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center"
  },
  orbitRing: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1
  },
  orbitRingInner: {
    position: "absolute",
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 1,
    borderStyle: "dashed"
  },
  personDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7
  },
  personYou: {
    top: 18,
    left: 122
  },
  personPartner: {
    bottom: 28,
    right: 36,
    width: 12,
    height: 12,
    borderRadius: 6
  }
});
