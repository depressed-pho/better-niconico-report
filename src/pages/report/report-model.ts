import * as Bacon from 'baconjs';
import { UnauthorizedError } from 'nicovideo/errors';
import { ReportID, ReportChunk, ReportEntry, getReportChunk } from 'nicovideo/report';

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

    public constructor(authenticate: () => Promise<void>) {
        this.reportEventBus = new Bacon.Bus<ReportEvent>();
        this.reportEvents   = this.reportEventBus.toEventStream();
        this.authenticate   = authenticate;

        /* When the report page is opened, we first read all the
         * report entries saved in IndexedDB before asking for updates
         * from the server. During that we also show the progress bar.
         */
        const fromDatabase  = this.readDatabase();
        const fromServer    = this.readServer();
        const initialEvents = fromDatabase;//FIXME
        this.unplugReportSource = this.reportEventBus.plug(initialEvents);
    }

    /** Create a stream of ReportEvent reading all the report entries
     * in database.
     */
    private readDatabase(): Bacon.EventStream<ReportEvent> {
        return Bacon.never<ReportEvent>();//FIXME
    }

    /** Create a stream of ReportEvent from FIXME
     */
    private readServer(): Bacon.EventStream<ReportEvent> {
        return Bacon.never<ReportEvent>();//FIXME
    }

    /** Create a singleton stream of ReportEntries with optionally
     * skipping down to a given ID. Invoke the authentication callback
     * when necessary.
     */
    private readChunkFromServer(skipDownTo?: ReportID): Bacon.EventStream<ReportChunk> {
        return Bacon.fromPromise((async () => {
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
        })());
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
        // FIXME: hide the progress bar

        // Tell the report view to clear the report.
        this.reportEventBus.push(new ClearEntriesEvent());

        // FIXME: reload from the server
    }

    // FIXME: remove this
    public test() {
        this.reportEventBus.push(new AppendEntryEvent({
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
}
