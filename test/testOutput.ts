import { Output, OutputMessage } from '../src/output';

export class TestOutput implements Output {
    public messages: OutputMessage[] = [];

    public async logEvent(msg: OutputMessage): Promise<void> {
        this.messages.push(msg);
    }

    public async shutdown(): Promise<void> {
        throw new Error('shutdown');
    }
}
