import * as Bacon from 'baconjs';
import { UnauthorizedError } from 'nicovideo/errors';
import { ReportID, ReportChunk, ReportEntry, getReportChunk } from 'nicovideo/report';
import { ConfigModel } from './config-model';

export class ReportEvent {}

/** Append a report entry at the end of the list.
 */
export class AppendEntryEvent extends ReportEvent {
    public constructor(public readonly entry: ReportEntry) { super() }
}

/** Clear the report list.
 */
export class ClearEntriesEvent extends ReportEvent {
    public constructor() { super() }
}

export class ReportModel {
    private readonly config: ConfigModel;

    /* Events telling the ReportView to what to do about the entry
     * list. */
    private readonly reportEventBus: Bacon.Bus<ReportEvent>;
    public readonly reportEvents: Bacon.EventStream<ReportEvent>;

    /* An async function to authenticate the user.
     */
    private authenticate: () => Promise<void>;

    /* A function to unplug the currently active report source. Called
     * on refresh. */
    private unplugReportSource?: () => void;

    public constructor(config: ConfigModel, authenticate: () => Promise<void>) {
        this.config         = config;
        this.authenticate   = authenticate;
        this.reportEventBus = new Bacon.Bus<ReportEvent>();
        this.reportEvents   = this.reportEventBus.toEventStream();

        this.reportEventBus.plug(this.spawnReportSource());
    }

    private spawnReportSource(): Bacon.EventStream<ReportEvent> {
        /* The report event stream is a concatenation of infinitely
         * many streams:
         *
         * 0. The entire database.
         *
         * 1. The report from the server from the beginning up until
         *    the first entry that is already in the database. There
         *    will be a silence between each chunk requests.
         *
         * 2. Silence for the polling interval, then repeat from 1.
         */
        return Bacon.repeat(i => {
            switch (i) {
                case 0:
                    return this.readDatabase();

                case 1:
                    return this.fetchFromServer();

                default:
                    console.log("the end of report source");// FIXME
            }
        });
    }

    /** Create a stream of ReportEvent reading all the report entries
     * in database.
     */
    private readDatabase(): Bacon.EventStream<ReportEvent> {
        /*
        // FIXME
        return Bacon.once(new AppendEntryEvent({
            id: "",
            title: "did something",
            timestamp: new Date(),
            subject: {
                id: "64011",
                url: "https://www.nicovideo.jp/user/64011",
                name: "玉ねぎ修字",
                iconURL: "https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/6/64011.jpg?1559446191"
            },
            action: "liked",
            object: {
                type: "video",
                url: "https://www.nicovideo.jp/watch/sm38451158?ref=pc_mypage_nicorepo",
                title: "クッキーク六花ー",
                //thumbURL: "https://nicovideo.cdn.nimg.jp/thumbnails/38451158/38451158.6981162.M"
                thumbURL: "https://secure-dcdn.cdn.nimg.jp/comch/channel-icon/128x128/ch2584920.jpg?1594468317"
            }
        }));
        */
        return Bacon.never<ReportEvent>();//FIXME
    }

    /** Create a stream of ReportEvent fetching from the server from
     * the beginning up until the first entry that is already in the
     * database. There will be a silence between each chunk requests.
     */
    private fetchFromServer(): Bacon.EventStream<ReportEvent> {
        return Bacon.fromBinder(sink => {
            let   abort   = false;
            const promise = (async () => {
                let skipDownTo: ReportID|undefined;
                while (true) {
                    console.debug(
                        "Requesting a chunk of report " +
                            (skipDownTo ? `skipping down to ${skipDownTo}.` : "from the beginning."));

                    const chunk = await this.fetchChunkFromServer(skipDownTo);

                    console.debug(
                        "Got a chunk containing %i report entries.", chunk.entries.length);

                    for (const entry of chunk.entries) {
                        this.reportEventBus.push(new AppendEntryEvent(entry));
                        // FIXME: progress bar
                        // FIXME: break when the entry is in the database.
                    }

                    if (chunk.hasNext) {
                        skipDownTo = chunk.oldestID;
                        await this.config
                            .delayBetweenConsecutiveFetch
                            .first()
                            .flatMap(delay => {
                                console.log(
                                    "We are going to fetch the next chunk after %f seconds.", delay);
                                return Bacon.later(delay * 1000, null);
                            })
                            .firstToPromise();
                        //break;//FIXME: delete this
                        continue;
                    }
                    else {
                        console.debug("It was the last report chunk available.");
                        break;
                    }
                }
            })();
            promise.catch((e) => {
                console.error(e);
                sink(new Bacon.Error(e));
            });
            return () => {
                abort = true;
            };
        });
    }

    /** Create a Promise resolving to a fetched ReportChunk with
     * optionally skipping down to a given ID. Invoke the
     * authentication callback when necessary.
     */
    private async fetchChunkFromServer(skipDownTo?: ReportID): Promise<ReportChunk> {
        while (true) {
            try {
                return await getReportChunk(skipDownTo);
            }
            catch (e) {
                if (e instanceof UnauthorizedError) {
                    await this.authenticate();
                    continue;
                }
                else {
                    throw e;
                }
            }
        }
    }

    /* Discard all the entries in the database and reload them from
     * the server.
     */
    public refresh(): void {
        /* Unplug the report source so that no report events will be
         * sent through the bus. */
        if (this.unplugReportSource) {
            this.unplugReportSource();
            this.unplugReportSource = undefined;
        }

        // FIXME: clear the database

        // Tell the report view to clear the report.
        this.reportEventBus.push(new ClearEntriesEvent());

        // FIXME: reload from the server
    }
}
