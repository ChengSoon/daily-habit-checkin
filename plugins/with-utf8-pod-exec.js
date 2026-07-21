const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod, createRunOncePlugin } = require("expo/config-plugins");

const MARKER = "# daily-habit-checkin: normalize CocoaPods command output";

function withUtf8PodExec(config) {
  return withDangerousMod(config, ["ios", async (modConfig) => {
    const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile");
    if (!fs.existsSync(podfilePath)) return modConfig;

    const podfile = fs.readFileSync(podfilePath, "utf8");
    if (podfile.includes(MARKER)) return modConfig;

    const patch = `
${MARKER}
module DailyHabitCheckinPodEncoding
  def execute_command(*args)
    super(*args).to_s.force_encoding(Encoding::UTF_8)
  end
end
Pod::Executable.singleton_class.prepend(DailyHabitCheckinPodEncoding)
`;
    fs.writeFileSync(podfilePath, `${patch}${podfile}`, "utf8");
    return modConfig;
  }]);
}

module.exports = createRunOncePlugin(withUtf8PodExec, "with-utf8-pod-exec", "1.0.0");
