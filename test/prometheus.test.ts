import { debug } from 'debug';
import { loadFabricloggerConfig, CliFlags } from '../src/config';
import { TestOutput } from './testOutput';
import { PrometheusMetricsScraper } from '../src/prometheus';

beforeAll(() => {
    debug.log = () => {
        // ignore
    };
});

test('prometheusNoDiscover', async () => {
    const output = new TestOutput();
    const config = await loadFabricloggerConfig({
        'config-file': './test/config/test.fabriclogger.yaml',
    } as CliFlags);
    const networkConfig = './test/config/test.network.yaml';
    const prometheus = new PrometheusMetricsScraper(config.prometheus, networkConfig, output);
    jest.spyOn(prometheus, 'checkAvailable').mockImplementation(() => Promise.resolve(true));
    await prometheus.initScrapers();

    expect(prometheus.hasPrometheusEndpointScraper('http://orderer1.example.com:7060/metrics')).toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://orderer2.example.com:7080/metrics')).not.toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://peer1.org0.example.com:7061/metrics')).toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://peer3.org0.example.com:7081/metrics')).not.toBeTruthy();
});

test('prometheusDiscoverUnavailable', async () => {
    const output = new TestOutput();
    const config = await loadFabricloggerConfig({
        'config-file': './test/config/test.fabriclogger_discover.yaml',
    } as CliFlags);
    const networkConfig = './test/config/test.network.yaml';
    const prometheus = new PrometheusMetricsScraper(config.prometheus, networkConfig, output);
    jest.spyOn(prometheus, 'checkAvailable').mockImplementation(() => Promise.resolve(false));
    await prometheus.initScrapers();

    expect(prometheus.hasPrometheusEndpointScraper('http://orderer1.example.com:7060/metrics')).toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://orderer2.example.com:7080/metrics')).not.toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://peer1.org0.example.com:7061/metrics')).toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://peer3.org0.example.com:7081/metrics')).not.toBeTruthy();
});

test('prometheusDiscoverAvailable', async () => {
    const output = new TestOutput();
    const config = await loadFabricloggerConfig({
        'config-file': './test/config/test.fabriclogger_discover.yaml',
    } as CliFlags);
    const networkConfig = './test/config/test.network.yaml';
    const prometheus = new PrometheusMetricsScraper(config.prometheus, networkConfig, output);
    jest.spyOn(prometheus, 'checkAvailable').mockImplementation(() => Promise.resolve(true));
    await prometheus.initScrapers();

    expect(prometheus.hasPrometheusEndpointScraper('http://orderer1.example.com:7060/metrics')).toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://peer1.org0.example.com:7061/metrics')).toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://peer1.org0.example.com:7081/metrics')).toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://peer2.org0.example.com:7081/metrics')).toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://peer3.org0.example.com:7081/metrics')).toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://orderer1.example.com:7080/metrics')).toBeTruthy();
    expect(prometheus.hasPrometheusEndpointScraper('http://orderer2.example.com:7080/metrics')).toBeTruthy();
});
