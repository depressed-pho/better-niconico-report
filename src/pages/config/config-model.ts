import * as Bacon from 'baconjs';
import { ReportID } from 'nicovideo/report';

// Unit: seconds
const defaultPollingInterval = 5 * 60;
const defaultFetchDelay      = 1;

const keyPollingInterval  = "bnr.polling-interval";
const keyFetchDelay       = "bnr.fetch-delay";
const keyLastVisibleEntry = "bnr.last-visible-entry";

/** Invariant: there is at most one instance of this class.
 */
export class ConfigModel {
    private readonly storage: Storage;

    /** The intervals in seconds between polling updates from the
     * server. When it's null the polling is disabled.
     */
    private readonly pollingIntervalBus: Bacon.Bus<number|null>;
    public  readonly pollingInterval: Bacon.Property<number|null>;

    /** The delay in seconds between fetching report chunks
     * consecutively from the server.
     */
    private readonly fetchDelayBus: Bacon.Bus<number>;
    public  readonly fetchDelay: Bacon.Property<number>;

    public constructor() {
        this.storage = window.localStorage;

        /* Populate the storage with default values. */
        if (!this.storage.getItem(keyPollingInterval)) {
            this.storage.setItem(keyPollingInterval, String(defaultPollingInterval));
        }
        if (!this.storage.getItem(keyFetchDelay)) {
            this.storage.setItem(keyFetchDelay, String(defaultFetchDelay));
        }

        this.pollingIntervalBus = new Bacon.Bus<number|null>();
        this.pollingInterval    =
            this.pollingIntervalBus
                .toProperty(
                    (() => {
                        const val = this.storage.getItem(keyPollingInterval)!;
                        return val == "null" ? null : Number(val);
                    })());

        this.fetchDelayBus = new Bacon.Bus<number>();
        this.fetchDelay    =
            this.fetchDelayBus
                .toProperty(
                    Number(this.storage.getItem(keyFetchDelay)!));

        /* The report page and the "Options page" are separate
         * documents so they don't share the same object of this
         * class. Listen to StorageEvent to notice the changes made
         * remotely. */
        window.addEventListener("storage", (ev: StorageEvent) => {
            switch (ev.key) {
                case keyPollingInterval:
                    this.pollingIntervalBus.push(
                        ev.newValue == "null" ? null : Number(ev.newValue));
                    break;

                case keyFetchDelay:
                    this.fetchDelayBus.push(Number(ev.newValue));
                    break;
            }
        });
    }

    public setPollingInterval(interval: number|null) {
        this.storage.setItem(keyPollingInterval, String(interval));
        this.pollingIntervalBus.push(interval);
    }

    public setFetchDelay(delay: number) {
        this.storage.setItem(keyFetchDelay, String(delay));
        this.fetchDelayBus.push(delay);
    }

    /* The ID of the report entry which was at least partially visible
     * last time the user scrolled or resized the window. It's null
     * when no reports were shown at all.
     */
    public getLastVisibleEntry(): ReportID|null {
        return this.storage.getItem(keyLastVisibleEntry);
    }

    public setLastVisibleEntry(id: ReportID|null): void {
        if (id) {
            this.storage.setItem(keyLastVisibleEntry, id);
        }
        else {
            this.storage.removeItem(keyLastVisibleEntry);
        }
    }

    /* Reset configurations that have a default value to the default.
     */
    public resetToDefault() {
        this.setPollingInterval(defaultPollingInterval);
        this.setFetchDelay(defaultFetchDelay);
    }
}
