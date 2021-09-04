import 'foundation-sites';
import * as $ from 'jquery';
import '../pages.scss';
import './report.scss';
import { ReportModel } from './report-model';
import { ReportView } from './report-view';

import { signIn } from '../sign-in/sign-in';//FIXME: delete this

/* This is the entry point of /assets/pages/report/report.html
 */

window.addEventListener('DOMContentLoaded', async () => {
    $(document).foundation();
    //await signIn();// FIXME: delete this

    const reportModel = new ReportModel();
    const reportView = new ReportView(reportModel);
    reportModel.test();//FIXME: delete this

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
