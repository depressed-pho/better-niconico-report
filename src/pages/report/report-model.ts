import * as Bacon from 'baconjs';
import { UnauthorizedError } from 'nicovideo/errors';
import { ReportID, ReportChunk, ReportEntry, getReportChunk } from 'nicovideo/report';
import { ConfigModel } from './config-model';
import { ReportDatabase } from './report-db';

const DEBUG_FETCH_ONLY_THE_FIRST_CHUNK = true;

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

/** Delete a report entry with the given ID.
 */
export class DeleteEntryEvent extends ReportEvent {
    public constructor(public readonly id: ReportID) { super() }
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

/** Show the progress bar with given progress [0, 1), or hide when 1.
 */
export class UpdateProgressEvent extends ReportEvent {
    public constructor(public readonly progress: number) { super() }
}

/** Enable or disable the update button.
*/
export class SetUpdatingAllowed extends ReportEvent {
    public constructor(public readonly isAllowed: boolean) { super() }
}

export class ReportModel {
    private readonly config: ConfigModel;
    private readonly database: ReportDatabase;

    /* Events telling the ReportView to what to do about the entry
     * list. */
    private readonly reportEventBus: Bacon.Bus<ReportEvent>;
    public readonly reportEvents: Bacon.EventStream<ReportEvent>;

    /* Events telling the model to trigger checking for updates.
     */
    private readonly updateRequested: Bacon.Bus<null>;

    /* An async function to authenticate the user.
     */
    private authenticate: () => Promise<void>;

    /* A function to unplug the currently active report source. Called
     * on refresh. */
    private unplugReportSource?: () => void;

    public constructor(config: ConfigModel, authenticate: () => Promise<void>) {
        this.config          = config;
        this.authenticate    = authenticate;
        this.database        = new ReportDatabase();
        this.reportEventBus  = new Bacon.Bus<ReportEvent>();
        this.reportEvents    = this.reportEventBus.toEventStream();
        this.updateRequested = new Bacon.Bus<null>();

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
                    // Construct an EventStream which emits null after
                    // some interval. Downstream can stop waiting on
                    // its first event. This is so that we can respond
                    // to interval changes even while in the interval.
                    const intervalStartedAt = Date.now();
                    const interval =
                        Bacon.mergeAll([
                            this.config.intervalBetweenPolling,
                            this.updateRequested.map(() => 0)
                        ]).flatMap(delay => {
                            const delayedSoFar = Date.now() - intervalStartedAt;
                            const remaining    = Math.max(0, delay * 1000 - delayedSoFar);
                            console.debug(
                                "We are going to poll the server for updates after %f seconds.", remaining / 1000);
                            return Bacon.later(remaining, null);
                        });
                    return interval.first().flatMap(() => this.fetchFromServer());
            }
        });
    }

    private standardExpirationDate(): Date {
        const d = new Date();
        d.setMonth(d.getMonth()-1, d.getDate());
        // The beginning of the day. The upstream uses this for
        // whatever reason.
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /** Get the expiration date of reports based on the current
     * time. It is either 1 month ago from now, or 1 day ago from the
     * last visible entry, whichever is earlier. */
    private async expirationDate(): Promise<Date> {
        const expireAt = this.standardExpirationDate();

        const lastVis = this.config.getLastVisibleEntry();
        if (lastVis) {
            const entry = await this.database.lookup(lastVis);
            if (entry) {
                const d = new Date(entry.timestamp.getTime());
                d.setDate(d.getDate()-1); // FIXME: should be configurable
                return d.getTime() < expireAt.getTime() ? d : expireAt;
            }
        }

        return expireAt;
    }

    /** Create a stream of ReportEvent reading all the report entries
     * in the database.
     */
    private readDatabase(): Bacon.EventStream<ReportEvent> {
        return Bacon.fromBinder(sink => {
            let   abort   = false;
            const promise = (async () => {
                // FIXME: apply filter
                sink(new Bacon.Next(new SetUpdatingAllowed(false)));
                sink(new Bacon.Next(new UpdateProgressEvent(0)));
                await this.database.tx("rw", async () => {
                    /* Purge old entries before reading anything. We
                     * don't have to mess with DeleteEntryEvent
                     * because no entries are displayed at this
                     * point. */
                    const expireAt = await this.expirationDate();
                    await this.database.purge(expireAt);

                    const total = await this.database.count();
                    let   count = 0;
                    console.info("Loading %d entries from the database...", total);
                    await this.database.each((entry) => {
                        count++;
                        sink(new Bacon.Next(new InsertEntryEvent(entry)));
                        sink(new Bacon.Next(new UpdateProgressEvent(count / total)));
                    });
                    if (total > 0) {
                        /* We are going to fetch the report from the
                         * server, but since the database wasn't empty,
                         * there won't be any reports older than the ones
                         * in the database. */
                        sink(new Bacon.Next(new ShowEndOfReportEvent()));
                    }
                    sink(new Bacon.Next(new UpdateProgressEvent(1)));
                });
            })();
            promise
                .catch(e => {
                    console.error(e);
                    sink(new Bacon.Error(e));
                })
                .then(() => {
                    sink(new Bacon.Next(new ResetInsertionPointEvent()));
                    sink(new Bacon.Next(new UpdateProgressEvent(1)));
                    sink(new Bacon.End());
                });
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
                sink(new Bacon.Next(new SetUpdatingAllowed(false)));
                sink(new Bacon.Next(new UpdateProgressEvent(0)));

                /* Purge old entries before posting requests. */
                this.database.tx("rw", async () => {
                    const expireAt = await this.expirationDate();
                    await this.database.purge(expireAt, entry => {
                        sink(new Bacon.Next(new DeleteEntryEvent(entry.id)));
                    });
                });

                /* Some work for displaying the progress bar. This
                 * doesn't need to be in a transaction because it's
                 * only informational. */
                const started    : number = Date.now();
                const expectedEnd: number = await (async () => {
                    const newest = await this.database.newest();
                    if (newest) {
                        console.debug(
                            "The timestamp of the newest entry in the database is ", newest.timestamp);
                        return newest.timestamp.getTime();
                    }
                    else {
                        const d = this.standardExpirationDate();
                        console.debug("The timestamp of the last available entry is expected to be", d);
                        return d.getTime();
                    }
                })();

                /* Fetching the entire report takes very long, it can
                 * be very large, but we still have to store them to
                 * the database all at once nevertheless because
                 * otherwise we may end up in an inconsistent
                 * state. So we buffer all the entries and store them
                 * afterwards. */
                const newEntries: ReportEntry[] = [];
                let skipDownTo: ReportID|undefined;

                loop: while (true) {
                    if (abort) {
                        console.debug("Got an abort request. Exiting...");
                        break;
                    }

                    console.debug(
                        "Requesting a chunk of report " +
                            (skipDownTo ? `skipping down to ${skipDownTo}.` : "from the beginning."));
                    const chunk = await this.fetchChunkFromServer(skipDownTo);
                    console.debug(
                        "Got a chunk containing %i report entries.", chunk.entries.length);

                    for (const entry of chunk.entries) {
                        if (await this.database.exists(entry.id)) {
                            console.debug(
                                "Found an entry which was already in our database: %s", entry.id);
                            console.debug(
                                "We got %d new entries from the server.", newEntries.length);
                            break loop;
                        }
                        // FIXME: Filter entries before sending them to the bus.
                        sink(new Bacon.Next(new InsertEntryEvent(entry)));
                        sink(new Bacon.Next(new UpdateProgressEvent(
                            (started - entry.timestamp.getTime()) / (started - expectedEnd))));
                        newEntries.push(entry);
                    }

                    if (chunk.hasNext) {
                        skipDownTo = chunk.oldestID;

                        // Construct an EventStream which emits null
                        // after some interval. Downstream can stop
                        // waiting on its first event. This is so that
                        // we can respond to interval changes even while
                        // in the interval.
                        const intervalStartedAt = Date.now();
                        const interval =
                            this.config.delayBetweenConsecutiveFetch
                                .flatMap(delay => {
                                    const delayedSoFar = Date.now() - intervalStartedAt;
                                    const remaining    = Math.max(0, delay * 1000 - delayedSoFar);
                                    console.debug(
                                        "We are going to fetch the next chunk after %f seconds.", remaining / 1000);
                                    return Bacon.later(remaining, null);
                                });
                        await interval.firstToPromise();
                        if (DEBUG_FETCH_ONLY_THE_FIRST_CHUNK) {
                            break loop;
                        }
                        else {
                            continue loop;
                        }
                    }
                    else {
                        console.debug("It was the last report chunk available.");
                        console.debug("We got %d entries from the server.", newEntries.length);
                        sink(new Bacon.Next(new ShowEndOfReportEvent()));
                        break loop;
                    }
                }

                await this.database.tx("rw", async () => {
                    await this.database.bulkPut(newEntries);
                });
            })();
            promise
                .catch(e => {
                    console.error(e);
                    sink(new Bacon.Error(e));
                })
                .then(() => {
                    sink(new Bacon.Next(new ResetInsertionPointEvent()));
                    sink(new Bacon.Next(new UpdateProgressEvent(1)));
                    sink(new Bacon.Next(new SetUpdatingAllowed(true)));
                    sink(new Bacon.End());
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

    /* Check for updates immediately, without waiting for the
     * automatic update timer.
     */
    public checkForUpdates(): void {
        this.updateRequested.push(null);
    }

    /* Discard all the entries in the database and reload them from
     * the server.
     */
    public async refresh(): Promise<void> {
        /* Unplug the report source so that no report events will be
         * sent through the bus. */
        if (this.unplugReportSource) {
            this.unplugReportSource();
            this.unplugReportSource = undefined;
        }

        // Clear the database
        await this.database.clear();

        // Tell the report view to clear the report.
        this.reportEventBus.push(new ClearEntriesEvent());

        // Reload the report from the server.
        this.reportEventBus.plug(this.spawnReportSource());
    }
}
