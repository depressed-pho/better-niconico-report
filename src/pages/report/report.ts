import 'foundation-sites';
import * as $ from 'jquery';
import '../pages.scss';
import './report.scss';
import { UnauthorizedError } from 'nicovideo/errors';
import { ReportEntry, getReport } from 'nicovideo/report';
import { login } from 'nicovideo/auth';

window.addEventListener('DOMContentLoaded', async () => {
    $(document).foundation();
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
