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
        if (this.subject && this.subject.id != entry.subject.id) {
            return null;
        }
        else if (this.activity && this.activity != entry.activity) {
            return null;
        }
        else if (this.object && entry.object && this.object != entry.object.type) {
            return null;
        }
        else {
            return this.recordFired().action;
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

    /** Return the number of rules. */
    public async count(): Promise<number> {
        if (this.cachedRules) {
            return this.cachedRules.length;
        }
        else {
            return await this.rules.count();
        }
    }

    /** Find a rule by its ID, or raise an error if not found.
     */
    public async get(id: FilterRuleID): Promise<FilterRule> {
        if (this.cachedRules) {
            const rule = this.cachedRules.find(rule => rule.id === id);
            if (rule) {
                return rule;
            }
        }
        else {
            const rule = await this.rules.get(id);
            if (rule) {
                return rule;
            }
        }
        throw new Error(`Rule not found: ${id}`);
    }

    /** Return an Array of all the existing rules, sorted by their
     * priority in descending order.
     */
    public async toArray(): Promise<FilterRule[]> {
        if (!this.cachedRules) {
            this.cachedRules = await this.rules.orderBy("priority").reverse().toArray();
        }
        return this.cachedRules;
    }

    /** Add a new filtering rule described as an IFilterRule, and
     * returns a proper FilterRule object.
     */
    public async add(rule: IFilterRule): Promise<FilterRule> {
        return await this.transaction("rw?", this.rules, async () => {
            /* First we need to find out which priority to use. */
            const arr = await this.rules.orderBy("priority").reverse().limit(1).toArray();
            const pri = arr.length ? arr[0].priority+1 : 0;

            /* Now we can construct a proper FilterRule object. */
            const obj = new FilterRule(rule, pri);

            /* Save it in the table, then clear the cache. */
            await this.rules.add(obj);
            delete this.cachedRules;

            return obj;
        });
    }

    /** Remove a rule with the given ID. Raise no errors even if no
     * such rules exist.
     */
    public async remove(id: FilterRuleID) {
        await this.rules.delete(id);
        delete this.cachedRules;
    }

    /** Swap priorities of two rules.
     */
    public async swap(idA: FilterRuleID, idB: FilterRuleID) {
        await this.transaction("rw?", this.rules, async () => {
            /* We cannot just update the rule objects because that
             * would temporarily violate the uniqueness constraint. So
             * we first remove one of the rules from the table. */
            const ruleA = await this.get(idA);
            const ruleB = await this.get(idB);
            const tmp   = ruleA.priority;
            ruleA.priority = ruleB.priority;
            ruleB.priority = tmp;
            await this.rules.delete(idA);
            await this.rules.put(ruleB);
            await this.rules.add(ruleA);
            delete this.cachedRules;
        });
    }
}
