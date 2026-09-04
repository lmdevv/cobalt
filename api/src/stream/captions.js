import { Agent, request } from "undici";
import { create as contentDisposition } from "content-disposition-header";

import { closeRequest, closeResponse } from "./shared.js";
import { destroyInternalStream } from "./manage.js";
import { convertCaptions } from "../processing/helpers/caption-formats.js";

const defaultAgent = new Agent();
const maxCaptionSize = 8 * 1024 * 1024;

const contentTypes = {
    md: "text/markdown; charset=utf-8",
    srt: "application/x-subrip; charset=utf-8",
    txt: "text/plain; charset=utf-8",
    vtt: "text/vtt; charset=utf-8",
};

export default async function captions(streamInfo, res) {
    const abortController = new AbortController();
    const shutdown = () => (
        closeRequest(abortController),
        closeResponse(res),
        destroyInternalStream(streamInfo.urls)
    );

    try {
        const response = await request(streamInfo.urls, {
            signal: abortController.signal,
            maxRedirections: 4,
            dispatcher: defaultAgent,
            headers: streamInfo.headers,
        });

        if (response.statusCode < 200 || response.statusCode > 299) {
            return shutdown();
        }

        const declaredSize = Number(response.headers["content-length"]);
        if (declaredSize > maxCaptionSize) {
            res.status(413).end();
            return shutdown();
        }

        const chunks = [];
        let size = 0;
        for await (const chunk of response.body) {
            size += chunk.length;
            if (size > maxCaptionSize) {
                res.status(413).end();
                return shutdown();
            }
            chunks.push(chunk);
        }

        const body = convertCaptions(
            Buffer.concat(chunks).toString("utf8"),
            streamInfo.captionFormat,
            streamInfo.captionMetadata
        );

        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Content-Disposition", contentDisposition(streamInfo.filename));
        res.setHeader("Content-Type", contentTypes[streamInfo.captionFormat]);
        res.setHeader("Content-Length", Buffer.byteLength(body));
        res.status(200).send(body);
        destroyInternalStream(streamInfo.urls);
    } catch {
        shutdown();
    }
}
