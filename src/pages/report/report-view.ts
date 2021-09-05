import { DropdownMenu } from 'foundation-sites';
import * as $ from 'jquery';
import { parseHTML } from 'nicovideo/parse-html';
import { ReportEntry } from 'nicovideo/report';
import { ResetInsertionPointEvent, InsertEntryEvent, ShowEndOfReportEvent,
         ClearEntriesEvent, UpdateProgressEvent, ReportModel
       } from './report-model';

/* Invariant: there is at most one instance of this class
 * throughout the lifetime of the report page.
 */
export class ReportView {
    private readonly model: ReportModel;
    private readonly progLoading: HTMLProgressElement;
    private readonly tmplReport: HTMLTemplateElement;
    private readonly divReport: HTMLDivElement;
    private readonly divReportEntries: HTMLDivElement;
    private readonly divEndOfReport: HTMLDivElement;
    private reportInsertionPoint?: Element;

    public constructor(model: ReportModel, ctx = document) {
        this.model            = model;
        this.progLoading      = ctx.querySelector<HTMLProgressElement>("progress.bnr-loading-progress")!;
        this.tmplReport       = ctx.querySelector<HTMLTemplateElement>("template[data-for='report']")!;
        this.divReport        = ctx.querySelector<HTMLDivElement>("div.bnr-report")!;
        this.divReportEntries = ctx.querySelector<HTMLDivElement>("div.bnr-report-entries")!;
        this.divEndOfReport   = ctx.querySelector<HTMLDivElement>("div.bnr-end-of-report")!;

        /* It is our responsible for interpreting the report events
         * coming from the model. */
        this.model.reportEvents.onValue(ev => {
            if (ev instanceof ResetInsertionPointEvent) {
                this.reportInsertionPoint = undefined;
            }
            else if (ev instanceof InsertEntryEvent) {
                this.insertEntry(ev.entry);
            }
            else if (ev instanceof ClearEntriesEvent) {
                this.clearEntries();
            }
            else if (ev instanceof ShowEndOfReportEvent) {
                this.divEndOfReport.classList.remove("hide");
            }
            else if (ev instanceof UpdateProgressEvent) {
                this.updateProgress(ev.progress);
            }
            else {
                throw new Error("Unknown type of ReportEvent: " + ev.constructor.name);
            }
        });
    }

    private insertEntry(entry: ReportEntry) {
        /* Inserting an element at somewhere not the bottom of the
         * page has an unwanted consequence: contents that the user is
         * currently looking at may suddenly move without their
         * intention, leading to misclicks that are extremely
         * frustrating. To prevent that from happening, we save the
         * total height of hidden areas before the insertion, and
         * correct the scroll position afterwards. */
        const curScrollPos     = this.divReport.scrollTop;
        const oldHiddenHeight  = this.divReport.scrollHeight - this.divReport.clientHeight;
        let   adjustmentNeeded = false;

        const frag = this.renderEntry(entry);
        if (this.reportInsertionPoint) {
            if (this.reportInsertionPoint.nextElementSibling) {
                // It's not the bottom.
                adjustmentNeeded = true;
            }
            this.reportInsertionPoint.after(frag);
            this.reportInsertionPoint = this.reportInsertionPoint.nextElementSibling!;
        }
        else {
            adjustmentNeeded = true; // It's always the bottom.
            this.divReportEntries.prepend(frag);
            this.reportInsertionPoint = this.divReportEntries.firstElementChild!;
        }

        if (adjustmentNeeded) {
            const newHiddenHeight = this.divReport.scrollHeight - this.divReport.clientHeight;
            this.divReport.scrollTop = curScrollPos + (newHiddenHeight - oldHiddenHeight);
        }
    }

    private renderEntry(entry: ReportEntry): DocumentFragment {
        const frag = this.tmplReport.content.cloneNode(true) as DocumentFragment;

        // Populate the contents of the entry.
        const aUser = frag.querySelector<HTMLAnchorElement>("a.bnr-user")!
        aUser.href = entry.subject.url;

        const imgUser = frag.querySelector<HTMLImageElement>("img.bnr-user-icon")!;
        imgUser.src = entry.subject.iconURL;

        const spanUser = frag.querySelector<HTMLSpanElement>("span.bnr-user-name")!;
        spanUser.textContent = entry.subject.name;

        const divTitle = frag.querySelector<HTMLDivElement>("div.bnr-report-title")!;
        divTitle.appendChild(parseHTML(entry.title));

        const divTimestamp = frag.querySelector<HTMLDivElement>("div.bnr-report-timestamp")!;
        divTimestamp.textContent = entry.timestamp.toLocaleString();

        if (entry.object) {
            for (const aObject of frag.querySelectorAll<HTMLAnchorElement>("a.bnr-object-anchor")) {
                aObject.href = entry.object.url;
            }

            const imgObjectThumb = frag.querySelector<HTMLImageElement>("img.bnr-object-thumb")!;
            imgObjectThumb.src = entry.object.thumbURL;

            function capitalize(str: string): string {
                return str.substring(0, 1).toUpperCase() + str.substring(1);
            }
            const spanObjectType = frag.querySelector<HTMLSpanElement>("span.bnr-object-type")!;
            spanObjectType.textContent = capitalize(entry.object.type);

            const spanObjectTitle = frag.querySelector<HTMLSpanElement>("span.bnr-object-title")!;
            spanObjectTitle.textContent = entry.object.title;
        }
        else {
            const divObject = frag.querySelector<HTMLDivElement>("div.bnr-object")!;
            divObject.classList.add("hide");
        }

        // Setup a Foundation dropdown menu for muting.
        const menuMuting = frag.querySelector<HTMLElement>(".menu.bnr-muting")!;
        new DropdownMenu($(menuMuting))

        return frag;
    }

    private clearEntries() {
        while (this.divReportEntries.firstChild) {
            this.divReportEntries.removeChild(this.divReportEntries.firstChild);
        }
        this.reportInsertionPoint = undefined;
        this.divEndOfReport.classList.add("hide");
    }

    private updateProgress(progress: number) {
        this.progLoading.value = progress;
        if (progress < 1) {
            if (!this.progLoading.classList.contains("bnr-fast-fade-in")) {
                this.progLoading.classList.add("bnr-fast-fade-in");
                this.progLoading.classList.remove("bnr-fast-fade-out");
                // The progress bar is initially hidden without transition.
                this.progLoading.classList.remove("bnr-transparent");
            }
        }
        else {
            if (!this.progLoading.classList.contains("bnr-fast-fade-out")) {
                this.progLoading.classList.add("bnr-fast-fade-out");
                this.progLoading.classList.remove("bnr-fast-fade-in");
            }
        }
    }
}
