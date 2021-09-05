import * as Bacon from 'baconjs';
import { ReportID } from 'nicovideo/report';

export interface ReportVisibility {
    id: ReportID,
    fromTop: number // [0, 1]
}

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

    /** The ID of the report entry which was at least partially
     * visible last time a new report entry was inserted, or the user
     * scrolled or resized the window. It becomes null when no reports
     * were shown at all.
     */
    private readonly lastVisibleReportBus: Bacon.Bus<ReportVisibility|null>;
    public  readonly lastVisibleReport: Bacon.Property<ReportVisibility|null>;

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

        this.lastVisibleReportBus = new Bacon.Bus<ReportVisibility|null>();
        this.lastVisibleReport    =
            this.lastVisibleReportBus
                .toProperty(
                    (() => {
                        const id      = this.storage.getItem("bnr.last-visible-report.id");
                        const fromTop = this.storage.getItem("bnr.last-visible-report.from-top");

                        if (id == null || fromTop == null) {
                            return null;
                        }
                        else {
                            return {id, fromTop: Number(fromTop)};
                        }
                    })());
    }
}
