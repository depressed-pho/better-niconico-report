import 'foundation-sites';
import * as $ from 'jquery';
import '../pages.scss';
import './report.scss';
import { FilterRuleSet } from 'nicovideo/report/filter';
import { ConfigModel } from './config-model';
import { ResetInsertionPointEvent, InsertEntryEvent, DeleteEntryEvent,
         ShowEndOfReportEvent, ClearEntriesEvent, UpdateProgressEvent,
         SetUpdatingAllowed, ReportModel
       } from './report-model';
import { ReportView } from './report-view';
import { createFilter } from '../create-filter/create-filter';
import { editFilterSet } from '../edit-filter-set/edit-filter-set';
import { signIn } from '../sign-in/sign-in';

/* This is the entry point of /assets/pages/report/report.html and is
 * a controller in the MVC sense.
 */

window.addEventListener('DOMContentLoaded', async () => {
    $(document).foundation();

    const configModel = new ConfigModel();
    const filterRules = new FilterRuleSet();
    const reportModel = new ReportModel(configModel, filterRules, signIn);
    const reportView  = new ReportView();

    /* Setup handlers for UI events from ReportView. */
    reportView.updateRequested.onValue(() => reportModel.checkForUpdates());
    reportView.refreshRequested.onValue(() => reportModel.refresh());
    reportView.filterCreationRequested.onValue(async entry => {
        const ruleDesc = await createFilter(entry);
        if (ruleDesc) {
            const rule = await filterRules.add(ruleDesc);
            console.debug("A new filtering rule has been added:", rule);
            reportModel.refresh(false);
        }
    });

    reportView.editFilterSetRequested.onValue(async () => {
        const isUpdated = await editFilterSet(filterRules);
        if (isUpdated) {
            console.debug("The set of filtering rules has been updated. Reloading the report...");
            reportModel.refresh(false);
        }
    });

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
        else if (ev instanceof DeleteEntryEvent) {
            reportView.deleteEntry(ev.id);
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
        else if (ev instanceof SetUpdatingAllowed) {
            reportView.setUpdatingAllowed(ev.isAllowed);
        }
        else {
            throw new Error("Unknown type of ReportEvent: " + ev.constructor.name);
        }
    });

    reportView.lastVisibleEntryChanged.onValue(id => {
        configModel.setLastVisibleEntry(id);
    });
});
