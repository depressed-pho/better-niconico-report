import 'foundation-sites';
import * as $ from 'jquery';
import '../pages.scss';
import './report.scss';
import { ConfigModel } from './config-model';
import { ReportModel } from './report-model';
import { ReportView } from './report-view';
import { signIn } from '../sign-in/sign-in';

/* This is the entry point of /assets/pages/report/report.html
 */

window.addEventListener('DOMContentLoaded', async () => {
    $(document).foundation();

    const configModel = new ConfigModel();
    const reportModel = new ReportModel(configModel, signIn);
    const reportView = new ReportView(reportModel);

    /* Setup the control menu on the top bar. */
    const menu      = document.querySelector<HTMLElement>(".menu[data-for='control']")!;
    const miRefresh = menu.querySelector<HTMLAnchorElement>("a[data-for='refresh']")!;
    miRefresh.addEventListener("click", () => reportModel.refresh());
});
