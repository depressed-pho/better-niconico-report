import { DropdownMenu } from 'foundation-sites';
import * as $ from 'jquery';
import '../pages.scss';
import './report.scss';
import { UnauthorizedError } from 'nicovideo/errors';
import { ReportEntry, getReport } from 'nicovideo/report';
import { signIn } from '../sign-in/sign-in';

function appendEntry(entry: ReportEntry) {
    const tmpl = document.querySelector<HTMLTemplateElement>("template[data-for='report']")!;
    const frag = tmpl.content.cloneNode(true) as DocumentFragment;

    // Populate the contents of the entry.
    const aUser = frag.querySelector<HTMLAnchorElement>("a.bnr-user")!
    aUser.href = entry.subject.url;

    const imgUser = frag.querySelector<HTMLImageElement>("img.bnr-user-icon")!;
    imgUser.src = entry.subject.iconURL;

    const spanUser = frag.querySelector<HTMLSpanElement>("span.bnr-user-name")!;
    spanUser.textContent = entry.subject.name;

    const divTitle = frag.querySelector<HTMLDivElement>("div.bnr-report-title")!;
    divTitle.textContent = entry.title;

    const divTimestamp = frag.querySelector<HTMLDivElement>("div.bnr-report-timestamp")!;
    divTimestamp.textContent = entry.timestamp.toLocaleString();

    for (let aObject of frag.querySelectorAll<HTMLAnchorElement>("a.bnr-object")) {
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

    // Setup a Foundation dropdown menu for muting.
    const menuMuting = frag.querySelector<HTMLElement>(".menu.bnr-muting")!;
    new DropdownMenu($(menuMuting))

    // Then finally attach it to the DOM tree.
    tmpl.parentNode!.appendChild(frag);
}

window.addEventListener('DOMContentLoaded', async () => {
    $(document).foundation();
    await signIn();// FIXME: delete this

    appendEntry({
        id: "",
        title: "did something",
        timestamp: new Date(),
        subject: {
            id: "64011",
            url: "https://www.nicovideo.jp/user/64011",
            name: "玉ねぎ修字",
            iconURL: "https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/6/64011.jpg?1559446191"
        },
        action: "liked",
        object: {
            type: "video",
            url: "https://www.nicovideo.jp/watch/sm38451158?ref=pc_mypage_nicorepo",
            title: "クッキーク六花ー",
            thumbURL: "https://nicovideo.cdn.nimg.jp/thumbnails/38451158/38451158.6981162.M"
        }
    });

    /*
    try {
        console.log(await getReport());
    }
    catch (e) {
        if (e instanceof UnauthorizedError) {
            //await login("foo@example.com", "bar");
        }
        else {
            throw e;
        }
    }
    */
});
