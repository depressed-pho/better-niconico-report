import { UnauthorizedError } from 'nicovideo/errors';

export type ReportID = string;

export interface ReportEntry {
}

export interface ReportEntries {
    newestID: ReportID,
    oldestID: ReportID,
    hasNext: boolean,
    entries: [ReportEntry]
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
        throw "FIXME";
    }
    else {
        throw new UnauthorizedError();
    }
}
