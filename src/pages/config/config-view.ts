import * as Bacon from 'baconjs';
import { abbreviateDuration } from 'nicovideo/abbreviate-duration';
import { ConfigModel } from './config-model';

// Unit: seconds
const pollingIntervalMin = 30;
const pollingIntervalMax = 24 * 60 * 60;
const fetchDelayMin = 0.5;
const fetchDelayMax = 10;

/* Invariant: there is at most one instance of this class
 * throughout the lifetime of the config page.
 */
export class ConfigView {
    private readonly model: ConfigModel;

    private readonly slidPollingInterval: HTMLInputElement;
    private readonly valPollingInterval: HTMLElement;
    private readonly slidFetchDelay: HTMLInputElement;
    private readonly valFetchDelay: HTMLElement;
    private readonly btnResetToDefault: HTMLButtonElement;

    public constructor(model: ConfigModel, ctx = document) {
        this.model = model;

        this.slidPollingInterval = ctx.querySelector<HTMLInputElement>("#polling-interval-slider")!;
        this.valPollingInterval  = ctx.querySelector<HTMLElement>("#polling-interval-value")!;
        this.slidFetchDelay      = ctx.querySelector<HTMLInputElement>("#fetch-delay-slider")!;
        this.valFetchDelay       = ctx.querySelector<HTMLElement>("#fetch-delay-value")!;
        this.btnResetToDefault   = ctx.querySelector<HTMLButtonElement>("#reset-to-default")!;

        /* Setup the polling interval slider. We need to reinterpret
         * its value here. What we need is a slider which moves from
         * 30 seconds to 86400 seconds (1 day) exponentially, but what
         * we have is a slider moving from 0.0 to 1.0 linearly.
         *
         * 30^1 = 30 (minimum)
         * 30^x = 86400 (maximum) ∴ x = log_30 86400
         *
         * So we just need to remap [0, 1] to [1, log_30 86400]. Also
         * note that log_30 86400 = ln 86400 / ln 30. The only thing
         * left is that we also want to interpret the maximum value as
         * +∞ i.e. "never".
         */
        const exponentialPollingInterval = () => {
            const value = this.slidPollingInterval.valueAsNumber;
            return value >= 1.0 ? null
                : linearToExponential(
                    value, pollingIntervalMin, pollingIntervalMax);
        };
        Bacon.fromEvent(this.slidPollingInterval, "input")
            .throttle(50)
            .map(() => exponentialPollingInterval())
            .merge(this.model.pollingInterval.toEventStream())
            .onValue(x => {
                this.valPollingInterval.textContent =
                    x == null
                    ? this.valPollingInterval.dataset.disabledLabel!
                    : abbreviateDuration(x);
            });
        Bacon.fromEvent(this.slidPollingInterval, "change")
            .map(() => exponentialPollingInterval())
            .onValue(x => {
                this.model.setPollingInterval(x);
            });

        /* And now we need to do the opposite. The slider value has to
         * synchronize with the corresponding property in the model.
         *
         * log_30 30 = 1 (minimum)
         * log_30 86400 (maximum)
         *
         * So we remap [1, 86400] to [0, 1] by computing log_30 of the
         * interval.
         */
        this.model.pollingInterval
            .map(value => {
                return value == null ? 1.0
                    : exponentialToLinear(
                        value, pollingIntervalMin, pollingIntervalMax);
            })
            .onValue(x => this.slidPollingInterval.valueAsNumber = x);

        /* Do mostly the same for the fetch delay slider.
         */
        const exponentialFetchDelay = () => {
            const value = this.slidFetchDelay.valueAsNumber;
            return linearToExponential(value, fetchDelayMin, fetchDelayMax);
        };
        Bacon.fromEvent(this.slidFetchDelay, "input")
            .throttle(50)
            .map(() => exponentialFetchDelay())
            .merge(this.model.fetchDelay.toEventStream())
            .onValue(x => {
                this.valFetchDelay.textContent = abbreviateDuration(x, true);
            });
        Bacon.fromEvent(this.slidFetchDelay, "change")
            .map(() => exponentialFetchDelay())
            .onValue(x => {
                this.model.setFetchDelay(x);
            });
        this.model.fetchDelay
            .map(value => {
                return exponentialToLinear(
                    value, fetchDelayMin, fetchDelayMax);
            })
            .onValue(x => this.slidFetchDelay.valueAsNumber = x);

        // The reset button is nothing special.
        Bacon.fromEvent(this.btnResetToDefault, "click")
            .onValue(() => this.model.resetToDefault());
    }
}

/* The slider value is assumed to be in [0, 1]. */
function linearToExponential(value: number, min: number, max: number): number {
    const powBase = min;
    const expMax  = Math.log(max) / Math.log(powBase);
    const powExp  = 1 + (expMax - 1) * value;
    return Math.pow(powBase, powExp);
}

function exponentialToLinear(value: number, min: number, max: number): number {
    /* Maybe there is a better way than this? I'm bad at math. */
    const logBase  = min;
    const logMax   = Math.log(max  ) / Math.log(logBase);
    const logValue = Math.log(value) / Math.log(logBase);
    return (logValue - 1) / (logMax - 1);
}
