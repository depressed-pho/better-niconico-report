/** 302.5445864200931 → "5 min"
 */
export function abbreviateDuration(seconds: number, showMillisec = false): string {
    const elems = new Array<string>();
    if (seconds >= 60 * 60 * 24 * 7) {
        const weeks = Math.floor(seconds / (60 * 60 * 24 * 7));
        seconds -= 60 * 60 * 24 * 7 * weeks;
        elems.push(`${weeks} ` + (weeks == 1 ? "week" : "weeks"));
    }
    if (seconds >= 60 * 60 * 24) {
        const days = Math.floor(seconds / (60 * 60 * 24));
        seconds -= 60 * 60 * 24 * days;
        elems.push(`${days} ` + (days == 1 ? "day" : "days"));
    }
    if (seconds >= 60 * 60) {
        const hours = Math.floor(seconds / (60 * 60));
        seconds -= 60 * 60 * hours;
        elems.push(`${hours} ` + (hours == 1 ? "hour" : "hours"));
    }
    if (seconds >= 60) {
        const min = Math.floor(seconds / 60);
        seconds -= 60 * min;
        elems.push(`${min} min`);
    }
    if (showMillisec) {
        if (seconds >= 1) {
            const sec = Math.floor(seconds);
            seconds -= sec;
            elems.push(`${sec} sec`);
        }
        const ms = Math.floor(seconds * 1000);
        if (elems.length == 0 || ms > 0) {
            elems.push(`${Math.floor(seconds * 1000)} ms`);
        }
    }
    else {
        elems.push(`${Math.floor(seconds)} sec`);
    }
    return elems.join(" ");
}
