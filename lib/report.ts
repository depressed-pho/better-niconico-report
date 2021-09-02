import { UnauthorizedError } from 'nicovideo/errors';

export type ReportID = string;
export type Action =
    "advertised" | "reserved-broadcast" | "broadcasted" | "got-magic-number" |
    "liked" | "listed" | "uploaded" | "unknown";

export interface ReportEntries {
    newestID: ReportID,
    oldestID: ReportID,
    hasNext: boolean,
    entries: [ReportEntry]
}

export interface ReportEntry {
    id: string,
    title: string, // Human-readable title of the entry, possibly in HTML.
    timestamp: Date,
    subject: User,
    action: Action,
    object: ReportObject
}

export interface User {
    id: string,
    url: string,
    name: string,
    iconURL: string
}

export interface ReportObject {
    type: "video" | "stream" | "image" | "unknown",
    url: string,
    title: string,
    thumbURL: string
}

export async function getReport(skipDownTo?: ReportID): Promise<ReportEntries> {
    const URL = "https://public.api.nicovideo.jp/v1/timelines/nicorepo/last-1-month/my/pc/entries.json"
        + (skipDownTo ? `?untilId=${skipDownTo}` : '');
    const res = await fetch(URL, {
        method: "GET",
        mode: "cors",
        credentials: "include"
    });
    if (res.ok) {
        const json = await res.json();

        console.assert(typeof(json.meta.maxId) === "string", json.meta);
        console.assert(typeof(json.meta.minId) === "string", json.meta);
        console.assert(typeof(json.meta.hasNext) === "boolean", json.meta);
        return {
            newestID: json.meta.maxId,
            oldestID: json.meta.minId,
            hasNext:  json.meta.hasNext,
            entries:  json.data.map(parseEntry)
        };
    }
    else {
        throw new UnauthorizedError();
    }
}

function parseEntry(json: any): ReportEntry {
    console.assert(typeof(json.id) === "string", json);
    console.assert(typeof(json.title) === "string", json);
    console.assert(typeof(json.muteContext.trigger) === "string", json);
    return {
        id: json.id,
        title: json.title,
        timestamp: new Date(json.updated), // Should be in W3C DTF.
        subject: parseSubject(json.muteContext, json.actor),
        action: parseAction(json.muteContext.trigger),
        object: parseObject(json.object)
    };
}

function parseSubject(jsonCtx: any, jsonActor: any): User {
    console.assert(typeof(jsonCtx.sender.id) === "string", jsonCtx);
    console.assert(typeof(jsonActor.url) === "string", jsonActor);
    console.assert(typeof(jsonActor.name) === "string", jsonActor);
    console.assert(typeof(jsonActor.icon) === "string", jsonActor);
    return {
        id: jsonCtx.sender.id,
        url: jsonActor.url,
        name: jsonActor.name,
        iconURL: jsonActor.icon
    };
}

function parseAction(trigger: string): Action {
    switch (trigger) {
        case "program.nicoad_user_advertise_program":
        case "video.nicoad_user_advertise_video":
            return "advertised";

        case "program.live_user_program_reserve":
            return "reserved-broadcast";

        case "program.live_channel_program_onairs":
        case "program.live_user_program_onairs":
            return "broadcasted";

        case "video.nicovideo_user_video_kiriban_play":
            return "got-magic-number";

        case "video.nicovideo_video_first_liked_by_user":
            return "liked";

        case "mylist.nicovideo_user_mylist_add_video":
            return "listed";

        case "illustImage.nicoseiga_user_illust_upload":
        case "video.nicovideo_user_video_upload":
            return "uploaded";

        default:
            console.warn("Unknown action:", trigger);
            return "unknown";
    }
}

function parseObject(json: any): ReportObject {
    console.assert(typeof(json.url) === "string", json);
    console.assert(typeof(json.name) === "string", json);
    console.assert(typeof(json.image) === "string", json);
    return {
        type: (() => {
            switch (json.type) {
                case "video":
                    return "video";
                case "program":
                    return "stream";
                case "image":
                    return "image";
                default:
                    console.warn("Unknown object type:", json);
                    return "unknown";
            }
        })(),
        url: json.url,
        title: json.name,
        thumbURL: json.image
    };
}
