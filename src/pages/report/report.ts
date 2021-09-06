import 'foundation-sites';
import * as $ from 'jquery';
import '../pages.scss';
import './report.scss';
import { ConfigModel } from './config-model';
import { ResetInsertionPointEvent, InsertEntryEvent, ShowEndOfReportEvent,
         ClearEntriesEvent, UpdateProgressEvent, ReportModel
       } from './report-model';
import { ReportView } from './report-view';
import { signIn } from '../sign-in/sign-in';

/* This is the entry point of /assets/pages/report/report.html and is
 * a controller in the MVC sense.
 */

window.addEventListener('DOMContentLoaded', async () => {
    $(document).foundation();

    const configModel = new ConfigModel();
    const reportModel = new ReportModel(configModel, signIn);
    const reportView = new ReportView();

    /* Setup the control menu on the top bar. */
    reportView.ctrlRefresh.onValue(() => reportModel.refresh());

    /* It is our responsible for interpreting the report events coming
     * from the model. */
    reportModel.reportEvents.onValue(ev => {
        if (ev instanceof ResetInsertionPointEvent) {
            reportView.resetInsertionPoint();
        }
        else if (ev instanceof InsertEntryEvent) {
            reportView.insertEntry(ev.entry);

            const lastVis = configModel.getLastVisibleEntry();
            if (lastVis && ev.entry.id == lastVis) {
                reportView.scrollTo(lastVis);
            }
        }
        else if (ev instanceof ClearEntriesEvent) {
            reportView.clearEntries();
        }
        else if (ev instanceof ShowEndOfReportEvent) {
            reportView.showEndOfReport();
        }
        else if (ev instanceof UpdateProgressEvent) {
            reportView.updateProgress(ev.progress);
        }
        else {
            throw new Error("Unknown type of ReportEvent: " + ev.constructor.name);
        }
    });

    reportView.lastVisibleEntryChanged.onValue(id => {
        configModel.setLastVisibleEntry(id);
    });
});
