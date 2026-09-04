import test from "node:test";
import assert from "node:assert/strict";

import { selectCaptionTrack } from "../captions.js";
import { convertCaptions, parseSrt, parseVtt } from "../caption-formats.js";
import { apiSchema } from "../../schema.js";

const sample = `\uFEFFWEBVTT\r
\r
NOTE generated fixture\r
ignored\r
\r
first cue\r
00:00.000 --> 00:02.500 align:start position:0%\r
<c.colorE5E5E5>Hello &amp; welcome</c>\r
\r
00:02.500 --> 00:04.000\r
Hello &amp; welcome back\r
\r
00:04.000 --> 00:06.250\r
<v Speaker>Final line</v>\r
`;

const sampleSrt = `1\r
00:00:00,000 --> 00:00:02,500\r
Hello &amp; welcome\r
\r
2\r
00:00:02,500 --> 00:00:04,000\r
Final line\r
`;

test("parseVtt extracts and cleans cues", () => {
    assert.deepEqual(parseVtt(sample), [
        { start: "00:00.000", end: "00:02.500", text: "Hello & welcome" },
        { start: "00:02.500", end: "00:04.000", text: "Hello & welcome back" },
        { start: "00:04.000", end: "00:06.250", text: "Final line" },
    ]);
});

test("SRT input converts to transcripts and VTT", () => {
    assert.equal(parseSrt(sampleSrt).length, 2);
    assert.equal(
        convertCaptions(sampleSrt, "txt", {}, "srt"),
        "Hello & welcome\n\nFinal line\n"
    );
    assert.match(
        convertCaptions(sampleSrt, "vtt", {}, "srt"),
        /^WEBVTT\n\n00:00:00\.000 --> 00:00:02\.500/
    );
});

test("plain text collapses growing automatic-caption cues", () => {
    assert.equal(
        convertCaptions(sample, "txt"),
        "Hello & welcome back\n\nFinal line\n"
    );
});

test("SRT output numbers cues and converts timestamps", () => {
    assert.match(convertCaptions(sample, "srt"), /^1\n00:00:00,000 --> 00:00:02,500/);
    assert.match(convertCaptions(sample, "srt"), /3\n00:00:04,000 --> 00:00:06,250\nFinal line\n$/);
});

test("Markdown output includes escaped metadata and transcript", () => {
    const markdown = convertCaptions(sample, "md", {
        title: "A *small* test",
        author: "cobalt",
        language: "en",
        source: "https://www.youtube.com/watch?v=abc",
    });

    assert.match(markdown, /^# A \\\*small\\\* test/);
    assert.match(markdown, /language: en/);
    assert.match(markdown, /source: <https:\/\/www\.youtube\.com\/watch\?v=abc>/);
});

test("VTT output is passed through with normalized newlines", () => {
    const output = convertCaptions(sample, "vtt");
    assert.ok(output.startsWith("WEBVTT\n"));
    assert.ok(!output.includes("\r"));
});

test("caption selection prefers manual tracks and matches base languages", () => {
    const tracks = [
        { language_code: "en-US", kind: "asr" },
        { language_code: "en-GB" },
        { language_code: "fr" },
    ];

    assert.equal(selectCaptionTrack(tracks, "en", true), tracks[1]);
    assert.equal(selectCaptionTrack(tracks, "en-AU", true), tracks[1]);
    assert.equal(selectCaptionTrack(tracks, "en-US", false), undefined);
    assert.equal(selectCaptionTrack(tracks, undefined, true), tracks[1]);
    assert.equal(selectCaptionTrack(tracks, "de", true), undefined);
});

test("empty and unknown caption formats fail", () => {
    assert.throws(() => convertCaptions("WEBVTT\n", "txt"));
    assert.throws(() => convertCaptions(sample, "json"));
});

test("caption API requests default to plain text and reject unknown formats", () => {
    const parsed = apiSchema.safeParse({
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        downloadMode: "captions",
    });

    assert.equal(parsed.success, true);
    assert.equal(parsed.data.captionFormat, "txt");
    assert.equal(parsed.data.downloadMode, "captions");

    assert.equal(apiSchema.safeParse({
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        downloadMode: "captions",
        captionFormat: "json",
    }).success, false);
});
