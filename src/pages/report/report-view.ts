import * as Bacon from 'baconjs';
import { DropdownMenu } from 'foundation-sites';
import * as $ from 'jquery';
import { parseHTML } from 'nicovideo/parse-html';
import { ReportID, ReportEntry } from 'nicovideo/report';

enum Visibility {
    AboveViewport,
    Visible,
    BelowViewport
}

/* Invariant: there is at most one instance of this class
 * throughout the lifetime of the report page.
 */
export class ReportView {
    /** Click events from menu items.
     */
    public readonly ctrlRefresh: Bacon.EventStream<null>;

    /** The ID of the last visible report entry in the
     * viewport. Updated when the contents of the viewport changes,
     * including resizing and scrolling the window.
     */
    public readonly lastVisibleEntry: Bacon.Property<ReportID|null>;
    private readonly entryAddedOrRemovedBus: Bacon.Bus<null>;

    private readonly progLoading: HTMLProgressElement;
    private readonly tmplReport: HTMLTemplateElement;
    private readonly divReport: HTMLDivElement;
    private readonly divReportEntries: HTMLDivElement;
    private readonly divEndOfReport: HTMLDivElement;
    private reportInsertionPoint?: Element;

    public constructor(ctx = document) {
        const menu       = document.querySelector<HTMLElement>(".menu[data-for='control']")!;
        const miRefresh  = menu.querySelector<HTMLAnchorElement>("a[data-for='refresh']")!;
        this.ctrlRefresh = Bacon.fromEvent(miRefresh, "click").map(Bacon.constant(null));

        this.progLoading      = ctx.querySelector<HTMLProgressElement>("progress.bnr-loading-progress")!;
        this.tmplReport       = ctx.querySelector<HTMLTemplateElement>("template[data-for='report']")!;
        this.divReport        = ctx.querySelector<HTMLDivElement>("div.bnr-report")!;
        this.divReportEntries = ctx.querySelector<HTMLDivElement>("div.bnr-report-entries")!;
        this.divEndOfReport   = ctx.querySelector<HTMLDivElement>("div.bnr-end-of-report")!;

        this.entryAddedOrRemovedBus = new Bacon.Bus<null>();
        this.lastVisibleEntry =
            Bacon.mergeAll([
                Bacon.mergeAll([
                    Bacon.fromEvent(window, "resize"),
                    Bacon.fromEvent(this.divReport, "scroll")
                ]).throttle(200),
                this.entryAddedOrRemovedBus
            ]).map(() => {
                return this.findLastVisibleEntry();
            }).skipDuplicates().toProperty(null);
    }

    public resetInsertionPoint(): void {
        this.reportInsertionPoint = undefined;
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

        this.entryAddedOrRemovedBus.push(null);
    }

    private renderEntry(entry: ReportEntry): DocumentFragment {
        const frag = this.tmplReport.content.cloneNode(true) as DocumentFragment;

        // Populate the contents of the entry.
        console.assert(frag.children.length === 1, frag);
        const toplevel = frag.firstElementChild! as HTMLElement;
        toplevel.dataset.id        = entry.id;
        toplevel.dataset.timestamp = entry.timestamp.toISOString();

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

    public clearEntries() {
        while (this.divReportEntries.firstChild) {
            this.divReportEntries.removeChild(this.divReportEntries.firstChild);
        }
        this.reportInsertionPoint = undefined;
        this.divEndOfReport.classList.add("hide");
        this.entryAddedOrRemovedBus.push(null);
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

    /** Find the ID of the report entry which is at least partially
     * visible now, or null if no entries are shown at all. This
     * method is very frequently called so it needs to be fast.
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

    /** Check if a given element is at least partially visible. This
     * is a faster and simplified version of the solution shown in
     * https://stackoverflow.com/a/21627295 but exploits our specific
     * DOM structure.
     */
    private visibilityOfEntryElement(el: Element): Visibility {
        const elRect = el.getBoundingClientRect();
        const vpRect = this.divReport.getBoundingClientRect();

        if (elRect.bottom < vpRect.top) {
            /* The element is above the visible part of its scrollable
             * ancestor. */
            return Visibility.AboveViewport;
        }
        else if (elRect.top > vpRect.bottom) {
            /* The element is below the visible part of its scrollable
             * ancestor. */
            return Visibility.BelowViewport;
        }
        else {
            return Visibility.Visible;
        }
    }
}
