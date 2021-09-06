import Dexie from 'dexie';
import { ReportID, ReportEntry } from 'nicovideo/report';

export class ReportDatabase extends Dexie {
    private readonly entries: Dexie.Table<ReportEntry, ReportID>;

    public constructor() {
        super("bnr.report");
        this.version(1).stores({
            entries: "id, timestamp"
        });
        this.entries = this.table("entries");
    }

    /* Dexie doesn't export its TransactioniMode type for whatever
     * reason. */
    public async tx<T>(mode: string, fn: () => Promise<T>): Promise<T> {
        return await this.transaction(mode as any, this.entries, fn);
    }

    /** Upsert entries in bulk. This isn't an atomic operation. Use
     * tx() if you want atomicity. */
    public async bulkPut(entries: ReportEntry[]): Promise<void> {
        await this.entries.bulkPut(entries);
    }

    /** Try inserting a report entry. Return true if it wasn't already
     * there, or false otherwise.
     */
    public async tryInsert(entry: ReportEntry): Promise<boolean> {
        try {
            await this.entries.add(entry);
            return true;
        }
        catch (e) {
            if (e instanceof Dexie.ConstraintError) {
                return false;
            }
            else {
                throw e;
            }
        }
    }

    /** Count the number of report entries. */
    public async count(): Promise<number> {
        return await this.entries.count();
    }

    /** Find the newest entry in the database, or null if no entries
     * are in the database.
     */
    public async newest(): Promise<ReportEntry|null> {
        const res = await this.entries.orderBy("timestamp").reverse().limit(1).toArray();
        return res.length ? res[0] : null;
    }

    /** Lookup an entry with the given ID in the database, or null if no
     * such entries are there.
     */
    public async lookup(id: ReportID): Promise<ReportEntry|null> {
        const res = await this.entries.get(id);
        return res ? res : null;
    }

    /** A variant of lookup() which returns boolean.
     */
    public async exists(id: ReportID): Promise<boolean> {
        return !!await this.lookup(id);
    }

    /** Iterate on all the report entries in the database, sorted by
     * their timestamp in the reverse order.
     */
    public async each(f: (entry: ReportEntry) => void): Promise<void> {
        await this.entries.orderBy("timestamp").reverse().each(f);
    }

    /** Iterate on report entries which are older than the given date,
     * and remove them from the database. The callback function can be
     * omitted.
     */
    public async purge(olderThan: Date, f?: (entry: ReportEntry) => void): Promise<void> {
        const coll = this.entries.where("timestamp").below(olderThan);
        if (f) {
            /* THINKME: Currently we can't use coll.modify() because
             * "delete ref.value" doesn't typecheck due to an issue in
             * its type signature. */
            await this.tx("rw", async () => {
                await coll.each(f);
                await coll.delete();
            });
        }
        else {
            await coll.delete();
        }
    }

    /** Clear the entire database. */
    public async clear(): Promise<void> {
        await this.entries.clear();
    }
}
