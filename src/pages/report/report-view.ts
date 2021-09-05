import { DropdownMenu } from 'foundation-sites';
import * as $ from 'jquery';
import { parseHTML } from 'nicovideo/parse-html';
import { ReportEntry } from 'nicovideo/report';
import { AppendEntryEvent, ClearEntriesEvent, ReportModel } from './report-model';

/* Invariant: there is at most one instance of this class
 * throughout the lifetime of the report page.
 */
export class ReportView {
    private readonly model: ReportModel;
    private readonly tmpl: HTMLTemplateElement;

    public constructor(model: ReportModel, ctx = document) {
        this.model = model;
        this.tmpl  = ctx.querySelector<HTMLTemplateElement>("template[data-for='report']")!;

        /* It is our responsible for interpreting the report events
         * coming from the model. */
        this.model.reportEvents.onValue(ev => {
            if (ev instanceof AppendEntryEvent) {
                this.appendEntry(ev.entry);
            }
            else if (ev instanceof ClearEntriesEvent) {
                this.clearEntries();
            }
            else {
                throw new Error("Unknown type of ReportEvent: " + ev.constructor.name);
            }
        });
    }

    private appendEntry(entry: ReportEntry) {
        const frag = this.renderEntry(entry);
        this.tmpl.parentNode!.appendChild(frag);
    }

    private renderEntry(entry: ReportEntry): DocumentFragment {
        const frag = this.tmpl.content.cloneNode(true) as DocumentFragment;

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
            divObject.style.display = "none";
        }

        // Setup a Foundation dropdown menu for muting.
        const menuMuting = frag.querySelector<HTMLElement>(".menu.bnr-muting")!;
        new DropdownMenu($(menuMuting))

        return frag;
    }

    private clearEntries() {
        const container = this.tmpl.parentNode!;
        for (const el of container.children) {
            if (el.localName != "template") {
                container.removeChild(el);
            }
        }
    }
}
