import 'foundation-sites';
import * as $ from 'jquery';
import '../pages.scss';
import './report.scss';
import { ReportModel } from './report-model';
import { ReportView } from './report-view';
import { signIn } from '../sign-in/sign-in';

/* This is the entry point of /assets/pages/report/report.html
 */

window.addEventListener('DOMContentLoaded', async () => {
    $(document).foundation();
    //await signIn();// FIXME: delete this

    const reportModel = new ReportModel(signIn);
    const reportView = new ReportView(reportModel);
    reportModel.test();//FIXME: delete this

    /* Setup the control menu on the top bar. */
    const menu      = document.querySelector<HTMLElement>(".menu[data-for='control']")!;
    const miRefresh = menu.querySelector<HTMLAnchorElement>("a[data-for='refresh']")!;
    miRefresh.addEventListener("click", () => reportModel.refresh());

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
