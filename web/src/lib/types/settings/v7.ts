import type { SubtitleLang } from "$lib/settings/audio-sub-language";
import type { CobaltSettingsV6 } from "$lib/types/settings/v6";

export const captionFormatOptions = ["txt", "vtt", "srt", "md"] as const;
export const transcriptMethodOptions = ["ask", "download", "copy"] as const;

export type CobaltSettingsV7 = Omit<CobaltSettingsV6, "schemaVersion" | "save"> & {
    schemaVersion: 7,
    save: CobaltSettingsV6["save"] & {
        captionFormat: typeof captionFormatOptions[number],
        captionLang: SubtitleLang,
        transcriptMethod: typeof transcriptMethodOptions[number],
    },
};
