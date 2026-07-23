import { describe, expect, it } from "vitest";
import { sanitizeSettingsForExport } from "./exportData";

describe("export settings", () => {
  it("never includes the AI API key", () => {
    const exported = sanitizeSettingsForExport({
      isEveningSummaryEnabled: true,
      eveningSummaryTime: "21:30",
      themeMode: "system",
      themeName: "romance",
      isQuietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      aiBaseUrl: "https://api.example.com/v1",
      aiApiKey: "sk-sensitive",
      aiModel: "example-model"
    });

    expect(exported).not.toHaveProperty("aiApiKey");
    expect(exported).toMatchObject({ aiBaseUrl: "https://api.example.com/v1", aiModel: "example-model" });
  });
});
