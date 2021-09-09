import * as Bacon from 'baconjs';
import { Reveal } from 'foundation-sites';
import * as $ from 'jquery';
import '../pages.scss';
import './edit-filter-set.scss';
import 'assets/table/scrollable.scss';
import { parseHTML } from 'nicovideo/parse-html';
import htmlEditFilterSet from './edit-filter-set.html';

export class EditFilterEvent {}

class EditFilterSetView {
    private static _instance: EditFilterSetView;
    private readonly frag: DocumentFragment;
    private readonly divReveal: HTMLDivElement;
    private currentEventBus?: Bacon.Bus<EditFilterEvent>;

    public static get singleton(): EditFilterSetView {
        if (!this._instance) {
            this._instance = new EditFilterSetView();
        }
        return this._instance;
    }

    private constructor() {
        this.frag      = parseHTML(htmlEditFilterSet);
        this.divReveal = this.frag.querySelector<HTMLDivElement>("div.reveal")!;

        // Foundation uses jQuery events as opposed to the native DOM
        // events.
        $(this.divReveal).on("closed.zf.reveal", () => {
            this.closeEventBus();
        });
    }

    private closeEventBus() {
        if (this.currentEventBus) {
            this.currentEventBus.end();
            delete this.currentEventBus;
        }
    }

    public open(): Bacon.EventStream<EditFilterEvent> {
        this.closeEventBus();
        this.currentEventBus = new Bacon.Bus<EditFilterEvent>();

        if (document.getElementById("bnr-edit-filter-set")) {
            $(this.divReveal).foundation("open");
        }
        else {
            const body = document.querySelector<HTMLBodyElement>("body")!;
            body.appendChild(this.frag);

            new Reveal($(this.divReveal)).open();
        }

        return this.currentEventBus;
    }
}

/** Open up a modal dialog letting the user to edit the set of
 * filtering rules, and return a stream of editing events. The stream
 * will end when the user closes the modal.
 */
export function editFilterSet(): Bacon.EventStream<EditFilterEvent> {
    return EditFilterSetView.singleton.open();
}
