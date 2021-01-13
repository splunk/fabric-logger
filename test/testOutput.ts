import { Output, OutputMessage, MetricsMessage } from '../src/output';

export class TestOutput implements Output {
    public messages: OutputMessage[] = [];
    public metricsMessages: MetricsMessage[] = [];

    public async logEvent(msg: OutputMessage): Promise<void> {
        this.messages.push(msg);
    }

    public async logMultiMetrics(msg: MetricsMessage): Promise<void> {
        this.metricsMessages.push(msg);
    }

    public async shutdown(): Promise<void> {
        throw new Error('shutdown');
    }
}
