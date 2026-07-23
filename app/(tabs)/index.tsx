import { useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckInCelebration, MiniCheckInBurst } from "../../src/ui/CheckInCelebration";
import { SyncFallback } from "../../src/ui/SyncScreen";
import { NumericCheckInModal } from "../../src/ui/today/NumericCheckInModal";
import { TodayDashboard } from "../../src/ui/today/TodayDashboard";
import { useTodayController } from "../../src/ui/today/useTodayController";
import { XpGainLabel } from "../../src/ui/XpGainLabel";

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const view = useTodayController();
  const { setFullCelebration, setMiniBurst } = view;
  const hideMiniBurst = useCallback(() => setMiniBurst(null), [setMiniBurst]);
  const hideFullCelebration = useCallback(() => setFullCelebration(null), [setFullCelebration]);
  if (view.status !== "ready") {
    return <SyncFallback status={view.status} errorMessage={view.errorMessage} onRetry={view.reload} />;
  }
  return (
    <>
      <TodayDashboard
        habits={view.habits}
        remaining={view.remaining}
        done={view.done}
        completedCount={view.completedIds.size}
        streaks={view.streaks}
        todayCheckIns={view.checkInsByHabit}
        completers={view.completers}
        people={view.people}
        hasPartner={view.couple.partner !== null}
        island={view.island}
        xpBalance={view.xpBalance}
        xpAccessory={view.xpGain ? (
          <XpGainLabel amount={view.xpGain.amount} playKey={view.xpGain.key} onFinish={() => view.setXpGain(null)} />
        ) : null}
        weekDoneKeys={view.weekDoneKeys}
        undoNow={view.undoNow}
        isUndoing={view.isUndoing}
        onStartComplete={view.startComplete}
        onCelebrate={view.showMiniBurst}
        onUndo={(habit, checkIn) => void view.undo(habit, checkIn)}
      />
      <NumericCheckInModal
        habit={view.numericHabit}
        value={view.numericValue}
        bottomInset={insets.bottom}
        onChange={view.setNumericValue}
        onCancel={view.cancelNumeric}
        onComplete={(habit, value) => void view.complete(habit, value, true)}
      />
      <MiniCheckInBurst trigger={view.miniBurst} onFinish={hideMiniBurst} />
      <CheckInCelebration celebration={view.fullCelebration} onFinish={hideFullCelebration} />
    </>
  );
}
