import '../pages.scss';
import { UnauthorizedError } from 'nicovideo/errors';
import { getReport } from 'nicovideo/report';
import { login } from 'nicovideo/auth';

window.addEventListener('DOMContentLoaded', async () => {
    /*
    try {
        await getReport();
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
