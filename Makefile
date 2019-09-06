clean:
	rm -R build/

build:
	mkdir -p build
	helm lint helm-chart/fabric-logger && helm package -d build helm-chart/fabric-logger

