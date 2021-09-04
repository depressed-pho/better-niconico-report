import * as Bacon from 'baconjs';
import { ReportEntry } from 'nicovideo/report';

export class ReportEvent {}

export class AppendEntryEvent extends ReportEvent {
    public constructor(public readonly entry: ReportEntry) { super(); }
}

export class ReportModel {
    /* Events telling the ReportView to what to do about the entry
     * list. */
    private readonly reportEventBus: Bacon.Bus<ReportEvent>;
    public readonly reportEvents: Bacon.EventStream<ReportEvent>;

    public constructor() {
        this.reportEventBus = new Bacon.Bus<ReportEvent>();
        this.reportEvents   = this.reportEventBus.toEventStream();
    }

    // FIXME: remove this
    public test() {
        this.reportEventBus.push(new AppendEntryEvent({
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
        }));
    }
}
