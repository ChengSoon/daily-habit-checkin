const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod, createRunOncePlugin } = require("expo/config-plugins");

const UTF8_MARKER = "# daily-habit-checkin: normalize CocoaPods command output";
const SQLITE_HEADER_MARKER = "# daily-habit-checkin: disambiguate ExpoSQLite vendored header";

const UTF8_PATCH = `
${UTF8_MARKER}
module DailyHabitCheckinPodEncoding
  def execute_command(*args)
    super(*args).to_s.force_encoding(Encoding::UTF_8)
  end
end
Pod::Executable.singleton_class.prepend(DailyHabitCheckinPodEncoding)
`;

const SQLITE_HEADER_PATCH = `
${SQLITE_HEADER_MARKER}
module DailyHabitCheckinExpoSQLiteHeader
  def generate
    content = super
    return content unless target.product_module_name == 'ExpoSQLite'

    content.gsub('#import "sqlite3.h"', '#import <ExpoSQLite/sqlite3.h>')
  end
end
Pod::Generator::UmbrellaHeader.prepend(DailyHabitCheckinExpoSQLiteHeader)
`;

function withUtf8PodExec(config) {
  return withDangerousMod(config, ["ios", async (modConfig) => {
    const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile");
    if (!fs.existsSync(podfilePath)) return modConfig;

    const podfile = fs.readFileSync(podfilePath, "utf8");
    const patches = [];
    if (!podfile.includes(UTF8_MARKER)) patches.push(UTF8_PATCH);
    if (!podfile.includes(SQLITE_HEADER_MARKER)) patches.push(SQLITE_HEADER_PATCH);
    if (patches.length === 0) return modConfig;

    fs.writeFileSync(podfilePath, `${patches.join("")}${podfile}`, "utf8");
    return modConfig;
  }]);
}

module.exports = createRunOncePlugin(withUtf8PodExec, "with-utf8-pod-exec", "1.1.0");
