import formurlencoded from 'form-urlencoded';
import { UnauthorizedError } from 'nicovideo/errors';

export async function login(user: string, password: string): Promise<void> {
    const URL = "https://account.nicovideo.jp/api/v1/login?site=niconico&mail_or_tel=1";
    const res = await fetch(URL, {
        method: "POST",
        mode: "cors",
        redirect: "follow",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formurlencoded({
            "current_form": "login_form",
            "mail_tel": user,
            "password": password,
            "login__submit": "Login"
        })
    });
    /* The server wants us to redirect to https://www.nicovideo.jp/ on
     * a success, and a login form on a failure. */
    if (/\/login\?/.test(res.url)) {
        throw new UnauthorizedError("Authentication failed");
    }
}
