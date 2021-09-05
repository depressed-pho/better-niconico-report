import * as Bacon from 'baconjs';
import { UnauthorizedError } from 'nicovideo/errors';
import { ReportID, ReportChunk, ReportEntry, getReportChunk } from 'nicovideo/report';
import { ConfigModel } from './config-model';
import { ReportDatabase } from './report-db';

export class ReportEvent {}

/** Move the insertion point to the top of the report.
 */
export class ResetInsertionPointEvent extends ReportEvent {
    public constructor() { super() }
}

/** Insert a report entry at the current insertion point.
 */
export class InsertEntryEvent extends ReportEvent {
    public constructor(public readonly entry: ReportEntry) { super() }
}

/** Show the "end of report" marker.
 */
export class ShowEndOfReportEvent extends ReportEvent {
    public constructor() { super() }
}

/** Clear the report list and hide the "end of report" marker.
 */
export class ClearEntriesEvent extends ReportEvent {
    public constructor() { super() }
}

export class ReportModel {
    private readonly config: ConfigModel;
    private readonly database: ReportDatabase;

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
        this.database       = new ReportDatabase();
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
     * in the database.
     */
    private readDatabase(): Bacon.EventStream<ReportEvent> {
        return Bacon.fromBinder(sink => {
            let   abort   = false;
            const promise = (async () => {
                // FIXME: progress bar
                // FIXME: apply filter
                await this.database.each((entry) => {
                    sink(new Bacon.Next(new InsertEntryEvent(entry)));
                });
                sink(new Bacon.Next(new ShowEndOfReportEvent()));
            })();
            promise
                .catch(e => {
                    console.error(e);
                    sink(new Bacon.Error(e));
                })
                .then(() => sink(new Bacon.End()));
            return () => {
                abort = true;
            }
        });
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
                    if (abort) {
                        console.debug("Got an abort request. Exiting...");
                        return;
                    }
                    console.debug(
                        "Requesting a chunk of report " +
                            (skipDownTo ? `skipping down to ${skipDownTo}.` : "from the beginning."));

                    const chunk = await this.fetchChunkFromServer(skipDownTo);

                    console.debug(
                        "Got a chunk containing %i report entries.", chunk.entries.length);

                    for (const entry of chunk.entries) {
                        if (!await this.database.tryInsert(entry)) {
                            console.debug(
                                "Found an entry which was already in our database: %s", entry.id);
                            return;
                        }
                        sink(new Bacon.Next(new InsertEntryEvent(entry)));
                        // FIXME: Filter entries before sending them to the bus.
                        // FIXME: progress bar
                    }

                    if (chunk.hasNext) {
                        skipDownTo = chunk.oldestID;
                        await this.config
                            .delayBetweenConsecutiveFetch
                            .first()
                            .flatMap(delay => {
                                console.debug(
                                    "We are going to fetch the next chunk after %f seconds.", delay);
                                return Bacon.later(delay * 1000, null);
                            })
                            .firstToPromise();
                        return;//FIXME: delete this
                        continue;
                    }
                    else {
                        console.debug("It was the last report chunk available.");
                        return;
                    }
                }
            })();
            promise
                .catch(e => {
                    console.error(e);
                    sink(new Bacon.Error(e));
                })
                .then(() => sink(new Bacon.End()));
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
