import Dexie from 'dexie';
import * as uuid from 'uuid';
import { User, Activity, ObjectType, ReportEntry } from 'nicovideo/report';

export const enum FilterAction {
    Show = "show",
    Hide = "hide"
}

export type FilterRuleID = string; // UUID v1

export interface IFilterRule {
    action: FilterAction,
    subject?: User,      /// undefined means "any"
    activity?: Activity, /// undefined means "any"
    object?: ObjectType  /// undefined means "any"
}

export class FilterRule implements IFilterRule {
    /** The rule identifier */
    public readonly id: FilterRuleID;

    /** The priority of this rule, which is a non-negative
     * integer. The larger the value is, the more the rule is
     * prioritized. This has to be unique in a rule set. */
    public priority: number;

    /** The number of times this filter has been determined an
     * action. */
    public numFired: number;

    /** The time when the last time this filter has fired. */
    public lastFired?: Date;

    // Properties from IFilterRule
    public action: FilterAction;
    public subject?: User;
    public activity?: Activity;
    public object?: ObjectType;

    public constructor(rule: IFilterRule, priority: number) {
        this.id       = uuid.v1();
        this.priority = priority;
        this.numFired = 0;

        this.action   = rule.action;
        this.subject  = rule.subject;
        this.activity = rule.activity;
        this.object   = rule.object;
    }

    /** Apply the filtering rule to the given report entry. Return
     * null when undecidable.
     */
    public apply(entry: ReportEntry): FilterAction|null {
        if (this.subject && this.subject.id == entry.subject.id) {
            return this.recordFired().action;
        }
        else if (this.activity && this.activity == entry.activity) {
            return this.recordFired().action;
        }
        else if (this.object && entry.object && this.object == entry.object.type) {
            return this.recordFired().action;
        }
        else {
            return null;
        }
    }

    private recordFired(): this {
        this.numFired++;
        this.lastFired = new Date();
        return this;
    }
}

/** An ordered set of FilterRule, ordered by their priority. The rules
 * are stored in IndexedDB.
 */
export class FilterRuleSet extends Dexie {
    private readonly rules: Dexie.Table<FilterRule, FilterRuleID>;
    private cachedRules?: FilterRule[];

    public constructor() {
        super("bnr.filter-rules");
        this.version(1).stores({
            rules: "id, &priority"
        });
        this.rules = this.table("rules");
        this.rules.mapToClass(FilterRule);
    }

    /** Apply the filtering rules to the given report entry. Return
     * FilterAction.Show if no rules apply.
     */
    public async apply(entry: ReportEntry): Promise<FilterAction> {
        return await this.transaction("rw?", this.rules, async () => {
            for (const rule of await this.toArray()) {
                const action = rule.apply(entry);
                if (action) {
                    await this.rules.put(rule);
                    return action;
                }
            }
            return FilterAction.Show;
        });
    }

    /** Return an Array of all the existing rules, sorted by their
     * priority in descending order. */
    public async toArray(): Promise<FilterRule[]> {
        if (!this.cachedRules) {
            this.cachedRules = await this.rules.orderBy("priority").reverse().toArray();
        }
        return this.cachedRules;
    }
}
