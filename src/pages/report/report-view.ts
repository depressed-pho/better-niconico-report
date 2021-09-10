import * as Bacon from 'baconjs';
import { DropdownMenu } from 'foundation-sites';
import * as $ from 'jquery';
import { parseHTML } from 'nicovideo/parse-html';
import { ReportID, ReportEntry } from 'nicovideo/report';

const enum Visibility {
    AboveViewport,
    Visible,
    BelowViewport
}

/* Invariant: there is at most one instance of this class
 * throughout the lifetime of the report page.
 */
export class ReportView {
    /** Click events from the "Check for updates" button.
     */
    public readonly updateRequested: Bacon.EventStream<null>;

    /** Click events from menu items.
     */
    public readonly refreshRequested: Bacon.EventStream<null>;
    public readonly editFilterSetRequested: Bacon.EventStream<null>;
    public readonly editPrefsRequested: Bacon.EventStream<null>;
    public readonly signOutRequested: Bacon.EventStream<null>;
    private readonly filterCreationRequestedBus: Bacon.Bus<ReportEntry>;
    public get filterCreationRequested(): Bacon.EventStream<ReportEntry> {
        return this.filterCreationRequestedBus;
    }

    /** The number of pixels that the content of div.bnr-report is
     * scrolled vertically or the window is resized.
     */
    public readonly reportScrolled: Bacon.EventStream<number>;

    /** The ID of the last visible report entry in the
     * viewport. Updated when the viewport is resized or scrolled, but
     * not when an entry is inserted or removed.
     *
     * THINKME: This is also updated (to null) when the report list is
     * cleared, because that unintentionally triggers the DOM "scroll"
     * event. I can't think of a good way to get rid of that. */
    public readonly lastVisibleEntryChanged: Bacon.EventStream<ReportID|null>;

    private readonly btnUpdate: HTMLButtonElement;
    private readonly progLoading: HTMLProgressElement;
    private readonly tmplReport: HTMLTemplateElement;
    private readonly divReport: HTMLDivElement;
    private readonly divReportEntries: HTMLDivElement;
    private readonly divEndOfReport: HTMLDivElement;
    private reportInsertionPoint?: Element;

    public constructor(ctx = document) {
        const topBar          = document.querySelector<HTMLDivElement>("div.top-bar")!;
        this.btnUpdate        = document.querySelector<HTMLButtonElement>("button[data-for='check-for-updates']")!;
        this.updateRequested  = Bacon.fromEvent(this.btnUpdate, "click").map(Bacon.constant(null));
        const menuCtrl        = topBar.querySelector<HTMLElement>(".menu[data-for='control']")!;
        const miEditFilterSet = menuCtrl.querySelector<HTMLAnchorElement>("a[data-for='edit-filter-set']")!;
        this.editFilterSetRequested = Bacon.fromEvent(miEditFilterSet, "click").map(Bacon.constant(null));
        const miEditPrefs     = menuCtrl.querySelector<HTMLAnchorElement>("a[data-for='edit-preferences']")!;
        this.editPrefsRequested = Bacon.fromEvent(miEditPrefs, "click").map(Bacon.constant(null));
        const miRefresh       = menuCtrl.querySelector<HTMLAnchorElement>("a[data-for='refresh']")!;
        this.refreshRequested = Bacon.fromEvent(miRefresh, "click").map(Bacon.constant(null));
        const miSignOut       = menuCtrl.querySelector<HTMLAnchorElement>("a[data-for='sign-out']")!;
        this.signOutRequested = Bacon.fromEvent(miSignOut, "click").map(Bacon.constant(null));

        this.filterCreationRequestedBus = new Bacon.Bus<ReportEntry>();

        this.progLoading      = ctx.querySelector<HTMLProgressElement>("progress.bnr-loading-progress")!;
        this.tmplReport       = ctx.querySelector<HTMLTemplateElement>("template[data-for='report']")!;
        this.divReport        = ctx.querySelector<HTMLDivElement>("div.bnr-report")!;
        this.divReportEntries = ctx.querySelector<HTMLDivElement>("div.bnr-report-entries")!;
        this.divEndOfReport   = ctx.querySelector<HTMLDivElement>("div.bnr-end-of-report")!;

        this.reportScrolled =
            Bacon.mergeAll([
                Bacon.fromEvent(window, "resize"),
                Bacon.fromEvent(this.divReport, "scroll")
            ]).map(() => {
                return this.divReport.scrollTop;
            }).skipDuplicates();

        this.lastVisibleEntryChanged =
            this.reportScrolled
                .throttle(200)
                .map(() => {
                    return this.findLastVisibleEntry();
                })
                .skipDuplicates();
    }

    public resetInsertionPoint(): void {
        delete this.reportInsertionPoint;
    }

    public insertEntry(entry: ReportEntry) {
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
        console.assert(frag.children.length === 1, frag);
        const toplevel = frag.firstElementChild! as HTMLElement;
        toplevel.id         = `bnr.report.${entry.id}`;
        toplevel.dataset.id = entry.id;
        toplevel.classList.add(`bnr-activity-${entry.activity}`);

        const aUser = frag.querySelector<HTMLAnchorElement>("a.bnr-user")!
        aUser.href = entry.subject.url;

        const imgUser = frag.querySelector<HTMLImageElement>("img.bnr-user-icon")!;
        imgUser.src = entry.subject.iconURL;

        const spanUser = frag.querySelector<HTMLSpanElement>("span.bnr-user-name")!;
        spanUser.textContent = entry.subject.name;

        const miCreateFilter = frag.querySelector<HTMLAnchorElement>("a[data-for='create-filter']")!;
        miCreateFilter.addEventListener("click", () => {
            this.filterCreationRequestedBus.push(entry);
        });

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

    private findEntry(id: ReportID): Element|null {
        return this.divReport.ownerDocument.getElementById(`bnr.report.${id}`);
    }

    public deleteEntry(id: ReportID): void {
        const el = this.findEntry(id);
        if (el) {
            console.info("Report entry expired:", id);
            el.parentNode!.removeChild(el);
        }
    }

    public clearEntries() {
        this.divReportEntries.replaceChildren();
        delete this.reportInsertionPoint;
        this.divEndOfReport.classList.add("hide");
    }

    public showEndOfReport(): void {
        this.divEndOfReport.classList.remove("hide");
    }

    public updateProgress(progress: number) {
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

    /** Find the ID of the report entry which is fully visible now, or
     * null if no entries are shown at all. This method is very
     * frequently called so it needs to be fast.
     */
    private findLastVisibleEntry(): ReportID|null {
        /* Perform a binary search on the list of report entry
         * elements. Maybe this isn't fast enough, but I can't think
         * of a better way. */
        const elems = this.divReportEntries.children;

        if (elems.length == 0) {
            return null;
        }
        else {
            let rangeBegin = 0;              // inclusive
            let rangeEnd   = elems.length-1; // inclusive
            let foundElem: Element|null = null;
            loop: while (rangeBegin <= rangeEnd) {
                const needle = Math.floor((rangeBegin + rangeEnd) / 2);
                const elem   = elems[needle];
                const visibi = this.visibilityOfEntryElement(elem);
                switch (visibi) {
                    case Visibility.AboveViewport:
                        rangeBegin = needle + 1;
                        continue;

                    case Visibility.BelowViewport:
                        rangeEnd = needle - 1;
                        continue;

                    case Visibility.Visible:
                        foundElem = elem;
                        break loop;

                    default:
                        throw new Error("Unreachable!");
                }
            }
            if (foundElem) {
                /* So, we found a visible element but we still don't
                 * know if it's the last one (probably not). We just
                 * search for the last one linearly because there
                 * can't be hundreds of visible elements in the
                 * viewport. */
                let lastElem = foundElem;
                while (true) {
                    const nextElem = lastElem.nextElementSibling;
                    if (nextElem &&
                        this.visibilityOfEntryElement(nextElem) === Visibility.Visible) {
                        lastElem = nextElem;
                        continue;
                    }
                    else {
                        break;
                    }
                }
                return (lastElem as HTMLElement).dataset.id!;
            }
            else {
                /* There are some report entries but none are
                 * visible. This can only happen when the window is
                 * extremely narrow. */
                return null;
            }
        }
    }

    /** Check if a given element is fully visible. This is a faster
     * and simplified version of the solution shown in
     * https://stackoverflow.com/a/21627295 but exploits our specific
     * DOM structure.
     */
    private visibilityOfEntryElement(el: Element): Visibility {
        const elRect = el.getBoundingClientRect();
        const vpRect = this.divReport.getBoundingClientRect();

        if (elRect.top < vpRect.top) {
            /* The element is above the visible part of its scrollable
             * ancestor. */
            return Visibility.AboveViewport;
        }
        else if (elRect.bottom > vpRect.bottom) {
            /* The element is below the visible part of its scrollable
             * ancestor. */
            return Visibility.BelowViewport;
        }
        else {
            return Visibility.Visible;
        }
    }

    /** Scroll the report list so that the report entry with the given
     * ID is visible. Do nothing if no such report entries are there.
     */
    public scrollTo(id: ReportID): void {
        const el = this.findEntry(id);
        if (el) {
            el.scrollIntoView();
        }
    }

    public setUpdatingAllowed(isAllowed: boolean): void {
        if (isAllowed) {
            this.btnUpdate.classList.remove("disabled");
        }
        else {
            this.btnUpdate.classList.add("disabled");
        }
    }
}
