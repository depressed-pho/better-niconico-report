import { Reveal } from 'foundation-sites';
import * as $ from 'jquery';
import './edit-filter-set.scss';
import 'assets/table/scrollable.scss';
import 'assets/table/selectable.scss';
import { parseHTML } from 'nicovideo/parse-html';
import { FilterAction, FilterRuleSet } from 'nicovideo/report/filter';
import htmlEditFilterSet from './edit-filter-set.html';

class EditFilterSetView {
    private static _instance: EditFilterSetView;
    private readonly frag: DocumentFragment;
    private readonly divReveal: HTMLDivElement;
    private readonly tbody: HTMLTableSectionElement;
    private readonly tmplRow: HTMLTemplateElement;
    private onClose?: (isUpdated: boolean) => void;
    private isUpdated: boolean;

    public static get singleton(): EditFilterSetView {
        if (!this._instance) {
            this._instance = new EditFilterSetView();
        }
        return this._instance;
    }

    private constructor() {
        this.frag      = parseHTML(htmlEditFilterSet);
        this.divReveal = this.frag.querySelector<HTMLDivElement>("div.reveal")!;
        this.tbody     = this.frag.querySelector<HTMLTableSectionElement>("table > tbody")!;
        this.tmplRow   = this.frag.querySelector<HTMLTemplateElement>("template[data-for='row']")!;
        this.isUpdated = false;

        // Foundation uses jQuery events as opposed to the native DOM
        // events.
        $(this.divReveal).on("closed.zf.reveal", () => {
            if (this.onClose) {
                this.onClose(this.isUpdated);
                delete this.onClose;
            }
            this.isUpdated = false;
        });
    }

    public async open(filterRules: FilterRuleSet, onClose: (isUpdated: boolean) => void): Promise<void> {
        this.onClose   = onClose;
        this.isUpdated = false;

        while (this.tbody.firstChild) {
            this.tbody.removeChild(this.tbody.firstChild);
        }
        for (const rule of await filterRules.toArray()) {
            /* For whatever reason, Node#cloneNode() returns Node, not
             * polymorphic this. Isn't this a bug? */
            const row = this.tmplRow.content.cloneNode(true) as DocumentFragment;

            // Is it selected?
            const tr = row.querySelector<HTMLTableRowElement>("tr")!;
            if (false) { // FIXME
                tr.classList.add("bnr-selected");
            }
            tr.addEventListener("click", () => {
                // Select it when clicked.
                // FIXME
            });

            // Rule
            const colRule    = row.querySelector<HTMLTableDataCellElement>("tr > td.bnr-rule")!;

            const spanAction = colRule.querySelector<HTMLSpanElement>("span[data-for='action']")!;
            const tmplAction = rule.action === FilterAction.Show ?
                spanAction.querySelector<HTMLTemplateElement>("template[data-for='show']")! :
                spanAction.querySelector<HTMLTemplateElement>("template[data-for='hide']")!;
            while (spanAction.firstChild) { // Remove templates
                spanAction.removeChild(spanAction.firstChild);
            }
            spanAction.appendChild(tmplAction.content);

            const spanSubject = colRule.querySelector<HTMLSpanElement>("span[data-for='subject']")!;
            const tmplUser    = spanSubject.querySelector<HTMLTemplateElement>("template[data-for='user']")!;
            const tmplAny     = spanSubject.querySelector<HTMLTemplateElement>("template[data-for='any']")!;
            while (spanSubject.firstChild) { // Remove templates
                spanSubject.removeChild(spanSubject.firstChild);
            }
            if (rule.subject) {
                const frag     = tmplUser.content;

                const aUser    = frag.querySelector<HTMLAnchorElement>("a.bnr-user")!;
                aUser.href     = rule.subject.url;

                const imgUser  = frag.querySelector<HTMLImageElement>("img.bnr-user-icon")!;
                imgUser.src    = rule.subject.iconURL;

                const spanUser = frag.querySelector<HTMLSpanElement>("span.bnr-user-name")!;
                spanUser.textContent = rule.subject.name;

                spanSubject.appendChild(frag);
            }
            else {
                spanSubject.appendChild(tmplAny.content);
            }

            const spanActivity = colRule.querySelector<HTMLSpanElement>("span[data-for='activity']")!;
            const tmplActivity = rule.activity ?
                spanActivity.querySelector<HTMLTemplateElement>(`template[data-for='${rule.activity}']`)! :
                spanActivity.querySelector<HTMLTemplateElement>("template[data-for='any']")!;
            while (spanActivity.firstChild) { // Remove templates
                spanActivity.removeChild(spanActivity.firstChild);
            }
            spanActivity.appendChild(tmplActivity.content);

            const spanObjectType = colRule.querySelector<HTMLSpanElement>("span[data-for='object-type']")!;
            const tmplObjectType = rule.object ?
                spanObjectType.querySelector<HTMLTemplateElement>(`template[data-for='${rule.object}']`)! :
                spanObjectType.querySelector<HTMLTemplateElement>("template[data-for='any']")!;
            while (spanObjectType.firstChild) { // Remove templates
                spanObjectType.removeChild(spanObjectType.firstChild);
            }
            spanObjectType.appendChild(tmplObjectType.content);

            // #Fired
            const colNumFired = row.querySelector<HTMLTableDataCellElement>("tr > td.bnr-num-fired")!;
            colNumFired.textContent = String(rule.numFired);

            // Last fired
            const colLastFired = row.querySelector<HTMLTableDataCellElement>("tr > td.bnr-last-fired")!;
            colLastFired.textContent = rule.lastFired ? rule.lastFired.toLocaleString() : '';

            this.tbody.appendChild(row);
        }

        if (document.getElementById("bnr-edit-filter-set")) {
            $(this.divReveal).foundation("open");
        }
        else {
            const body = document.querySelector<HTMLBodyElement>("body")!;
            body.appendChild(this.frag);

            new Reveal($(this.divReveal)).open();
        }
    }
}

/** Open up a modal dialog letting the user to edit the set of
 * filtering rules, and return a Promise which fulfills with true if
 * the set of rules is modified, or false otherwise. */
export function editFilterSet(filterRules: FilterRuleSet): Promise<boolean> {
    return new Promise((resolve) => {
        EditFilterSetView.singleton.open(filterRules, resolve);
    });
}
