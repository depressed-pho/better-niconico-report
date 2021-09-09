import { Reveal } from 'foundation-sites';
import * as $ from 'jquery';
import './create-filter.scss';
import { parseHTML } from 'nicovideo/parse-html';
import { Activity, ObjectType, ReportEntry } from 'nicovideo/report';
import { FilterAction, IFilterRule } from 'nicovideo/report/filter';
import htmlCreateFilter from './create-filter.html';

class CreateFilterView {
    private static _instance: CreateFilterView;
    private readonly frag: DocumentFragment;
    private readonly divReveal: HTMLDivElement;
    private readonly form: HTMLFormElement;
    private readonly selAction: HTMLSelectElement;
    private readonly selSubject: HTMLSelectElement;
    private readonly optUser: HTMLOptionElement;
    private readonly selActivity: HTMLSelectElement;
    private readonly selObjectType: HTMLSelectElement;
    private readonly divWarning: HTMLDivElement;
    private readonly divWarnings: NodeListOf<HTMLDivElement>;
    private readonly btnCancel: HTMLButtonElement;
    private readonly btnSubmit: HTMLButtonElement;
    private entry?: ReportEntry;
    private onClose?: (rule?: IFilterRule) => void;

    public static get singleton(): CreateFilterView {
        if (!this._instance) {
            this._instance = new CreateFilterView();
        }
        return this._instance;
    }

    private constructor() {
        this.frag          = parseHTML(htmlCreateFilter);
        this.divReveal     = this.frag.querySelector<HTMLDivElement>("div.reveal")!;
        this.form          = this.frag.querySelector<HTMLFormElement>("form")!;
        this.selAction     = this.form.querySelector<HTMLSelectElement>("select[name='action']")!;
        this.selSubject    = this.form.querySelector<HTMLSelectElement>("select[name='subject']")!;
        this.optUser       = this.selSubject.querySelector<HTMLOptionElement>("option[value='user']")!;
        this.selActivity   = this.form.querySelector<HTMLSelectElement>("select[name='activity']")!;
        this.selObjectType = this.form.querySelector<HTMLSelectElement>("select[name='object-type']")!;
        this.divWarning    = this.form.querySelector<HTMLDivElement>("div.warning")!;
        this.divWarnings   = this.divWarning.querySelectorAll<HTMLParagraphElement>(":scope > div");
        this.btnCancel     = this.form.querySelector<HTMLButtonElement>("button.secondary")!;
        this.btnSubmit     = this.form.querySelector<HTMLButtonElement>("button[type='submit']")!;

        this.selAction    .addEventListener("change", () => this.warnIfNeeded());
        this.selSubject   .addEventListener("change", () => this.warnIfNeeded());
        this.selActivity  .addEventListener("change", () => this.warnIfNeeded());
        this.selObjectType.addEventListener("change", () => this.warnIfNeeded());

        this.btnCancel.addEventListener("click", () => this.close());
        this.btnSubmit.addEventListener("click", ev => {
            ev.preventDefault();
            this.submit();
        });

        // Foundation uses jQuery events as opposed to the native DOM
        // events.
        $(this.divReveal).on("closed.zf.reveal", () => {
            if (this.onClose) {
                this.onClose(undefined);
            }
        });
    }

    public open(entry: ReportEntry, onClose: (rule?: IFilterRule) => void): void {
        this.entry   = entry;
        this.onClose = onClose;

        this.selAction.value     = "hide";
        this.selSubject.value    = "user";
        this.optUser.text        = entry.subject.name;
        this.selActivity.value   = entry.activity === "unknown" ? "any" : entry.activity;
        if (entry.object) {
            this.selObjectType.value = entry.object.type === "unknown" ? "any" : entry.object.type;
        }
        else {
            this.selObjectType.value = "any";
        }
        this.warn(null);

        if (document.getElementById("bnr-create-filter")) {
            $(this.divReveal).foundation("open");
        }
        else {
            const body = document.querySelector<HTMLBodyElement>("body")!;
            body.appendChild(this.frag);

            new Reveal($(this.divReveal)).open();
        }
    }

    private toRule(): IFilterRule {
        if (this.entry) {
            const rule: IFilterRule = {
                action: this.selAction.value == "show"
                    ? FilterAction.Show : FilterAction.Hide
            };
            if (this.selSubject.value == "user") {
                rule.subject = this.entry.subject;
            }
            if (this.selActivity.value != "any") {
                rule.activity = this.selActivity.value as Activity;
            }
            if (this.selObjectType.value != "any") {
                rule.object = this.selObjectType.value as ObjectType;
            }
            return rule;
        }
        else {
            throw new Error("No entries have been set.");
        }
    }

    private warnIfNeeded() {
        const rule = this.toRule();

        if (rule.action == FilterAction.Hide && !rule.subject && !rule.activity && !rule.object) {
            this.warn("hiding-everything");
        }
        else if (rule.action == FilterAction.Hide && !rule.activity && !rule.object) {
            this.warn("hiding-everything-about-user");
        }
        else {
            this.warn(null);
        }
    }

    private warn(warningID: string|null) {
        if (this.entry) {
            if (warningID) {
                for (const div of this.divWarnings) {
                    if (div.dataset.for === warningID) {
                        for (const aUser of
                             div.querySelectorAll<HTMLAnchorElement>("a.bnr-user")) {
                            aUser.href = this.entry.subject.url;
                        }
                        for (const imgUserIcon of
                             div.querySelectorAll<HTMLImageElement>("img.bnr-user-icon")) {
                            imgUserIcon.src = this.entry.subject.iconURL;
                        }
                        for (const spanUserName of
                             div.querySelectorAll<HTMLSpanElement>("span.bnr-user-name")) {
                            spanUserName.textContent = this.entry.subject.name;
                        }
                        div.classList.remove("hide");
                    }
                    else {
                        div.classList.add("hide");
                    }
                }
                this.divWarning.classList.remove("hide");
            }
            else {
                this.divWarning.classList.add("hide");
            }
        }
        else {
            throw new Error("No entries have been set.");
        }
    }

    private close() {
        $(this.divReveal).foundation("close");
    }

    private submit() {
        if (this.onClose) {
            this.onClose(this.toRule());
            delete this.onClose;
        }
        this.close();
    }
}

/** Open up a modal dialog letting the user to create a filter from a
 * report entry, wait for user input and fulfill when it succeeds. The
 * promise fulfills with "undefined" when the user cancels the modal.
 */
export function createFilter(entry: ReportEntry): Promise<IFilterRule|undefined> {
    return new Promise((resolve) => {
        CreateFilterView.singleton.open(entry, resolve);
    });
}
