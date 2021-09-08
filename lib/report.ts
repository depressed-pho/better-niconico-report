import { UnauthorizedError } from 'nicovideo/errors';

export type ReportID = string;
export type UserID   = string;
export type Activity =
    "advertise" | "reserve-broadcast" | "broadcast" | "get-magic-number" |
    "like" | "list" | "upload" | "unknown";
export type ObjectType =
    "video" | "stream" | "image" | "comic" | "article" | "model" | "game" | "unknown"

export interface ReportChunk {
    newestID: ReportID,
    oldestID: ReportID,
    hasNext: boolean,
    entries: [ReportEntry]
}

export interface ReportEntry {
    id: ReportID,
    title: string, // Human-readable title of the entry, possibly in HTML.
    timestamp: Date,
    subject: User,
    activity: Activity,
    object?: ReportObject
}

export interface User {
    id: UserID,
    url: string,
    name: string,
    iconURL: string
}

export interface ReportObject {
    type: ObjectType,
    url: string,
    title: string,
    thumbURL: string
}

export async function getReportChunk(skipDownTo?: ReportID): Promise<ReportChunk> {
    const URL = "https://public.api.nicovideo.jp/v1/timelines/nicorepo/last-1-month/my/pc/entries.json"
        + (skipDownTo ? `?untilId=${skipDownTo}` : '');
    const res = await fetch(URL, {
        method: "GET",
        mode: "cors",
        credentials: "include"
    });
    if (res.ok) {
        const json = await res.json();

        console.assert(typeof json.meta.maxId   === "string" , json.meta);
        console.assert(typeof json.meta.minId   === "string" , json.meta);
        console.assert(typeof json.meta.hasNext === "boolean", json.meta);
        console.assert(json.data instanceof Array, json);
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
    console.assert(typeof json.id          === "string", json);
    console.assert(typeof json.title       === "string", json);
    console.assert(typeof json.muteContext === "object", json);
    console.assert(typeof json.muteContext.trigger === "string", json.muteContext);
    if (json.object) {
        console.assert(typeof json.object === "object", json);
    }
    return {
        id: json.id,
        title: json.title,
        timestamp: new Date(json.updated), // Should be in W3C DTF.
        subject: parseSubject(json.muteContext, json.actor),
        activity: parseActivity(json.muteContext.trigger),
        object: json.object ? parseObject(json.object) : undefined
    };
}

function parseSubject(jsonCtx: any, jsonActor: any): User {
    console.assert(typeof jsonCtx.sender.id === "string", jsonCtx);
    console.assert(typeof jsonActor.url     === "string", jsonActor);
    console.assert(typeof jsonActor.name    === "string", jsonActor);
    console.assert(typeof jsonActor.icon    === "string", jsonActor);
    return {
        id: jsonCtx.sender.id,
        url: jsonActor.url,
        name: jsonActor.name,
        iconURL: jsonActor.icon
    };
}

function parseActivity(trigger: string): Activity {
    switch (trigger) {
        case "illustImage.nicoad_user_advertise_illust":
        case "game.nicoad_user_advertise_game":
        case "program.nicoad_user_advertise_program":
        case "solid.nicoad_user_advertise_solid":
        case "video.nicoad_user_advertise_video":
            return "advertise";

        case "program.live_channel_program_reserve":
        case "program.live_user_program_reserve":
        case "program.live_user_program_video_live_reserve":
            return "reserve-broadcast";

        case "program.live_channel_program_onairs":
        case "program.live_user_program_onairs":
        case "program.live_user_program_video_live_onairs":
            return "broadcast";

        case "video.nicovideo_user_video_kiriban_play":
            return "get-magic-number";

        case "video.nicovideo_video_first_liked_by_user":
            return "like";

        case "community.nicommunity_user_video_registered":
        case "illustImage.nicoseiga_user_illust_clip":
        case "mangaContent.nicoseiga_user_manga_content_favorite":
        case "mylist.nicovideo_user_mylist_add_video":
        case "solid.nicovideo_user_solid_favorite":
            return "list";

        case "channelArticle.nicovideo_user_blomaga_upload":
        case "channelArticle.blomaga_channel_channel_article_publish":
        case "community.nicommunity_user_community_news_created":
        case "game.nicogame_user_game_update":
        case "game.nicogame_user_game_upload":
        case "illustImage.nicoseiga_user_illust_upload":
        case "solid.nicovideo_user_solid_upload":
        case "video.nicovideo_channel_video_upload":
        case "video.nicovideo_user_video_upload":
            return "upload";

        default:
            console.warn("Unknown activity:", trigger);
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
                case "comicStory":
                    return "comic";
                case "article":
                    return "article";
                case "3DModel":
                case "solid":
                    return "model";
                case "game":
                    return "game";
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
