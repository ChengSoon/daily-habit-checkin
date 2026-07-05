# V1 MVP Verification Checklist

- [ ] App launches on iOS simulator or Android emulator through Expo.
- [ ] App launches on a physical device through Expo Go.
- [ ] User can create a habit from AI plan preview.
- [ ] AI failure is shown as an error message and does not crash the app.
- [ ] Today tab lists active habits.
- [ ] User can complete a check-in with one tap.
- [ ] Numeric habits ask for a value before completion.
- [ ] Completed check-in persists after app reload.
- [ ] Habit detail shows current streak and completion rate.
- [ ] Habit reminder permission can be requested.
- [ ] Habit reminder can be scheduled on a real device.
- [ ] Evening summary reminder can be enabled and configured.
- [ ] Profile tab explains AI data use and local-first privacy.

## Current Environment Notes

- Automated TypeScript, lint, and unit tests can run on this machine.
- Expo Go QR service can start on this machine.
- iOS simulator cannot be verified yet because `/Applications/Xcode.app` is installed but Apple Xcode license has not been accepted; `simctl` is blocked until `sudo xcodebuild -license` is completed in Terminal.
- Android emulator cannot be verified here because Android SDK tools are unavailable.
- Local notification delivery still needs verification on a real mobile device.
- AI generation still needs verification with an OpenAI account that has available quota.
