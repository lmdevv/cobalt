const normalizedLanguage = language => language?.toLowerCase().replace("_", "-");

export const createCaptionResponse = ({
    url,
    format,
    language,
    service,
    id,
    title,
    author,
    source,
    headers,
}) => ({
    type: "captions",
    isCaptionOnly: true,
    urls: url,
    headers,
    captionFormat: format,
    captionLanguage: language,
    filenameAttributes: {
        service,
        id,
        title: title || `${service}_${id}`,
        author,
    },
    captionMetadata: {
        title,
        author,
        language,
        source,
    },
});

export const selectCaptionTrack = (tracks, subtitleLang, allowAutomatic = false) => {
    const allowed = tracks.filter(track => allowAutomatic || track.kind !== "asr");
    if (!allowed.length) return;

    const requested = normalizedLanguage(subtitleLang);
    if (!requested) {
        return allowed.find(track => track.kind !== "asr") || allowed[0];
    }

    const matching = allowed.filter(track => {
        const language = normalizedLanguage(track.language_code);
        const baseLanguage = language?.split("-")[0];
        const requestedBase = requested.split("-")[0];
        return language === requested
            || language?.startsWith(`${requested}-`)
            || requested.startsWith(`${language}-`)
            || (allowAutomatic && baseLanguage === requestedBase);
    });

    return matching.find(track => track.kind !== "asr") || matching[0];
};
