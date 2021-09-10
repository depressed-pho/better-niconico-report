import * as Bacon from 'baconjs';
import { ReportID } from 'nicovideo/report';

/** Invariant: there is at most one instance of this class.
 */
export class ConfigModel {
    private readonly storage: Storage;

    /** The delay in seconds between fetching report chunks
     * consecutively from the server.
     */
    private readonly delayBetweenConsecutiveFetchBus: Bacon.Bus<number>;
    public  readonly delayBetweenConsecutiveFetch: Bacon.Property<number>;

    /** The intervals in seconds between polling updates from the
     * server.
     */
    private readonly intervalBetweenPollingBus: Bacon.Bus<number>;
    public  readonly intervalBetweenPolling: Bacon.Property<number>;

    public constructor() {
        this.storage = window.localStorage;

        /* Populate the storage with default values. */
        if (!this.storage.getItem("bnr.delay-between-consecutive-fetch")) {
            this.storage.setItem("bnr.delay-between-consecutive-fetch", String(1));
        }
        if (!this.storage.getItem("bnr.interval-between-polling")) {
            this.storage.setItem("bnr.interval-between-polling", String(5 * 60));
        }

        this.delayBetweenConsecutiveFetchBus = new Bacon.Bus<number>();
        this.delayBetweenConsecutiveFetch    =
            this.delayBetweenConsecutiveFetchBus
                .toProperty(
                    Number(this.storage.getItem("bnr.delay-between-consecutive-fetch")!));

        this.intervalBetweenPollingBus = new Bacon.Bus<number>();
        this.intervalBetweenPolling    =
            this.intervalBetweenPollingBus
                .toProperty(
                    Number(this.storage.getItem("bnr.interval-between-polling")!));
    }

    /* The ID of the report entry which was at least partially visible
     * last time the user scrolled or resized the window. It's null
     * when no reports were shown at all.
     */
    public getLastVisibleEntry(): ReportID|null {
        return this.storage.getItem("bnr.last-visible-entry");
    }

    public setLastVisibleEntry(id: ReportID|null): void {
        if (id) {
            this.storage.setItem("bnr.last-visible-entry", id);
        }
        else {
            this.storage.removeItem("bnr.last-visible-entry");
        }
    }
}
