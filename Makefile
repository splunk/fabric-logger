build:
	@mkdir -p build
	@helm package -d build helm-chart/fabric-logger-helm

