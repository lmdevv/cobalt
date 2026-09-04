const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
};

const decodeEntities = text => text.replace(
    /&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi,
    (entity, value) => {
        if (value[0] !== "#") {
            return namedEntities[value.toLowerCase()] ?? entity;
        }

        const hex = value[1]?.toLowerCase() === "x";
        const codePoint = Number.parseInt(value.slice(hex ? 2 : 1), hex ? 16 : 10);
        try {
            return String.fromCodePoint(codePoint);
        } catch {
            return entity;
        }
    }
);

const cleanCueText = text => decodeEntities(
    text
        .replace(/<\d{2}:\d{2}(?::\d{2})?\.\d{3}>/g, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
).split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .join("\n");

export const parseVtt = input => {
    const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const blocks = normalized.split(/\n{2,}/);
    const cues = [];

    for (const block of blocks) {
        const lines = block.split("\n").map(line => line.trimEnd());
        if (!lines.length || /^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) {
            continue;
        }

        const timingIndex = lines.findIndex(line => line.includes(" --> "));
        if (timingIndex < 0) continue;

        const timing = lines[timingIndex].match(
            /^(\d{2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(\d{2}:)?\d{2}:\d{2}\.\d{3}/
        )?.[0];
        if (!timing) continue;

        const [ start, end ] = timing.split(/\s+-->\s+/);
        const text = cleanCueText(lines.slice(timingIndex + 1).join("\n"));
        if (text) cues.push({ start, end, text });
    }

    return cues;
};

const transcriptLines = cues => {
    const lines = [];
    for (const cue of cues) {
        const text = cue.text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
        if (!text || lines.at(-1) === text) continue;

        if (lines.length && text.startsWith(`${lines.at(-1)} `)) {
            lines[lines.length - 1] = text;
        } else {
            lines.push(text);
        }
    }
    return lines;
};

const srtTimestamp = timestamp => {
    const withHours = timestamp.split(":").length === 2 ? `00:${timestamp}` : timestamp;
    return withHours.replace(".", ",");
};

const escapeMarkdown = value => value.replace(/[\\`*_{}\[\]<>#+.!|~-]/g, "\\$&");

export const convertCaptions = (vtt, format, metadata = {}) => {
    if (format === "vtt") {
        return vtt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    }

    const cues = parseVtt(vtt);
    if (!cues.length) throw new Error("caption file has no cues");

    if (format === "srt") {
        return cues.map((cue, index) => [
            index + 1,
            `${srtTimestamp(cue.start)} --> ${srtTimestamp(cue.end)}`,
            cue.text,
        ].join("\n")).join("\n\n") + "\n";
    }

    const transcript = transcriptLines(cues);
    if (format === "txt") return transcript.join("\n\n") + "\n";

    if (format === "md") {
        const heading = `# ${escapeMarkdown(metadata.title || "Transcript")}`;
        const details = [
            metadata.author && `author: ${escapeMarkdown(metadata.author)}`,
            metadata.language && `language: ${escapeMarkdown(metadata.language)}`,
            metadata.source && `source: <${metadata.source}>`,
        ].filter(Boolean);

        return [ heading, ...details, ...transcript.map(escapeMarkdown) ].join("\n\n") + "\n";
    }

    throw new Error("unsupported caption format");
};
