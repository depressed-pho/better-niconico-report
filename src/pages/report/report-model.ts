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
            }
        });
    }

    /** Create a stream of ReportEvent reading all the report entries
     * in database.
     */
    private readDatabase(): Bacon.EventStream<ReportEvent> {
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
                thumbURL: "https://nicovideo.cdn.nimg.jp/thumbnails/38451158/38451158.6981162.M"
            }
        }));
    }

    /** Create a stream of ReportEvent from a singleton stream of
     * fetch trigger FIXME
     */
    private fetchFromServer(): Bacon.EventStream<ReportEvent> {
        return Bacon.never<ReportEvent>();//FIXME
    }

    /** Create a stream of ReportChunk from a stream of fetch requests
     * i.e. skipDownTo?: ReportID) while preserving the order of the
     * requests.
     */
    private mapChunkRequests(requests: Bacon.EventStream<ReportID|undefined>): Bacon.EventStream<ReportChunk> {
        /* Note that we don't actually need to preserve the order,
         * because we never post a new request before receiving a
         * response for an old request. This is only for safety.
         */
        return Bacon.fromBinder(sink => {
            const queue: (ReportChunk | null)[] = [];
            const unsub = requests.subscribe(ev => {
                if (ev instanceof Bacon.End || ev instanceof Bacon.Error) {
                    sink(ev as any);
                }
                else if (ev instanceof Bacon.Value) {
                    queue.push(null);
                    const idx = queue.length-1;

                    this.fetchChunkFromServer(ev.value)
                        .then(chunk => {
                            queue[idx] = chunk;

                            // Flush the queue up to the first null.
                            let i = 0;
                            for (; i < queue.length; ) {
                                if (queue[idx]) {
                                    sink(new Bacon.Next(queue[i]!));
                                    i++;
                                }
                                else {
                                    break;
                                }
                            }
                            queue.splice(0, i);
                        })
                        .catch(e => sink(new Bacon.Error(e)));
                }
                else {
                    throw new Error("Unknown Bacon event type: " + ev.constructor.name);
                }
            });
            return unsub;
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
